-- Migration 007 : applications client & livreur
-- rôles (invité / client / livreur), livreurs, livraisons, positions GPS, messagerie, mesures (suivi), objectifs enrichis.

-- ---------- Objectifs enrichis ----------
alter table categories add column if not exists statut text not null default 'valide';   -- valide | attente
alter table categories add column if not exists type text;                                -- moteur de conseil (perte, prise, masse, diabete, grossesse…)
alter table categories add column if not exists description text;
alter table categories add column if not exists icone text;

-- ---------- Clients : compte, formule, abonnement ----------
alter table clients add column if not exists email text;
alter table clients add column if not exists user_id uuid unique references auth.users(id) on delete set null;
alter table clients add column if not exists formule text not null default 'livraison';  -- livraison | conseil
alter table clients add column if not exists abonnement_debut date;
alter table clients add column if not exists abonnement_fin date;
alter table clients add column if not exists offre_id text references offres(id) on delete set null;
alter table clients add column if not exists creneaux text[] not null default '{midi}';  -- matin | midi | soir
create index if not exists clients_user_idx on clients(user_id);

-- ---------- Livreurs ----------
create table if not exists livreurs (
  id text primary key,
  nom text not null,
  telephone text,
  email text,
  user_id uuid unique references auth.users(id) on delete set null,
  vehicule text,
  couleur text,
  actif boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- Profils (un par compte) ----------
create table if not exists profils (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  nom text,
  telephone text,
  role text not null default 'invite' check (role in ('invite', 'client', 'livreur')),
  client_id text references clients(id) on delete set null,
  livreur_id text references livreurs(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists profils_client_idx on profils(client_id);
create index if not exists profils_livreur_idx on profils(livreur_id);

-- ---------- Suivi (poids, tour de taille) ----------
create table if not exists mesures (
  id text primary key,
  client_id text not null references clients(id) on delete cascade,
  date date not null default current_date,
  poids numeric,
  tour_taille numeric,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists mesures_client_idx on mesures(client_id, date);

-- ---------- Livraisons ----------
create table if not exists livraisons (
  id text primary key,
  date date not null,
  creneau text not null default 'midi',
  client_id text not null references clients(id) on delete cascade,
  livreur_id text references livreurs(id) on delete set null,
  statut text not null default 'prevue' check (statut in ('prevue', 'en_route', 'livree', 'echec', 'annulee')),
  ordre int,
  adresse text,
  repere text,
  lat double precision,
  lng double precision,
  eta timestamptz,
  depart_at timestamptz,
  livree_at timestamptz,
  menu_id text references menus(id) on delete set null,
  note_livreur text,
  created_at timestamptz not null default now()
);
create index if not exists livraisons_date_idx on livraisons(date);
create index if not exists livraisons_client_idx on livraisons(client_id);
create index if not exists livraisons_livreur_idx on livraisons(livreur_id, date);
create index if not exists livraisons_menu_idx on livraisons(menu_id);

-- ---------- Position GPS des livreurs (une ligne par livreur) ----------
create table if not exists positions (
  livreur_id text primary key references livreurs(id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  precision numeric,
  vitesse numeric,
  cap numeric,
  updated_at timestamptz not null default now()
);

-- ---------- Messagerie ----------
-- conversation : 'client:<id>' (admin + client + livreur du jour), 'livreur:<id>' (admin + livreur), 'user:<uuid>' (invité + admin)
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation text not null,
  auteur_id uuid default auth.uid(),
  auteur_role text,
  auteur_nom text,
  texte text not null check (char_length(texte) between 1 and 2000),
  lu_par uuid[] not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists messages_conv_idx on messages(conversation, created_at);

-- ---------- Fonctions d'accès (security definer, schéma privé) ----------
create or replace function private.today_mg() returns date language sql stable set search_path = '' as $$ select (now() at time zone 'Indian/Antananarivo')::date $$;

create or replace function private.my_client_id() returns text language sql stable security definer set search_path = '' as $$
  select client_id from public.profils where user_id = (select auth.uid())
$$;
create or replace function private.my_livreur_id() returns text language sql stable security definer set search_path = '' as $$
  select livreur_id from public.profils where user_id = (select auth.uid())
$$;
-- le livreur a une livraison (hier, aujourd'hui, demain) chez ce client
create or replace function private.livreur_sert_client(cid text) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.livraisons l where l.client_id = cid and l.livreur_id = private.my_livreur_id()
    and l.date between private.today_mg() - 1 and private.today_mg() + 1)
$$;
-- le client voit le livreur qui le livre (hier, aujourd'hui, demain)
create or replace function private.client_voit_livreur(lid text) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.livraisons l where l.livreur_id = lid and l.client_id = private.my_client_id()
    and l.date between private.today_mg() - 1 and private.today_mg() + 1)
$$;
create or replace function private.can_chat(conv text) returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_admin()
    or conv = 'client:' || private.my_client_id()
    or conv = 'livreur:' || private.my_livreur_id()
    or conv = 'user:' || (select auth.uid())::text
    or (conv like 'client:%' and private.livreur_sert_client(substr(conv, 8)))
$$;

-- Liaison automatique compte ↔ fiche client / livreur (par e-mail)
create or replace function private.relier_compte(p_email text) returns void language plpgsql security definer set search_path = '' as $$
declare u uuid; c text; l text;
begin
  if p_email is null or p_email = '' then return; end if;
  select id into u from auth.users where lower(email) = lower(p_email) limit 1;
  if u is null then return; end if;
  insert into public.profils (user_id, email) values (u, lower(p_email)) on conflict (user_id) do nothing;
  select id into c from public.clients where lower(email) = lower(p_email) order by created_at limit 1;
  select id into l from public.livreurs where lower(email) = lower(p_email) order by created_at limit 1;
  if l is not null then
    update public.livreurs set user_id = u where id = l and (user_id is null or user_id = u);
    update public.profils set role = 'livreur', livreur_id = l where user_id = u;
  elsif c is not null then
    update public.clients set user_id = u where id = c and (user_id is null or user_id = u);
    update public.profils set role = 'client', client_id = c where user_id = u;
  end if;
end $$;

create or replace function private.on_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profils (user_id, email, nom) values (new.id, lower(new.email), coalesce(new.raw_user_meta_data ->> 'nom', '')) on conflict (user_id) do nothing;
  perform private.relier_compte(new.email);
  return new;
end $$;
drop trigger if exists sakafo_on_new_user on auth.users;
create trigger sakafo_on_new_user after insert on auth.users for each row execute function private.on_new_user();

create or replace function private.on_email_fiche() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.email is not null and (tg_op = 'INSERT' or new.email is distinct from old.email) then
    perform private.relier_compte(new.email);
  end if;
  return null;
end $$;
drop trigger if exists sakafo_client_email on clients;
create trigger sakafo_client_email after insert or update of email on clients for each row execute function private.on_email_fiche();
drop trigger if exists sakafo_livreur_email on livreurs;
create trigger sakafo_livreur_email after insert or update of email on livreurs for each row execute function private.on_email_fiche();

-- Un client ne peut pas modifier sa formule, son abonnement, ses notes admin…
create or replace function private.protege_client() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then
    new.id := old.id; new.user_id := old.user_id; new.email := old.email; new.formule := old.formule;
    new.abonnement_debut := old.abonnement_debut; new.abonnement_fin := old.abonnement_fin; new.offre_id := old.offre_id;
    new.notes := old.notes; new.actif := old.actif; new.created_at := old.created_at;
  end if;
  return new;
end $$;
drop trigger if exists sakafo_protege_client on clients;
create trigger sakafo_protege_client before update on clients for each row execute function private.protege_client();

-- Un utilisateur ne peut pas changer son rôle
create or replace function private.protege_profil() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then
    new.user_id := old.user_id; new.role := old.role; new.client_id := old.client_id; new.livreur_id := old.livreur_id; new.email := old.email;
  end if;
  return new;
end $$;
drop trigger if exists sakafo_protege_profil on profils;
create trigger sakafo_protege_profil before update on profils for each row execute function private.protege_profil();

-- Le livreur ne modifie que le suivi de ses livraisons
create or replace function private.protege_livraison() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then
    new.id := old.id; new.date := old.date; new.creneau := old.creneau; new.client_id := old.client_id; new.livreur_id := old.livreur_id;
    new.adresse := old.adresse; new.repere := old.repere; new.lat := old.lat; new.lng := old.lng; new.menu_id := old.menu_id; new.created_at := old.created_at;
  end if;
  return new;
end $$;
drop trigger if exists sakafo_protege_livraison on livraisons;
create trigger sakafo_protege_livraison before update on livraisons for each row execute function private.protege_livraison();

-- Les messages ne sont pas modifiables (sauf « lu ») par les non-admins
create or replace function private.protege_message() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then
    new.id := old.id; new.conversation := old.conversation; new.auteur_id := old.auteur_id; new.auteur_role := old.auteur_role;
    new.auteur_nom := old.auteur_nom; new.texte := old.texte; new.created_at := old.created_at;
    new.lu_par := array(select distinct x from unnest(old.lu_par || array[(select auth.uid())]) x where x is not null);
  end if;
  return new;
end $$;
drop trigger if exists sakafo_protege_message on messages;
create trigger sakafo_protege_message before update on messages for each row execute function private.protege_message();

-- ---------- Sécurité (RLS) ----------
do $$ declare t text; begin
  foreach t in array array['livreurs','profils','mesures','livraisons','positions','messages'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "admin_all" on %I', t);
    execute format('create policy "admin_all" on %I for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()))', t);
  end loop;
  -- Catalogue lisible par tous (vitrine, mode invité)
  foreach t in array array['categories','plats','composition','ingredients','offres','menus'] loop
    execute format('drop policy if exists "lecture_publique" on %I', t);
    execute format('create policy "lecture_publique" on %I for select to anon, authenticated using (true)', t);
  end loop;
end $$;

drop policy if exists "calendrier_lecture" on calendrier;
create policy "calendrier_lecture" on calendrier for select to authenticated using (client_id is null or client_id = (select private.my_client_id()));

drop policy if exists "client_soi" on clients;
create policy "client_soi" on clients for select to authenticated using (user_id = (select auth.uid()) or (select private.livreur_sert_client(id)));
drop policy if exists "client_maj_soi" on clients;
create policy "client_maj_soi" on clients for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "profil_soi" on profils;
create policy "profil_soi" on profils for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "profil_maj_soi" on profils;
create policy "profil_maj_soi" on profils for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "livreur_lecture" on livreurs;
create policy "livreur_lecture" on livreurs for select to authenticated using (user_id = (select auth.uid()) or (select private.client_voit_livreur(id)));

drop policy if exists "mesures_client" on mesures;
create policy "mesures_client" on mesures for all to authenticated using (client_id = (select private.my_client_id())) with check (client_id = (select private.my_client_id()));

drop policy if exists "livraisons_lecture" on livraisons;
create policy "livraisons_lecture" on livraisons for select to authenticated using (client_id = (select private.my_client_id()) or livreur_id = (select private.my_livreur_id()));
drop policy if exists "livraisons_livreur_maj" on livraisons;
create policy "livraisons_livreur_maj" on livraisons for update to authenticated using (livreur_id = (select private.my_livreur_id())) with check (livreur_id = (select private.my_livreur_id()));

drop policy if exists "positions_lecture" on positions;
create policy "positions_lecture" on positions for select to authenticated using (livreur_id = (select private.my_livreur_id()) or (select private.client_voit_livreur(livreur_id)));
drop policy if exists "positions_livreur_ins" on positions;
create policy "positions_livreur_ins" on positions for insert to authenticated with check (livreur_id = (select private.my_livreur_id()));
drop policy if exists "positions_livreur_maj" on positions;
create policy "positions_livreur_maj" on positions for update to authenticated using (livreur_id = (select private.my_livreur_id())) with check (livreur_id = (select private.my_livreur_id()));

drop policy if exists "messages_lecture" on messages;
create policy "messages_lecture" on messages for select to authenticated using ((select private.can_chat(conversation)));
drop policy if exists "messages_envoi" on messages;
create policy "messages_envoi" on messages for insert to authenticated with check (auteur_id = (select auth.uid()) and (select private.can_chat(conversation)));
drop policy if exists "messages_lu" on messages;
create policy "messages_lu" on messages for update to authenticated using ((select private.can_chat(conversation))) with check ((select private.can_chat(conversation)));

grant usage on schema private to anon, authenticated;
grant execute on all functions in schema private to anon, authenticated;
revoke execute on function private.relier_compte(text) from anon, authenticated;

-- ---------- Temps réel ----------
do $$ begin
  begin alter publication supabase_realtime add table messages; exception when others then null; end;
  begin alter publication supabase_realtime add table positions; exception when others then null; end;
  begin alter publication supabase_realtime add table livraisons; exception when others then null; end;
end $$;
