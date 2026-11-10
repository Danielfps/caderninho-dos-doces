import { estornoDePagamento, lerFatura, textoReason } from "./assinatura.mjs";
import { chamarMercadoPago, type Config, MercadoPagoError, rpcService, urlDeVolta } from "./servidor.ts";

export class ContratacaoError extends Error {
  constructor(readonly codigo: string, readonly status: number) { super(codigo); }
}

async function obterContratacao(config: Config, id: string) {
  const url = `${config.supabaseUrl}/rest/v1/contratacoes?select=*&id=eq.${encodeURIComponent(id)}&limit=1`;
  const res = await fetch(url, { headers: { apikey: config.serviceKey, Authorization: `Bearer ${config.serviceKey}` } });
  if (!res.ok) throw new Error(`Falha ao ler contratação (${res.status})`);
  const rows = await res.json();
  return Array.isArray(rows) ? rows[0] ?? null : null;
}

async function buscarAssinaturasDoPlano(config: Config, planoId: string) {
  const todas: any[] = [];
  for (let offset = 0; ; offset += 100) {
    const query = new URLSearchParams({ preapproval_plan_id: planoId, limit: "100", offset: String(offset) });
    const result = await chamarMercadoPago(config, `/preapproval/search?${query}`);
    const pagina = Array.isArray(result?.results) ? result.results : [];
    todas.push(...pagina.filter((item: any) => String(item?.preapproval_plan_id ?? "") === planoId
      && String(item?.collector_id ?? "") === config.mpCollectorId));
    if (pagina.length < 100 || Number(result?.paging?.total) <= offset + pagina.length) return todas;
  }
}

/* A assinatura nasce sem external_reference: quem prova que ela é nossa é o plano. */
async function cancelarNoMercadoPago(config: Config, id: string, planoId: string) {
  const corresponde = (assinatura: any) => String(assinatura?.id ?? "") === String(id)
    && String(assinatura?.collector_id ?? "") === config.mpCollectorId
    && (!planoId || String(assinatura?.preapproval_plan_id ?? "") === planoId);
  let result: any;
  try {
    result = await chamarMercadoPago(config, `/preapproval/${encodeURIComponent(id)}`, {
      method: "PUT", body: JSON.stringify({ status: "cancelled" }),
    });
  } catch (error) {
    if (!(error instanceof MercadoPagoError) || error.status !== 400) throw error;
    const atual = await chamarMercadoPago(config, `/preapproval/${encodeURIComponent(id)}`);
    if (!corresponde(atual) || String(atual?.status ?? "").toLowerCase() !== "cancelled") throw error;
    return atual;
  }
  if (!corresponde(result)
    || String(result?.status ?? "").toLowerCase() !== "cancelled") {
    throw new MercadoPagoError("Mercado Pago não confirmou o cancelamento");
  }
  return result;
}

async function fechar(config: Config, id: string, estado: "abandonada" | "cancelada") {
  await rpcService(config, "fechar_contratacao", { p_id: id, p_estado: estado });
}

/* Plano com assinatura autorizada não fecha (400): quem chama decide se isso é erro. */
async function fecharPlano(config: Config, id: string) {
  const result = await chamarMercadoPago(config, `/preapproval_plan/${encodeURIComponent(id)}`, {
    method: "PUT", body: JSON.stringify({ status: "cancelled" }),
  });
  if (String(result?.id) !== id || String(result?.collector_id) !== config.mpCollectorId || result?.status !== "cancelled") {
    throw new MercadoPagoError("Mercado Pago não confirmou o fechamento do plano");
  }
  await rpcService(config, "marcar_plano_fechado", { p_mp_plano_id: id });
  return result;
}

const contratacaoPaga = (estado: unknown) => ["ativa", "aguardando_pagamento"].includes(String(estado));

async function gravarCheckout(config: Config, row: any, mp: any) {
  if (!mp?.id || typeof mp.init_point !== "string") throw new MercadoPagoError("Resposta inválida do Mercado Pago");
  if (String(mp.external_reference ?? "") !== String(row.id) || String(mp.collector_id ?? "") !== config.mpCollectorId) {
    try { await fecharPlano(config, String(mp.id)); }
    catch (error) { console.error("Não consegui cancelar uma contratação com conta incompatível", error); }
    await fechar(config, row.id, "abandonada");
    throw new MercadoPagoError("Mercado Pago devolveu uma contratação incompatível");
  }
  const aceito = await rpcService(config, "confirmar_checkout", {
    p_id: row.id, p_operacao: row.operacao, p_mp_plano_id: String(mp.id), p_init_point: mp.init_point,
  });
  if (!aceito) {
    await fecharPlano(config, String(mp.id));
    throw new ContratacaoError("em_andamento", 409);
  }
  return { init_point: mp.init_point, contratacao_id: String(row.id) };
}

async function criarPlano(config: Config, row: any, volta?: unknown) {
  const frequency = row.plano === "anual" ? 12 : 1;
  const reason = textoReason(row.plano, Number(row.valor_inicial), Number(row.valor_recorrente));
  const payload = {
    reason,
    external_reference: String(row.id),
    auto_recurring: {
      frequency,
      frequency_type: "months",
      transaction_amount: Number(row.valor_inicial),
      currency_id: "BRL",
    },
    back_url: urlDeVolta(config, volta),
  };
  try {
    const created = await chamarMercadoPago(config, "/preapproval_plan", { method: "POST", body: JSON.stringify(payload) });
    return await gravarCheckout(config, row, created);
  } finally {
    await rpcService(config, "liberar_checkout", { p_id: row.id, p_operacao: row.operacao });
  }
}

export async function iniciar(config: Config, user: { id: string; email: string }, plano: unknown, volta?: unknown) {
  if (plano !== "mensal" && plano !== "anual") throw new ContratacaoError("pedido", 400);
  for (let tentativa = 0; tentativa < 4; tentativa++) {
    const acao = await rpcService(config, "iniciar_contratacao", { p_user: user.id, p_plano: plano });
    switch (acao?.acao) {
      case "plano_indisponivel": throw new ContratacaoError("plano_indisponivel", 409);
      case "limite": throw new ContratacaoError("limite", 429);
      case "ja_ativa": throw new ContratacaoError("ja_ativa", 409);
      case "em_andamento": throw new ContratacaoError("em_andamento", 409);
      case "reusar": {
        // Antes de entregar o mesmo link, confere se a pessoa já pagou: senão ela paga duas vezes.
        await sincronizarContratacao(config, { id: acao.id });
        const atual = await obterContratacao(config, String(acao.id));
        if (contratacaoPaga(atual?.estado)) throw new ContratacaoError("ja_ativa", 409);
        if (atual?.estado !== "checkout_pendente") continue;
        return { init_point: acao.init_point, contratacao_id: String(acao.id) };
      }
      case "criar": return await criarPlano(config, acao, volta);
      case "retomar": return await criarPlano(config, acao, volta);
      case "substituir": {
        let velho = await obterContratacao(config, String(acao.id));
        if (velho) {
          await sincronizarContratacao(config, velho);
          velho = await obterContratacao(config, String(acao.id)) ?? velho;
        }
        // Pagou e o aviso ainda não tinha chegado: nunca cancelar uma assinatura paga aqui.
        if (contratacaoPaga(velho?.estado)) throw new ContratacaoError("ja_ativa", 409);
        if (velho?.mp_preapproval_id) {
          await cancelarNoMercadoPago(config, String(velho.mp_preapproval_id), String(velho.mp_plano_id ?? ""));
        }
        if (velho?.mp_plano_id) await fecharPlano(config, String(velho.mp_plano_id));
        await fechar(config, String(acao.id), "abandonada");
        continue;
      }
      default: throw new Error("Resposta inválida ao iniciar contratação");
    }
  }
  throw new ContratacaoError("em_andamento", 409);
}

function valorMinimo(row: any) {
  return Math.min(Number(row.valor_inicial), Number(row.valor_recorrente));
}

async function fecharPlanoTolerante(config: Config, id: string) {
  try { await fecharPlano(config, id); }
  catch (error) {
    console.error("Não consegui fechar o plano; a sincronização continua", error instanceof MercadoPagoError ? { status: error.status } : { tipo: "erro" });
  }
}

async function registrarFatura(config: Config, row: any, fatura: any, assinaturaId: string, duplicada: boolean) {
  const f = lerFatura(fatura);
  if (!f || !f.id || f.contratacaoId !== assinaturaId
    || String(fatura?.external_reference ?? "") !== String(row.id) || f.moeda !== "BRL") return null;
  if (Number(f.valor) + 0.00001 < valorMinimo(row) && f.estado === "aprovada") {
    console.error("Cobrança abaixo do mínimo recusada", { contratacao_id: String(row.id), cobranca_id: f.id });
    return null;
  }
  // O aviso payment pode faltar e a fatura pode continuar aprovada depois do estorno.
  if (f.pagamentoId && f.estado === "aprovada") {
    const pagamento = await chamarMercadoPago(config, `/v1/payments/${encodeURIComponent(f.pagamentoId)}`);
    if (String(pagamento?.id) !== f.pagamentoId || String(pagamento?.collector_id) !== config.mpCollectorId
      || String(pagamento?.external_reference) !== String(row.id)) {
      throw new MercadoPagoError("Pagamento não corresponde à contratação");
    }
    if (estornoDePagamento(pagamento.status)) {
      await rpcService(config, "estornar_por_pagamento", { p_pagamento: f.pagamentoId, p_status: pagamento.status });
      f.estado = "estornada";
      f.pagamentoStatus = pagamento.status;
    }
  }
  const saved = await rpcService(config, "registrar_cobranca_assinatura", {
    p_mp_cobranca_id: f.id,
    p_contratacao: String(row.id),
    p_pagamento: f.pagamentoId,
    p_valor: f.valor,
    p_estado: f.estado,
    p_mp_status: f.status,
    p_pag_status: f.pagamentoStatus,
    p_debitada: f.debitadaEm,
    p_assinatura: assinaturaId,
    p_duplicada: duplicada,
  });
  return { ...f, estado: saved?.estado ?? f.estado, saved };
}

async function reconciliarPromocao(config: Config, row: any, preapproval: any, faturas: any[]) {
  if (row.plano !== "mensal" || Number(row.valor_inicial) >= Number(row.valor_recorrente)) return;
  if (String(preapproval?.status ?? "").toLowerCase() !== "authorized") return;
  if (!faturas.some((f: any) => f?.estado === "aprovada")) return;
  const atual = Number(preapproval?.auto_recurring?.transaction_amount);
  if (!Number.isFinite(atual) || atual >= Number(row.valor_recorrente)) return;
  const recorrente = Number(row.valor_recorrente);
  const autoRecurring = { transaction_amount: recorrente, currency_id: "BRL" };
  const reason = textoReason("mensal", recorrente, recorrente);
  if (row.mp_plano_id) {
    await chamarMercadoPago(config, `/preapproval_plan/${encodeURIComponent(row.mp_plano_id)}`, {
      method: "PUT", body: JSON.stringify({ auto_recurring: autoRecurring }),
    });
  }
  let updated = await chamarMercadoPago(config, `/preapproval/${encodeURIComponent(preapproval.id)}`);
  if (Number(updated?.auto_recurring?.transaction_amount) !== recorrente) {
    updated = await chamarMercadoPago(config, `/preapproval/${encodeURIComponent(preapproval.id)}`, {
      method: "PUT", body: JSON.stringify({ auto_recurring: autoRecurring, reason }),
    });
  }
  if (String(updated?.id ?? "") !== String(preapproval.id)
    || Number(updated?.auto_recurring?.transaction_amount) !== recorrente) {
    throw new MercadoPagoError("Mercado Pago não confirmou a atualização do preço");
  }
}

async function importarFaturas(config: Config, row: any, assinatura: any, duplicada = false) {
  if (String(assinatura?.status ?? "").toLowerCase() === "pending") return [];
  const todas: any[] = [];
  for (let offset = 0; ; offset += 12) {
    const result = await chamarMercadoPago(config,
      `/authorized_payments/search?preapproval_id=${encodeURIComponent(String(assinatura.id))}&limit=12&offset=${offset}`);
    const pagina = Array.isArray(result?.results) ? result.results : [];
    todas.push(...pagina.filter((fatura: any) => String(fatura?.preapproval_id ?? "") === String(assinatura.id)));
    if (pagina.length < 12) break;
  }
  // A validade de cada cobrança depende da anterior: registra sempre da mais antiga para a mais nova.
  const data = (fatura: any) => Date.parse(fatura?.debit_date ?? fatura?.date_created ?? "") || 0;
  todas.sort((a, b) => data(a) - data(b));
  const salvas: any[] = [];
  for (const fatura of todas) {
    const saved = await registrarFatura(config, row, fatura, String(assinatura.id), duplicada);
    if (saved) salvas.push(saved);
  }
  return salvas;
}

async function sincronizarAssinatura(config: Config, row: any, assinatura: any, faturas: any[]) {
  const aplicado = await rpcService(config, "aplicar_preapproval", {
    p_id: String(row.id), p_mp_id: String(assinatura.id), p_status: String(assinatura.status ?? "pending"),
    p_ultima_mudanca: assinatura.last_modified ?? assinatura.date_last_updated ?? null,
    p_proxima: assinatura.next_payment_date ?? null,
  });
  if (aplicado?.cancelar_no_mp) {
    await cancelarNoMercadoPago(config, String(assinatura.id), String(row.mp_plano_id ?? ""));
  }
  row = await obterContratacao(config, String(row.id)) ?? row;
  try { await reconciliarPromocao(config, row, assinatura, faturas); }
  catch (error) { console.error("Não consegui atualizar o valor promocional; vou tentar de novo", error instanceof MercadoPagoError ? { status: error.status } : { tipo: "erro" }); }
  if (["cancelada", "abandonada"].includes(String(aplicado?.estado ?? row.estado)) && row.mp_plano_id) {
    await fecharPlanoTolerante(config, String(row.mp_plano_id));
  }
  return aplicado;
}

async function sincronizarDadosContratacao(config: Config, contratacao: any) {
  if (!contratacao?.id) return null;
  let row = await obterContratacao(config, String(contratacao.id));
  if (!row) return null;
  const planoId = String(row.mp_plano_id ?? "");
  if (!planoId) {
    if (row.mp_preapproval_id) {
      const assinatura = await chamarMercadoPago(config, `/preapproval/${encodeURIComponent(row.mp_preapproval_id)}`);
      if (String(assinatura?.external_reference ?? "") !== String(row.id)
        || String(assinatura?.collector_id ?? "") !== config.mpCollectorId) {
        throw new MercadoPagoError("Assinatura não corresponde à contratação");
      }
      return await sincronizarAssinatura(config, row, assinatura, []);
    }
    if (row.estado === "checkout_pendente" && !row.cancelamento_pendente && Date.parse(row.expira_em ?? "") <= Date.now()) await fechar(config, String(row.id), "abandonada");
    return null;
  }

  const plano = await chamarMercadoPago(config, `/preapproval_plan/${encodeURIComponent(planoId)}`);
  if (String(plano?.id ?? "") !== planoId
    || String(plano?.external_reference ?? "") !== String(row.id)
    || String(plano?.collector_id ?? "") !== config.mpCollectorId) {
    throw new MercadoPagoError("Plano não corresponde à contratação ou à conta configurada");
  }
  const encontradas = await buscarAssinaturasDoPlano(config, planoId);
  let guardada: any = null;
  if (row.mp_preapproval_id) {
    guardada = await chamarMercadoPago(config, `/preapproval/${encodeURIComponent(row.mp_preapproval_id)}`);
    if (String(guardada?.id ?? "") !== String(row.mp_preapproval_id)
      || String(guardada?.preapproval_plan_id ?? "") !== planoId
      || String(guardada?.collector_id ?? "") !== config.mpCollectorId) {
      throw new MercadoPagoError("Assinatura não corresponde ao plano ou à conta configurada");
    }
    if (!encontradas.some((item: any) => String(item?.id ?? "") === String(guardada.id))) encontradas.push(guardada);
  }
  const statusDe = (item: any) => String(item?.status ?? "").toLowerCase();
  const maisAntiga = (a: any, b: any) => Date.parse(a.date_created ?? "") - Date.parse(b.date_created ?? "");
  const pagas = encontradas.filter((item: any) => statusDe(item) !== "pending").sort(maisAntiga);
  const ordenadas = pagas.filter((item: any) => statusDe(item) === "authorized");
  // Pagou e virou cancelada ou pausada antes da 1ª conferência: continua sendo a assinatura desta tentativa.
  let principal: any = guardada ?? ordenadas[0] ?? pagas[0] ?? null;
  if (!principal) {
    if (["cancelada", "abandonada"].includes(String(row.estado))) await fecharPlanoTolerante(config, planoId);
    if (row.expira_em && Date.parse(row.expira_em) <= Date.now() && row.estado !== "abandonada" && !row.cancelamento_pendente) {
      await fechar(config, String(row.id), "abandonada");
      await fecharPlanoTolerante(config, planoId);
    }
    return null;
  }

  if (principal.external_reference && String(principal.external_reference) !== String(row.id)) {
    throw new MercadoPagoError("Assinatura aponta para outra contratação");
  }
  row = { ...row, mp_preapproval_id: String(principal.id) };
  if (!principal.external_reference) {
    try {
      principal = await chamarMercadoPago(config, `/preapproval/${encodeURIComponent(principal.id)}`, {
        method: "PUT", body: JSON.stringify({ external_reference: String(row.id) }),
      });
    } catch (error) {
      console.error("Não consegui gravar a referência da assinatura; vou tentar de novo", error instanceof MercadoPagoError ? { status: error.status } : { tipo: "erro" });
    }
  }

  // Também as canceladas: o estorno de uma assinatura duplicada precisa chegar à cobrança dela.
  const faturasPrincipais = await importarFaturas(config, row, principal);
  const outras = pagas.filter((item: any) => String(item.id) !== String(principal.id));
  for (const assinatura of outras) await importarFaturas(config, row, assinatura, true);
  for (const duplicada of outras.filter((item: any) => statusDe(item) === "authorized")) {
    console.error("O link de uma contratação foi pago mais de uma vez; a assinatura extra será cancelada", {
      contratacao_id: String(row.id), assinatura_id: String(duplicada.id),
    });
    await cancelarNoMercadoPago(config, String(duplicada.id), planoId);
  }
  return await sincronizarAssinatura(config, row, principal, faturasPrincipais);
}

/* Fechar o plano é parte da confirmação, inclusive quando o checkout acabou entre as leituras. */
async function efetivarCancelamento(config: Config, row: any) {
  const planoId = String(row.mp_plano_id ?? "");
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    const assinaturas = planoId ? await buscarAssinaturasDoPlano(config, planoId) : [];
    if (row.mp_preapproval_id && !assinaturas.some((a: any) => String(a.id) === String(row.mp_preapproval_id))) {
      assinaturas.push(await chamarMercadoPago(config, `/preapproval/${encodeURIComponent(row.mp_preapproval_id)}`));
    }
    for (const assinatura of assinaturas) {
      if (!["cancelled", "canceled", "finished", "expired"].includes(String(assinatura.status).toLowerCase())) {
        await cancelarNoMercadoPago(config, String(assinatura.id), planoId);
      }
    }
    if (!planoId) return;
    try {
      const fechado = await fecharPlano(config, planoId);
      if (String(fechado?.id) !== planoId || String(fechado?.collector_id) !== config.mpCollectorId
        || String(fechado?.external_reference) !== String(row.id) || fechado?.status !== "cancelled") {
        throw new MercadoPagoError("Mercado Pago não confirmou o fechamento do plano");
      }
      return;
    } catch (error) {
      // Uma assinatura pode ter nascido depois da busca: reler e cancelar antes de tentar fechar.
      if (!(error instanceof MercadoPagoError) || error.status !== 400) throw error;
    }
  }
  throw new MercadoPagoError("O cancelamento ainda não foi confirmado");
}

export async function sincronizarContratacao(config: Config, contratacao: any) {
  if (!contratacao?.id) return null;
  const row = await obterContratacao(config, String(contratacao.id));
  if (!row) return null;
  try {
    let erroEncerramento: unknown = null;
    try {
      const extras = await rpcService(config, "planos_checkout_pendentes", { p_id: String(row.id) });
      for (const extra of extras) {
        try { await fecharPlano(config, String(extra.mp_plano_id)); }
        catch (error) { erroEncerramento ??= error; }
      }
    } catch (error) { erroEncerramento ??= error; }
    if (row.cancelamento_pendente) {
      try { await efetivarCancelamento(config, row); }
      catch (error) { erroEncerramento ??= error; }
    }
    // Dinheiro não espera a limpeza: importar faturas mesmo se o encerramento precisar de retentativa.
    const resultado = await sincronizarDadosContratacao(config, row);
    if (erroEncerramento !== null) throw erroEncerramento;
    if (row.cancelamento_pendente) await rpcService(config, "concluir_cancelamento", { p_id: String(row.id) });
    await rpcService(config, "marcar_sincronizada", { p_id: String(row.id) });
    return resultado;
  } catch (error) {
    await rpcService(config, "marcar_falha_sincronizacao", { p_id: String(row.id) })
      .catch(() => console.error("Não consegui registrar a falha da conferência", { contratacao_id: String(row.id) }));
    throw error;
  }
}

export async function cancelar(config: Config, userId: string) {
  const rows = await listarContratacoesUsuario(config, userId);
  const row = Array.isArray(rows) ? rows.find((r: any) => r.cancelamento_pendente
    || ["checkout_pendente", "aguardando_pagamento", "ativa", "pausada", "falha_pagamento"].includes(r.estado)) : null;
  if (!row) return null;
  await rpcService(config, "solicitar_cancelamento", { p_id: String(row.id) });
  await sincronizarContratacao(config, { id: row.id });
  return row.id;
}

export async function buscarContratacoesPendentes(config: Config, limite = 50) {
  const rows = await rpcService(config, "contratacoes_reconciliar", { p_limite: limite });
  return Array.isArray(rows) ? rows : [];
}

async function lerContratacoes(config: Config, filtros: Record<string, string>) {
  const query = new URLSearchParams({ select: "*", order: "criado_em.desc", limit: "50", ...filtros });
  const res = await fetch(`${config.supabaseUrl}/rest/v1/contratacoes?${query}`, {
    headers: { apikey: config.serviceKey, Authorization: `Bearer ${config.serviceKey}` },
  });
  if (!res.ok) throw new Error(`Falha ao listar contratações da conta (${res.status})`);
  const rows = await res.json();
  return Array.isArray(rows) ? rows : [];
}

/* Encerrar a recorrência não encerra a vida financeira das faturas. */
export async function listarContratacoesUsuario(config: Config, userId: string) {
  return await rpcService(config, "contratacoes_para_usuario", { p_user: userId });
}

export async function contaTemContratacao(config: Config, userId: string) {
  return (await lerContratacoes(config, { user_id: `eq.${userId}`, limit: "1" })).length > 0;
}
