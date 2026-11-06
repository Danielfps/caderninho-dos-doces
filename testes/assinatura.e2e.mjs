import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHmac, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { criarMpFalso } from "./mp-falso.mjs";
import { criarSupabaseFalso } from "./supabase-falso.mjs";

const dir = path.dirname(fileURLToPath(import.meta.url));
const server = (handler) => new Promise((resolve) => {
  const value = createServer(handler);
  value.listen(0, "127.0.0.1", () => resolve(value));
});
const fecharServidor = (value) => new Promise((resolve) => value.close(resolve));
const requestJson = async (url, options = {}) => {
  const response = await fetch(url, options);
  let body = null;
  try { body = await response.json(); } catch { /* corpo vazio */ }
  return { status: response.status, body };
};

const supa = await criarSupabaseFalso();
const mp = criarMpFalso();
const supaServer = await server((req, res) => supa.tratar(req, res, req.url.split("?")[0].replace(/^\//, "")));
const mpServer = await server(mp.tratar);
const free = await server((_req, res) => res.end());
const functionsPort = free.address().port;
await fecharServidor(free);
const functionsBase = `http://127.0.0.1:${functionsPort}`;
const supaBase = `http://127.0.0.1:${supaServer.address().port}`;
const mpBase = `http://127.0.0.1:${mpServer.address().port}`;
const deno = spawn(path.join(dir, "node_modules", "deno", "deno.exe"), [
  "run", "--allow-env", "--allow-net", "rodar-funcoes.ts",
], {
  cwd: dir,
  env: {
    ...process.env,
    FUNCOES_PORT: String(functionsPort),
    SUPABASE_URL: supaBase,
    SUPABASE_ANON_KEY: supa.chave,
    SUPABASE_SERVICE_ROLE_KEY: supa.chaveServico,
    MP_ACCESS_TOKEN: "TEST-ACCESS-TOKEN",
    MP_COLLECTOR_ID: "123456",
    MP_API_URL: mpBase,
    MP_WEBHOOK_SECRET: "segredo-local-e2e",
    APP_URLS: "https://app.test/",
    RECONCILIAR_CHAVE: "chave-local-e2e",
  },
  stdio: ["ignore", "pipe", "pipe"],
});
let logDeno = "";
deno.stdout.setEncoding("utf8").on("data", (chunk) => { logDeno += chunk; });
deno.stderr.setEncoding("utf8").on("data", (chunk) => { logDeno += chunk; });

try {
  let ready = false;
  for (let i = 0; i < 60; i++) {
    if (deno.exitCode !== null) throw new Error(`Deno encerrou: ${logDeno}`);
    try {
      const ping = await fetch(`${functionsBase}/health`);
      if (ping.ok) { ready = true; break; }
    } catch { /* iniciando */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.equal(ready, true, `Deno não iniciou: ${logDeno}`);

  const cadastrar = async (email) => {
    const result = await requestJson(`${supaBase}/auth/v1/signup`, {
      method: "POST", headers: { apikey: supa.chave, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "senha-de-teste", data: { nome: email.split("@")[0] } }),
    });
    assert.equal(result.status, 200, JSON.stringify(result.body));
    return result.body;
  };
  const ana = await cadastrar("ana@teste.local");
  const bia = await cadastrar("bia@teste.local");
  const chamar = (sessao, body) => requestJson(`${functionsBase}/functions/v1/assinatura`, {
    method: "POST",
    headers: { apikey: supa.chave, Authorization: `Bearer ${sessao.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const criar = async (sessao, plano = "mensal") => {
    const result = await chamar(sessao, { acao: "criar", plano });
    assert.equal(result.status, 200, JSON.stringify(result.body));
    return result.body;
  };
  const checkoutAna = await criar(ana);
  for (let i = 0; i < 4; i++) assert.equal((await criar(ana)).init_point, checkoutAna.init_point);
  assert.equal(mp.planos.size, 1, "cinco pedidos de criação reutilizam um único plano");
  const planoAna = new URL(checkoutAna.init_point).searchParams.get("preapproval_plan_id");
  const checkoutBia = await criar(bia);
  const planoBia = new URL(checkoutBia.init_point).searchParams.get("preapproval_plan_id");
  assert.notEqual(planoAna, planoBia);

  const pagosAna = [
    mp.pagarPlano(planoAna, { payerEmail: "email-diferente@exemplo.test", payerId: "401" }),
    mp.pagarPlano(planoAna, { payerEmail: "segundo-pagador@exemplo.test", payerId: "402" }),
  ];
  const pagoBia = mp.pagarPlano(planoBia, { payerEmail: "bia-pagador@exemplo.test", payerId: "501" });
  const [syncAna, syncBia] = await Promise.all([chamar(ana, { acao: "conferir" }), chamar(bia, { acao: "conferir" })]);
  assert.equal(syncAna.status, 200, JSON.stringify(syncAna.body));
  assert.equal(syncBia.status, 200, JSON.stringify(syncBia.body));
  const anaRow = (await supa.sql("select user_id,mp_plano_id,mp_preapproval_id,estado from public.contratacoes where id=$1", [checkoutAna.contratacao_id]))[0];
  const biaRow = (await supa.sql("select user_id,mp_plano_id,mp_preapproval_id,estado from public.contratacoes where id=$1", [checkoutBia.contratacao_id]))[0];
  assert.equal(anaRow.user_id, ana.user.id);
  assert.equal(biaRow.user_id, bia.user.id);
  assert.equal(anaRow.mp_preapproval_id, pagosAna[0].assinatura.id);
  assert.equal(biaRow.mp_preapproval_id, pagoBia.assinatura.id);
  assert.equal(anaRow.estado, "ativa");
  assert.equal(biaRow.estado, "ativa");
  assert.equal(mp.assinaturas.get(pagosAna[1].assinatura.id).status, "cancelled", "a segunda assinatura do mesmo link é cancelada");
  const cobrancasAna = await supa.sql("select count(*)::int n from public.cobrancas where contratacao_id=$1 and estado='aprovada'", [checkoutAna.contratacao_id]);
  assert.equal(cobrancasAna[0].n, 2, "as duas cobranças entram na validade");
  assert.equal(mp.planos.get(planoAna).auto_recurring.transaction_amount, 19.9, "a promoção sobe após a primeira cobrança");

  mp.falharFechamentoPlano = true;
  const cancelada = await chamar(bia, { acao: "cancelar" });
  assert.equal(cancelada.status, 200, JSON.stringify(cancelada.body));
  assert.equal(cancelada.body.situacao.assinatura.estado, "cancelada");

  const planoAbandonado = await criar(bia);
  const planoAbandonadoId = new URL(planoAbandonado.init_point).searchParams.get("preapproval_plan_id");
  await supa.sql("update public.contratacoes set estado='abandonada' where id=$1", [planoAbandonado.contratacao_id]);
  const conferirAbandonada = await chamar(bia, { acao: "conferir" });
  assert.equal(conferirAbandonada.status, 200);
  assert.equal(mp.planos.get(planoAbandonadoId).status, "cancelled");

  mp.falharRespostaCriacao = true;
  const perdida = await chamar(bia, { acao: "criar", plano: "anual" });
  assert.equal(perdida.status, 502, "a resposta perdida não devolve link ao comprador");
  const semLink = (await supa.sql("select id,criado_em from public.contratacoes where user_id=$1 and estado='checkout_pendente' order by criado_em desc limit 1", [bia.user.id]))[0];
  assert.ok(semLink);
  const planosOrfaosAntes = [...mp.planos.values()].filter((item) => item.external_reference === semLink.id).length;
  assert.equal(planosOrfaosAntes, 1);
  await supa.sql("update public.contratacoes set criado_em=now()-interval '30 seconds' where id=$1", [semLink.id]);
  const retomada = await criar(bia, "anual");
  const planoRetomadoId = new URL(retomada.init_point).searchParams.get("preapproval_plan_id");
  assert.notEqual(planoRetomadoId, [...mp.planos.values()].find((item) => item.external_reference === semLink.id).id);
  assert.equal([...mp.assinaturas.values()].filter((item) => item.preapproval_plan_id === planoRetomadoId).length, 0);
  assert.equal((await supa.sql("select count(*)::int n from public.cobrancas where contratacao_id=$1", [semLink.id]))[0].n, 0);

  /* ---------- matriz completa ---------- */
  let cenarios = 0;
  const cena = async (nome, fn) => {
    try { await fn(); cenarios += 1; console.log(`OK      ${nome}`); }
    catch (error) { console.log(`FALHA   ${nome}`); throw error; }
  };
  let sequencia = 0;
  const novaConta = async () => cadastrar(`conta${++sequencia}@teste.local`);
  const planoDe = (checkout) => new URL(checkout.init_point).searchParams.get("preapproval_plan_id");
  const conferir = async (sessao) => {
    await supa.sql("update public.contratacoes set sincronizada_em=null where user_id=$1", [sessao.user.id]);
    const r = await chamar(sessao, { acao: "conferir" });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    return r.body.situacao;
  };
  const aviso = async ({ tipo, id, segredo = "segredo-local-e2e", requestId = randomUUID(), semAssinatura = false, adulterar = false }) => {
    const ts = String(Math.floor(Date.now() / 1000));
    const v1 = createHmac("sha256", segredo).update(`id:${String(id).toLowerCase()};request-id:${requestId};ts:${ts};`).digest("hex");
    const headers = { "Content-Type": "application/json", "x-request-id": requestId };
    if (!semAssinatura) headers["x-signature"] = `ts=${ts},v1=${adulterar ? v1.replace(/.$/, (c) => (c === "0" ? "1" : "0")) : v1}`;
    const r = await requestJson(`${functionsBase}/functions/v1/mp-webhook?data.id=${encodeURIComponent(id)}&type=${tipo}`, {
      method: "POST", headers, body: JSON.stringify({ type: tipo, action: "updated", live_mode: false, data: { id } }),
    });
    return { ...r, requestId };
  };
  const assinar = async (sessao, plano = "mensal") => {
    const checkout = await criar(sessao, plano);
    return { checkout, pago: mp.pagarPlano(planoDe(checkout)) };
  };
  const diasEntre = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5);
  const linha = async (id) => (await supa.sql("select * from public.contratacoes where id=$1", [id]))[0];

  await cena("Teste 1: contrata sem e-mail do cliente e ignora preço, e-mail, conta e status mandados pelo app", async () => {
    const c = await novaConta();
    const antes = mp.pedidos.length;
    const r = await chamar(c, { acao: "criar", plano: "mensal", preco: 0.01, valor: 0.01, transaction_amount: 0.01, payer_email: "x@y.z", email: "x@y.z", user_id: ana.user.id, status: "authorized", volta: "https://mal.test/" });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const plano = mp.planos.get(planoDe(r.body));
    assert.equal(plano.auto_recurring.transaction_amount, 14.9);
    assert.equal(plano.back_url, "https://app.test/");
    assert.equal(plano.external_reference, r.body.contratacao_id);
    assert.equal((await linha(r.body.contratacao_id)).user_id, c.user.id);
    assert.equal(mp.pedidos.slice(antes).filter((p) => p.method === "POST" && p.path === "/preapproval").length, 0, "não usa /preapproval");
    assert.deepEqual(Object.keys(r.body).filter((k) => !k.startsWith("_")).sort(), ["contratacao_id", "init_point"]);
  });

  await cena("Plano inválido é recusado e e-mail sem confirmar não contrata", async () => {
    const c = await novaConta();
    assert.equal((await chamar(c, { acao: "criar", plano: "semanal" })).status, 400);
    supa.desconfirmar(c.user.id);
    const r = await chamar(c, { acao: "criar", plano: "mensal" });
    assert.equal(r.status, 403);
    assert.equal(r.body.erro, "sem_email");
  });

  await cena("Teste 7: 5 toques ao mesmo tempo geram 1 plano", async () => {
    const c = await novaConta();
    const antes = mp.planos.size;
    const rs = await Promise.all(Array.from({ length: 5 }, () => chamar(c, { acao: "criar", plano: "mensal" })));
    assert.ok(rs.every((r) => r.status === 200 || (r.status === 409 && r.body.erro === "em_andamento")), JSON.stringify(rs));
    assert.equal(mp.planos.size - antes, 1);
    const n = await supa.sql("select count(*)::int n from public.contratacoes where user_id=$1", [c.user.id]);
    assert.equal(n[0].n, 1);
  });

  await cena("Teste 3: checkout abandonado não libera nada e deixa assinar de novo", async () => {
    const c = await novaConta();
    const { contratacao_id, init_point } = await criar(c);
    const s = await conferir(c);
    assert.equal(s.pago_ate, null);
    assert.equal(s.assinatura.estado, "checkout_pendente");
    assert.equal(new Date(s.liberado_ate).getTime(), new Date(s.teste_ate).getTime());
    assert.equal((await criar(c)).init_point, init_point);
    await supa.sql("update public.contratacoes set expira_em=now()-interval '1 minute' where id=$1", [contratacao_id]);
    const novo = await criar(c);
    assert.notEqual(novo.contratacao_id, contratacao_id);
    assert.equal(mp.planos.get(new URL(init_point).searchParams.get("preapproval_plan_id")).status, "cancelled");
  });

  await cena("Cobrança pendente não libera (autorizada sem pagamento aprovado)", async () => {
    const c = await novaConta();
    const checkout = await criar(c);
    mp.pagarPlano(planoDe(checkout), { pagamentoStatus: "pending" });
    const s = await conferir(c);
    assert.equal(s.assinatura.estado, "aguardando_pagamento");
    assert.equal(s.pago_ate, null);
    assert.equal(new Date(s.liberado_ate).getTime(), new Date(s.teste_ate).getTime());
    assert.equal(s.conferir, true);
  });

  await cena("Teste 4: cobrança recusada não libera e permite tentar de novo", async () => {
    const c = await novaConta();
    const checkout = await criar(c);
    const { assinatura } = mp.pagarPlano(planoDe(checkout), { pagamentoStatus: "rejected" });
    const s = await conferir(c);
    assert.equal(s.assinatura.estado, "falha_pagamento");
    assert.equal(s.pago_ate, null);
    const novo = await criar(c);
    assert.notEqual(novo.contratacao_id, checkout.contratacao_id);
    assert.equal(mp.assinaturas.get(assinatura.id).status, "cancelled", "a assinatura recusada é cancelada antes da nova");
  });

  await cena("Teste 1 e 2: aprovada libera, e quem assina no teste grátis não perde dias", async () => {
    const c = await novaConta();
    await assinar(c);
    const s = await conferir(c);
    assert.equal(s.assinatura.estado, "ativa");
    assert.equal(s.plano, "mensal");
    assert.ok(diasEntre(s.teste_ate, s.pago_ate) >= 28 && diasEntre(s.teste_ate, s.pago_ate) <= 31, "conta a partir do fim do teste");
    assert.equal(diasEntre(s.pago_ate, s.liberado_ate), 3, "3 dias de tolerância");
    assert.equal(s.cobrancas.length, 1);
    assert.equal(Number(s.cobrancas[0].valor), 14.9);
  });

  await cena("Teste 5: webhook válido sincroniza, sem assinatura ou adulterado é recusado", async () => {
    const c = await novaConta();
    const { checkout, pago } = await assinar(c);
    assert.equal((await aviso({ tipo: "subscription_preapproval", id: pago.assinatura.id, semAssinatura: true })).status, 401);
    assert.equal((await aviso({ tipo: "subscription_preapproval", id: pago.assinatura.id, adulterar: true })).status, 401);
    assert.equal((await aviso({ tipo: "subscription_preapproval", id: pago.assinatura.id, segredo: "outro" })).status, 401);
    assert.equal((await linha(checkout.contratacao_id)).estado, "checkout_pendente", "aviso recusado não muda nada");
    const r = await aviso({ tipo: "subscription_preapproval", id: pago.assinatura.id });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal((await linha(checkout.contratacao_id)).estado, "ativa");
    const ev = await supa.sql("select * from public.eventos_pagamento where chave like $1", [`%${r.requestId}`]);
    assert.equal(ev[0].resultado, "ok");
    assert.equal(ev[0].acao, "updated");
    assert.equal(ev[0].ao_vivo, false);
  });

  await cena("Teste 6: aviso duplicado e conferências repetidas não somam dias", async () => {
    const c = await novaConta();
    const { pago } = await assinar(c);
    const r1 = await aviso({ tipo: "subscription_authorized_payment", id: pago.fatura.id, requestId: "req-fixo-dup" });
    assert.equal(r1.status, 200);
    const antes = (await conferir(c)).pago_ate;
    await aviso({ tipo: "subscription_authorized_payment", id: pago.fatura.id, requestId: "req-fixo-dup" });
    await aviso({ tipo: "subscription_authorized_payment", id: pago.fatura.id });
    await aviso({ tipo: "payment", id: pago.pagamento.id });
    await conferir(c);
    assert.equal((await conferir(c)).pago_ate, antes);
    const ev = await supa.sql("select repeticoes from public.eventos_pagamento where chave like '%req-fixo-dup'");
    assert.equal(ev[0].repeticoes, 2);
  });

  await cena("Teste 9: renovação soma 1 período, sem somar de novo em leituras repetidas", async () => {
    const c = await novaConta();
    const { pago } = await assinar(c);
    const antes = (await conferir(c)).pago_ate;
    const r = mp.cobrarAssinatura(pago.assinatura.id, { debitoEmDias: 30 });
    await aviso({ tipo: "subscription_authorized_payment", id: r.fatura.id });
    const depois = (await conferir(c)).pago_ate;
    assert.ok(diasEntre(antes, depois) >= 28 && diasEntre(antes, depois) <= 31, `${antes} ${depois}`);
    for (let i = 0; i < 3; i++) await conferir(c);
    await aviso({ tipo: "subscription_authorized_payment", id: pago.fatura.id });
    assert.equal((await conferir(c)).pago_ate, depois, "reler cobrança antiga não pode empurrar a validade");
  });

  await cena("Renovação recusada vira falha_pagamento, aprovada volta, e fatura agendada não muda o estado", async () => {
    const c = await novaConta();
    const { pago } = await assinar(c);
    await conferir(c);
    mp.cobrarAssinatura(pago.assinatura.id, { debitoEmDias: 30, status: "scheduled", pagamentoStatus: null });
    assert.equal((await conferir(c)).assinatura.estado, "ativa", "agendada não tira de ativa");
    mp.cobrarAssinatura(pago.assinatura.id, { debitoEmDias: 1, pagamentoStatus: "rejected" });
    const f = await conferir(c);
    assert.equal(f.assinatura.estado, "falha_pagamento");
    assert.equal(diasEntre(f.pago_ate, f.liberado_ate), 3);
    mp.cobrarAssinatura(pago.assinatura.id, { debitoEmDias: 2 });
    assert.equal((await conferir(c)).assinatura.estado, "ativa");
  });

  await cena("Promoção: sobe para 19,90, repete se falhar, e só vale uma vez por conta", async () => {
    const c = await novaConta();
    const { checkout, pago } = await assinar(c);
    mp.falharProxima("PUT", "/preapproval_plan/", 500);
    await conferir(c);
    assert.equal(mp.assinaturas.get(pago.assinatura.id).auto_recurring.transaction_amount, 14.9, "falhou agora");
    await conferir(c);
    assert.equal(mp.assinaturas.get(pago.assinatura.id).auto_recurring.transaction_amount, 19.9, "repetiu na conferência seguinte");
    assert.equal((await chamar(c, { acao: "cancelar" })).status, 200);
    const novo = await criar(c);
    assert.notEqual(novo.contratacao_id, checkout.contratacao_id);
    assert.equal(mp.planos.get(planoDe(novo)).auto_recurring.transaction_amount, 19.9, "sem promoção na segunda vez");
    assert.equal((await conferir(c)).preco_promo, null);
  });

  await cena("Estorno recua a validade e devolve a promoção", async () => {
    const c = await novaConta();
    const { pago } = await assinar(c);
    assert.ok((await conferir(c)).pago_ate);
    mp.estornar(pago.pagamento.id);
    await aviso({ tipo: "payment", id: pago.pagamento.id });
    const s = await conferir(c);
    assert.equal(s.pago_ate, null);
    assert.equal(s.cobrancas[0].estado, "estornada");
    assert.equal(Number(s.preco_promo), 14.9);
    await aviso({ tipo: "subscription_authorized_payment", id: pago.fatura.id });
    assert.equal((await conferir(c)).pago_ate, null, "estorno é final");
  });

  await cena("Teste 10: cancelar chega ao Mercado Pago, mantém o período pago e não renova", async () => {
    const c = await novaConta();
    const { pago } = await assinar(c);
    const pagoAte = (await conferir(c)).pago_ate;
    const r = await chamar(c, { acao: "cancelar", contratacao_id: "qualquer", id: "qualquer" });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(mp.assinaturas.get(pago.assinatura.id).status, "cancelled");
    assert.equal(r.body.situacao.assinatura.estado, "cancelada");
    assert.ok(r.body.situacao.assinatura.cancelada_em);
    assert.equal(r.body.situacao.pago_ate, pagoAte);
    assert.equal(new Date(r.body.situacao.liberado_ate).getTime(), new Date(pagoAte).getTime(), "sem tolerância");
    assert.equal((await chamar(c, { acao: "cancelar" })).status, 200, "cancelar de novo não dá erro");
  });

  await cena("Assinatura sem referência gravada ainda cancela (o plano prova que é nossa)", async () => {
    const c = await novaConta();
    const { pago } = await assinar(c);
    mp.falharProxima("PUT", "/preapproval/", 500);
    await conferir(c);
    assert.equal(mp.assinaturas.get(pago.assinatura.id).external_reference, null);
    mp.falharSempreReferencia = true;
    const r = await chamar(c, { acao: "cancelar" });
    mp.falharSempreReferencia = false;
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(mp.assinaturas.get(pago.assinatura.id).status, "cancelled");
  });

  await cena("Teste 11: uma conta não mexe na assinatura da outra", async () => {
    const a = await novaConta();
    const b = await novaConta();
    const { checkout, pago } = await assinar(a);
    await conferir(a);
    const r = await chamar(b, { acao: "cancelar", contratacao_id: checkout.contratacao_id, mp_preapproval_id: pago.assinatura.id });
    assert.equal(r.status, 200);
    assert.equal(mp.assinaturas.get(pago.assinatura.id).status, "authorized");
    assert.equal((await linha(checkout.contratacao_id)).estado, "ativa");
  });

  await cena("Cancelada direto no Mercado Pago sincroniza, e aviso velho não reativa", async () => {
    const c = await novaConta();
    const { checkout, pago } = await assinar(c);
    await conferir(c);
    mp.cancelarPeloMp(pago.assinatura.id);
    await aviso({ tipo: "subscription_preapproval", id: pago.assinatura.id });
    assert.equal((await linha(checkout.contratacao_id)).estado, "cancelada");
    await aviso({ tipo: "subscription_authorized_payment", id: pago.fatura.id });
    assert.equal((await conferir(c)).assinatura.estado, "cancelada");
  });

  await cena("Aviso fora de ordem: leitura mais velha não muda o estado", async () => {
    const c = await novaConta();
    const { checkout, pago } = await assinar(c);
    await conferir(c);
    const a = mp.assinaturas.get(pago.assinatura.id);
    a.status = "paused";
    a.last_modified = new Date(Date.now() - 864e5).toISOString();
    await aviso({ tipo: "subscription_preapproval", id: a.id });
    assert.equal((await linha(checkout.contratacao_id)).estado, "ativa");
    a.last_modified = new Date(Date.now() + 1000).toISOString();
    await aviso({ tipo: "subscription_preapproval", id: a.id });
    assert.equal((await linha(checkout.contratacao_id)).estado, "pausada");
  });

  await cena("Teste 8: erros 400, 401, 429 e 500 viram mp_falhou, e tentar de novo funciona", async () => {
    for (const status of [400, 401, 429, 500]) {
      const c = await novaConta();
      mp.falharProxima("POST", "/preapproval_plan", status);
      const r = await chamar(c, { acao: "criar", plano: "mensal" });
      assert.equal(r.status, 502, `${status}`);
      assert.equal(r.body.erro, "mp_falhou");
      await supa.sql("update public.contratacoes set criado_em=now()-interval '30 seconds' where user_id=$1", [c.user.id]);
      assert.ok((await criar(c)).init_point);
    }
  });

  await cena("Teste 8: rede falhou depois de criar: resposta perdida não gera duplicata nem cobrança", async () => {
    const c = await novaConta();
    mp.falharRespostaCriacao = true;
    assert.equal((await chamar(c, { acao: "criar", plano: "mensal" })).status, 502);
    const em = await chamar(c, { acao: "criar", plano: "mensal" });
    assert.equal(em.status, 409);
    assert.equal(em.body.erro, "em_andamento");
    await supa.sql("update public.contratacoes set criado_em=now()-interval '30 seconds' where user_id=$1", [c.user.id]);
    const ok = await criar(c);
    assert.equal((await supa.sql("select count(*)::int n from public.contratacoes where user_id=$1", [c.user.id]))[0].n, 1, "mesma tentativa");
    assert.equal(mp.planos.get(planoDe(ok)).external_reference, ok.contratacao_id);
  });

  await cena("Aviso com Mercado Pago fora responde 502 para ser reenviado, depois processa", async () => {
    const c = await novaConta();
    const { checkout, pago } = await assinar(c);
    mp.falharProxima("GET", "/preapproval/", 500);
    assert.equal((await aviso({ tipo: "subscription_preapproval", id: pago.assinatura.id, requestId: "req-reenvio" })).status, 502);
    assert.equal((await aviso({ tipo: "subscription_preapproval", id: pago.assinatura.id, requestId: "req-reenvio" })).status, 200);
    assert.equal((await linha(checkout.contratacao_id)).estado, "ativa");
    const ev = await supa.sql("select resultado,repeticoes from public.eventos_pagamento where chave like '%req-reenvio'");
    assert.equal(ev[0].resultado, "ok");
    assert.equal(ev[0].repeticoes, 2);
  });

  await cena("Conferir com Mercado Pago fora ainda devolve a situação do banco", async () => {
    const c = await novaConta();
    await assinar(c);
    const pagoAntes = (await conferir(c)).pago_ate;
    mp.falharProxima("GET", "/preapproval_plan/", 500);
    assert.equal((await conferir(c)).pago_ate, pagoAntes);
  });

  await cena("Preço muda com tentativa aberta: link antigo sai e o novo usa o preço novo", async () => {
    const c = await novaConta();
    const velho = await criar(c, "anual");
    await supa.sql("update public.planos set valor=159.90 where id='anual'");
    const novo = await criar(c, "anual");
    await supa.sql("update public.planos set valor=149.90 where id='anual'");
    assert.notEqual(novo.contratacao_id, velho.contratacao_id);
    assert.equal(mp.planos.get(planoDe(novo)).auto_recurring.transaction_amount, 159.9);
    assert.equal(mp.planos.get(planoDe(velho)).status, "cancelled");
    assert.equal((await linha(velho.contratacao_id)).estado, "abandonada");
  });

  await cena("Trocar de plano depois de pagar sem aviso: assinatura paga nunca é cancelada", async () => {
    const c = await novaConta();
    const { checkout, pago } = await assinar(c);
    const r = await chamar(c, { acao: "criar", plano: "anual" });
    assert.equal(r.status, 409, JSON.stringify(r.body));
    assert.equal(r.body.erro, "ja_ativa");
    assert.equal(mp.assinaturas.get(pago.assinatura.id).status, "authorized");
    assert.equal((await linha(checkout.contratacao_id)).estado, "ativa");
  });

  await cena("Link dado por abandonado e pago depois volta a valer e fecha a tentativa aberta", async () => {
    const c = await novaConta();
    const velho = await criar(c);
    const { assinatura } = mp.pagarPlano(planoDe(velho));
    await supa.sql("update public.contratacoes set estado='abandonada' where id=$1", [velho.contratacao_id]);
    const aberta = (await supa.sql("insert into public.contratacoes(user_id,plano,valor_inicial,valor_recorrente,estado) values($1,'mensal',14.90,19.90,'checkout_pendente') returning id", [c.user.id]))[0].id;
    await aviso({ tipo: "subscription_preapproval", id: assinatura.id });
    assert.equal((await linha(velho.contratacao_id)).estado, "ativa");
    assert.equal((await linha(aberta)).estado, "abandonada");
  });

  await cena("Conta do Mercado Pago errada é recusada na criação e no aviso", async () => {
    const c = await novaConta();
    mp.trocarColetor("999");
    const r = await chamar(c, { acao: "criar", plano: "mensal" });
    assert.equal(r.status, 502);
    const plano = [...mp.planos.values()].at(-1);
    assert.equal(plano.status, "cancelled", "o plano errado é fechado");
    const outra = mp.pagarPlano(plano.id, { forcar: true });
    assert.equal((await aviso({ tipo: "subscription_preapproval", id: outra.assinatura.id })).status, 200);
    mp.trocarColetor("123456");
    const ev = await supa.sql("select detalhe from public.eventos_pagamento order by id desc limit 1");
    assert.equal(ev[0].detalhe, "collector_invalido");
  });

  await cena("Compra antiga continua valendo e linha antiga em assinaturas não libera nada", async () => {
    const c = await novaConta();
    await supa.sql("insert into public.assinaturas(user_id,status,valido_ate,mp_preapproval_id) values($1,'ativa',now()+interval '300 days','antiga')", [c.user.id]);
    const s0 = await conferir(c);
    assert.equal(s0.pago_ate, null);
    await supa.sql("insert into public.compras(mp_payment_id,user_id,plano,valor,status,valido_de,valido_ate) values($1,$2,'mensal',14.90,'aprovada',now(),now()+interval '20 days')", [`antiga-${c.user.id}`, c.user.id]);
    const s = await conferir(c);
    assert.ok(s.pago_ate);
    assert.equal(s.preco_promo, null, "compra mensal antiga já usou a promoção");
    const { pago } = await assinar(c);
    assert.equal(pago.fatura.transaction_amount, 19.9);
    const s2 = await conferir(c);
    assert.ok(diasEntre(s.pago_ate, s2.pago_ate) >= 28, "a primeira cobrança soma depois da compra antiga");
  });

  await cena("Anual: frequency 12, valida 12 meses e não tem promoção", async () => {
    const c = await novaConta();
    const { checkout } = await assinar(c, "anual");
    const plano = mp.planos.get(planoDe(checkout));
    assert.equal(plano.auto_recurring.frequency, 12);
    assert.equal(plano.auto_recurring.transaction_amount, 149.9);
    const s = await conferir(c);
    assert.equal(s.plano, "anual");
    assert.ok(diasEntre(s.teste_ate, s.pago_ate) >= 364);
  });

  await cena("Limite de tentativas por hora", async () => {
    const c = await novaConta();
    for (let i = 0; i < 10; i++) await supa.sql("insert into public.contratacoes(user_id,plano,valor_inicial,valor_recorrente,estado) values($1,'mensal',14.90,19.90,'abandonada')", [c.user.id]);
    const r = await chamar(c, { acao: "criar", plano: "mensal" });
    assert.equal(r.status, 429);
    assert.equal(r.body.erro, "limite");
  });

  await cena("Conferir enxerga assinatura ativa criada há mais de 48 horas", async () => {
    const c = await novaConta();
    const { checkout, pago } = await assinar(c);
    await conferir(c);
    await supa.sql("update public.contratacoes set criado_em=now()-interval '40 days' where id=$1", [checkout.contratacao_id]);
    mp.cobrarAssinatura(pago.assinatura.id, { debitoEmDias: 30 });
    const s = await conferir(c);
    assert.equal(s.cobrancas.filter((x) => x.estado === "aprovada").length, 2);
  });

  await cena("Reconciliação corrige divergência e recusa chave errada", async () => {
    const c = await novaConta();
    const { checkout } = await assinar(c);
    const url = `${functionsBase}/functions/v1/mp-reconciliar`;
    assert.equal((await requestJson(url, { method: "POST", headers: { "x-reconciliar-chave": "errada" } })).status, 401);
    assert.equal((await requestJson(url, { method: "POST" })).status, 401);
    await supa.sql("update public.contratacoes set sincronizada_em=null where id=$1", [checkout.contratacao_id]);
    for (let i = 0; i < 6 && (await linha(checkout.contratacao_id)).estado !== "ativa"; i++) {
      assert.equal((await requestJson(url, { method: "POST", headers: { "x-reconciliar-chave": "chave-local-e2e" } })).status, 200);
    }
    assert.equal((await linha(checkout.contratacao_id)).estado, "ativa");
  });

  await cena("Aviso de assinatura de fora do sistema não fica sendo reenviado", async () => {
    const c = await novaConta();
    const checkout = await criar(c);
    const { assinatura } = mp.pagarPlano(planoDe(checkout));
    mp.assinaturas.get(assinatura.id).preapproval_plan_id = null;
    mp.assinaturas.get(assinatura.id).external_reference = "exp-b-nao-e-uuid";
    const r = await aviso({ tipo: "subscription_preapproval", id: assinatura.id });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal((await aviso({ tipo: "subscription_preapproval", id: "nao-existe" })).status, 200);
    assert.equal((await aviso({ tipo: "topic_desconhecido", id: "1" })).status, 200);
  });

  await cena("Logs sem e-mail nem token", async () => {
    assert.ok(!/TEST-ACCESS-TOKEN/.test(logDeno), "token no log");
    assert.ok(!/segredo-local-e2e|chave-local-e2e/.test(logDeno), "segredo no log");
    assert.ok(!/[\w.-]+@[\w-]+\.[\w.-]+/.test(logDeno), `e-mail no log: ${logDeno.match(/[\w.-]+@[\w-]+\.[\w.-]+/)}`);
  });

  console.log(`\nResultado: ${cenarios} cenários passaram, 0 falhas.`);
} catch (error) {
  throw new Error(`${error instanceof Error ? error.stack : error}\nDeno: ${logDeno}`);
} finally {
  deno.kill();
  await Promise.all([fecharServidor(supaServer), fecharServidor(mpServer), supa.fechar()]);
}
