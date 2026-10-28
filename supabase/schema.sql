-- =============================================================
--  Sakafo Sur Mesure — schéma base de données (Supabase)
--  Adikao manontolo ao amin'ny Supabase > SQL Editor > New query > Run
-- =============================================================

create table if not exists ingredients (
  id          text primary key,              -- ohatra: I001
  nom_mg      text not null,
  nom_fr      text,
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
  prix_kg     numeric,                       -- Ar / kg
  source      text,
  a_verifier  boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists categories (
  id          text primary key,              -- ohatra: perte-de-poids
  nom         text not null,
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
  nom_en      text,
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
  grammes       numeric not null default 0,
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
--  Fiarovana: ireo olona tafiditra (login) ihany no mahita sy
--  manova ny données.
-- -------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['ingredients','categories','plats','composition','menus'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "admin_all" on %I', t);
    execute format('create policy "admin_all" on %I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;
