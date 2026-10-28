-- Migration 002 : langues FR/EN/MG, NB, unités (à exécuter seulement si vous aviez déjà créé les tables avant cette version)
alter table ingredients add column if not exists nom_en text;
alter table ingredients add column if not exists poids_piece numeric;
alter table ingredients add column if not exists densite numeric;
alter table categories add column if not exists nom_en text;
alter table categories add column if not exists nom_mg text;
alter table plats add column if not exists nom_commercial text;
alter table plats add column if not exists marketing text;
alter table plats add column if not exists nb text;
alter table plats add column if not exists traductions jsonb not null default '{}';
alter table composition add column if not exists quantite numeric not null default 0;
alter table composition add column if not exists unite text not null default 'g';
alter table composition add column if not exists note text;
