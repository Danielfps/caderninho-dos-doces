import { tratar as assinatura } from "../supabase/functions/assinatura/handler.ts";
import { tratar as webhook } from "../supabase/functions/mp-webhook/handler.ts";
import { tratar as reconciliar } from "../supabase/functions/mp-reconciliar/handler.ts";

const port = Number(Deno.env.get("FUNCOES_PORT") ?? "8768");

Deno.serve({ hostname: "127.0.0.1", port }, async (req) => {
  const path = new URL(req.url).pathname;
  if (path === "/health") return Response.json({ ok: true });
  if (path === "/functions/v1/assinatura") return await assinatura(req);
  if (path === "/functions/v1/mp-webhook") return await webhook(req);
  if (path === "/functions/v1/mp-reconciliar") return await reconciliar(req);
  return Response.json({ erro: "not_found" }, { status: 404 });
});
