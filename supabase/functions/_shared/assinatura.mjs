const ESTORNOS = new Set(["refunded", "charged_back", "cancelled", "canceled"]);

export function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value ?? ""));
}

export function mapearStatusMercadoPago(status, cobranca = null) {
  const st = String(status ?? "").toLowerCase();
  if (st === "authorized") {
    if (cobranca?.estado === "aprovada") return "ativa";
    if (cobranca?.estado === "recusada") return "falha_pagamento";
    return "aguardando_pagamento";
  }
  if (st === "paused") return "pausada";
  if (st === "cancelled" || st === "canceled") return "cancelada";
  if (st === "finished" || st === "expired") return "encerrada";
  if (st === "pending") return "checkout_pendente";
  return null;
}

export function lerQuantidadeCobrada(preapproval) {
  const quantidade = Number(preapproval?.summarized?.charged_quantity ?? 0);
  return Number.isFinite(quantidade) ? quantidade : 0;
}

export function lerFatura(fatura) {
  if (!fatura || typeof fatura !== "object") return null;
  const pagamento = fatura.payment && typeof fatura.payment === "object" ? fatura.payment : {};
  const status = String(fatura.status ?? "").toLowerCase();
  const pagamentoStatus = String(pagamento.status ?? "").toLowerCase();
  let estado = "pendente";
  if (ESTORNOS.has(pagamentoStatus) || ESTORNOS.has(status)) estado = "estornada";
  else if (status === "processed" && pagamentoStatus === "approved") estado = "aprovada";
  else if (status === "rejected" || pagamentoStatus === "rejected" || pagamentoStatus === "cancelled" || pagamentoStatus === "canceled") estado = "recusada";
  const valor = Number(fatura.transaction_amount ?? fatura.summarized?.transaction_amount ?? fatura.summarized?.total);
  return {
    id: String(fatura.id ?? ""),
    contratacaoId: String(fatura.preapproval_id ?? ""),
    pagamentoId: pagamento.id == null ? null : String(pagamento.id),
    estado,
    status,
    pagamentoStatus: pagamentoStatus || null,
    valor: Number.isFinite(valor) ? valor : 0,
    moeda: String(fatura.currency_id ?? fatura.summarized?.currency_id ?? "").toUpperCase(),
    debitadaEm: fatura.debit_date ?? fatura.date_created ?? null,
  };
}

export function criarManifestoWebhook({ id, requestId, ts }) {
  const partes = [];
  if (id !== undefined && id !== null && String(id) !== "") partes.push(`id:${String(id).toLowerCase()};`);
  if (requestId !== undefined && requestId !== null && String(requestId) !== "") partes.push(`request-id:${String(requestId)};`);
  if (ts !== undefined && ts !== null && String(ts) !== "") partes.push(`ts:${String(ts)};`);
  return partes.join("");
}

function assinaturaPartes(value) {
  const out = {};
  for (const fragmento of String(value ?? "").split(",")) {
    const i = fragmento.indexOf("=");
    if (i > 0) out[fragmento.slice(0, i).trim()] = fragmento.slice(i + 1).trim();
  }
  return out;
}

function compararHexConstante(a, b) {
  if (!/^[0-9a-f]{64}$/i.test(a) || !/^[0-9a-f]{64}$/i.test(b)) return false;
  let diferenca = 0;
  for (let i = 0; i < a.length; i++) diferenca |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diferenca === 0;
}

export async function validarXSignature({ id, requestId, header, secret }) {
  if (!id || !secret) return false;
  const partes = assinaturaPartes(header);
  if (!partes.ts || !partes.v1) return false;
  const manifesto = criarManifestoWebhook({ id, requestId, ts: partes.ts });
  if (!manifesto) return false;
  const chave = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = await crypto.subtle.sign("HMAC", chave, new TextEncoder().encode(manifesto));
  const esperado = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return compararHexConstante(esperado, partes.v1);
}

export function textoReason(plano, valorInicial, valorRecorrente) {
  const brl = (valor) => `R$ ${Number(valor).toFixed(2).replace(".", ",")}`;
  if (plano === "mensal") {
    return Number(valorInicial) < Number(valorRecorrente)
      ? `Caderninho de Fiado: 1º mês ${brl(valorInicial)}, depois ${brl(valorRecorrente)}/mês`
      : `Caderninho de Fiado: assinatura mensal ${brl(valorRecorrente)}`;
  }
  if (plano === "anual") return `Caderninho de Fiado: plano anual ${brl(valorRecorrente)}/ano`;
  throw new TypeError("Plano inválido");
}

export function lerReferenciaAntiga(ref) {
  const texto = String(ref ?? "");
  const i = texto.indexOf(":");
  if (i < 0) return null;
  const plano = texto.slice(0, i);
  const userId = texto.slice(i + 1);
  return (plano === "mensal" || plano === "anual") && isUuid(userId) ? { plano, userId } : null;
}

// Compatibilidade do caminho legado de pagamentos únicos.
export function lerReferencia(ref) { return lerReferenciaAntiga(ref); }
export function referenciaDaConta(ref, userId) {
  const r = lerReferenciaAntiga(ref);
  return r?.userId === String(userId ?? "") ? r : null;
}
export function pagamentoValido(pagamento, { mensalMinimo = 0, anual = 0 } = {}) {
  const referencia = lerReferenciaAntiga(pagamento?.external_reference);
  if (!referencia || String(pagamento?.currency_id ?? "").toUpperCase() !== "BRL") {
    return { valido: false, aprovado: false, estornado: false, ...referencia };
  }
  const status = String(pagamento?.status ?? "").toLowerCase();
  if (ESTORNOS.has(status)) return { valido: true, aprovado: false, estornado: true, ...referencia };
  if (status !== "approved") return { valido: false, aprovado: false, estornado: false, ...referencia };
  const minimo = Number(referencia.plano === "mensal" ? mensalMinimo : anual);
  const valor = Number(pagamento?.transaction_amount);
  const aprovado = Number.isFinite(minimo) && minimo > 0 && Number.isFinite(valor) && valor >= minimo;
  return { valido: aprovado, aprovado, estornado: false, ...referencia };
}
export function lerNotificacaoPagamento(url, corpo = {}) {
  const endereco = url instanceof URL ? url : new URL(String(url), "https://caderninho.invalid");
  const id = endereco.searchParams.get("data.id") ?? endereco.searchParams.get("id")
    ?? corpo?.data?.id ?? corpo?.["data.id"] ?? corpo?.id ?? "";
  const tipo = endereco.searchParams.get("type") ?? endereco.searchParams.get("topic")
    ?? corpo?.type ?? corpo?.topic ?? "";
  return { id: String(id), tipo: String(tipo) };
}
