-- Migration 009 : paramètres (dépôt, trafic…) et unités lisibles par les applications client / livreur
drop policy if exists "params_lecture" on options;
create policy "params_lecture" on options for select to anon, authenticated using (type = 'param' or type = 'unite');
