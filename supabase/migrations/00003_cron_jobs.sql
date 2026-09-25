-- ============================================================================
-- MIGRATION 00003 : Cron job — Régénération automatique du planning
-- Déclenche l'Edge Function auto-generate-week chaque dimanche à 20h
-- ============================================================================

-- 1. Activer les extensions nécessaires
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema pg_catalog;

-- 2. Planifier le cron job : chaque dimanche à 20h00 (UTC)
--    pg_cron utilise l'heure UTC → 20h CET = 18h UTC (hiver) ou 19h UTC (été)
--    On utilise 19h UTC pour couvrir les deux fuseaux
select cron.schedule(
  'auto-generate-week-sunday',
  '0 19 * * 0',  -- dimanche 19h UTC = dimanche 20h/21h CET
  $$
  select net.http_post(
    url := 'https://' || current_setting('app.settings.supabase_project_ref') || '.supabase.co/functions/v1/auto-generate-week',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.cron_secret'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- 3. Désactiver l'ancien planning de la semaine précédente
--    (optionnel : garde l'historique mais désactive is_active)
--    Exécuté juste avant le cron de génération
select cron.schedule(
  'deactivate-old-plans',
  '30 18 * * 0',  -- dimanche 18h30 UTC
  $$
  update public.weekly_plans
  set is_active = false
  where semaine_debut < date_trunc('week', now())::date;
  $$
);