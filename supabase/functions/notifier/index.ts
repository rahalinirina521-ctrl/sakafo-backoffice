// Envoie une notification push (Web Push / VAPID) aux appareils de l'admin, ou d'un client (communauté).
// Appelée par la base (private.notifier → pg_net) avec l'en-tête x-sakafo-secret.
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

type Sub = { endpoint: string; p256dh: string; auth: string };
async function envoyer(subs: Sub[], msg: Record<string, unknown>) {
  const payload = JSON.stringify(msg);
  let ok = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 86400, urgency: "high" });
      ok++;
    } catch (err) {
      const code = (err as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await sb.from("push_abonnements").delete().eq("endpoint", s.endpoint);
    }
  }
  return ok;
}

Deno.serve(async (req) => {
  try {
    const { data: cfg, error: e1 } = await sb.rpc("config_push");
    if (e1 || !cfg) return new Response("config", { status: 500 });
    if (req.headers.get("x-sakafo-secret") !== cfg.hook_secret) return new Response("forbidden", { status: 403 });
    const { id, client_notif } = await req.json();
    webpush.setVapidDetails(cfg.vapid_sujet || "mailto:admin@sakafo.mg", cfg.vapid_public, cfg.vapid_private);
    // Notification d'un client (communauté) : envoyée à ses appareils, ouvre l'application client
    if (client_notif) {
      const { data: cn } = await sb.from("notifs_client").select("*").eq("id", client_notif).single();
      if (!cn) return new Response("introuvable", { status: 404 });
      const { data: pr } = await sb.from("profils").select("user_id").eq("client_id", cn.client_id);
      const uids = (pr || []).map((x: { user_id: string }) => x.user_id);
      if (!uids.length) return Response.json({ envoyes: 0 });
      const { data: subs } = await sb.from("push_abonnements").select("*").in("user_id", uids);
      return Response.json({ envoyes: await envoyer(subs || [], { id: cn.id, titre: cn.titre, texte: cn.texte || "", lien: cn.lien, page: "client.html" }) });
    }
    const { data: n } = await sb.from("notifications").select("*").eq("id", id).single();
    if (!n) return new Response("introuvable", { status: 404 });
    const { data: admins } = await sb.from("admins").select("email");
    const emails = (admins || []).map((a: { email: string }) => a.email.toLowerCase());
    const { data: users } = await sb.auth.admin.listUsers({ perPage: 1000 });
    const ids = (users?.users || []).filter((u) => emails.includes((u.email || "").toLowerCase())).map((u) => u.id);
    if (!ids.length) return Response.json({ envoyes: 0 });
    const { data: subs } = await sb.from("push_abonnements").select("*").in("user_id", ids);
    return Response.json({ envoyes: await envoyer(subs || [], { id: n.id, titre: n.titre, texte: n.texte, lien: n.lien, page: "index.html" }) });
  } catch (e) {
    return new Response(String(e), { status: 500 });
  }
});
