-- =============================================================
--  Sakafo Sur Mesure — schéma base de données (Supabase)
--  Adikao manontolo ao amin'ny Supabase > SQL Editor > New query > Run
-- =============================================================

create table if not exists ingredients (
  id          text primary key,              -- ohatra: I001
  nom_mg      text not null,
  nom_fr      text,
  nom_en      text,
  categorie   text,                          -- Féculent, Protéine, Légume...
  etat        text,                          -- Masaka / Manta / Vonona
  kcal        numeric,                       -- isaky ny 100 g
  proteines   numeric,
  glucides    numeric,
  lipides     numeric,
  fibres      numeric,
  sucres      numeric,
  sodium      numeric,                       -- mg isaky ny 100 g
  ig          numeric,                       -- index glycémique
  poids_piece numeric,                       -- g isaky ny isa (atody 1 = 50 g)
  densite     numeric,                       -- g isaky ny ml (ranon-javatra)
  prix_kg     numeric,                       -- Ar / kg
  source      text,
  a_verifier  boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists categories (
  id          text primary key,              -- ohatra: perte-de-poids
  nom         text not null,                 -- français
  nom_en      text,
  nom_mg      text,
  kcal_cible  numeric,                       -- kcal tanjona isan'andro (antonony)
  tolerance   numeric default 0.10,          -- 0.10 = ±10 %
  prot_g_kg   numeric,
  cg_max      numeric,                       -- charge glycémique max isan'andro
  ordre       int default 0,
  regles      text
);

create table if not exists plats (
  id          text primary key,              -- ohatra: SK0001
  nom         text not null,
  nom_commercial text,                       -- anarana hita amin'ny client
  marketing   text,                          -- résumé marketing
  nom_en      text,                          -- description photo (anglais)
  nb          text,                          -- NB / points forts
  traductions jsonb not null default '{}',   -- {"en": {...}, "mg": {...}}
  fotoana     text,                          -- Maraina / Atoandro / Hariva / Goûter
  categories  text[] not null default '{}',
  description text,
  avantages   text,
  effets      text,
  image_url   text,
  prix_vente  numeric,
  statut      text not null default 'Draft', -- Draft / Voamarina
  notes       text,
  created_at  timestamptz not null default now()
);

create table if not exists composition (
  id            text primary key,
  plat_id       text not null references plats(id) on delete cascade,
  ingredient_id text not null references ingredients(id) on update cascade,
  quantite      numeric not null default 0,
  unite         text not null default 'g',   -- g / ml / isa / cas / cac
  grammes       numeric not null default 0,  -- calculé automatiquement
  note          text,                        -- NB : sans sel, sans sucre…
  ordre         int default 0
);
create index if not exists composition_plat_idx on composition(plat_id);

create table if not exists menus (
  id            text primary key,            -- ohatra: MN0001
  categorie_id  text references categories(id) on delete set null,
  andro         text,
  maraina       text references plats(id) on delete set null,
  atoandro      text references plats(id) on delete set null,
  hariva        text references plats(id) on delete set null,
  gouter        text references plats(id) on delete set null,
  notes         text
);

-- -------------------------------------------------------------
--  Fiarovana: ireo email ao amin'ny table "admins" ihany no
--  mahita sy manova ny données (na dia misy olona hafa misoratra aza).
-- -------------------------------------------------------------
create table if not exists admins (email text primary key, created_at timestamptz not null default now());
alter table admins enable row level security;
-- insert into admins (email) values ('email-nao@gmail.com');

create schema if not exists private;
grant usage on schema private to authenticated;
create or replace function private.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;
revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated;

do $$
declare t text;
begin
  foreach t in array array['ingredients','categories','plats','composition','menus'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "admin_all" on %I', t);
    execute format('create policy "admin_all" on %I for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()))', t);
  end loop;
end $$;

-- -------------------------------------------------------------
--  Sary (Storage): bucket "sary" public (lien hitan'ny client),
--  fa ny admin ihany no mampakatra / manova / mamafa.
-- -------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('sary', 'sary', true)
on conflict (id) do update set public = true;
drop policy if exists "sary_select_admin" on storage.objects;
create policy "sary_select_admin" on storage.objects for select to authenticated using (bucket_id = 'sary' and (select private.is_admin()));
drop policy if exists "sary_insert" on storage.objects;
create policy "sary_insert" on storage.objects for insert to authenticated with check (bucket_id = 'sary' and (select private.is_admin()));
drop policy if exists "sary_update" on storage.objects;
create policy "sary_update" on storage.objects for update to authenticated using (bucket_id = 'sary' and (select private.is_admin()));
drop policy if exists "sary_delete" on storage.objects;
create policy "sary_delete" on storage.objects for delete to authenticated using (bucket_id = 'sary' and (select private.is_admin()));
