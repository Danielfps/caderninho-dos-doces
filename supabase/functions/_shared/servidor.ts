import { isUuid, separarDuplicadas } from "./assinatura.mjs";

export type Config = {
  supabaseUrl: string;
  anonKey: string;
  serviceKey: string;
  mpToken: string;
  appUrls: URL[];
};

export class MercadoPagoError extends Error {}
/* conta com proteção em 2 etapas, mas o token ainda não passou pelo código (aal1) */
export class CodigoPendenteError extends Error {}

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
  const appUrls = (Deno.env.get("APP_URLS") ?? "")
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      try { return new URL(item); } catch { return null; }
    })
    .filter((item): item is URL => item !== null);
  if (!supabaseUrl || !anonKey || !serviceKey || !mpToken || appUrls.length === 0) return null;
  return { supabaseUrl, anonKey, serviceKey, mpToken, appUrls };
}

export function responderJson(req: Request, config: Config | null, status: number, body: unknown) {
  const origin = req.headers.get("origin");
  const allowed = origin && config?.appUrls.some((url) => url.origin === origin);
  const headers = new Headers({ "Content-Type": "application/json; charset=utf-8" });
  if (allowed) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
    headers.set("Access-Control-Allow-Headers", "authorization, apikey, x-client-info, content-type");
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  }
  const responseBody = status === 204 || status === 304 ? null : JSON.stringify(body);
  return new Response(responseBody, { status, headers });
}

export function responderOptions(req: Request, config: Config | null) {
  const origin = req.headers.get("origin");
  if (!origin || !config?.appUrls.some((url) => url.origin === origin)) {
    return responderJson(req, config, 403, { erro: "pedido" });
  }
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
  // O token já foi conferido pelo /auth/v1/user acima; aqui só se lê o nível dele.
  const temCodigo = Array.isArray(user?.factors) && user.factors.some((f: any) => f?.status === "verified");
  if (temCodigo && lerAal(authorization.replace(/^Bearer\s+/i, "")) !== "aal2") throw new CodigoPendenteError();
  return { id: user.id as string, email: user.email as string, authorization };
}

export async function chamarMercadoPago(config: Config, path: string, init: RequestInit = {}) {
  try {
    const response = await fetch(`https://api.mercadopago.com${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${config.mpToken}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });
    const raw = await response.text();
    let data: any = null;
    try { data = raw ? JSON.parse(raw) : null; } catch { /* resposta fora de JSON */ }
    if (!response.ok) throw new MercadoPagoError(`Mercado Pago respondeu ${response.status}`);
    return data;
  } catch (error) {
    if (error instanceof MercadoPagoError) throw error;
    throw new MercadoPagoError("Falha de comunicação com o Mercado Pago");
  }
}

/* Todas as assinaturas da conta no Mercado Pago. */
export async function buscarPreapprovals(config: Config, userId: string) {
  const busca = await chamarMercadoPago(
    config,
    `/preapproval/search?external_reference=${encodeURIComponent(userId)}&limit=100`,
  );
  return (Array.isArray(busca?.results) ? busca.results : []).filter((p: any) => p?.id && p?.external_reference === userId);
}

/* Duas assinaturas autorizadas = duas cobranças por mês. Cancela as duplicadas e devolve a que fica.
   Se não der para cancelar agora, registra no log; o próximo aviso ou "conferir" tenta de novo. */
export async function cancelarDuplicadas(config: Config, lista: any[]) {
  const { manter, duplicadas } = separarDuplicadas(lista);
  for (const p of duplicadas) {
    try {
      await chamarMercadoPago(config, `/preapproval/${encodeURIComponent(p.id)}`, {
        method: "PUT",
        body: JSON.stringify({ status: "cancelled" }),
      });
      console.warn("Assinatura duplicada cancelada no Mercado Pago", p.id);
    } catch (error) {
      console.error("Não consegui cancelar a assinatura duplicada", p.id, error);
    }
  }
  return manter;
}

export async function lerAssinatura(config: Config, userId: string) {
  const query = new URLSearchParams({
    select: "user_id,status,valido_ate,mp_preapproval_id,atualizado_em",
    user_id: `eq.${userId}`,
    limit: "1",
  });
  const response = await fetch(`${config.supabaseUrl}/rest/v1/assinaturas?${query}`, {
    headers: { apikey: config.serviceKey, Authorization: `Bearer ${config.serviceKey}` },
  });
  if (!response.ok) throw new Error("Falha ao ler assinatura");
  return (await response.json())[0] ?? null;
}

export async function gravarAssinatura(config: Config, userId: string, dados: Record<string, unknown>) {
  const headers = {
    apikey: config.serviceKey,
    Authorization: `Bearer ${config.serviceKey}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
  const current = await lerAssinatura(config, userId);
  if (current) {
    const query = new URLSearchParams({ user_id: `eq.${userId}` });
    if (dados.status === "pendente") query.set("status", "neq.ativa");
    const response = await fetch(`${config.supabaseUrl}/rest/v1/assinaturas?${query}`, {
      method: "PATCH", headers, body: JSON.stringify(dados),
    });
    if (!response.ok) throw new Error("Falha ao atualizar assinatura");
    const atualizada = (await response.json())[0] ?? null;
    if (atualizada || dados.status !== "pendente") return atualizada;
    const atual = await lerAssinatura(config, userId);
    if (atual?.status === "ativa") {
      const preserveQuery = new URLSearchParams({ user_id: `eq.${userId}`, status: "eq.ativa" });
      const preserve = await fetch(`${config.supabaseUrl}/rest/v1/assinaturas?${preserveQuery}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ mp_preapproval_id: dados.mp_preapproval_id, atualizado_em: dados.atualizado_em }),
      });
      if (!preserve.ok) throw new Error("Falha ao preservar assinatura ativa");
      return (await preserve.json())[0] ?? atual;
    }
    return atual;
  }
  const response = await fetch(`${config.supabaseUrl}/rest/v1/assinaturas`, {
    method: "POST", headers, body: JSON.stringify({ user_id: userId, ...dados }),
  });
  if (response.status === 409) return await gravarAssinatura(config, userId, dados);
  if (!response.ok) throw new Error("Falha ao criar assinatura");
  return (await response.json())[0] ?? null;
}

export async function minhaSituacao(config: Config, authorization: string) {
  const response = await fetch(`${config.supabaseUrl}/rest/v1/rpc/minha_situacao`, {
    method: "POST",
    headers: {
      apikey: config.anonKey,
      Authorization: authorization,
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  if (!response.ok) throw new Error("Falha ao consultar situação");
  return await response.json();
}

export function urlDeVolta(config: Config, candidata: unknown) {
  const primeira = config.appUrls[0].href;
  if (typeof candidata !== "string") return primeira;
  try {
    const url = new URL(candidata);
    return config.appUrls.some((permitida) => permitida.href === url.href) ? url.href : primeira;
  } catch {
    return primeira;
  }
}

export async function pegarPreco(config: Config) {
  const response = await fetch(`${config.supabaseUrl}/rest/v1/planos?select=valor&id=eq.mensal&ativo=eq.true&limit=1`, {
    headers: { apikey: config.serviceKey, Authorization: `Bearer ${config.serviceKey}` },
  });
  if (!response.ok) throw new Error("Falha ao ler preço");
  const preco = Number((await response.json())[0]?.valor);
  if (!Number.isFinite(preco) || preco <= 0) throw new Error("Preço mensal inválido");
  return preco;
}
