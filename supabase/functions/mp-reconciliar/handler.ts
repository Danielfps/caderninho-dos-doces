import { buscarContratacoesPendentes, sincronizarContratacao } from "../_shared/contratacao.ts";
import { carregarConfig, responderJson } from "../_shared/servidor.ts";

function mesmaChave(a: string, b: string) {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  const n = Math.max(x.length, y.length);
  for (let i = 0; i < n; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

export async function tratar(req: Request): Promise<Response> {
  const config = carregarConfig();
  if (req.method !== "POST") return responderJson(req, config, 400, { erro: "pedido" });
  if (!config) return responderJson(req, config, 500, { erro: "config" });
  const segredo = Deno.env.get("RECONCILIAR_CHAVE");
  if (!segredo) return responderJson(req, config, 500, { erro: "config" });
  if (!mesmaChave(req.headers.get("x-reconciliar-chave") ?? "", segredo)) {
    return responderJson(req, config, 401, { erro: "chave_invalida" });
  }
  try {
    const rows = await buscarContratacoesPendentes(config, 50);
    const agora = Date.now();
    const elegiveis = rows.filter((row: any) => {
      const sincronizada = Date.parse(String(row.sincronizada_em ?? "")) || 0;
      const proxima = Date.parse(String(row.proxima_cobranca ?? "")) || 0;
      return row.estado === "aguardando_pagamento" || !sincronizada || agora - sincronizada >= 6 * 3600000 || (proxima > 0 && proxima <= agora);
    });
    let falhas = 0;
    for (const row of elegiveis) {
      try { await sincronizarContratacao(config, row); }
      catch (error) {
        falhas += 1;
        console.error("Falha ao reconciliar uma contratação", { contratacao_id: String(row.id), tipo: error instanceof Error ? error.name : "erro" });
      }
    }
    return responderJson(req, config, 200, { ok: true, sincronizadas: elegiveis.length - falhas, falhas });
  } catch (error) {
    console.error("Falha na reconciliação de assinaturas", { tipo: error instanceof Error ? error.name : "erro" });
    return responderJson(req, config, 502, { erro: "mp_falhou" });
  }
}
