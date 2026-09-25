-- ============================================================================
-- MIGRATION 00011 : Économies ancrées sur la base de l'utilisateur + emails
-- Décision produit (audit J1) : la promesse « € économisés » est calculée
-- contre la dépense hebdomadaire DÉCLARÉE par l'utilisateur (sa base),
-- jamais contre une moyenne théorique. Jamais devinée : champ nullable,
-- widget masqué tant que la base n'est pas saisie.
--
-- 1. profiles.depense_reference_hebdo : la base déclarée (€/semaine)
-- 2. profiles.depense_reference_saisie_le : date de saisie (détection péremption)
-- 3. weekly_budget_snapshots.depense_reelle : dépense RÉELLE saisie après les
--    courses → économie terrain = base − dépense réelle (vérité terrain,
--    calibrage des prix de référence en bêta)
-- 4. Préférences email : opt-out transactionnel + anti-doublon bienvenue
-- ============================================================================

-- 1 & 2. BASE DE DÉPENSE DÉCLARÉE ────────────────────────────────────────────
alter table public.profiles
  add column if not exists depense_reference_hebdo real;

alter table public.profiles
  add column if not exists depense_reference_saisie_le date;

comment on column public.profiles.depense_reference_hebdo is
  'Dépense hebdomadaire déclarée par l''utilisateur avant PlanMyMeal (€). Base du calcul des économies. NULL = non saisie → widget économies masqué, jamais deviné.';
comment on column public.profiles.depense_reference_saisie_le is
  'Date de la dernière saisie de la base de dépense (pour signaler une base périmée).';

-- 3. DÉPENSE RÉELLE POST-COURSES ─────────────────────────────────────────────
alter table public.weekly_budget_snapshots
  add column if not exists depense_reelle real;

comment on column public.weekly_budget_snapshots.depense_reelle is
  'Dépense réellement constatée par l''utilisateur après ses courses (€). Vérité terrain : economie_reelle = profiles.depense_reference_hebdo − depense_reelle.';

-- 4. PRÉFÉRENCES EMAIL ───────────────────────────────────────────────────────
-- Opt-out des emails transactionnels (digest hebdo). Le welcome est
-- transactionnel à usage unique (anti-doublon via welcome_email_envoye_le).
alter table public.profiles
  add column if not exists emails_transactionnels boolean not null default true;

alter table public.profiles
  add column if not exists welcome_email_envoye_le timestamptz;

-- Anti-doublon digest hebdo : semaine_debut du dernier digest envoyé.
-- Un re-déclenchement du cron dans la même semaine ne renvoie rien.
alter table public.profiles
  add column if not exists digest_envoye_le date;

comment on column public.profiles.emails_transactionnels is
  'false = l''utilisateur a désactivé les emails transactionnels (digest hebdomadaire). Le welcome n''est jamais renvoyé s''il a déjà été envoyé.';
comment on column public.profiles.welcome_email_envoye_le is
  'Timestamp d''envoi de l''email de bienvenue — garde d''idempotence.';
