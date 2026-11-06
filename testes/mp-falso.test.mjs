import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "node:http";
import { criarMpFalso } from "./mp-falso.mjs";

test("mp-falso reproduz planos individuais, assinaturas, cobranças e limites provados", async (t) => {
  const mp = criarMpFalso();
  const server = createServer(mp.tratar);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const chamar = async (path, { method = "GET", body } = {}) => {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: { Authorization: "Bearer TEST-ACCESS-TOKEN", "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, body: await response.json() };
  };
  const criarPlano = async (external_reference) => chamar("/preapproval_plan", { method: "POST", body: {
    reason: "Plano teste", external_reference, back_url: "https://app.test/volta",
    auto_recurring: { frequency: 1, frequency_type: "months", transaction_amount: 14.9, currency_id: "BRL" },
  } });

  const criado = await criarPlano("contratacao-ana");
  assert.equal(criado.status, 201);
  assert.equal(criado.body.external_reference, "contratacao-ana");
  assert.equal(Object.hasOwn(criado.body, "payer_email"), false);
  const pago1 = mp.pagarPlano(criado.body.id, { payerEmail: "email-diferente@exemplo.test", payerId: "10001" });
  const pago2 = mp.pagarPlano(criado.body.id, { payerEmail: "outro@exemplo.test", payerId: "10002" });
  assert.equal(pago1.assinatura.external_reference, null);
  assert.equal(pago1.assinatura.payer_email, null);
  assert.equal(pago1.assinatura.preapproval_plan_id, criado.body.id);
  assert.equal(pago1.pagamento.payer.email, "email-diferente@exemplo.test");
  assert.equal(pago1.fatura.external_reference, "contratacao-ana");
  assert.equal(pago2.assinatura.preapproval_plan_id, criado.body.id);

  const busca = await chamar(`/preapproval/search?preapproval_plan_id=${criado.body.id}&external_reference=ignorada`);
  assert.equal(busca.body.results.length, 2);
  assert.ok(busca.body.results.every((item) => item.preapproval_plan_id === criado.body.id));

  const fechadoComAssinatura = await chamar(`/preapproval_plan/${criado.body.id}`, { method: "PUT", body: { status: "cancelled" } });
  assert.deepEqual(fechadoComAssinatura, { status: 400, body: { message: "bad_request" } });
  const valorNovo = { auto_recurring: { frequency: 1, frequency_type: "months", transaction_amount: 19.9, currency_id: "BRL" }, reason: "Plano atualizado" };
  assert.equal((await chamar(`/preapproval_plan/${criado.body.id}`, { method: "PUT", body: valorNovo })).status, 200);
  const relida = await chamar(`/preapproval/${pago1.assinatura.id}`);
  assert.equal(relida.body.auto_recurring.transaction_amount, 19.9);
  assert.equal((await chamar(`/preapproval/${pago1.assinatura.id}`, { method: "PUT", body: valorNovo })).status, 200);
  assert.equal((await chamar(`/preapproval/${pago1.assinatura.id}`, { method: "PUT", body: { external_reference: "contratacao-ana" } })).status, 200);
  assert.equal((await chamar(`/preapproval/${pago2.assinatura.id}`, { method: "PUT", body: { status: "cancelled" } })).status, 200);
  assert.equal((await chamar(`/preapproval/${pago1.assinatura.id}`, { method: "PUT", body: { status: "cancelled" } })).status, 200);
  assert.equal((await chamar(`/preapproval_plan/${criado.body.id}`, { method: "PUT", body: { status: "cancelled" } })).status, 200);
  assert.deepEqual(await chamar(`/preapproval/${pago1.assinatura.id}`, { method: "PUT", body: { status: "cancelled" } }), {
    status: 400, body: { message: "You can not modify a cancelled preapproval" },
  });
  assert.deepEqual(await chamar(`/preapproval/${pago1.assinatura.id}`, { method: "PUT", body: { status: "canceled" } }), {
    status: 400, body: { message: "Invalid preapproval status param" },
  });

  const semAssinante = await criarPlano("contratacao-sem-pagamento");
  assert.equal((await chamar(`/preapproval_plan/${semAssinante.body.id}`, { method: "PUT", body: { status: "cancelled" } })).status, 200);
  const cancelada = await criarPlano("contratacao-assinatura-cancelada");
  const assinaturaCancelada = mp.pagarPlano(cancelada.body.id).assinatura;
  await chamar(`/preapproval/${assinaturaCancelada.id}`, { method: "PUT", body: { status: "cancelled" } });
  assert.equal((await chamar(`/preapproval_plan/${cancelada.body.id}`, { method: "PUT", body: { status: "cancelled" } })).status, 200);

  const planoPaginado = await criarPlano("contratacao-paginada");
  const assinaturaPaginada = mp.pagarPlano(planoPaginado.body.id, { payerId: "11000" }).assinatura;
  for (let i = 0; i < 12; i++) mp.cobrarAssinatura(assinaturaPaginada.id, { payerEmail: `pagador${i}@exemplo.test` });
  const faturas = [...mp.faturas.values()].filter((item) => item.external_reference === "contratacao-paginada");
  const assinaturaDaPrimeira = faturas[0].preapproval_id;
  const primeira = await chamar(`/authorized_payments/search?preapproval_id=${assinaturaDaPrimeira}&limit=12&offset=0`);
  const segunda = await chamar(`/authorized_payments/search?preapproval_id=${assinaturaDaPrimeira}&limit=12&offset=12`);
  assert.equal(primeira.body.results.length, 12);
  assert.equal(segunda.body.results.length, 1);
  for (const limit of [20, 100]) {
    assert.deepEqual(await chamar(`/authorized_payments/search?preapproval_id=${assinaturaDaPrimeira}&limit=${limit}`), {
      status: 400, body: { message: "Invalid value for limit" },
    });
  }
  assert.equal((await chamar(`/authorized_payments/${faturas[0].id}`)).body.collector_id, undefined);
  assert.equal((await chamar(`/v1/payments/${pago1.pagamento.id}`)).body.external_reference, "contratacao-ana");
  assert.equal((await chamar("/preapproval", { method: "POST", body: {} })).status, 404);
});
