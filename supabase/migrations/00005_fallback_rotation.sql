-- ============================================================================
-- MIGRATION 00005 : Traçabilité du filet de sécurité rotation — PlanMyMeal
-- Flag 'fallback_utilise' sur weekly_plans : true quand la génération a dû
-- réutiliser des recettes récemment servies (cooldown 21j levé), pour
-- afficher une bannière à l'utilisateur.
-- ============================================================================

alter table public.weekly_plans
  add column if not exists fallback_utilise boolean not null default false;
