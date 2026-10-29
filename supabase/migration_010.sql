-- Migration 010 : correctif liaison compte ↔ fiche (les triggers de protection bloquaient la liaison automatique)
create or replace function private.interne() returns boolean language sql stable set search_path = '' as $$ select coalesce(current_setting('sakafo.interne', true), '') = '1' $$;
-- relier_compte : set_config('sakafo.interne','1',true) avant les UPDATE puis remis à ''.
-- protege_client / protege_profil : « if not private.is_admin() and not private.interne() then … ».
-- (contenu complet appliqué sur le projet : migration « liaison_compte_fix »)
create index if not exists clients_offre_idx on clients(offre_id);
