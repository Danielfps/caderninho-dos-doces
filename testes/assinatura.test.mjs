import assert from "node:assert/strict";
import test from "node:test";
import { isUuid, lerReferencia, pagamentoValido, referenciaDaConta, lerNotificacaoPagamento, lerQuantidadeCobrada } from "../supabase/functions/_shared/assinatura.mjs";

const ana = "11111111-1111-4111-8111-111111111111";
const bia = "22222222-2222-4222-8222-222222222222";

test("valida UUID e lê só referências mensal/anual da conta", () => {
  assert.equal(isUuid(ana), true);
  assert.equal(isUuid("not-a-uuid"), false);
  assert.deepEqual(lerReferencia(`mensal:${ana}`), { plano: "mensal", userId: ana });
  assert.deepEqual(lerReferencia(`anual:${ana}`), { plano: "anual", userId: ana });
  assert.equal(lerReferencia(`semanal:${ana}`), null);
  assert.equal(lerReferencia("mensal:not-a-uuid"), null);
  assert.equal(lerReferencia("") , null);
});

test("pagamento aprovado exige BRL e o mínimo do plano", () => {
  const mensalPromo = { id: 1, external_reference: `mensal:${ana}`, currency_id: "BRL", transaction_amount: 14.9, status: "approved" };
  assert.deepEqual(pagamentoValido(mensalPromo, { mensalMinimo: 14.9, anual: 149.9 }), {
    valido: true, aprovado: true, estornado: false, plano: "mensal", userId: ana,
  });
  assert.equal(pagamentoValido({ ...mensalPromo, transaction_amount: 14.89 }, { mensalMinimo: 14.9, anual: 149.9 }).valido, false);
  assert.equal(pagamentoValido({ ...mensalPromo, currency_id: "USD" }, { mensalMinimo: 14.9, anual: 149.9 }).valido, false);
  assert.equal(pagamentoValido({ ...mensalPromo, status: "pending" }, { mensalMinimo: 14.9, anual: 149.9 }).valido, false);
  assert.equal(pagamentoValido({ ...mensalPromo, external_reference: `mensal:${bia}` }, { mensalMinimo: 14.9, anual: 149.9 }).userId, bia);
  assert.equal(referenciaDaConta(`mensal:${bia}`, ana), null);
  assert.deepEqual(referenciaDaConta(`mensal:${ana}`, ana), { plano: "mensal", userId: ana });
});

test("anual aprovado exige o preço anual configurado", () => {
  const anual = { id: 2, external_reference: `anual:${ana}`, currency_id: "BRL", transaction_amount: 149.9, status: "approved" };
  assert.equal(pagamentoValido(anual, { mensalMinimo: 14.9, anual: 149.9 }).valido, true);
  assert.equal(pagamentoValido({ ...anual, transaction_amount: 149.89 }, { mensalMinimo: 14.9, anual: 149.9 }).valido, false);
  assert.equal(pagamentoValido({ ...anual, currency_id: "USD" }, { mensalMinimo: 14.9, anual: 149.9 }).valido, false);
});

test("estornos são reconhecidos para mensal e anual", () => {
  for (const status of ["refunded", "charged_back", "cancelled", "canceled"]) {
    const resultado = pagamentoValido({ external_reference: `mensal:${ana}`, currency_id: "BRL", status });
    assert.equal(resultado.valido, true, status);
    assert.equal(resultado.aprovado, false, status);
    assert.equal(resultado.estornado, true, status);
    assert.equal(resultado.plano, "mensal", status);
  }
  assert.equal(pagamentoValido({ external_reference: `anual:${ana}`, currency_id: "BRL", status: "refunded" }).plano, "anual");
  assert.equal(pagamentoValido({ external_reference: `anual:${ana}`, currency_id: "USD", status: "refunded" }).valido, false);
});

test("lê data.id do aviso e id/topic alternativos", () => {
  assert.deepEqual(lerNotificacaoPagamento("https://hook.test/?data.id=123&type=payment"), { id: "123", tipo: "payment" });
  assert.deepEqual(lerNotificacaoPagamento("https://hook.test/?id=456&topic=payment"), { id: "456", tipo: "payment" });
  assert.deepEqual(lerNotificacaoPagamento("https://hook.test/", { data: { id: 789 }, type: "payment" }), { id: "789", tipo: "payment" });
  assert.deepEqual(lerNotificacaoPagamento("https://hook.test/", { id: "987", topic: "payment" }), { id: "987", tipo: "payment" });
  assert.deepEqual(lerNotificacaoPagamento("https://hook.test/?data.id=1", { data: { id: 2 } }), { id: "1", tipo: "" });
});

test("quantidade de cobranças resumida nula equivale a zero", () => {
  assert.equal(lerQuantidadeCobrada({ summarized: { charged_quantity: null } }), 0);
  assert.equal(lerQuantidadeCobrada({ summarized: { charged_quantity: 2 } }), 2);
  assert.equal(lerQuantidadeCobrada({ summarized: {} }), 0);
});
