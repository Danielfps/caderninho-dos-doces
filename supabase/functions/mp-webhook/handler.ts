import { estornoDePagamento, isUuid, lerNotificacaoPagamento, lerReferenciaAntiga, validarXSignature } from "../_shared/assinatura.mjs";
import { sincronizarContratacao } from "../_shared/contratacao.ts";
import { processarPagamento } from "../_shared/pagamentos.ts";
import { chamarMercadoPago, carregarConfig, MercadoPagoError, responderJson, rpcService, type Config } from "../_shared/servidor.ts";

async function lerContratacao(config: Config, filtro: string, valor: string) {
  // Assinatura de fora deste sistema: sem isso o banco recusa o valor e o aviso seria reenviado para sempre.
  if (!valor || (filtro === "id" && !isUuid(valor))) return null;
  const q = new URLSearchParams({ select: "*", [filtro]: `eq.${valor}`, limit: "1" });
  const res = await fetch(`${config.supabaseUrl}/rest/v1/contratacoes?${q}`, {
    headers: { apikey: config.serviceKey, Authorization: `Bearer ${config.serviceKey}` },
  });
  if (!res.ok) throw new Error(`Falha ao localizar contratação (${res.status})`);
  const rows = await res.json();
  return Array.isArray(rows) ? rows[0] ?? null : null;
}

function eventoChave(tipo: string, id: string, requestId: string) {
  return `${tipo}:${id}:${requestId}`.slice(0, 300);
}

async function tratarAviso(config: Config, tipo: string, id: string) {
  if (tipo === "subscription_preapproval") {
    const mp = await chamarMercadoPago(config, `/preapproval/${encodeURIComponent(id)}`);
    if (String(mp?.collector_id ?? "") !== config.mpCollectorId) return "collector_invalido";
    const row = mp?.preapproval_plan_id
      ? await lerContratacao(config, "mp_plano_id", String(mp.preapproval_plan_id))
      : await lerContratacao(config, "id", String(mp?.external_reference ?? ""));
    if (!row) return "contratacao_ausente";
    await sincronizarContratacao(config, row);
    return "ok";
  }
  if (tipo === "subscription_authorized_payment") {
    const fatura = await chamarMercadoPago(config, `/authorized_payments/${encodeURIComponent(id)}`);
    const row = await lerContratacao(config, "id", String(fatura?.external_reference ?? ""));
    if (!row) return "contratacao_ausente";
    await sincronizarContratacao(config, row);
    return "ok";
  }
  if (tipo === "payment") {
    const pagamento = await chamarMercadoPago(config, `/v1/payments/${encodeURIComponent(id)}`);
    if (String(pagamento?.collector_id ?? "") !== config.mpCollectorId) return "collector_invalido";
    const ref = String(pagamento?.external_reference ?? "");
    const antiga = lerReferenciaAntiga(ref);
    if (antiga) {
      await processarPagamento(config, pagamento);
      return "ok";
    }
    // Estorno vale pelo pagamento lido agora: a fatura pode demorar a mudar ou nem mudar.
    if (estornoDePagamento(pagamento?.status)) {
      await rpcService(config, "estornar_por_pagamento", { p_pagamento: String(pagamento?.id ?? ""), p_status: String(pagamento?.status) });
    }
    const row = await lerContratacao(config, "id", ref);
    if (!row) return "contratacao_ausente";
    await sincronizarContratacao(config, row);
    return "ok";
  }
  return "ignorado";
}

export async function tratar(req: Request): Promise<Response> {
  const config = carregarConfig();
  if (req.method !== "POST") return responderJson(req, config, 400, { erro: "pedido" });
  if (!config) return responderJson(req, config, 500, { erro: "config" });
  const secret = Deno.env.get("MP_WEBHOOK_SECRET");
  if (!secret) return responderJson(req, config, 500, { erro: "config" });
  let body: any = {};
  try { body = await req.json(); } catch { body = {}; }
  const url = new URL(req.url);
  const { id, tipo } = lerNotificacaoPagamento(url, body);
  const requestId = req.headers.get("x-request-id") ?? "";
  const valido = await validarXSignature({ id, requestId, header: req.headers.get("x-signature"), secret });
  if (!valido) {
    console.warn("Aviso recusado: assinatura inválida", { tipo, request_id: requestId.slice(0, 80) });
    return responderJson(req, config, 401, { erro: "assinatura_invalida" });
  }
  const chave = eventoChave(tipo, id, requestId);
  try {
    const evento = await rpcService(config, "registrar_evento", {
      p_chave: chave, p_tipo: tipo || "desconhecido", p_acao: String(body?.action ?? "").slice(0, 80), p_mp_id: id, p_ao_vivo: body?.live_mode === true,
    });
    if (!evento?.novo && ["ok", "ignorado"].includes(evento?.resultado)) {
      return responderJson(req, config, 200, { ok: true });
    }
    if (!["subscription_preapproval", "subscription_authorized_payment", "payment"].includes(tipo)) {
      await rpcService(config, "concluir_evento", { p_chave: chave, p_resultado: "ignorado", p_detalhe: "topico_ignorado" });
      return responderJson(req, config, 200, { ok: true });
    }
    const resultado = await tratarAviso(config, tipo, id);
    const ok = resultado === "ok";
    await rpcService(config, "concluir_evento", {
      p_chave: chave, p_resultado: ok ? "ok" : "ignorado", p_detalhe: ok ? "processado" : resultado,
    });
    return responderJson(req, config, 200, { ok: true });
  } catch (error) {
    let detalhe = "erro_processamento";
    if (error instanceof MercadoPagoError && error.status === 404) detalhe = "mp_404";
    else console.error("Falha ao processar aviso do Mercado Pago", error instanceof MercadoPagoError ? { status: error.status } : { tipo: error instanceof Error ? error.name : "erro" });
    await rpcService(config, "concluir_evento", { p_chave: chave, p_resultado: "erro", p_detalhe: detalhe });
    if (error instanceof MercadoPagoError && error.status === 404) return responderJson(req, config, 200, { ok: true });
    return responderJson(req, config, 502, { erro: "mp_falhou" });
  }
}
