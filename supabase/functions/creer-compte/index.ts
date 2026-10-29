// L'admin crée le compte d'un client depuis le back-office (e-mail + mot de passe provisoire, e-mail déjà confirmé).
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    // 1) l'appelant doit être admin
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } });
    const { data: who, error: e0 } = await userClient.rpc("whoami");
    if (e0 || !who?.admin) return json({ error: "Réservé à l'administrateur" }, 403);
    // 2) création du compte
    const { client_id, email, password, nom } = await req.json();
    if (!client_id || !email || !password || String(password).length < 8) return json({ error: "Données incomplètes" }, 400);
    const sb = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const mail = String(email).trim().toLowerCase();
    const { error: e1 } = await sb.from("clients").update({ email: mail }).eq("id", client_id);
    if (e1) return json({ error: e1.message }, 400);
    const { data, error } = await sb.auth.admin.createUser({ email: mail, password, email_confirm: true, user_metadata: { nom, app: "client", cree_par_admin: true } });
    if (error) return json({ error: error.message.includes("already") ? "Cet e-mail a déjà un compte" : error.message }, 400);
    return json({ ok: true, user_id: data.user?.id });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
