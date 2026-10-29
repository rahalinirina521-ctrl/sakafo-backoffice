-- Migration 011 : inscription par le client (fiche créée automatiquement), notifications admin (back-office + push)
create extension if not exists pg_net with schema extensions;

-- Configuration privée (clé VAPID privée, secret du webhook) — valeurs insérées hors dépôt Git
create table if not exists private.config (cle text primary key, valeur text not null);
-- Lecture réservée au service_role (fonctions Edge)
create or replace function public.config_push() returns json language sql stable security definer set search_path = '' as $$
  select json_object_agg(cle, valeur) from private.config where cle in ('vapid_public', 'vapid_private', 'hook_secret', 'vapid_sujet')
$$;
revoke execute on function public.config_push() from public, anon, authenticated;
grant execute on function public.config_push() to service_role;

-- Notifications pour l'admin
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  type text not null default 'info',          -- inscription | message | info
  titre text not null,
  texte text,
  lien text,                                   -- ex. #/clients?id=CL0003
  lu boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_date_idx on notifications(created_at desc);
alter table notifications enable row level security;
drop policy if exists "admin_all" on notifications;
create policy "admin_all" on notifications for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

-- Abonnements Web Push (téléphones / ordinateurs de l'admin)
create table if not exists push_abonnements (
  endpoint text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  p256dh text not null,
  auth text not null,
  appareil text,
  created_at timestamptz not null default now()
);
create index if not exists push_user_idx on push_abonnements(user_id);
alter table push_abonnements enable row level security;
drop policy if exists "push_soi" on push_abonnements;
create policy "push_soi" on push_abonnements for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Envoi d'une notification : ligne + appel de la fonction Edge « notifier » (push)
create or replace function private.notifier(p_type text, p_titre text, p_texte text, p_lien text) returns void language plpgsql security definer set search_path = '' as $$
declare nid uuid; secret text;
begin
  insert into public.notifications (type, titre, texte, lien) values (p_type, p_titre, p_texte, p_lien) returning id into nid;
  select valeur into secret from private.config where cle = 'hook_secret';
  if secret is not null then
    perform net.http_post(
      url := 'https://iehcmptnmugvxfnvzugu.supabase.co/functions/v1/notifier',
      body := jsonb_build_object('id', nid),
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-sakafo-secret', secret));
  end if;
exception when others then null; -- ne jamais bloquer une inscription ou un message
end $$;

-- Nouvel utilisateur : profil + fiche client automatique (sauf inscription depuis l'application livreur)
create or replace function private.on_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
declare meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb); cid text; cat text; lien text;
begin
  insert into public.profils (user_id, email, nom, telephone) values (new.id, lower(new.email), coalesce(meta ->> 'nom', ''), meta ->> 'telephone') on conflict (user_id) do nothing;
  perform private.relier_compte(new.email);
  if coalesce(meta ->> 'app', 'client') <> 'livreur'
     and not exists (select 1 from public.admins a where lower(a.email) = lower(new.email))
     and not exists (select 1 from public.profils where user_id = new.id and (client_id is not null or livreur_id is not null)) then
    cid := 'CL-' || upper(substr(replace(new.id::text, '-', ''), 1, 6));
    select id into cat from public.categories where id = meta ->> 'objectif' and statut <> 'attente';
    perform set_config('sakafo.interne', '1', true);
    insert into public.clients (id, nom, telephone, email, categorie_id, formule, actif, user_id, profil, notes)
      values (cid, coalesce(nullif(meta ->> 'nom', ''), split_part(new.email, '@', 1)), meta ->> 'telephone', lower(new.email),
              coalesce(cat, 'normal'), 'livraison', true, new.id, '{}'::jsonb, 'Inscrit depuis l''application')
      on conflict (id) do nothing;
    update public.profils set role = 'client', client_id = cid where user_id = new.id;
    perform set_config('sakafo.interne', '', true);
    lien := '#/clients?id=' || cid;
  else
    lien := '#/parametres';
  end if;
  perform private.notifier('inscription', '🆕 Nouvelle inscription : ' || coalesce(nullif(meta ->> 'nom', ''), new.email),
    concat_ws(' · ', new.email, meta ->> 'telephone', case when meta ->> 'app' = 'livreur' then 'application livreur' end), lien);
  return new;
end $$;

-- Message d'un client / livreur / invité → notification admin
create or replace function private.on_message() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(new.auteur_role, '') <> 'admin' then
    perform private.notifier('message', '💬 ' || coalesce(nullif(new.auteur_nom, ''), 'Message'), left(new.texte, 140), '#/messages?c=' || new.conversation);
  end if;
  return new;
end $$;
drop trigger if exists sakafo_on_message on messages;
create trigger sakafo_on_message after insert on messages for each row execute function private.on_message();

do $$ begin
  begin alter publication supabase_realtime add table notifications; exception when others then null; end;
end $$;

-- Le rôle de l'auteur d'un message est fixé par la base (pas par l'application)
create or replace function private.role_message() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then
    new.auteur_id := (select auth.uid());
    new.auteur_role := case when private.my_livreur_id() is not null then 'livreur' when private.my_client_id() is not null then 'client' else 'invite' end;
  else
    new.auteur_role := 'admin';
  end if;
  return new;
end $$;
drop trigger if exists sakafo_role_message on messages;
create trigger sakafo_role_message before insert on messages for each row execute function private.role_message();
