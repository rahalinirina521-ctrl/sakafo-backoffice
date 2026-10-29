-- 014 : type de formule (livraison / prescription sans livraison) sur les offres
alter table public.offres add column if not exists mode text;
alter table public.offres drop constraint if exists offres_mode_check;
alter table public.offres add constraint offres_mode_check check (mode is null or mode in ('livraison', 'conseil'));
comment on column public.offres.mode is 'null = les deux ; livraison ; conseil (prescription sans livraison)';
