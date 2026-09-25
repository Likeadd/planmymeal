-- ============================================================================
-- MIGRATION 00020 : retrait du cron Edge Function obsolète
--
-- Le job pg_cron 'auto-generate-week-sunday' appelait l'Edge Function
-- auto-generate-week, un FORK périmé du moteur de rotation (sans mémoire
-- alimentaire, frigo, profils famille, budget, équipement ni desserts, avec
-- des écritures non transactionnelles et un bug de semaine cible : il
-- écrasait le planning EN COURS le dimanche soir au lieu de préparer le
-- suivant).
--
-- L'auto-génération est désormais assurée par la route Next.js
-- /api/cron/auto-generate-week (planifiée dans vercel.json, dimanche 19h UTC),
-- qui délègue au VRAI moteur — la même source de vérité que le bouton
-- « Générer ma semaine ». Idempotent : un planning déjà présent n'est jamais
-- écrasé.
-- ============================================================================

-- ⚠️ pg_cron refuse l'UPDATE direct de cron.job MÊME au rôle postgres
-- (table possédée par l'extension → « permission denied for table job »).
-- L'API officielle est cron.unschedule(). On SUPPRIME donc le job — il
-- pointe vers une Edge Function retirée du dépôt, le relancer ne pourrait
-- que échouer ; la trace de son existence reste dans l'historique git
-- (migration 00003) et le README.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'auto-generate-week-sunday') then
    perform cron.unschedule('auto-generate-week-sunday');
  end if;
end $$;

-- Opt-out de l'auto-génération (le cron Vercel saute les foyers qui la
-- désactivent). Défaut : activée — le planning se construit tout seul,
-- comme promis à l'onboarding. Le nouveau cron utilise la même lecture
-- « onboarding_complete = true » que l'ancien.
alter table public.profiles
  add column if not exists auto_generate boolean not null default true;

comment on column public.profiles.auto_generate is
  'Auto-génération hebdomadaire du planning par le cron (opt-out utilisateur)';

-- Le flag se désactive par le propriétaire du compte uniquement
-- (RLS déjà en place sur profiles : l'utilisateur modifie sa propre ligne).

-- Le job 'deactivate-old-plans' (désactivation des semaines passées) reste
-- utile : il garde l'historique consultable sans polluer les lectures
-- `is_active = true` (digest email, planning courant).
