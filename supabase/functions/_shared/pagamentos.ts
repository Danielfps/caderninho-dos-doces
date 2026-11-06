import { chamarMercadoPago, pegarPrecos, registrarCompra, type Config, MercadoPagoError } from "./servidor.ts";
import { lerReferenciaAntiga, pagamentoValido, referenciaDaConta } from "./assinatura.mjs";

/** Mantém somente a conferência das compras avulsas já existentes. */
export async function processarPagamento(config: Config, pagamento: any) {
  const referencia = lerReferenciaAntiga(pagamento?.external_reference);
  const pagamentoId = String(pagamento?.id ?? "");
  if (!referencia || !/^\d+$/.test(pagamentoId)) return false;
  const status = String(pagamento?.status ?? "").toLowerCase();
  let validacao;
  if (["refunded", "charged_back", "cancelled", "canceled"].includes(status)) {
    validacao = pagamentoValido(pagamento);
  } else if (status === "approved") {
    const precos = await pegarPrecos(config);
    const mensalMinimo = precos.mensal == null ? 0 : precos.promo == null ? precos.mensal : Math.min(precos.mensal, precos.promo);
    validacao = pagamentoValido(pagamento, { mensalMinimo, anual: precos.anual ?? 0 });
  } else return false;
  if (!validacao.valido) return false;
  await registrarCompra(config, pagamentoId, validacao.userId!, Number(pagamento.transaction_amount), validacao.aprovado, validacao.plano as "mensal" | "anual");
  return true;
}

async function buscarPagamento(config: Config, id: string) {
  try { return await chamarMercadoPago(config, `/v1/payments/${encodeURIComponent(id)}`); }
  catch (error) {
    if (error instanceof MercadoPagoError && error.status === 404) return null;
    throw error;
  }
}

export async function consultarPagamentos(config: Config, userId: string, pagamentoId?: unknown) {
  const id = typeof pagamentoId === "string" || (typeof pagamentoId === "number" && Number.isSafeInteger(pagamentoId))
    ? String(pagamentoId) : "";
  if (/^\d+$/.test(id)) {
    try {
      const pagamento = await buscarPagamento(config, id);
      if (pagamento && referenciaDaConta(pagamento.external_reference, userId)) await processarPagamento(config, pagamento);
    } catch (error) { console.error("Falha ao consultar pagamento antigo", error); }
  }
  for (const plano of ["mensal", "anual"]) {
    const referencia = `${plano}:${userId}`;
    try {
      const busca = await chamarMercadoPago(config,
        `/v1/payments/search?external_reference=${encodeURIComponent(referencia)}&sort=date_created&criteria=desc`);
      for (const pagamento of Array.isArray(busca?.results) ? busca.results : []) {
        if (String(pagamento?.external_reference ?? "") === referencia) await processarPagamento(config, pagamento);
      }
    } catch (error) { console.error(`Falha ao buscar pagamentos antigos da conta (${plano})`, error); }
  }
}
