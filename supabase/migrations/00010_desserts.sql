-- ============================================================================
-- 00010 : Desserts — créneau repas optionnel
-- - plan_meals.repas_type accepte désormais 'dessert' (en plus de dejeuner/diner)
-- - Le moteur attribue 3-4 desserts/semaine (week-end puis milieu de semaine)
-- - La liste de courses agrège déjà toutes les lignes plan_meals → les
--   ingrédients des desserts sont achetés automatiquement, sans changement.
-- ============================================================================

alter table public.plan_meals
  drop constraint plan_meals_repas_type_check;

alter table public.plan_meals
  add constraint plan_meals_repas_type_check
  check (repas_type in ('dejeuner', 'diner', 'dessert'));

-- Préférence par foyer : desserts ajoutés automatiquement aux semaines générées
alter table public.profiles
  add column if not exists desserts_activees boolean not null default true;
