-- Migration 008 : whoami() + nouveaux objectifs (en attente par défaut, à valider dans Objectifs)
-- (déjà appliquée sur le projet sakafo — voir le contenu complet dans l'historique Supabase « objectifs_et_whoami »)
create or replace function public.whoami() returns json language sql stable security definer set search_path = '' as $$
  select json_build_object('user_id', (select auth.uid()), 'admin', private.is_admin(),
    'role', coalesce((select role from public.profils where user_id = (select auth.uid())), 'invite'),
    'client_id', private.my_client_id(), 'livreur_id', private.my_livreur_id())
$$;
revoke execute on function public.whoami() from anon;
grant execute on function public.whoami() to authenticated;
-- Objectifs ajoutés : masse-musculaire, grossesse, allaitement, hypertension, cholesterol, senior, anemie (statut 'attente')
-- Types : perte, prise, diabete, budget, normal, masse, grossesse, allaitement, hta, cholesterol, senior, anemie
