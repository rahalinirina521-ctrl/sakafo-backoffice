-- Migration 005 : menus réutilisables (repas libres), clients, planning, formules (déjà appliquée sur le projet sakafo)
create table if not exists options (id text primary key, type text not null, valeur text not null, base text, facteur numeric, ordre int default 0, created_at timestamptz not null default now());
alter table menus add column if not exists nom text;
alter table menus add column if not exists repas jsonb not null default '[]';
create table if not exists clients (id text primary key, nom text not null, telephone text, adresse text, categorie_id text references categories(id) on delete set null, kcal_cible numeric, allergies text, notes text, profil jsonb not null default '{}', actif boolean not null default true, created_at timestamptz not null default now());
create table if not exists calendrier (id text primary key, date date not null, menu_id text references menus(id) on delete cascade, categorie_id text references categories(id) on delete cascade, client_id text references clients(id) on delete cascade, notes text);
create table if not exists offres (id text primary key, nom text not null, nb_jours int not null default 1, prix numeric, categorie_id text references categories(id) on delete set null, description text, actif boolean not null default true, ordre int default 0);
do $$ declare t text; begin
  foreach t in array array['options','clients','calendrier','offres'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "admin_all" on %I', t);
    execute format('create policy "admin_all" on %I for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()))', t);
  end loop; end $$;
