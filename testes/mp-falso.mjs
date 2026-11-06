import { randomUUID } from "node:crypto";

const responder = (res, status, body) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
};

/** Mercado Pago local: planos individuais, assinaturas e faturas recorrentes. */
export function criarMpFalso({ collectorId = "123456", token = "TEST-ACCESS-TOKEN" } = {}) {
  const planos = new Map();
  const assinaturas = new Map();
  const faturas = new Map();
  const pagamentos = new Map();
  const pedidos = [];
  let numero = 0;
  let falharRespostaCriacao = false;
  let falharFechamentoPlano = false;
  let falharSempreReferencia = false;
  const falhas = [];

  function pagarPlano(planoId, { payerEmail = "pagador@outro-dominio.test", payerId = String(900000 + ++numero), pagamentoStatus = "approved", forcar = false } = {}) {
    const plano = planos.get(String(planoId));
    if (!plano || (plano.status === "cancelled" && !forcar)) throw new Error("Plano indisponível");
    const assinaturaId = `mp-sub-${randomUUID()}`;
    const assinatura = {
      id: assinaturaId,
      collector_id: collectorId,
      external_reference: null,
      payer_email: null,
      payer_id: payerId,
      preapproval_plan_id: plano.id,
      status: "authorized",
      date_created: new Date(Date.now() + numero++).toISOString(),
      last_modified: new Date().toISOString(),
      auto_recurring: structuredClone(plano.auto_recurring),
      reason: plano.reason,
      summarized: { charged_quantity: 1 },
    };
    assinaturas.set(assinaturaId, assinatura);
    const cobrancaId = String(700000 + numero);
    const pagamentoId = String(800000 + numero);
    const fatura = {
      id: Number(cobrancaId),
      preapproval_id: assinaturaId,
      type: "recurring",
      status: "processed",
      date_created: new Date().toISOString(),
      last_modified: new Date().toISOString(),
      transaction_amount: Number(plano.auto_recurring.transaction_amount),
      currency_id: plano.auto_recurring.currency_id ?? "BRL",
      reason: plano.reason,
      external_reference: plano.external_reference,
      payment: { id: Number(pagamentoId), status: pagamentoStatus, status_detail: "accredited" },
      retry_attempt: 0,
      debit_date: new Date().toISOString(),
      payment_method_id: "visa",
      _payer_email: payerEmail,
    };
    faturas.set(cobrancaId, fatura);
    pagamentos.set(pagamentoId, {
      id: Number(pagamentoId),
      collector_id: collectorId,
      external_reference: plano.external_reference,
      operation_type: "regular_payment",
      status: pagamentoStatus,
      currency_id: fatura.currency_id,
      transaction_amount: fatura.transaction_amount,
      payer: { id: Number(payerId), email: payerEmail },
    });
    return { assinatura: structuredClone(assinatura), fatura: structuredClone(fatura), pagamento: structuredClone(pagamentos.get(pagamentoId)) };
  }

  function cobrarAssinatura(assinaturaId, { payerEmail = "pagador@outro-dominio.test", debitoEmDias = 0, status = "processed", pagamentoStatus = "approved" } = {}) {
    const assinatura = assinaturas.get(String(assinaturaId));
    if (!assinatura) throw new Error("Assinatura inexistente");
    const plano = planos.get(String(assinatura.preapproval_plan_id));
    const cobrancaId = String(700000 + ++numero);
    const pagamentoId = String(800000 + ++numero);
    const debito = new Date(Date.now() + debitoEmDias * 864e5).toISOString();
    const fatura = {
      id: Number(cobrancaId), preapproval_id: assinatura.id, type: "recurring", status,
      date_created: debito, last_modified: debito,
      transaction_amount: Number(assinatura.auto_recurring.transaction_amount),
      currency_id: "BRL", reason: plano?.reason ?? assinatura.reason,
      external_reference: plano?.external_reference ?? assinatura.external_reference,
      payment: pagamentoStatus ? { id: Number(pagamentoId), status: pagamentoStatus, status_detail: "accredited" } : undefined,
      retry_attempt: 0, debit_date: debito, payment_method_id: "visa", _payer_email: payerEmail,
    };
    faturas.set(cobrancaId, fatura);
    const pagamento = {
      id: Number(pagamentoId), collector_id: collectorId, external_reference: fatura.external_reference,
      operation_type: "regular_payment", status: pagamentoStatus, currency_id: "BRL",
      transaction_amount: fatura.transaction_amount, payer: { email: payerEmail },
    };
    if (pagamentoStatus) pagamentos.set(pagamentoId, pagamento);
    assinatura.summarized = { charged_quantity: Number(assinatura.summarized?.charged_quantity ?? 0) + 1 };
    assinatura.last_modified = new Date().toISOString();
    return { assinatura: structuredClone(assinatura), fatura: structuredClone(fatura), pagamento: structuredClone(pagamento) };
  }

  function estornar(pagamentoId) {
    const pagamento = pagamentos.get(String(pagamentoId));
    if (!pagamento) throw new Error("Pagamento inexistente");
    pagamento.status = "refunded";
    for (const fatura of faturas.values()) if (String(fatura.payment?.id) === String(pagamentoId)) fatura.payment.status = "refunded";
  }

  function cancelarPeloMp(assinaturaId) {
    const assinatura = assinaturas.get(String(assinaturaId));
    assinatura.status = "cancelled";
    assinatura.last_modified = new Date().toISOString();
  }

  async function tratar(req, res) {
    const url = new URL(req.url, "http://mp-falso.local");
    pedidos.push({ method: req.method, path: `${url.pathname}${url.search}` });
    if (req.headers.authorization !== `Bearer ${token}`) return responder(res, 401, { message: "Unauthorized" });
    const falha = falhas.findIndex((f) => f.metodo === req.method && url.pathname.startsWith(f.caminho));
    if (falha >= 0) {
      const [{ status }] = falhas.splice(falha, 1);
      return responder(res, status, { message: `falha simulada ${status} para pagador@exemplo.test` });
    }
    let body = {};
    if (req.method !== "GET") {
      try {
        body = JSON.parse(await new Promise((resolve, reject) => {
          let raw = "";
          req.on("data", (chunk) => { raw += chunk; });
          req.on("end", () => resolve(raw || "{}"));
          req.on("error", reject);
        }));
      } catch { return responder(res, 400, { message: "Invalid JSON" }); }
    }

    if (req.method === "POST" && url.pathname === "/preapproval_plan") {
      const id = `mp-plan-${randomUUID()}`;
      const plan = {
        id,
        collector_id: collectorId,
        external_reference: String(body.external_reference ?? ""),
        init_point: `https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=${id}`,
        status: "active",
        reason: body.reason ?? "",
        back_url: body.back_url ?? "",
        auto_recurring: body.auto_recurring ?? {},
      };
      planos.set(id, plan);
      if (falharRespostaCriacao) {
        falharRespostaCriacao = false;
        return responder(res, 500, { message: "Creation succeeded but its response was lost" });
      }
      return responder(res, 201, plan);
    }

    if (url.pathname.startsWith("/preapproval_plan/")) {
      const id = decodeURIComponent(url.pathname.slice("/preapproval_plan/".length));
      const plan = planos.get(id);
      if (!plan) return responder(res, 404, { message: "Not found" });
      if (req.method === "GET") return responder(res, 200, plan);
      if (req.method !== "PUT") return responder(res, 405, { message: "Method not allowed" });
      if (body.status === "cancelled") {
        if (falharFechamentoPlano) { falharFechamentoPlano = false; return responder(res, 400, { message: "bad_request" }); }
        const assinaturaAtiva = [...assinaturas.values()].some((item) =>
          item.preapproval_plan_id === id && item.status === "authorized");
        if (assinaturaAtiva) return responder(res, 400, { message: "bad_request" });
        plan.status = "cancelled";
        return responder(res, 200, plan);
      }
      if (body.auto_recurring) {
        plan.auto_recurring = { ...plan.auto_recurring, ...body.auto_recurring };
        for (const assinatura of assinaturas.values()) {
          if (assinatura.preapproval_plan_id === id) assinatura.auto_recurring = structuredClone(plan.auto_recurring);
        }
      }
      if (body.reason !== undefined) {
        plan.reason = body.reason;
        for (const assinatura of assinaturas.values()) if (assinatura.preapproval_plan_id === id) assinatura.reason = body.reason;
      }
      return responder(res, 200, plan);
    }

    if (req.method === "GET" && url.pathname === "/preapproval/search") {
      const planId = url.searchParams.get("preapproval_plan_id");
      const results = [...assinaturas.values()].filter((item) =>
        !planId || item.preapproval_plan_id === planId);
      const limit = Math.min(Number(url.searchParams.get("limit") ?? 100), 100);
      return responder(res, 200, { results: results.slice(0, limit), paging: { limit, total: results.length } });
    }

    if (url.pathname.startsWith("/preapproval/")) {
      const id = decodeURIComponent(url.pathname.slice("/preapproval/".length));
      const assinatura = assinaturas.get(id);
      if (!assinatura) return responder(res, 404, { message: "Not found" });
      if (req.method === "GET") return responder(res, 200, assinatura);
      if (req.method !== "PUT") return responder(res, 405, { message: "Method not allowed" });
      if (body.status === "canceled") return responder(res, 400, { message: "Invalid preapproval status param" });
      if (falharSempreReferencia && body.external_reference !== undefined) return responder(res, 500, { message: "falha simulada" });
      if (body.status === "cancelled" && assinatura.status === "cancelled") {
        return responder(res, 400, { message: "You can not modify a cancelled preapproval" });
      }
      if (body.status === "authorized" && assinatura.status === "cancelled") {
        return responder(res, 400, { message: "Invalid transition" });
      }
      Object.assign(assinatura, body);
      assinatura.last_modified = new Date().toISOString();
      if (body.auto_recurring) assinatura.auto_recurring = { ...assinatura.auto_recurring, ...body.auto_recurring };
      return responder(res, 200, assinatura);
    }

    if (req.method === "GET" && url.pathname === "/authorized_payments/search") {
      const limit = Number(url.searchParams.get("limit") ?? 12);
      if (!Number.isInteger(limit) || limit < 1 || limit > 12) return responder(res, 400, { message: "Invalid value for limit" });
      const offset = Number(url.searchParams.get("offset") ?? 0);
      if (!Number.isInteger(offset) || offset < 0) return responder(res, 400, { message: "Invalid value for offset" });
      const results = [...faturas.values()].filter((item) => item.preapproval_id === url.searchParams.get("preapproval_id"));
      const pagina = results.slice(offset, offset + limit).map(({ _payer_email, ...item }) => item);
      return responder(res, 200, { results: pagina, paging: { limit, offset, total: results.length } });
    }

    if (req.method === "GET" && url.pathname.startsWith("/authorized_payments/")) {
      const fatura = faturas.get(url.pathname.slice("/authorized_payments/".length));
      if (!fatura) return responder(res, 404, { message: "Not found" });
      const { _payer_email, ...publica } = fatura;
      return responder(res, 200, publica);
    }

    if (req.method === "GET" && url.pathname.startsWith("/v1/payments/")) {
      const pagamento = pagamentos.get(url.pathname.slice("/v1/payments/".length));
      return pagamento ? responder(res, 200, pagamento) : responder(res, 404, { message: "Not found" });
    }

    return responder(res, 404, { message: "Not found" });
  }

  return { tratar, planos, assinaturas, faturas, pagamentos, pedidos, pagarPlano, cobrarAssinatura, estornar, cancelarPeloMp,
    falharProxima(metodo, caminho, status) { falhas.push({ metodo, caminho, status }); },
    trocarColetor(valor) { collectorId = valor; },
    get falharSempreReferencia() { return falharSempreReferencia; }, set falharSempreReferencia(value) { falharSempreReferencia = Boolean(value); },
    get falharRespostaCriacao() { return falharRespostaCriacao; }, set falharRespostaCriacao(value) { falharRespostaCriacao = Boolean(value); },
    get falharFechamentoPlano() { return falharFechamentoPlano; }, set falharFechamentoPlano(value) { falharFechamentoPlano = Boolean(value); } };
}
