-- ============================================================================
-- MIGRATION 00021 : HOUSEHOLDS MULTI-COMPTES — PlanMyMeal
--
-- Les « profils famille » (00017) sont déclaratifs : ils décrivent les goûts
-- de personnes qui n'ont pas de compte. Ici on pose la fondation du vrai
-- FOYER PARTAGÉ (§8 du produit) : plusieurs COMPES authentifiés dans un même
-- foyer, rejoints par invitation.
--
-- Décisions produit (validées) :
--   - Le foyer est DÉTENU par son créateur : chaque compte possède son foyer
--     (auto-créé). Long-terme, planning / frigo / listes migreront de
--     user_id vers household_id — ce jour-là, tout le foyer partage la même
--     donnée, sans dupliquer.
--   - V1 : UN SEUL foyer par personne (unique(user_id)) — « les gens qui
--       mangent ensemble ». Les foyers multiples (parents séparés) viendront
--       plus tard : il suffira de relâcher la contrainte.
--   - Invitation par CODE en app (aucune infrastructure email) : 8 lettres
--       majuscules sans ambiguïté (pas de I/O/S/Z…) formatées XXXX-XXXX —
--       dictable à l'oral sans erreur. Expiration 7 jours, usage unique,
--       révocable. Un seul code actif par foyer.
--   - Rôles : owner (gère membres + invitations) et membre (lit).
--       Le partage en écriture (planning partagé) n'existe pas encore :
--       trois rôles seraient prématurés.
--
-- Les écritures croisées (rejoindre le foyer d'un autre) passent OBLIGATOIREMENT
-- par les fonctions SECURITY DEFINER ci-dessous : aucune policy client n'autorise
-- INSERT/UPDATE/DELETE sur ces tables. Cohérent avec 00012/00015 : le client ne
-- touche jamais directement ce qu'il ne possède pas.
--
-- ORDRE IMPORTANT : les 3 tables sont créées AVANT les policies — la policy de
-- lecture de `households` référence `household_members`, et Postgres valide le
-- corps d'une policy à sa création (échec 42P01 sinon).
--
-- 100 % idempotent : relançable sans risque.
-- ============================================================================

-- NB : la génération du code d'invitation n'utilise PAS pgcrypto —
-- l'extension vit dans le schéma « extensions », invisible depuis des
-- fonctions en search_path = public. gen_random_uuid() (cœur Postgres 13+)
-- suffit et rend la migration dépendante de zéro extension.

-- ────────────────────────────────────────────────────────────────────────────
-- 1 — TABLES (toutes, avant toute policy)
-- ────────────────────────────────────────────────────────────────────────────

create table if not exists public.households (
  id bigserial primary key,
  nom text not null default 'Mon foyer',
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint households_nom_check check (char_length(btrim(nom)) between 1 and 60)
);

create table if not exists public.household_members (
  id bigserial primary key,
  household_id bigint not null references public.households(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'membre' check (role in ('owner', 'membre')),
  joined_at timestamptz not null default now(),
  unique (household_id, user_id),
  -- V1 : une personne appartient à UN SEUL foyer (voir en-tête)
  unique (user_id)
);

create table if not exists public.household_invitations (
  id bigserial primary key,
  household_id bigint not null references public.households(id) on delete cascade,
  code text not null unique,
  created_by uuid not null references public.profiles(id) on delete cascade,
  expires_at timestamptz not null,
  used_by uuid references public.profiles(id) on delete set null,
  used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  -- Format XXXX-XXXX (8 caractères A-Z0-9) : dictable à l'oral, sans ambiguïté
  constraint household_invitations_code_format check (code ~ '^[A-Z0-9]{4}-[A-Z0-9]{4}$')
);

create index if not exists idx_household_members_household
  on public.household_members(household_id);
-- user_id est déjà couvert par l'index unique

create index if not exists idx_household_invitations_household
  on public.household_invitations(household_id);

comment on table public.households is
  'Foyer partagé : plusieurs comptes authentifiés planifient pour les mêmes gens';
comment on table public.household_members is
  'Comptes authentifiés appartenant à un foyer (owner = créateur)';
comment on table public.household_invitations is
  'Codes d''invitation à usage unique, expirants, révocables (un code actif par foyer)';

-- ────────────────────────────────────────────────────────────────────────────
-- 2 — RLS + POLICIES
--
-- ⚠️ Les policies passent par des helpers SECURITY DEFINER : une policy qui
-- interroge sa propre table (household_members → household_members) déclenche
-- une RÉCURSION INFINIE (42P17) à la première requête client. Le helper,
-- en definer, contourne le RLS → pas de récursion. Pattern canonique Supabase
-- pour les groupes partagés.
-- ────────────────────────────────────────────────────────────────────────────

-- Le compte courant est-il membre (owner ou membre) du foyer ?
create or replace function public.est_membre_du_foyer(p_household_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.household_members
    where household_id = p_household_id and user_id = auth.uid()
  );
$$;

-- Le compte courant est-il le créateur du foyer ?
create or replace function public.est_proprietaire_du_foyer(p_household_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.household_members
    where household_id = p_household_id and user_id = auth.uid() and role = 'owner'
  );
$$;

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.household_invitations enable row level security;

-- households : lecture par les membres uniquement ; le renommage est réservé
-- au créateur. INSERT/DELETE : fonctions SECURITY DEFINER / service_role.
drop policy if exists "Members view household" on public.households;
create policy "Members view household"
  on public.households for select
  using (public.est_membre_du_foyer(households.id));

drop policy if exists "Owner updates household" on public.households;
create policy "Owner updates household"
  on public.households for update
  using (public.est_proprietaire_du_foyer(households.id))
  with check (public.est_proprietaire_du_foyer(households.id));

-- household_members : on voit les membres des foyers auxquels on appartient
-- soi-même. Écritures : SECURITY DEFINER uniquement (ensure_household_for,
-- household_join, household_leave, household_remove_member).
drop policy if exists "Members view co-members" on public.household_members;
create policy "Members view co-members"
  on public.household_members for select
  using (public.est_membre_du_foyer(household_members.household_id));

-- household_invitations : le créateur consulte le code actif de son foyer.
-- Tout le reste (génération, consommation, révocation) passe par les fonctions
-- SECURITY DEFINER.
drop policy if exists "Owner views invitations" on public.household_invitations;
create policy "Owner views invitations"
  on public.household_invitations for select
  using (public.est_proprietaire_du_foyer(household_invitations.household_id));

-- ────────────────────────────────────────────────────────────────────────────
-- 3 — Fonctions SECURITY DEFINER
-- ────────────────────────────────────────────────────────────────────────────

-- Interne (SANS garde) : création idempotente du foyer personnel d'un compte.
-- Appelée par le trigger d'inscription et le backfill, qui tournent hors
-- contexte JWT (connexion admin GoTrue → auth.uid() est null) : une garde
-- auth.uid() y ferait échouer CHAQUE inscription. Sûre par construction :
-- elle n'opère que sur l'id explicitement passé, et n'est pas exécutable
-- par les clients (revoke plus bas).
create or replace function public.ensure_household_for(
  p_user_id uuid,
  p_nom text default 'Mon foyer'
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing bigint;
  v_household bigint;
begin
  if p_user_id is null then
    raise exception 'user_id manquant';
  end if;

  select hm.household_id into v_existing
  from public.household_members hm
  where hm.user_id = p_user_id
  limit 1;
  if v_existing is not null then
    return v_existing;
  end if;

  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'Profil introuvable';
  end if;

  insert into public.households (nom, created_by)
  values (coalesce(nullif(btrim(p_nom), ''), 'Mon foyer'), p_user_id)
  returning id into v_household;

  insert into public.household_members (household_id, user_id, role)
  values (v_household, p_user_id, 'owner');

  return v_household;
end;
$$;

-- Wrapper public : RPC client — retourne l'id du foyer du compte appelant,
-- en créant le sien s'il n'en a pas. Idempotent — appelable à chaque requête.
create or replace function public.ensure_household(
  p_nom text default 'Mon foyer'
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Utilisateur non authentifié';
  end if;
  return public.ensure_household_for(v_user, p_nom);
end;
$$;

-- Trigger : tout nouveau profil obtient son foyer personnel immédiatement
create or replace function public.ensure_personal_household_on_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.ensure_household_for(new.id);
  return null; -- after trigger
end;
$$;

drop trigger if exists ensure_personal_household on public.profiles;
create trigger ensure_personal_household
  after insert on public.profiles
  for each row execute function public.ensure_personal_household_on_signup();

-- household_invite : (ré)génère LE code actif du foyer du créateur.
-- Le code précédent non utilisé est révoqué : un seul code actif à la fois,
-- l'UI affiche « le » code à partager sans ambiguïté.
create or replace function public.household_invite(p_days int default 7)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_household bigint;
  v_role text;
  v_uuid text;
  v_code text;
  v_attempt int := 0;
begin
  if v_user is null then
    raise exception 'Utilisateur non authentifié';
  end if;

  select hm.household_id, hm.role into v_household, v_role
  from public.household_members hm
  where hm.user_id = v_user
  limit 1;
  if v_household is null then
    raise exception 'Aucun foyer pour ce compte';
  end if;
  if v_role <> 'owner' then
    raise exception 'Seul le créateur du foyer peut inviter';
  end if;
  if p_days is null or p_days < 1 or p_days > 30 then
    raise exception 'Durée de validité entre 1 et 30 jours';
  end if;

  update public.household_invitations
  set revoked_at = now()
  where household_id = v_household and revoked_at is null and used_by is null;

  loop
    v_attempt := v_attempt + 1;
    if v_attempt > 5 then
      raise exception 'Génération du code impossible (collision répétée)';
    end if;
    -- 8 caractères tirés d'un UUID : chaque caractère = un quartet hexa
    -- (16 valeurs → distribution PARFAITEMENT uniforme) mappé sur un
    -- alphabet sans ambiguïté (pas de I/1, 0/O, 5/S, 2/Z, 8/B…).
    v_uuid := replace(gen_random_uuid()::text, '-', '');
    v_code := '';
    for i in 1..8 loop
      v_code := v_code || substr(
        'ABCDEFHJKMNPQRVT',
        ('x' || substr(v_uuid, i, 1))::bit(4)::int + 1,
        1
      );
    end loop;
    v_code := substring(v_code, 1, 4) || '-' || substring(v_code, 5, 4);
    begin
      insert into public.household_invitations
        (household_id, code, created_by, expires_at)
      values
        (v_household, v_code, v_user, now() + make_interval(days => p_days));
      return v_code;
    exception when unique_violation then
      -- collision de code : on régénère
      null;
    end;
  end loop;
end;
$$;

-- household_join : rejoindre le foyer d'un code valide.
-- Garde : tout compte possède déjà son foyer personnel auto-créé. Si c'est
-- le placeholder VIDE (owner seul, jamais partagé), il est TROQUÉ contre le
-- foyer rejoint — sans ça, l'auto-création rendrait toute invitation
-- impossible à accepter. Sinon (membre d'un autre foyer, ou foyer déjà
-- partagé) : refus, il faut quitter d'abord.
create or replace function public.household_join(p_code text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_inv public.household_invitations;
  v_existing bigint;
  v_role text;
  v_created_by uuid;
  v_nb_membres bigint;
begin
  if v_user is null then
    raise exception 'Utilisateur non authentifié';
  end if;
  if v_code !~ '^[A-Z0-9]{4}-[A-Z0-9]{4}$' then
    raise exception 'Code invalide (format attendu : XXXX-XXXX)';
  end if;

  -- 1. Validation AVANT toute mutation : un code invalide ne doit jamais
  --    avoir détruit le foyer placeholder (sinon le compte reste sans foyer).
  select * into v_inv from public.household_invitations
  where code = v_code limit 1;
  if v_inv is null then
    raise exception 'Code inconnu';
  end if;
  if v_inv.revoked_at is not null then
    raise exception 'Code révoqué';
  end if;
  if v_inv.used_by is not null then
    raise exception 'Code déjà utilisé';
  end if;
  if v_inv.expires_at < now() then
    raise exception 'Code expiré';
  end if;
  if v_inv.created_by = v_user then
    raise exception 'Vous ne pouvez pas rejoindre votre propre foyer';
  end if;

  -- 2. Consommation ATOMIQUE du code : l'update conditionnel verrouille la
  --    ligne — deux invités simultanés sur le même code, un seul passe
  --    (l'autre repart avec « Code déjà utilisé »). En cas d'échec plus bas,
  --    TOUTE la transaction annule, consommation comprise : le code reste
  --    utilisable.
  update public.household_invitations
  set used_by = v_user, used_at = now()
  where id = v_inv.id and used_by is null;
  if not found then
    raise exception 'Code déjà utilisé';
  end if;

  -- 3. Troc du foyer placeholder (cf. doc au-dessus).
  select hm.household_id, hm.role into v_existing, v_role
  from public.household_members hm where hm.user_id = v_user limit 1;
  if v_existing is not null then
    if v_role = 'owner' then
      select h.created_by, count(hm2.id) into v_created_by, v_nb_membres
      from public.households h
      left join public.household_members hm2 on hm2.household_id = h.id
      where h.id = v_existing
      group by h.created_by;
      if v_created_by = v_user and v_nb_membres = 1 then
        -- Placeholder auto-créé, jamais partagé : troqué (les invitations
        -- non utilisées qu'il portait sont purgées en cascade — personne
        -- n'a jamais pu les utiliser).
        delete from public.households where id = v_existing;
      else
        raise exception 'Vous appartenez déjà à un foyer (quittez-le d''abord)';
      end if;
    else
      raise exception 'Vous appartenez déjà à un foyer (quittez-le d''abord)';
    end if;
  end if;

  -- 4. Admission.
  insert into public.household_members (household_id, user_id, role)
  values (v_inv.household_id, v_user, 'membre');

  return v_inv.household_id;
end;
$$;

-- household_leave : un MEMBRE quitte le foyer. Le créateur ne peut pas
-- quitter le sien. En partant, le membre récupère un foyer personnel
-- (placeholder) : l'invariant « chaque compte a un foyer » reste vrai.
create or replace function public.household_leave()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_role text;
begin
  if v_user is null then
    raise exception 'Utilisateur non authentifié';
  end if;
  select hm.role into v_role
  from public.household_members hm where hm.user_id = v_user limit 1;
  if v_role is null then
    raise exception 'Vous n''appartenez à aucun foyer';
  end if;
  if v_role = 'owner' then
    raise exception 'Le créateur ne peut pas quitter son foyer';
  end if;
  delete from public.household_members where user_id = v_user;
  perform public.ensure_household_for(v_user);
end;
$$;

-- household_remove_member : le créateur retire un membre (pas lui-même).
create or replace function public.household_remove_member(p_member_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_household bigint;
  v_role text;
begin
  if v_user is null then
    raise exception 'Utilisateur non authentifié';
  end if;
  if p_member_user_id is null then
    raise exception 'Membre cible manquant';
  end if;

  select hm.household_id, hm.role into v_household, v_role
  from public.household_members hm where hm.user_id = v_user limit 1;
  if v_household is null then
    raise exception 'Aucun foyer pour ce compte';
  end if;
  if v_role <> 'owner' then
    raise exception 'Seul le créateur du foyer peut retirer un membre';
  end if;
  if p_member_user_id = v_user then
    raise exception 'Utilisez household_leave() pour quitter votre foyer';
  end if;

  delete from public.household_members
  where household_id = v_household and user_id = p_member_user_id;
  if not found then
    raise exception 'Ce compte n''est pas membre de votre foyer';
  end if;
end;
$$;

-- household_annuler_invitation : révoque le code actif (créateur uniquement).
create or replace function public.household_annuler_invitation(p_invitation_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_household bigint;
begin
  if v_user is null then
    raise exception 'Utilisateur non authentifié';
  end if;
  select hm.household_id into v_household
  from public.household_members hm
  where hm.user_id = v_user and hm.role = 'owner' limit 1;
  if v_household is null then
    raise exception 'Seul le créateur du foyer peut annuler une invitation';
  end if;

  update public.household_invitations
  set revoked_at = now()
  where id = p_invitation_id and household_id = v_household and revoked_at is null;
  if not found then
    raise exception 'Invitation introuvable ou déjà annulée';
  end if;
end;
$$;

-- household_list_members : vue lisible des membres (pour l'UI), avec nom.
-- SECURITY DEFINER : contourne la policy « own profile only » de profiles
-- UNIQUEMENT pour l'affichage minimal (nom) — jamais d'email ni de données
-- sensibles.
create or replace function public.household_list_members()
returns table (
  user_id uuid,
  role text,
  joined_at timestamptz,
  nom text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_household bigint;
begin
  if v_user is null then
    raise exception 'Utilisateur non authentifié';
  end if;
  select hm.household_id into v_household
  from public.household_members hm where hm.user_id = v_user limit 1;
  if v_household is null then
    return;
  end if;

  return query
  select hm.user_id, hm.role, hm.joined_at,
         p.full_name
  from public.household_members hm
  join public.profiles p on p.id = hm.user_id
  where hm.household_id = v_household
  order by (hm.role = 'owner') desc, hm.joined_at asc;
end;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 4 — DROITS : les RPC publiques sont réservées aux clients authentifiés,
-- la fonction interne n'est exécutable par personne (trigger / backfill / SQL
-- direct uniquement).
-- ────────────────────────────────────────────────────────────────────────────
revoke all on function public.ensure_household_for(uuid, text) from public, authenticated, anon;
revoke all on function public.est_membre_du_foyer(bigint) from public, anon;
grant execute on function public.est_membre_du_foyer(bigint) to authenticated;
revoke all on function public.est_proprietaire_du_foyer(bigint) from public, anon;
grant execute on function public.est_proprietaire_du_foyer(bigint) to authenticated;
revoke all on function public.ensure_household(text) from public, anon;
grant execute on function public.ensure_household(text) to authenticated;
revoke all on function public.household_invite(int) from public, anon;
grant execute on function public.household_invite(int) to authenticated;
revoke all on function public.household_join(text) from public, anon;
grant execute on function public.household_join(text) to authenticated;
revoke all on function public.household_leave() from public, anon;
grant execute on function public.household_leave() to authenticated;
revoke all on function public.household_remove_member(uuid) from public, anon;
grant execute on function public.household_remove_member(uuid) to authenticated;
revoke all on function public.household_annuler_invitation(bigint) from public, anon;
grant execute on function public.household_annuler_invitation(bigint) to authenticated;
revoke all on function public.household_list_members() from public, anon;
grant execute on function public.household_list_members() to authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 5 — Backfill : chaque profil existant obtient son foyer personnel
-- ────────────────────────────────────────────────────────────────────────────
insert into public.households (nom, created_by)
select 'Mon foyer', p.id
from public.profiles p
where not exists (
  select 1 from public.household_members hm where hm.user_id = p.id
);

insert into public.household_members (household_id, user_id, role)
select h.id, h.created_by, 'owner'
from public.households h
where not exists (
  select 1 from public.household_members hm where hm.user_id = h.created_by
);
