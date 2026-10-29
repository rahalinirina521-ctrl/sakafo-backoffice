-- Migration 013 : communauté (amis, publications, réactions), avis, incidents livreur, messagerie par interlocuteur,
-- journal d'activité, limitation des tentatives de connexion, sauvegardes automatiques.

-- ---------- Communauté (adhésion volontaire) ----------
create table if not exists communaute (
  client_id text primary key references clients(id) on delete cascade,
  pseudo text not null check (char_length(pseudo) between 2 and 30),
  bio text check (char_length(bio) <= 200),
  visible boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists communaute_pseudo_idx on communaute (lower(pseudo));

create table if not exists amis (
  id uuid primary key default gen_random_uuid(),
  de text not null references clients(id) on delete cascade,
  a text not null references clients(id) on delete cascade,
  statut text not null default 'attente' check (statut in ('attente', 'accepte', 'refuse')),
  created_at timestamptz not null default now(),
  check (de <> a),
  unique (de, a)
);
create index if not exists amis_a_idx on amis(a);

create table if not exists publications (
  id uuid primary key default gen_random_uuid(),
  client_id text not null references clients(id) on delete cascade,
  type text not null default 'texte' check (type in ('performance', 'motivation', 'texte')),
  texte text not null check (char_length(texte) between 1 and 1000),
  data jsonb not null default '{}',
  visibilite text not null default 'amis' check (visibilite in ('amis', 'communaute')),
  masque boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists publications_client_idx on publications(client_id, created_at desc);

create table if not exists reactions (
  publication_id uuid not null references publications(id) on delete cascade,
  client_id text not null references clients(id) on delete cascade,
  emoji text not null check (emoji in ('👏', '💪', '🔥', '❤️', '🎉')),
  created_at timestamptz not null default now(),
  primary key (publication_id, client_id)
);
create index if not exists reactions_client_idx on reactions(client_id);

-- ---------- Avis ----------
create table if not exists avis (
  id uuid primary key default gen_random_uuid(),
  client_id text not null references clients(id) on delete cascade,
  cible_type text not null check (cible_type in ('plat', 'livreur', 'service')),
  cible_id text not null default '',
  note int not null check (note between 1 and 5),
  commentaire text check (char_length(commentaire) <= 1000),
  masque boolean not null default false,
  reponse text,
  created_at timestamptz not null default now(),
  unique (client_id, cible_type, cible_id)
);
create index if not exists avis_cible_idx on avis(cible_type, cible_id);
alter table avis add column if not exists auteur text;
-- Le client ne peut ni se répondre ni se « démasquer » ; le prénom affiché est fixé par la base
create or replace function private.protege_avis() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then
    new.auteur := (select split_part(trim(nom), ' ', 1) from public.clients where id = new.client_id);
    if tg_op = 'INSERT' then new.reponse := null; new.masque := false;
    else new.reponse := old.reponse; new.masque := old.masque; new.client_id := old.client_id; end if;
  end if;
  return new;
end $$;
drop trigger if exists sakafo_protege_avis on avis;
create trigger sakafo_protege_avis before insert or update on avis for each row execute function private.protege_avis();

-- ---------- Incidents livreur ----------
create table if not exists incidents (
  id uuid primary key default gen_random_uuid(),
  livreur_id text not null references livreurs(id) on delete cascade,
  type text not null default 'autre',            -- panne | crevaison | accident | embouteillage | meteo | autre
  description text,
  duree_min int not null default 15 check (duree_min between 1 and 600),
  statut text not null default 'en_cours' check (statut in ('en_cours', 'resolu')),
  lat double precision, lng double precision,
  created_at timestamptz not null default now(),
  resolu_at timestamptz
);
create index if not exists incidents_livreur_idx on incidents(livreur_id, created_at desc);

-- ---------- Journal d'activité ----------
create table if not exists journal (
  id bigint generated always as identity primary key,
  quand timestamptz not null default now(),
  user_id uuid, email text, action text not null, table_nom text not null, ligne_id text, details jsonb
);
create index if not exists journal_quand_idx on journal(quand desc);

-- ---------- Fonctions d'accès ----------
create or replace function private.membre(cid text) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.communaute where client_id = cid and visible)
$$;
create or replace function private.sont_amis(x text, y text) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.amis where statut = 'accepte' and ((de = x and a = y) or (de = y and a = x)))
$$;

-- Conversations : client:<id> (équipe), livclient:<id> (livreur du jour ↔ client), livreur:<id> (équipe ↔ livreur),
-- user:<uuid> (invité ↔ équipe), dm:<clientA>|<clientB> (entre amis)
create or replace function private.can_chat(conv text) returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_admin()
    or conv = 'client:' || private.my_client_id()
    or conv = 'livclient:' || private.my_client_id()
    or conv = 'livreur:' || private.my_livreur_id()
    or conv = 'user:' || (select auth.uid())::text
    or (conv like 'livclient:%' and private.livreur_sert_client(substr(conv, 11)))
    or (conv like 'dm:%' and private.my_client_id() is not null
        and private.my_client_id() in (split_part(substr(conv, 4), '|', 1), split_part(substr(conv, 4), '|', 2))
        and private.sont_amis(split_part(substr(conv, 4), '|', 1), split_part(substr(conv, 4), '|', 2)))
$$;

-- Les messages système (incidents…) gardent leur auteur
create or replace function private.role_message() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null or private.interne() then return new; end if;
  if not private.is_admin() then
    new.auteur_id := (select auth.uid());
    new.auteur_role := case when private.my_livreur_id() is not null then 'livreur' when private.my_client_id() is not null then 'client' else 'invite' end;
  else
    new.auteur_role := 'admin';
  end if;
  return new;
end $$;

-- L'admin n'est notifié que pour les conversations avec l'équipe
create or replace function private.on_message() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(new.auteur_role, '') <> 'admin' and (new.conversation like 'client:%' or new.conversation like 'user:%' or new.conversation like 'livreur:%') then
    perform private.notifier('message', '💬 ' || coalesce(nullif(new.auteur_nom, ''), 'Message'), left(new.texte, 140), '#/messages?c=' || new.conversation);
  end if;
  return new;
end $$;

-- ---------- Incidents : retard automatique + excuses aux clients + alerte admin ----------
create or replace function private.on_incident() returns trigger language plpgsql security definer set search_path = '' as $$
declare r record; nom text; lib text; n int := 0; jour date := private.today_mg();
begin
  select l.nom into nom from public.livreurs l where l.id = new.livreur_id;
  lib := case new.type when 'panne' then 'une panne de moto' when 'crevaison' then 'une crevaison' when 'accident' then 'un accident (sans gravité pour votre repas)'
    when 'embouteillage' then 'de gros embouteillages' when 'meteo' then 'une forte pluie' else 'un imprévu' end;
  perform set_config('sakafo.interne', '1', true);
  if tg_op = 'INSERT' then
    for r in select * from public.livraisons where livreur_id = new.livreur_id and date = jour and statut in ('prevue', 'en_route') loop
      update public.livraisons set eta = greatest(coalesce(eta, now()), now()) + make_interval(mins => new.duree_min) where id = r.id;
      insert into public.messages (conversation, auteur_role, auteur_nom, texte) values ('client:' || r.client_id, 'admin', 'Sakafo Sur Mesure',
        '😔 Votre livreur a rencontré ' || lib || '. Nouveau délai estimé : +' || new.duree_min || ' min (arrivée vers '
        || to_char((greatest(coalesce(r.eta, now()), now()) + make_interval(mins => new.duree_min)) at time zone 'Indian/Antananarivo', 'HH24:MI')
        || '). Toutes nos excuses pour ce retard, nous faisons le maximum.' || E'\n' || '🇲🇬 Nisy olana kely teny an-dalana ny mpitondra sakafo. Miala tsiny amin''ny fahatarana, ho tonga tsy ho ela izy.');
      n := n + 1;
    end loop;
    perform private.notifier('incident', '⚠️ Incident : ' || coalesce(nom, new.livreur_id) || ' — ' || new.type,
      n || ' livraison(s) retardée(s) d''environ ' || new.duree_min || ' min' || coalesce(' · ' || nullif(new.description, ''), ''), '#/livraisons');
  elsif new.statut = 'resolu' and old.statut <> 'resolu' then
    for r in select distinct client_id from public.livraisons where livreur_id = new.livreur_id and date = jour and statut in ('prevue', 'en_route') loop
      insert into public.messages (conversation, auteur_role, auteur_nom, texte) values ('client:' || r.client_id, 'admin', 'Sakafo Sur Mesure',
        '✅ Problème réglé : votre livreur est reparti, suivez-le en direct dans « Livraison ». Merci pour votre patience 🙏');
    end loop;
    perform private.notifier('incident', '✅ Incident résolu : ' || coalesce(nom, new.livreur_id), null, '#/livraisons');
  end if;
  perform set_config('sakafo.interne', '', true);
  return new;
end $$;
drop trigger if exists sakafo_on_incident on incidents;
create trigger sakafo_on_incident after insert or update of statut on incidents for each row execute function private.on_incident();

-- Avis → notification admin
create or replace function private.on_avis() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.notifier('avis', '⭐ ' || new.note || '/5 — avis ' || new.cible_type, left(coalesce(new.commentaire, ''), 140), '#/avis');
  return new;
end $$;
drop trigger if exists sakafo_on_avis on avis;
create trigger sakafo_on_avis after insert on avis for each row execute function private.on_avis();

-- Compte démo : lecture seule partout
do $$ declare t text; begin
  foreach t in array array['communaute', 'amis', 'publications', 'reactions', 'avis'] loop
    execute format('drop trigger if exists sakafo_demo on %I', t);
    execute format('create trigger sakafo_demo before insert or update or delete on %I for each row execute function private.bloque_demo()', t);
  end loop;
end $$;

-- Journal (actions sur les données sensibles)
create or replace function private.journaliser() returns trigger language plpgsql security definer set search_path = '' as $$
declare cles text[];
begin
  if tg_op = 'UPDATE' then
    select array_agg(k) into cles from jsonb_each(to_jsonb(new)) e(k, v) where to_jsonb(old) -> k is distinct from v;
    if cles is null then return new; end if;
  end if;
  insert into public.journal (user_id, email, action, table_nom, ligne_id, details)
  values ((select auth.uid()), (select email from auth.users where id = (select auth.uid())), tg_op, tg_table_name,
          coalesce(to_jsonb(new) ->> 'id', to_jsonb(old) ->> 'id', to_jsonb(new) ->> 'email', to_jsonb(old) ->> 'email'),
          case when tg_op = 'UPDATE' then jsonb_build_object('champs', cles) when tg_op = 'DELETE' then to_jsonb(old) else null end);
  return coalesce(new, old);
end $$;
do $$ declare t text; begin
  foreach t in array array['clients', 'offres', 'categories', 'plats', 'livreurs', 'menus', 'admins', 'avis', 'publications'] loop
    execute format('drop trigger if exists sakafo_journal on %I', t);
    execute format('create trigger sakafo_journal after insert or update or delete on %I for each row execute function private.journaliser()', t);
  end loop;
end $$;

-- Suppressions seulement (pour pouvoir restaurer un plat avec sa composition, un menu avec son planning…)
do $$ declare t text; begin
  foreach t in array array['composition', 'calendrier', 'mesures', 'livraisons', 'ingredients'] loop
    execute format('drop trigger if exists sakafo_journal_suppr on %I', t);
    execute format('create trigger sakafo_journal_suppr after delete on %I for each row execute function private.journaliser()', t);
  end loop;
end $$;

-- ---------- RLS ----------
do $$ declare t text; begin
  foreach t in array array['communaute', 'amis', 'publications', 'reactions', 'avis', 'incidents', 'journal'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "admin_all" on %I', t);
    execute format('create policy "admin_all" on %I for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()))', t);
  end loop;
end $$;

drop policy if exists "communaute_lecture" on communaute;
create policy "communaute_lecture" on communaute for select to authenticated using (visible or client_id = (select private.my_client_id()));
drop policy if exists "communaute_soi" on communaute;
create policy "communaute_soi" on communaute for all to authenticated using (client_id = (select private.my_client_id())) with check (client_id = (select private.my_client_id()));

drop policy if exists "amis_lecture" on amis;
create policy "amis_lecture" on amis for select to authenticated using ((select private.my_client_id()) in (de, a));
drop policy if exists "amis_demande" on amis;
create policy "amis_demande" on amis for insert to authenticated with check (de = (select private.my_client_id()) and statut = 'attente' and (select private.membre(a)) and (select private.membre(de)));
drop policy if exists "amis_reponse" on amis;
create policy "amis_reponse" on amis for update to authenticated using (a = (select private.my_client_id())) with check (a = (select private.my_client_id()));
drop policy if exists "amis_suppr" on amis;
create policy "amis_suppr" on amis for delete to authenticated using ((select private.my_client_id()) in (de, a));

drop policy if exists "pub_lecture" on publications;
create policy "pub_lecture" on publications for select to authenticated using (
  client_id = (select private.my_client_id())
  or (not masque and ((visibilite = 'communaute' and (select private.membre(private.my_client_id())))
                      or private.sont_amis(client_id, (select private.my_client_id())))));
drop policy if exists "pub_soi" on publications;
create policy "pub_soi" on publications for insert to authenticated with check (client_id = (select private.my_client_id()) and (select private.membre(client_id)) and not masque);
drop policy if exists "pub_suppr" on publications;
create policy "pub_suppr" on publications for delete to authenticated using (client_id = (select private.my_client_id()));

drop policy if exists "react_lecture" on reactions;
create policy "react_lecture" on reactions for select to authenticated using (exists (select 1 from public.publications p where p.id = publication_id));
drop policy if exists "react_soi" on reactions;
create policy "react_soi" on reactions for insert to authenticated with check (client_id = (select private.my_client_id()) and exists (select 1 from public.publications p where p.id = publication_id));
drop policy if exists "react_suppr" on reactions;
create policy "react_suppr" on reactions for delete to authenticated using (client_id = (select private.my_client_id()));
drop policy if exists "react_maj" on reactions;
create policy "react_maj" on reactions for update to authenticated using (client_id = (select private.my_client_id())) with check (client_id = (select private.my_client_id()));

drop policy if exists "avis_lecture" on avis;
create policy "avis_lecture" on avis for select to anon, authenticated using (not masque or client_id = (select private.my_client_id()));
drop policy if exists "avis_soi" on avis;
create policy "avis_soi" on avis for insert to authenticated with check (client_id = (select private.my_client_id()) and not masque and reponse is null);
drop policy if exists "avis_maj" on avis;
create policy "avis_maj" on avis for update to authenticated using (client_id = (select private.my_client_id())) with check (client_id = (select private.my_client_id()) and not masque);
drop policy if exists "avis_suppr" on avis;
create policy "avis_suppr" on avis for delete to authenticated using (client_id = (select private.my_client_id()));

drop policy if exists "incidents_lecture" on incidents;
create policy "incidents_lecture" on incidents for select to authenticated using (livreur_id = (select private.my_livreur_id()) or (select private.client_voit_livreur(livreur_id)));
drop policy if exists "incidents_livreur" on incidents;
create policy "incidents_livreur" on incidents for insert to authenticated with check (livreur_id = (select private.my_livreur_id()));
drop policy if exists "incidents_livreur_maj" on incidents;
create policy "incidents_livreur_maj" on incidents for update to authenticated using (livreur_id = (select private.my_livreur_id())) with check (livreur_id = (select private.my_livreur_id()));

-- Les membres de la communauté voient le nom (pseudo) des amis : via la table communaute uniquement.

-- ---------- Limitation des tentatives de connexion (fonction « connexion ») ----------
create table if not exists private.tentatives (cle text primary key, nb int not null default 0, bloque_jusqu timestamptz, maj timestamptz not null default now());
create or replace function public.tentative(p_cle text, p_resultat text) returns json language plpgsql security definer set search_path = '' as $$
declare t private.tentatives;
begin
  select * into t from private.tentatives where cle = p_cle;
  if p_resultat = 'verifier' then
    return json_build_object('bloque', t.bloque_jusqu is not null and t.bloque_jusqu > now(), 'jusqu', t.bloque_jusqu);
  elsif p_resultat = 'ok' then
    delete from private.tentatives where cle = p_cle;
  else
    insert into private.tentatives (cle, nb, maj) values (p_cle, 1, now())
      on conflict (cle) do update set nb = case when private.tentatives.maj < now() - interval '15 minutes' then 1 else private.tentatives.nb + 1 end, maj = now();
    update private.tentatives set bloque_jusqu = now() + interval '15 minutes' where cle = p_cle and nb >= 6;
  end if;
  return json_build_object('ok', true);
end $$;
revoke execute on function public.tentative(text, text) from public, anon, authenticated;
grant execute on function public.tentative(text, text) to service_role;

-- ---------- Sauvegardes ----------
insert into storage.buckets (id, name, public) values ('sauvegardes', 'sauvegardes', false) on conflict (id) do nothing;
drop policy if exists "sauvegardes_admin" on storage.objects;
create policy "sauvegardes_admin" on storage.objects for all to authenticated using (bucket_id = 'sauvegardes' and (select private.is_admin())) with check (bucket_id = 'sauvegardes' and (select private.is_admin()));

-- ---------- Temps réel ----------
do $$ begin
  begin alter publication supabase_realtime add table incidents; exception when others then null; end;
  begin alter publication supabase_realtime add table amis; exception when others then null; end;
  begin alter publication supabase_realtime add table publications; exception when others then null; end;
  begin alter publication supabase_realtime add table reactions; exception when others then null; end;
end $$;

-- ---------- Sauvegarde automatique chaque nuit (02:00 Antananarivo) + nettoyage ----------
create extension if not exists pg_cron;
do $$ begin
  if exists (select 1 from cron.job where jobname = 'sakafo-sauvegarde') then perform cron.unschedule('sakafo-sauvegarde'); end if;
  if exists (select 1 from cron.job where jobname = 'sakafo-nettoyage') then perform cron.unschedule('sakafo-nettoyage'); end if;
end $$;
select cron.schedule('sakafo-sauvegarde', '0 23 * * *', $job$
  select net.http_post(url := 'https://iehcmptnmugvxfnvzugu.supabase.co/functions/v1/sauvegarde', body := '{"auto":true}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-sakafo-secret', (select valeur from private.config where cle = 'hook_secret')),
    timeout_milliseconds := 60000)
$job$);
select cron.schedule('sakafo-nettoyage', '30 23 * * 0', $job$
  delete from public.journal where quand < now() - interval '365 days';
  delete from private.tentatives where maj < now() - interval '1 day';
  delete from public.notifications where lu and created_at < now() - interval '90 days';
$job$);
