-- ============================================================================
-- 00028 — Newsletter dominicale (lead magnet sans compte)
--
-- Formulaire du footer (LandingFooter) + /api/newsletter : email + liste de
-- courses de la semaine, envoyés chaque dimanche à qui n'a pas de compte.
-- Aucune policy RLS : la table n'est lue/écrite QUE côté serveur, avec la
-- clé de service (routes /api/newsletter*, cron newsletter-hebdo) — jamais
-- depuis le client. RLS activée quand même, par cohérence avec le reste du
-- schéma (défense en profondeur si une clé anon interroge la table un jour).
--
-- 100 % additif et idempotent.
-- ============================================================================

create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  -- Jeton d'un lien de désinscription à un clic, sans authentification.
  token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  unsubscribed_at timestamptz
);

create index if not exists newsletter_subscribers_active_idx
  on public.newsletter_subscribers (email)
  where unsubscribed_at is null;

alter table public.newsletter_subscribers enable row level security;
