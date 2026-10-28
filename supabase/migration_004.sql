-- Migration 004 : choix personnalisés (Autre…)
create table if not exists options (
  id text primary key,
  type text not null,
  valeur text not null,
  base text,
  facteur numeric,
  ordre int default 0,
  created_at timestamptz not null default now()
);
create index if not exists options_type_idx on options(type);
alter table options enable row level security;
drop policy if exists "admin_all" on options;
create policy "admin_all" on options for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
