// Sauvegarde complète de la base (JSON) dans le stockage privé « sauvegardes ».
// Appelée chaque nuit par pg_cron (en-tête x-sakafo-secret) ou à la demande par l'admin (« Sauvegarder maintenant »).
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-sakafo-secret", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });
const URL_ = Deno.env.get("SUPABASE_URL")!;
const sb = createClient(URL_, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const TABLES = ["categories", "ingredients", "offres", "options", "plats", "composition", "menus", "clients", "livreurs", "calendrier", "mesures", "livraisons",
  "suggestions", "avis", "communaute", "amis", "publications", "reactions", "incidents", "messages", "notifications", "admins", "profils"];
const GARDER = 30;

async function tout(table: string) {
  const rows: unknown[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from(table).select("*").range(from, from + 999);
    if (error) return { erreur: error.message, rows };
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return { rows };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { data: cfg } = await sb.rpc("config_push");
    let source = "manuel";
    if (req.headers.get("x-sakafo-secret") && req.headers.get("x-sakafo-secret") === cfg?.hook_secret) source = "auto";
    else {
      const user = createClient(URL_, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } });
      const { data: who } = await user.rpc("whoami");
      if (!who?.admin) return json({ error: "Réservé à l'administrateur" }, 403);
    }
    const dump: Record<string, unknown> = { _meta: { app: "sakafo", version: 1, date: new Date().toISOString(), source } };
    const compte: Record<string, number> = {};
    for (const t of TABLES) { const r = await tout(t); dump[t] = r.rows; compte[t] = r.rows.length; }
    const d = new Date(Date.now() + 3 * 3600e3).toISOString().replace(/[:T]/g, "-").slice(0, 16);
    const chemin = `${source}/${d}.json`;
    const corps = new Blob([JSON.stringify(dump)], { type: "application/json" });
    const { error } = await sb.storage.from("sauvegardes").upload(chemin, corps, { contentType: "application/json", upsert: true });
    if (error) return json({ error: error.message }, 500);
    // rotation : on garde les 30 plus récentes de chaque type
    const { data: liste } = await sb.storage.from("sauvegardes").list(source, { limit: 1000, sortBy: { column: "name", order: "desc" } });
    const vieux = (liste || []).slice(GARDER).map((f) => `${source}/${f.name}`);
    if (vieux.length) await sb.storage.from("sauvegardes").remove(vieux);
    return json({ ok: true, chemin, compte });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
