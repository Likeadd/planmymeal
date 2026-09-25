-- ============================================================================
-- MIGRATION 00017 : PROFILS FAMILLE — PlanMyMeal
--
-- Le foyer n'est plus « une personne » : on planifie pour plusieurs goûts.
-- Le moteur doit trouver le MEILLEUR COMPROMIS, pas satisfaire une majorité en
-- sacrifiant un membre (une recette détestée par l'enfant reste un mauvais
-- dîner, même si les deux parents l'adorent).
--
--   1. family_members — les personnes pour qui on cuisine : nom, emoji, âge et
--      surtout `poids` (1 = ses goûts comptent peu, 5 = ils sont prioritaires).
--      C'est la PONDÉRATION PAR MEMBRE demandée : un invité occasionnel ne
--      pèse pas autant qu'un enfant qui vit là.
--   2. family_member_ingredients — relation d'un membre à un aliment :
--        'aime'        → boost
--        'n_aime_pas'  → pénalité
--        'interdit'    → EXCLUSION DURE (allergie, intolérance, éthique…).
--      Un interdit n'est jamais négocié, exactement comme user_allergies.
--   3. family_member_meal_preferences — mémoire d'un membre sur une recette
--      (note 1-5, « ne plus proposer »). Un veto n'est appliqué en dur que si
--      la somme des poids des membres qui refusent atteint la majorité du foyer
--      (voir lib/famille.ts) : sinon il pèse très lourd sans bloquer.
--   4. profiles.poids_famille — part du compromis familial dans le score (0 =
--      je cuisine pour moi d'abord, 100 = compromis maximal).
--   5. save_family_member(...) — enregistrement ATOMIQUE d'un membre et de ses
--      relations. Remplacer les aliments d'un membre = supprimer + réinsérer :
--      sans transaction, un échec au milieu laissait le membre sans aucune
--      préférence. Même raisonnement que la migration 00012.
--
-- 100 % idempotent : relançable sans risque.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 4 — Pondération globale du compromis familial
-- ────────────────────────────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists poids_famille smallint not null default 70;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_poids_famille_check'
  ) then
    alter table public.profiles
      add constraint profiles_poids_famille_check check (poids_famille between 0 and 100);
  end if;
end $$;

comment on column public.profiles.poids_famille is
  'Part du compromis familial dans le score de rotation (0 = mes goûts seuls, 100 = compromis maximal)';

-- ────────────────────────────────────────────────────────────────────────────
-- 1 — Membres du foyer
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists public.family_members (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  nom text not null,
  emoji text not null default '👤',
  /** Poids de ses goûts dans le compromis (1 = souple, 5 = prioritaire) */
  poids smallint not null default 3 check (poids between 1 and 5),
  /** Âge (optionnel) : affichage / information, n'entre pas dans le score */
  age smallint check (age between 0 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint family_members_nom_check check (char_length(btrim(nom)) between 1 and 40)
);

create index if not exists idx_family_members_user on public.family_members(user_id);

alter table public.family_members enable row level security;

drop policy if exists "Users manage own family members" on public.family_members;
create policy "Users manage own family members"
  on public.family_members for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

comment on table public.family_members is
  'Personnes pour qui le foyer cuisine (pondération par membre du compromis familial)';

-- ────────────────────────────────────────────────────────────────────────────
-- 2 — Relations membre ↔ aliment
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists public.family_member_ingredients (
  member_id bigint not null references public.family_members(id) on delete cascade,
  ingredient_id integer not null references public.ingredients(id) on delete cascade,
  /** aime | n_aime_pas | interdit (interdit = exclusion dure, comme une allergie) */
  relation text not null check (relation in ('aime', 'n_aime_pas', 'interdit')),
  primary key (member_id, ingredient_id)
);

create index if not exists idx_family_member_ingredients_member
  on public.family_member_ingredients(member_id);

alter table public.family_member_ingredients enable row level security;

drop policy if exists "Users manage own family ingredient links" on public.family_member_ingredients;
create policy "Users manage own family ingredient links"
  on public.family_member_ingredients for all
  using (exists (
    select 1 from public.family_members fm
    where fm.id = member_id and fm.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.family_members fm
    where fm.id = member_id and fm.user_id = auth.uid()
  ));

-- ────────────────────────────────────────────────────────────────────────────
-- 3 — Mémoire d'un membre sur une recette
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists public.family_member_meal_preferences (
  member_id bigint not null references public.family_members(id) on delete cascade,
  meal_id integer not null references public.meals(id) on delete cascade,
  /** 1 = ce membre refuse … 5 = il adore. null = pas d'avis. */
  note smallint check (note between 1 and 5),
  ne_plus_proposer boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (member_id, meal_id)
);

create index if not exists idx_family_member_meal_prefs_member
  on public.family_member_meal_preferences(member_id);

alter table public.family_member_meal_preferences enable row level security;

drop policy if exists "Users manage own family meal prefs" on public.family_member_meal_preferences;
create policy "Users manage own family meal prefs"
  on public.family_member_meal_preferences for all
  using (exists (
    select 1 from public.family_members fm
    where fm.id = member_id and fm.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.family_members fm
    where fm.id = member_id and fm.user_id = auth.uid()
  ));

-- ────────────────────────────────────────────────────────────────────────────
-- 5 — Enregistrement atomique d'un membre (+ ses aliments, + ses recettes)
--
-- p_membre_id null → création ; sinon mise à jour (et vérification que le
-- membre appartient bien à p_user_id : un id volé ne peut pas être modifié).
-- Les listes fournies REMPLACENT les précédentes — c'est ce que fait l'écran
-- de réglages, et ça évite de réconcilier des diffs côté client.
-- Les ids inconnus sont ignorés plutôt que de faire échouer tout l'enregistrement.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.save_family_member(
  p_user_id uuid,
  p_nom text,
  p_membre_id bigint default null,
  p_emoji text default '👤',
  p_poids smallint default 3,
  p_age smallint default null,
  p_ingredients jsonb default '[]'::jsonb,
  p_preferences jsonb default '[]'::jsonb
) returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
  v_nom text;
  v_poids smallint;
begin
  v_nom := btrim(coalesce(p_nom, ''));
  if char_length(v_nom) < 1 or char_length(v_nom) > 40 then
    raise exception 'Nom de membre invalide';
  end if;

  v_poids := least(5, greatest(1, coalesce(p_poids, 3)));

  if p_membre_id is null then
    insert into family_members (user_id, nom, emoji, poids, age, updated_at)
    values (
      p_user_id, v_nom,
      coalesce(nullif(btrim(p_emoji), ''), '👤'),
      v_poids,
      case when p_age is null then null else least(120, greatest(0, p_age)) end,
      now()
    )
    returning id into v_id;
  else
    update family_members
    set nom = v_nom,
        emoji = coalesce(nullif(btrim(p_emoji), ''), '👤'),
        poids = v_poids,
        age = case when p_age is null then null else least(120, greatest(0, p_age)) end,
        updated_at = now()
    where id = p_membre_id and user_id = p_user_id
    returning id into v_id;

    if v_id is null then
      raise exception 'Membre introuvable';
    end if;

    delete from family_member_ingredients where member_id = v_id;
    delete from family_member_meal_preferences where member_id = v_id;
  end if;

  -- Aliments : on n'insère que des ingrédients réels et des relations connues
  insert into family_member_ingredients (member_id, ingredient_id, relation)
  select v_id, (e ->> 'ingredient_id')::integer, e ->> 'relation'
  from jsonb_array_elements(coalesce(p_ingredients, '[]'::jsonb)) as e
  where (e ->> 'relation') in ('aime', 'n_aime_pas', 'interdit')
    and exists (
      select 1 from ingredients i where i.id = (e ->> 'ingredient_id')::integer
    );

  -- Recettes : note et/ou veto. Une ligne sans note ET sans veto ne sert à rien.
  insert into family_member_meal_preferences (member_id, meal_id, note, ne_plus_proposer, updated_at)
  select v_id,
         (e ->> 'meal_id')::integer,
         -- Note absente = pas d''avis (null) ; note hors bornes = ramenée dans
         -- l''échelle plutôt que de faire échouer tout l''enregistrement.
         case
           when (e ->> 'note') is null or (e ->> 'note') = '' then null
           else least(5, greatest(1, (e ->> 'note')::smallint))
         end,
         coalesce((e ->> 'ne_plus_proposer')::boolean, false),
         now()
  from jsonb_array_elements(coalesce(p_preferences, '[]'::jsonb)) as e
  where exists (
      select 1 from meals m where m.id = (e ->> 'meal_id')::integer
    )
    and (
      e ->> 'note' is not null
      or coalesce((e ->> 'ne_plus_proposer')::boolean, false)
    );

  return v_id;
end;
$$;

revoke execute on function public.save_family_member(
  uuid, text, bigint, text, smallint, smallint, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.save_family_member(
  uuid, text, bigint, text, smallint, smallint, jsonb, jsonb
) to service_role;
