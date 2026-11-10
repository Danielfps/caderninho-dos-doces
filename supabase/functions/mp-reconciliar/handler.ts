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
    let falhas = 0;
    for (const row of rows) {
      try { await sincronizarContratacao(config, row); }
      catch (error) {
        falhas += 1;
        console.error("Falha ao reconciliar uma contratação", { contratacao_id: String(row.id), tipo: error instanceof Error ? error.name : "erro" });
      }
    }
    return responderJson(req, config, 200, { ok: true, sincronizadas: rows.length - falhas, falhas });
  } catch (error) {
    console.error("Falha na reconciliação de assinaturas", { tipo: error instanceof Error ? error.name : "erro" });
    return responderJson(req, config, 502, { erro: "mp_falhou" });
  }
}
