import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// IA ao amin'ny back-office: mandefa ny prompt any amin'ny Claude (Anthropic) ary mamerina ny valiny.
// Ny admin ihany (table public.admins) no afaka miantso azy.
// Secrets ilaina: ANTHROPIC_API_KEY (tsy maintsy), ANTHROPIC_MODEL (tsy voatery).

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST uniquement" }, 405);
  try {
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: u } = await admin.auth.getUser(token);
    const email = u?.user?.email?.toLowerCase();
    if (!email) return json({ error: "Non connecté", code: "auth" }, 401);
    const { data: row } = await admin.from("admins").select("email").eq("email", email).maybeSingle();
    if (!row) return json({ error: "Non autorisé", code: "forbidden" }, 403);

    const key = Deno.env.get("ANTHROPIC_API_KEY");
    if (!key) return json({ error: "Clé API IA non configurée (secret ANTHROPIC_API_KEY)", code: "no_key" }, 503);

    const body = await req.json().catch(() => ({}));
    const prompt = typeof body.prompt === "string" ? body.prompt : "";
    if (!prompt || prompt.length > 80000) return json({ error: "Prompt invalide" }, 400);

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: Deno.env.get("ANTHROPIC_MODEL") || "claude-sonnet-5-5",
        max_tokens: 8000,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return json({ error: j?.error?.message || `Erreur IA ${r.status}`, code: "ai" }, 502);
    const text = (j.content || []).filter((c: { type: string }) => c.type === "text").map((c: { text: string }) => c.text).join("\n");
    return json({ text });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
