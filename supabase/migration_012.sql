-- Migration 012 : connexion par nom d'utilisateur + compte démo (utilisateur « demo », mot de passe « demo »)

-- Nom d'utilisateur (unique, minuscules)
alter table profils add column if not exists username text;
create unique index if not exists profils_username_idx on profils (lower(username));

create or replace function private.nettoie_username(u text) returns text language sql immutable set search_path = '' as $$
  select nullif(left(regexp_replace(lower(coalesce(u, '')), '[^a-z0-9._-]', '', 'g'), 30), '')
$$;

-- Nom d'utilisateur disponible ? (formulaire d'inscription)
create or replace function public.username_libre(u text) returns boolean language sql stable security definer set search_path = '' as $$
  select private.nettoie_username(u) is not null and length(private.nettoie_username(u)) >= 3
     and private.nettoie_username(u) not in ('demo', 'admin', 'sakafo', 'livreur', 'client')
     and not exists (select 1 from public.profils where lower(username) = private.nettoie_username(u))
$$;
grant execute on function public.username_libre(text) to anon, authenticated;

-- Le nom d'utilisateur choisi à l'inscription est enregistré dans le profil
create or replace function private.on_username() returns trigger language plpgsql security definer set search_path = '' as $$
declare u text := private.nettoie_username(new.raw_user_meta_data ->> 'username'); base text; n int := 1;
begin
  if u is null then return new; end if;
  base := u;
  while exists (select 1 from public.profils where lower(username) = u and user_id <> new.id) loop
    n := n + 1; u := left(base, 27) || n::text;
  end loop;
  update public.profils set username = u where user_id = new.id;
  return new;
end $$;
drop trigger if exists sakafo_on_username on auth.users;
create trigger sakafo_on_username after insert on auth.users for each row execute function private.on_username();

-- L'utilisateur peut changer son nom d'utilisateur (nettoyé)
create or replace function private.protege_profil() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() and not private.interne() then
    new.user_id := old.user_id; new.role := old.role; new.client_id := old.client_id; new.livreur_id := old.livreur_id; new.email := old.email;
    if old.client_id = 'CL-DEMO' then new.username := old.username; end if;
  end if;
  new.username := private.nettoie_username(new.username);
  return new;
end $$;

-- ---------- Compte démo : lecture seule ----------
create or replace function private.est_demo() returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(private.my_client_id() = 'CL-DEMO', false)
$$;
create or replace function private.protege_client() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() and not private.interne() then
    if old.id = 'CL-DEMO' then return old; end if;
    new.id := old.id; new.user_id := old.user_id; new.email := old.email; new.formule := old.formule;
    new.abonnement_debut := old.abonnement_debut; new.abonnement_fin := old.abonnement_fin; new.offre_id := old.offre_id;
    new.notes := old.notes; new.actif := old.actif; new.created_at := old.created_at;
  end if;
  return new;
end $$;
create or replace function private.bloque_demo() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if private.est_demo() and not private.is_admin() then
    raise exception 'Compte démo : les modifications sont désactivées. Créez votre compte pour commencer !';
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists sakafo_demo_mesures on mesures;
create trigger sakafo_demo_mesures before insert or update or delete on mesures for each row execute function private.bloque_demo();
drop trigger if exists sakafo_demo_messages on messages;
create trigger sakafo_demo_messages before insert on messages for each row execute function private.bloque_demo();

-- Messages insérés par le système (sans utilisateur connecté) : rôle conservé
create or replace function private.role_message() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then return new; end if;
  if not private.is_admin() then
    new.auteur_id := (select auth.uid());
    new.auteur_role := case when private.my_livreur_id() is not null then 'livreur' when private.my_client_id() is not null then 'client' else 'invite' end;
  else
    new.auteur_role := 'admin';
  end if;
  return new;
end $$;

-- Données du compte démo (fiche client inactive : jamais incluse dans les vraies livraisons)
insert into livreurs (id, nom, telephone, vehicule, couleur, actif) values ('LR-DEMO', 'Livreur démo', null, 'Moto', '#1565c0', false)
  on conflict (id) do nothing;
insert into clients (id, nom, telephone, adresse, repere, lat, lng, categorie_id, actif, email, formule, abonnement_debut, abonnement_fin, creneaux, notes, profil)
values ('CL-DEMO', 'Compte démo', null, 'Analakely, Antananarivo', 'Devant la pharmacie', -18.9075, 47.5240, 'perte-de-poids', false, 'demo.sakafo@example.com', 'livraison',
  current_date - 30, current_date + 3650, '{midi}', 'Compte de démonstration (lecture seule). Ne pas supprimer.',
  '{"sexe":"F","date_naissance":"1992-04-12","taille":163,"poids":86.4,"poids_depart":91,"poids_cible":75,"activite":"leger"}')
on conflict (id) do nothing;
insert into mesures (id, client_id, date, poids, tour_taille) values
  ('MS-DEMO-1', 'CL-DEMO', current_date - 56, 91.0, 104), ('MS-DEMO-2', 'CL-DEMO', current_date - 42, 89.9, 102),
  ('MS-DEMO-3', 'CL-DEMO', current_date - 28, 88.6, 100.5), ('MS-DEMO-4', 'CL-DEMO', current_date - 14, 87.5, 99),
  ('MS-DEMO-5', 'CL-DEMO', current_date - 2, 86.4, 97.5)
on conflict (id) do nothing;
insert into messages (id, conversation, auteur_role, auteur_nom, texte, created_at) values
  ('00000000-0000-4000-8000-00000000de01', 'client:CL-DEMO', 'admin', 'Sakafo Sur Mesure', 'Bienvenue dans le compte démo 👋 Ici, vous échangez avec notre équipe et avec votre livreur le jour de la livraison.', now() - interval '3 days'),
  ('00000000-0000-4000-8000-00000000de02', 'client:CL-DEMO', 'admin', 'Sakafo Sur Mesure', 'Bravo : -4,6 kg en 8 semaines, exactement au bon rythme 💪', now() - interval '1 day')
on conflict (id) do nothing;

-- config_push renvoie toute la configuration privée (service_role uniquement) ; valeurs demo_email / demo_password insérées hors Git.
create or replace function public.config_push() returns json language sql stable security definer set search_path = '' as $$
  select json_object_agg(cle, valeur) from private.config
$$;
revoke execute on function public.config_push() from public, anon, authenticated;
grant execute on function public.config_push() to service_role;
