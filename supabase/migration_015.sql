-- Migration 015 : communauté façon réseau social — photos, commentaires, réactions élargies, profils,
-- blocage, signalements, notifications des clients (application + push).

-- ---------- Colonnes supplémentaires ----------
alter table communaute add column if not exists photo_url text;
alter table communaute add column if not exists objectif text check (char_length(objectif) <= 60);
alter table communaute add column if not exists montrer_objectif boolean not null default false;

alter table publications add column if not exists photos text[] not null default '{}';
alter table publications drop constraint if exists publications_photos_check;
alter table publications add constraint publications_photos_check check (coalesce(array_length(photos, 1), 0) <= 4);
alter table publications drop constraint if exists publications_type_check;
alter table publications add constraint publications_type_check check (type in ('performance', 'motivation', 'texte', 'repas', 'sport', 'progres'));
alter table publications drop constraint if exists publications_texte_check;
alter table publications add constraint publications_texte_check check (char_length(texte) <= 1000);

alter table reactions drop constraint if exists reactions_emoji_check;
alter table reactions add constraint reactions_emoji_check check (emoji in ('👍', '❤️', '💪', '🔥', '👏', '🎉'));

-- ---------- Nouvelles tables ----------
create table if not exists commentaires (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references publications(id) on delete cascade,
  client_id text not null references clients(id) on delete cascade,
  parent_id uuid references commentaires(id) on delete cascade,
  texte text not null check (char_length(texte) between 1 and 500),
  masque boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists commentaires_pub_idx on commentaires(publication_id, created_at);

create table if not exists blocages (
  client_id text not null references clients(id) on delete cascade,
  bloque_id text not null references clients(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (client_id, bloque_id),
  check (client_id <> bloque_id)
);

create table if not exists signalements (
  id uuid primary key default gen_random_uuid(),
  client_id text not null references clients(id) on delete cascade,
  cible_type text not null check (cible_type in ('publication', 'commentaire', 'membre')),
  cible_id text not null,
  motif text check (char_length(motif) <= 300),
  traite boolean not null default false,
  created_at timestamptz not null default now(),
  unique (client_id, cible_type, cible_id)
);

create table if not exists notifs_client (
  id uuid primary key default gen_random_uuid(),
  client_id text not null references clients(id) on delete cascade,
  type text not null,
  titre text not null,
  texte text,
  lien text,
  acteur text,
  lu boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifs_client_idx on notifs_client(client_id, created_at desc);

-- ---------- Fonctions utilitaires ----------
create or replace function private.bloque(x text, y text) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.blocages where (client_id = x and bloque_id = y) or (client_id = y and bloque_id = x))
$$;
create or replace function private.pseudo(cid text) returns text language sql stable security definer set search_path = '' as $$
  select coalesce((select pseudo from public.communaute where client_id = cid), 'Un membre')
$$;
-- Une publication visible par moi (mêmes règles que la lecture des publications)
create or replace function private.pub_visible(pid uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.publications p where p.id = pid and (
    p.client_id = private.my_client_id()
    or (not p.masque and not private.bloque(p.client_id, private.my_client_id())
        and ((p.visibilite = 'communaute' and private.membre(private.my_client_id())) or private.sont_amis(p.client_id, private.my_client_id())))))
$$;

-- Notification d'un client (dans l'application, et push si demandé)
create or replace function private.notif_client(p_client text, p_type text, p_titre text, p_texte text, p_lien text, p_acteur text, p_push boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare nid uuid; secret text;
begin
  if p_client is null then return; end if;
  insert into public.notifs_client (client_id, type, titre, texte, lien, acteur) values (p_client, p_type, p_titre, left(p_texte, 160), p_lien, p_acteur) returning id into nid;
  if p_push then
    select valeur into secret from private.config where cle = 'hook_secret';
    if secret is not null then
      perform net.http_post(url := 'https://iehcmptnmugvxfnvzugu.supabase.co/functions/v1/notifier',
        body := jsonb_build_object('client_notif', nid),
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-sakafo-secret', secret));
    end if;
  end if;
exception when others then null;
end $$;

-- ---------- Déclencheurs de notifications ----------
create or replace function private.on_reaction() returns trigger language plpgsql security definer set search_path = '' as $$
declare auteur text;
begin
  select client_id into auteur from public.publications where id = new.publication_id;
  if auteur is not null and auteur <> new.client_id and (tg_op = 'INSERT' or new.emoji is distinct from old.emoji) then
    perform private.notif_client(auteur, 'reaction', private.pseudo(new.client_id) || ' a réagi ' || new.emoji || ' à votre publication', null,
      '#/communaute?p=' || new.publication_id, private.pseudo(new.client_id), tg_op = 'INSERT');
  end if;
  return new;
end $$;
drop trigger if exists sakafo_on_reaction on reactions;
create trigger sakafo_on_reaction after insert or update on reactions for each row execute function private.on_reaction();

create or replace function private.on_commentaire() returns trigger language plpgsql security definer set search_path = '' as $$
declare auteur text; parent_auteur text; nom text := private.pseudo(new.client_id);
begin
  select client_id into auteur from public.publications where id = new.publication_id;
  if new.parent_id is not null then
    select client_id into parent_auteur from public.commentaires where id = new.parent_id;
    if parent_auteur is not null and parent_auteur <> new.client_id then
      perform private.notif_client(parent_auteur, 'reponse', nom || ' a répondu à votre commentaire', new.texte, '#/communaute?p=' || new.publication_id, nom, true);
    end if;
  end if;
  if auteur is not null and auteur <> new.client_id and auteur is distinct from parent_auteur then
    perform private.notif_client(auteur, 'commentaire', nom || ' a commenté votre publication', new.texte, '#/communaute?p=' || new.publication_id, nom, true);
  end if;
  return new;
end $$;
drop trigger if exists sakafo_on_commentaire on commentaires;
create trigger sakafo_on_commentaire after insert on commentaires for each row execute function private.on_commentaire();

create or replace function private.on_ami() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' and new.statut = 'attente' then
    perform private.notif_client(new.a, 'demande_ami', private.pseudo(new.de) || ' vous a envoyé une demande d''ami', null, '#/communaute?onglet=amis', private.pseudo(new.de), true);
  elsif tg_op = 'UPDATE' and new.statut = 'accepte' and old.statut <> 'accepte' then
    perform private.notif_client(new.de, 'ami_accepte', private.pseudo(new.a) || ' a accepté votre demande d''ami 🎉', null, '#/communaute?membre=' || new.a, private.pseudo(new.a), true);
  end if;
  return new;
end $$;
drop trigger if exists sakafo_on_ami on amis;
create trigger sakafo_on_ami after insert or update on amis for each row execute function private.on_ami();

-- Nouvelle publication : prévenir les amis (dans l'application seulement, sans push)
create or replace function private.on_publication() returns trigger language plpgsql security definer set search_path = '' as $$
declare r record; nom text := private.pseudo(new.client_id);
begin
  for r in select case when de = new.client_id then a else de end as ami from public.amis where statut = 'accepte' and new.client_id in (de, a) loop
    perform private.notif_client(r.ami, 'publication', nom || ' a publié', left(new.texte, 120), '#/communaute?p=' || new.id, nom, false);
  end loop;
  return new;
end $$;
drop trigger if exists sakafo_on_publication on publications;
create trigger sakafo_on_publication after insert on publications for each row execute function private.on_publication();

-- Signalement : l'admin est prévenu
create or replace function private.on_signalement() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.notifier('signalement', '🚩 Signalement dans la communauté', new.cible_type || coalesce(' : ' || new.motif, ''), '#/avis');
  return new;
end $$;
drop trigger if exists sakafo_on_signalement on signalements;
create trigger sakafo_on_signalement after insert on signalements for each row execute function private.on_signalement();

-- Compte démo : lecture seule
do $$ declare t text; begin
  foreach t in array array['commentaires', 'blocages', 'signalements'] loop
    execute format('drop trigger if exists sakafo_demo on %I', t);
    execute format('create trigger sakafo_demo before insert or update or delete on %I for each row execute function private.bloque_demo()', t);
  end loop;
end $$;

-- ---------- RLS ----------
do $$ declare t text; begin
  foreach t in array array['commentaires', 'blocages', 'signalements', 'notifs_client'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "admin_all" on %I', t);
    execute format('create policy "admin_all" on %I for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()))', t);
  end loop;
end $$;

drop policy if exists "pub_lecture" on publications;
create policy "pub_lecture" on publications for select to authenticated using ((select private.pub_visible(id)));
drop policy if exists "pub_maj" on publications;
create policy "pub_maj" on publications for update to authenticated using (client_id = (select private.my_client_id())) with check (client_id = (select private.my_client_id()) and not masque);

drop policy if exists "react_lecture" on reactions;
create policy "react_lecture" on reactions for select to authenticated using ((select private.pub_visible(publication_id)));
drop policy if exists "react_soi" on reactions;
create policy "react_soi" on reactions for insert to authenticated with check (client_id = (select private.my_client_id()) and (select private.pub_visible(publication_id)));

drop policy if exists "com_lecture" on commentaires;
create policy "com_lecture" on commentaires for select to authenticated using (
  client_id = (select private.my_client_id())
  or (not masque and (select private.pub_visible(publication_id)) and not private.bloque(client_id, (select private.my_client_id()))));
drop policy if exists "com_soi" on commentaires;
create policy "com_soi" on commentaires for insert to authenticated with check (
  client_id = (select private.my_client_id()) and not masque and (select private.membre(client_id)) and (select private.pub_visible(publication_id)));
drop policy if exists "com_suppr" on commentaires;
create policy "com_suppr" on commentaires for delete to authenticated using (
  client_id = (select private.my_client_id())
  or exists (select 1 from public.publications p where p.id = publication_id and p.client_id = (select private.my_client_id())));

drop policy if exists "bloc_soi" on blocages;
create policy "bloc_soi" on blocages for all to authenticated using (client_id = (select private.my_client_id())) with check (client_id = (select private.my_client_id()));

drop policy if exists "signal_soi" on signalements;
create policy "signal_soi" on signalements for insert to authenticated with check (client_id = (select private.my_client_id()) and not traite);

drop policy if exists "notif_lecture" on notifs_client;
create policy "notif_lecture" on notifs_client for select to authenticated using (client_id = (select private.my_client_id()));
drop policy if exists "notif_lu" on notifs_client;
create policy "notif_lu" on notifs_client for update to authenticated using (client_id = (select private.my_client_id())) with check (client_id = (select private.my_client_id()));
drop policy if exists "notif_suppr" on notifs_client;
create policy "notif_suppr" on notifs_client for delete to authenticated using (client_id = (select private.my_client_id()));

-- ---------- Photos (stockage) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('communaute', 'communaute', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 3145728, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];
drop policy if exists "communaute_photos_ajout" on storage.objects;
create policy "communaute_photos_ajout" on storage.objects for insert to authenticated
  with check (bucket_id = 'communaute' and (storage.foldername(name))[1] = (select private.my_client_id()) and not (select private.est_demo()));
drop policy if exists "communaute_photos_suppr" on storage.objects;
create policy "communaute_photos_suppr" on storage.objects for delete to authenticated
  using (bucket_id = 'communaute' and ((storage.foldername(name))[1] = (select private.my_client_id()) or (select private.is_admin())));

-- ---------- Temps réel ----------
do $$ begin
  begin alter publication supabase_realtime add table commentaires; exception when others then null; end;
  begin alter publication supabase_realtime add table notifs_client; exception when others then null; end;
end $$;

-- ---------- Nettoyage : notifications lues de plus de 60 jours ----------
do $$ begin
  perform cron.unschedule('sakafo-notifs-client');
exception when others then null;
end $$;
select cron.schedule('sakafo-notifs-client', '30 2 * * *', $$delete from public.notifs_client where created_at < now() - interval '60 days'$$);
