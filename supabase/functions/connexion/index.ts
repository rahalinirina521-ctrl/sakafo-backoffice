// Connexion par nom d'utilisateur (ou compte démo « demo » / « demo »).
// Renvoie une session Supabase ; l'e-mail associé au nom d'utilisateur n'est jamais révélé.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });
const URL_ = Deno.env.get("SUPABASE_URL")!;
const admin = createClient(URL_, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const ERREUR = "Nom d'utilisateur ou mot de passe incorrect";
const jour = (d: number) => new Date(Date.now() + 3 * 3600e3 + d * 864e5).toISOString().slice(0, 10); // Antananarivo

async function preparerDemo(cfg: Record<string, string>) {
  // compte (recréé si besoin, mot de passe toujours remis à la valeur de référence)
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const u = (list?.users || []).find((x) => (x.email || "").toLowerCase() === cfg.demo_email);
  if (!u) await admin.auth.admin.createUser({ email: cfg.demo_email, password: cfg.demo_password, email_confirm: true, user_metadata: { nom: "Compte démo", app: "demo" } });
  else await admin.auth.admin.updateUserById(u.id, { password: cfg.demo_password });
  // menus de la semaine
  const { data: menus } = await admin.from("menus").select("id, categorie_id").order("id");
  const ms = (menus || []).filter((m) => m.categorie_id === "perte-de-poids");
  const pool = ms.length ? ms : menus || [];
  if (pool.length) {
    const rows = Array.from({ length: 7 }, (_, i) => ({ id: `cli:CL-DEMO:${jour(i)}`, date: jour(i), menu_id: pool[i % pool.length].id, categorie_id: null, client_id: "CL-DEMO" }));
    await admin.from("calendrier").upsert(rows);
  }
  // livraison du jour en cours + position du livreur démo
  const now = Date.now();
  await admin.from("livraisons").upsert({ id: `LV-DEMO-${jour(0)}`, date: jour(0), creneau: "midi", client_id: "CL-DEMO", livreur_id: "LR-DEMO", statut: "en_route", ordre: 1,
    adresse: "Analakely, Antananarivo", repere: "Devant la pharmacie", lat: -18.9075, lng: 47.524, depart_at: new Date(now - 6 * 60e3).toISOString(), eta: new Date(now + 14 * 60e3).toISOString() });
  await admin.from("positions").upsert({ livreur_id: "LR-DEMO", lat: -18.9182, lng: 47.5338, precision: 10, updated_at: new Date().toISOString() });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { identifiant, password } = await req.json();
    const id = String(identifiant || "").trim().toLowerCase();
    if (!id || !password) return json({ error: ERREUR }, 400);
    const { data: cfg } = await admin.rpc("config_push");
    let email = id; let pwd = String(password);
    if (id === "demo") {
      if (pwd !== "demo") return json({ error: ERREUR }, 401);
      await preparerDemo(cfg);
      email = cfg.demo_email; pwd = cfg.demo_password;
    } else if (!id.includes("@")) {
      const { data: p } = await admin.from("profils").select("email").ilike("username", id).maybeSingle();
      if (!p?.email) return json({ error: ERREUR }, 401);
      email = p.email;
    }
    const anon = createClient(URL_, Deno.env.get("SUPABASE_ANON_KEY")!, { auth: { persistSession: false } });
    const { data, error } = await anon.auth.signInWithPassword({ email, password: pwd });
    if (error || !data.session) {
      const msg = error?.message || "";
      return json({ error: /confirm/i.test(msg) ? "Adresse e-mail pas encore confirmée : ouvrez l'e-mail reçu à l'inscription." : ERREUR }, 401);
    }
    return json({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
