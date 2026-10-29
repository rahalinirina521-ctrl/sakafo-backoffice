-- Migration 006 : suggestions de plats (IA via Excel) en attente de validation, gardées jusqu'au refus
create table if not exists suggestions (
  id text primary key,
  statut text not null default 'attente', -- attente | valide
  categorie_id text references categories(id) on delete set null,
  fotoana text,
  nom text,
  plat_id text references plats(id) on delete set null,
  data jsonb not null default '{}',
  created_at timestamptz not null default now()
);
alter table suggestions enable row level security;
drop policy if exists "admin_all" on suggestions;
create policy "admin_all" on suggestions for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create index if not exists suggestions_categorie_idx on suggestions(categorie_id);
create index if not exists suggestions_plat_idx on suggestions(plat_id);
