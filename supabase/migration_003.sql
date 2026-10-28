-- Migration 003 : données IA supplémentaires
alter table plats add column if not exists conseil text;
alter table plats add column if not exists conservation text;
alter table plats add column if not exists post_reseaux text;
alter table plats add column if not exists details jsonb not null default '{}';
