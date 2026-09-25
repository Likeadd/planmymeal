-- ============================================================================
-- MIGRATION 00008 : Restes ("cuisiné le soir, mangé le lendemain midi")
-- Sur une ligne 'dejeuner', est_reste_de = meal_id du dîner dont ce repas
-- est le reste. La liste de courses n'achète alors pas d'ingrédients pour
-- ce déjeuner : le dîner source est cuisiné en double.
-- ============================================================================

alter table public.plan_meals
  add column if not exists est_reste_de integer references public.meals(id) on delete set null;

-- ⚠️ plan_meals a désormais 2 FKs vers meals (meal_id + est_reste_de) → tout
-- embed PostgREST 'meals(...)' depuis plan_meals doit être désambiguïsé :
--   meals!plan_meals_meal_id_fkey  (le repas du créneau)
--   meals!plan_meals_est_reste_de_fkey (jamais utilisé en embed)
