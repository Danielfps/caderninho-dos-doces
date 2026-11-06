import { isUuid } from "./assinatura.mjs";

export type Config = {
  supabaseUrl: string;
  anonKey: string;
  serviceKey: string;
  mpToken: string;
  mpCollectorId: string;
  mpApiUrl: string;
  appUrls: URL[];
};

export class MercadoPagoError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "MercadoPagoError";
  }
}
export class CodigoPendenteError extends Error {}
export class EmailPendenteError extends Error {}

function lerAal(token: string) {
  try {
    const parte = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(parte.padEnd(parte.length + ((4 - (parte.length % 4)) % 4), "=")));
    return typeof payload?.aal === "string" ? payload.aal : "aal1";
  } catch {
    return "aal1";
  }
}

export function carregarConfig(): Config | null {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.replace(/\/$/, "");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const mpToken = Deno.env.get("MP_ACCESS_TOKEN");
  const mpCollectorId = Deno.env.get("MP_COLLECTOR_ID");
  const appUrls = (Deno.env.get("APP_URLS") ?? "")
    .split(/[\n,]/).map((item) => item.trim()).filter(Boolean)
    .map((item) => { try { return new URL(item); } catch { return null; } })
    .filter((item): item is URL => item !== null);
  const mpApiUrl = (Deno.env.get("MP_API_URL") ?? "https://api.mercadopago.com").replace(/\/$/, "");
  // back_url só aceita https; endereço http em APP_URLS serve apenas para o navegador de desenvolvimento.
  if (!supabaseUrl || !anonKey || !serviceKey || !mpToken || !mpCollectorId || !appUrls.some((url) => url.protocol === "https:")) return null;
  try { if (new URL(mpApiUrl).protocol !== "http:" && new URL(mpApiUrl).protocol !== "https:") return null; }
  catch { return null; }
  return { supabaseUrl, anonKey, serviceKey, mpToken, mpCollectorId, mpApiUrl, appUrls };
}

export function responderJson(req: Request, config: Config | null, status: number, body: unknown) {
  const origin = req.headers.get("origin");
  const allowed = origin && config?.appUrls.some((url) => url.origin === origin);
  const headers = new Headers({ "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  if (allowed) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
    headers.set("Access-Control-Allow-Headers", "authorization, apikey, x-client-info, content-type, x-reconciliar-chave");
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  }
  return new Response(status === 204 || status === 304 ? null : JSON.stringify(body), { status, headers });
}

export function responderOptions(req: Request, config: Config | null) {
  const origin = req.headers.get("origin");
  if (!origin || !config?.appUrls.some((url) => url.origin === origin)) return responderJson(req, config, 403, { erro: "pedido" });
  return responderJson(req, config, 204, null);
}

export async function autenticar(req: Request, config: Config) {
  const authorization = req.headers.get("authorization") ?? "";
  if (!/^Bearer\s+\S+$/i.test(authorization)) return null;
  const response = await fetch(`${config.supabaseUrl}/auth/v1/user`, {
    headers: { apikey: config.anonKey, Authorization: authorization },
  });
  if (!response.ok) return null;
  const user = await response.json();
  if (!isUuid(user?.id) || typeof user?.email !== "string") return null;
  if (!(user.email_confirmed_at || user.confirmed_at)) throw new EmailPendenteError();
  const temCodigo = Array.isArray(user?.factors) && user.factors.some((f: any) => f?.status === "verified");
  if (temCodigo && lerAal(authorization.replace(/^Bearer\s+/i, "")) !== "aal2") throw new CodigoPendenteError();
  return { id: user.id as string, email: user.email as string, authorization };
}

/* Só a mensagem curta do erro, sem e-mail nem nada parecido com token. */
function limparMotivo(raw: string) {
  let texto = raw;
  try { const j = JSON.parse(raw); texto = String(j?.message ?? j?.error ?? ""); }
  catch { texto = ""; }
  return texto.replace(/[^\s@]+@[^\s@]+/g, "[e-mail]").replace(/(APP_USR|TEST)-[\w-]+/g, "[token]").slice(0, 160);
}

export async function chamarMercadoPago(config: Config, path: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort("timeout"), 15000);
  try {
    const response = await fetch(`${config.mpApiUrl}${path}`, {
      ...init,
      signal: init.signal ?? controller.signal,
      headers: { Authorization: `Bearer ${config.mpToken}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
    });
    if (!response.ok) {
      const motivo = limparMotivo(await response.text().catch(() => ""));
      console.error("Mercado Pago recusou o pedido", { status: response.status, caminho: path.split("?")[0], motivo });
      throw new MercadoPagoError(`Mercado Pago respondeu ${response.status} em ${path.split("?")[0]}`, response.status);
    }
    const raw = await response.text();
    try { return raw ? JSON.parse(raw) : null; }
    catch { throw new MercadoPagoError("Resposta inválida do Mercado Pago", response.status); }
  } catch (error) {
    if (error instanceof MercadoPagoError) throw error;
    if (controller.signal.aborted) throw new MercadoPagoError("Tempo esgotado ao falar com o Mercado Pago");
    throw new MercadoPagoError("Falha de comunicação com o Mercado Pago");
  } finally {
    clearTimeout(timer);
  }
}

export async function rpcService(config: Config, nome: string, argumentos: Record<string, unknown> = {}) {
  const response = await fetch(`${config.supabaseUrl}/rest/v1/rpc/${encodeURIComponent(nome)}`, {
    method: "POST",
    headers: { apikey: config.serviceKey, Authorization: `Bearer ${config.serviceKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(argumentos),
  });
  if (!response.ok) {
    const motivo = limparMotivo(await response.text().catch(() => ""));
    throw new Error(`RPC ${nome} falhou com status ${response.status}: ${motivo}`);
  }
  return await response.json();
}

export async function minhaSituacao(config: Config, authorization: string) {
  const response = await fetch(`${config.supabaseUrl}/rest/v1/rpc/minha_situacao`, {
    method: "POST", headers: { apikey: config.anonKey, Authorization: authorization, "Content-Type": "application/json" }, body: "{}",
  });
  if (!response.ok) throw new Error(`Falha ao consultar situação (${response.status})`);
  return await response.json();
}

export function urlDeVolta(config: Config, candidata?: unknown) {
  if (typeof candidata === "string") {
    try {
      const url = new URL(candidata);
      const ok = config.appUrls.find((permitida) => permitida.href === url.href && url.protocol === "https:");
      if (ok) return ok.href;
    } catch { /* usa o primeiro endereço https configurado */ }
  }
  return config.appUrls.find((url) => url.protocol === "https:")?.href ?? "";
}

export async function pegarPrecos(config: Config) {
  const response = await fetch(`${config.supabaseUrl}/rest/v1/planos?select=id,valor,meses,moeda,descricao&ativo=eq.true&id=in.(mensal,mensal_promo,anual)`, {
    headers: { apikey: config.serviceKey, Authorization: `Bearer ${config.serviceKey}` },
  });
  if (!response.ok) throw new Error(`Falha ao ler preços (${response.status})`);
  const linhas = await response.json();
  const porId = new Map((Array.isArray(linhas) ? linhas : []).map((linha: any) => [String(linha.id), linha]));
  const valor = (id: string) => {
    const n = Number((porId.get(id) as any)?.valor);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  return { mensal: valor("mensal"), promo: valor("mensal_promo"), anual: valor("anual"), linhas: porId };
}

export async function registrarCompra(config: Config, pagamentoId: string, userId: string, valor: number, aprovado: boolean, plano: "mensal" | "anual") {
  return await rpcService(config, "registrar_compra", {
    p_payment_id: pagamentoId, p_user: userId, p_valor: valor, p_aprovado: aprovado, p_plano: plano,
  });
}
