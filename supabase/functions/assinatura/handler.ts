import { consultarPagamentos } from "../_shared/pagamentos.ts";
import {
  cancelar as cancelarContratacao,
  contaTemContratacao,
  ContratacaoError,
  iniciar,
  listarContratacoesUsuario,
  sincronizarContratacao,
} from "../_shared/contratacao.ts";
import {
  AuthIndisponivelError,
  autenticar,
  carregarConfig,
  CodigoPendenteError,
  EmailPendenteError,
  MercadoPagoError,
  minhaSituacao,
  responderJson,
  responderOptions,
} from "../_shared/servidor.ts";

export async function tratar(req: Request): Promise<Response> {
  const config = carregarConfig();
  if (req.method === "OPTIONS") return responderOptions(req, config);
  if (req.method !== "POST") return responderJson(req, config, 400, { erro: "pedido" });
  if (!config) return responderJson(req, config, 500, { erro: "config" });
  let body: any;
  try { body = await req.json(); }
  catch { return responderJson(req, config, 400, { erro: "pedido" }); }
  if (!body || typeof body !== "object" || Array.isArray(body)
    || !["criar", "conferir", "cancelar"].includes(body.acao)) return responderJson(req, config, 400, { erro: "pedido" });

  let user;
  try { user = await autenticar(req, config); }
  catch (error) {
    if (error instanceof CodigoPendenteError) return responderJson(req, config, 403, { erro: "insufficient_aal" });
    if (error instanceof EmailPendenteError) return responderJson(req, config, 403, { erro: "sem_email" });
    if (error instanceof AuthIndisponivelError) return responderJson(req, config, 503, { erro: "servico" });
    return responderJson(req, config, 401, { erro: "sem_login" });
  }
  if (!user) return responderJson(req, config, 401, { erro: "sem_login" });

  try {
    if (body.acao === "criar") {
      if (body.plano !== "mensal" && body.plano !== "anual") return responderJson(req, config, 400, { erro: "pedido" });
      const resultado = await iniciar(config, user, body.plano, body.volta);
      return responderJson(req, config, 200, resultado);
    }

    if (body.acao === "cancelar") {
      await cancelarContratacao(config, user.id);
      const situacao = await minhaSituacao(config, user.authorization);
      return responderJson(req, config, 200, { situacao });
    }

    // Mercado Pago fora do ar não pode impedir o app de ler a situação que já está no banco.
    const agora = Date.now();
    let conferenciaOk = true;
    for (const row of await listarContratacoesUsuario(config, user.id)) {
      const sincronizada = Date.parse(String(row.sincronizada_em ?? "")) || 0;
      if (agora - sincronizada < 4000 && !row.conferencia_falhou && !row.cancelamento_pendente) continue;
      try { await sincronizarContratacao(config, row); }
      catch (error) {
        conferenciaOk = false;
        console.error("Não consegui conferir uma contratação", {
          contratacao_id: String(row.id), tipo: error instanceof Error ? error.name : "erro",
          status: error instanceof MercadoPagoError ? error.status : undefined,
        });
      }
    }
    if (!await contaTemContratacao(config, user.id)) await consultarPagamentos(config, user.id, body.pagamento_id);
    const situacao = await minhaSituacao(config, user.authorization);
    return responderJson(req, config, 200, { situacao, conferencia_ok: conferenciaOk });
  } catch (error) {
    if (error instanceof ContratacaoError) return responderJson(req, config, error.status, { erro: error.codigo });
    console.error("Falha na função assinatura", error instanceof MercadoPagoError ? { tipo: error.name, status: error.status } : { tipo: error instanceof Error ? error.name : "erro", motivo: error instanceof Error ? error.message.slice(0, 200) : "" });
    const mpFalhou = error instanceof MercadoPagoError;
    return responderJson(req, config, mpFalhou ? 502 : 500, { erro: mpFalhou ? "mp_falhou" : "config" });
  }
}
