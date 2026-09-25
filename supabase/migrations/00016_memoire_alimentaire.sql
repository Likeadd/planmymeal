-- ============================================================================
-- MIGRATION 00016 : MÉMOIRE ALIMENTAIRE + FRIGO — PlanMyMeal
--
-- Transforme le générateur de menus en assistant : le moteur ne se contente
-- plus d'espacer les recettes (21 j), il apprend les goûts et les contraintes.
--
--   1. profiles.temps_max_par_jour — temps de cuisine disponible pour CHAQUE
--      jour (« mercredi soir → 15 min »). null = repli sur temps_max_semaine
--      / temps_max_weekend (colonnes 00001, toujours utilisées).
--   2. profiles.contexte_jours — intention culinaire par jour :
--      'normal' | 'rapide' | 'leger' | 'plaisir'.
--   3. profiles.nouveaute — curseur Confort (0) ↔ Découverte (100).
--   4. meal_history.raison — « pourquoi ? » d'une note (trop long, trop cher…).
--   5. user_meal_preferences — mémoire par recette : note, fréquence souhaitée
--      (« environ tous les 20 jours »), jour préféré, créneau préféré,
--      ne plus proposer.
--   6. fridge_items — garde-manger persistant (quantité, unité, péremption).
--   7. recompute_shopping_list_frigo — enveloppe ADDITIVE de
--      recompute_shopping_list (00014) : elle déduit du panier ce qui est déjà
--      au frigo (même unité uniquement) puis supprime les lignes couvertes.
--      On ne réécrit PAS la RPC d'agrégation → aucune duplication de logique.
--
-- 100 % idempotent : relançable sans risque.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1..3 — Préférences de rythme du foyer
-- ────────────────────────────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists temps_max_par_jour jsonb not null default '[]'::jsonb;

alter table public.profiles
  add column if not exists contexte_jours jsonb not null default '[]'::jsonb;

alter table public.profiles
  add column if not exists nouveaute smallint not null default 20;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_nouveaute_check'
  ) then
    alter table public.profiles
      add constraint profiles_nouveaute_check check (nouveaute between 0 and 100);
  end if;
end $$;

comment on column public.profiles.temps_max_par_jour is
  'Temps de préparation max par jour (jsonb: 7 entrées number|null, index 0=lundi). null → repli temps_max_semaine/weekend';
comment on column public.profiles.contexte_jours is
  'Intention culinaire par jour (jsonb: 7 entrées parmi normal|rapide|leger|plaisir|null)';
comment on column public.profiles.nouveaute is
  'Curseur Confort (0) ↔ Découverte (100) du moteur de recommandation';

-- ────────────────────────────────────────────────────────────────────────────
-- 4 — Raison d''une note
-- ────────────────────────────────────────────────────────────────────────────
alter table public.meal_history add column if not exists raison text;

comment on column public.meal_history.raison is
  'Pourquoi de la note : trop_long | trop_cher | trop_complique | pas_assez_bon | trop_epice | ingredients_introuvables | famille | autre';

-- ────────────────────────────────────────────────────────────────────────────
-- 5 — Mémoire alimentaire par recette
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists public.user_meal_preferences (
  user_id uuid not null references public.profiles(id) on delete cascade,
  meal_id integer not null references public.meals(id) on delete cascade,
  /** Dernière note explicite (1 = rejeter, 5 = adorer) */
  note smallint check (note between 1 and 5),
  /** Rotation souhaitée : « environ tous les 20 jours » */
  frequence_jours smallint check (frequence_jours between 1 and 365),
  /** Jour préféré 0=lundi..6=dimanche */
  jour_prefere smallint check (jour_prefere between 0 and 6),
  /** Créneau préféré */
  repas_prefere text check (repas_prefere in ('dejeuner', 'diner', 'dessert', 'dessert_midi')),
  /** Bannissement définitif de la pioche */
  ne_plus_proposer boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, meal_id)
);

create index if not exists idx_user_meal_preferences_user on public.user_meal_preferences(user_id);

alter table public.user_meal_preferences enable row level security;

drop policy if exists "Users manage own meal preferences" on public.user_meal_preferences;
create policy "Users manage own meal preferences"
  on public.user_meal_preferences for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────────────────────
-- 6 — Frigo / garde-manger persistant
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists public.fridge_items (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  ingredient_id integer not null references public.ingredients(id),
  quantite real not null check (quantite > 0),
  /** Unité normalisée à l''écriture : g | ml | pcs | botte | boite | sachet */
  unite text not null default 'g',
  /** Date de péremption (optionnelle) — sert au tri et aux alertes */
  expiration date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, ingredient_id, unite)
);

create index if not exists idx_fridge_items_user on public.fridge_items(user_id);

alter table public.fridge_items enable row level security;

drop policy if exists "Users manage own fridge" on public.fridge_items;
create policy "Users manage own fridge"
  on public.fridge_items for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────────────────────
-- 7 — Liste de courses consciente du frigo (enveloppe additive)
--
-- recompute_shopping_list_frigo(p_plan_id) :
--   1. recalcule la liste via la RPC d''agrégation 00014 (source de vérité)
--   2. déduit les quantités du frigo, UNIQUEMENT si l''unité correspond
--      (comparer des grammes à des pièces fausserait le panier — on préfère
--      ne rien déduire plutôt que déduire faux)
--   3. supprime les lignes entièrement couvertes par le frigo
--
-- Réservée à service_role, comme les autres RPC du moteur.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.recompute_shopping_list_frigo(
  p_plan_id bigint
) returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_list_id bigint;
  v_user_id uuid;
begin
  v_list_id := public.recompute_shopping_list(p_plan_id);
  if v_list_id is null then
    return null;
  end if;

  select wp.user_id into v_user_id from weekly_plans wp where wp.id = p_plan_id;
  if v_user_id is null then
    return v_list_id;
  end if;

  -- Déduction « même unité » (voir en-tête)
  update shopping_list_items sli
  set quantite_totale = greatest(0, sli.quantite_totale - f.quantite)::real
  from (
    select fi.ingredient_id, fi.unite, sum(fi.quantite)::real as quantite
    from fridge_items fi
    where fi.user_id = v_user_id
    group by fi.ingredient_id, fi.unite
  ) f
  where sli.list_id = v_list_id
    and f.ingredient_id = sli.ingredient_id
    and f.unite = sli.unite;

  delete from shopping_list_items
  where list_id = v_list_id and quantite_totale <= 0;

  return v_list_id;
end;
$$;

revoke execute on function public.recompute_shopping_list_frigo(bigint) from public, anon, authenticated;
grant execute on function public.recompute_shopping_list_frigo(bigint) to service_role;
