-- ============================================================================
-- 00030 — Profil corporel (besoins caloriques) + nouveaux régimes
--
-- 1. `profiles.sexe / age / taille_cm / poids_kg` : FACULTATIFS, saisis à
--    l'inscription pour calculer `calories_par_jour` (Mifflin-St Jeor, voir
--    src/lib/nutrition.ts). NULL = valeur de référence utilisée.
--    `calories_par_jour` existait déjà : elle reçoit désormais la valeur
--    proposée (modifiable par l'utilisateur).
-- 2. `user_diets.regime` : ajoute low_carb, paleo, sans_sucre_ajoute.
--
-- 100 % additif et idempotent.
-- ============================================================================

alter table public.profiles
  add column if not exists sexe text check (sexe in ('homme', 'femme')),
  add column if not exists age smallint check (age between 14 and 100),
  add column if not exists taille_cm smallint check (taille_cm between 120 and 230),
  add column if not exists poids_kg numeric(5,1) check (poids_kg between 30 and 250);

alter table public.profiles drop constraint if exists profiles_calories_par_jour_check;
alter table public.profiles
  add constraint profiles_calories_par_jour_check
  check (calories_par_jour is null or calories_par_jour between 1000 and 5000);

alter table public.user_diets drop constraint if exists user_diets_regime_check;
alter table public.user_diets
  add constraint user_diets_regime_check check (regime in (
    'vegan', 'vegetarien', 'pesco_vegetarien',
    'keto', 'sans_gluten', 'sans_lactose',
    'halal', 'cacher', 'sans_porc', 'sans_alcool',
    'low_carb', 'paleo', 'sans_sucre_ajoute'
  ));

notify pgrst, 'reload schema';
