import {
  buscarPreapprovals,
  cancelarDuplicadas,
  carregarConfig,
  chamarMercadoPago,
  gravarAssinatura,
  lerAssinatura,
  responderJson,
} from "../_shared/servidor.ts";
import { criarManifestoWebhook, isUuid, mapearStatusMercadoPago, validadeNaoEncurtada } from "../_shared/assinatura.mjs";

function lerAssinaturaHeader(valor: string | null) {
  const partes = new Map<string, string>();
  for (const parte of (valor ?? "").split(",")) {
    const [chave, ...resto] = parte.trim().split("=");
    if (chave && resto.length) partes.set(chave, resto.join("="));
  }
  const ts = partes.get("ts");
  const v1 = partes.get("v1");
  return ts && v1 ? { ts, v1 } : null;
}

function compararConstante(a: string, b: string) {
  if (!/^[0-9a-f]+$/i.test(a) || !/^[0-9a-f]+$/i.test(b) || a.length !== b.length) return false;
  let diferenca = 0;
  for (let i = 0; i < a.length; i++) diferenca |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diferenca === 0;
}

async function validarAssinatura(req: Request, id: string, secret: string) {
  const pares = lerAssinaturaHeader(req.headers.get("x-signature"));
  const requestId = req.headers.get("x-request-id");
  if (!pares || !requestId) return false;
  const manifesto = criarManifestoWebhook({ id, requestId, ts: pares.ts });
  const chave = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const assinatura = await crypto.subtle.sign("HMAC", chave, new TextEncoder().encode(manifesto));
  const calculada = Array.from(new Uint8Array(assinatura), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return compararConstante(calculada, pares.v1);
}

Deno.serve(async (req) => {
  const config = carregarConfig();
  if (req.method !== "POST") return responderJson(req, config, 400, { erro: "pedido" });
  if (!config) return responderJson(req, config, 500, { erro: "config" });
  const secret = Deno.env.get("MP_WEBHOOK_SECRET");
  if (!secret) return responderJson(req, config, 500, { erro: "config" });

  const url = new URL(req.url);
  const id = url.searchParams.get("data.id") ?? "";
  const topic = url.searchParams.get("type") ?? url.searchParams.get("topic") ?? "";
  if (!id || !(await validarAssinatura(req, id, secret))) {
    return responderJson(req, config, 401, { erro: "assinatura_invalida" });
  }
  if (topic !== "subscription_preapproval" && topic !== "subscription_authorized_payment") {
    return responderJson(req, config, 200, { ok: true });
  }

  try {
    let preapprovalId = id;
    if (topic === "subscription_authorized_payment") {
      const pagamento = await chamarMercadoPago(config, `/authorized_payments/${encodeURIComponent(id)}`);
      if (!pagamento?.preapproval_id) return responderJson(req, config, 200, { ok: true });
      preapprovalId = String(pagamento.preapproval_id);
    }
    let preapproval = await chamarMercadoPago(config, `/preapproval/${encodeURIComponent(preapprovalId)}`);
    if (!isUuid(preapproval?.external_reference)) return responderJson(req, config, 200, { ok: true });
    // Pagamento autorizado: confere se a conta ficou com duas assinaturas autorizadas (duas cobranças) e cancela a
    // duplicada. Fica sempre a mais antiga, então dois avisos ao mesmo tempo escolhem a mesma.
    if (String(preapproval.status ?? "").toLowerCase() === "authorized") {
      try {
        const lista = await buscarPreapprovals(config, preapproval.external_reference);
        if (!lista.some((p: any) => String(p.id) === String(preapproval.id))) lista.push(preapproval);
        const manter = await cancelarDuplicadas(config, lista);
        if (manter && String(manter.id) !== String(preapproval.id)) preapproval = manter;
      } catch (error) {
        console.error("Não consegui conferir assinaturas duplicadas", error);
      }
    }
    const status = mapearStatusMercadoPago(preapproval.status);
    if (!status) return responderJson(req, config, 200, { ok: true });

    const userId = preapproval.external_reference;
    const atual = await lerAssinatura(config, userId);
    // Aviso de outro link da mesma conta: só vale se for de pagamento autorizado (ex.: pagou pelo primeiro link aberto).
    // Aviso antigo de link pendente ou cancelado não rebaixa a assinatura guardada.
    if (atual?.mp_preapproval_id && atual.mp_preapproval_id !== String(preapproval.id) && status !== "ativa") {
      return responderJson(req, config, 200, { ok: true });
    }
    const validoAte = validadeNaoEncurtada(status, atual?.valido_ate, preapproval.next_payment_date ?? null);
    const statusFinal = atual?.status === "ativa" && status === "pendente" ? "ativa" : status;
    await gravarAssinatura(config, userId, {
      status: statusFinal,
      valido_ate: validoAte,
      mp_preapproval_id: String(preapproval.id),
      atualizado_em: new Date().toISOString(),
    });
    return responderJson(req, config, 200, { ok: true });
  } catch (error) {
    console.error("Falha ao processar webhook do Mercado Pago", error);
    return responderJson(req, config, 502, { erro: "mp_falhou" });
  }
});
