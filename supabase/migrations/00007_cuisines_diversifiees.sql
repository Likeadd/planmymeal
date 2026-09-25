-- ============================================================================
-- MIGRATION 00007 : Cuisines diversifiées en mode fallback
-- Persiste la liste des cuisines mises en avant quand le filet de sécurité
-- rotation est actif, pour affichage dans la bannière du dashboard
-- (survit aux rechargements de page).
-- ============================================================================

alter table public.weekly_plans
  add column if not exists cuisines_diversifiees text[] not null default '{}';
