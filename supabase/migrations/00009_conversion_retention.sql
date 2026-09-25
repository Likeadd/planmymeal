-- ============================================================================
-- MIGRATION 00009 : Fonctionnalités Conversion & Rétention
-- 1. profiles.prix_max_portion : cap strict par portion (Pro) — l'algo ne
--    sélectionne QUE des recettes sous ce seuil.
-- 2. profiles.equipements : appareils possédés (Air fryer, Cookéo, Thermomix…)
--    → boost des recettes compatibles, pénalité des recettes exigeant un
--    appareil non possédé.
-- 3. profiles.auto_restes : "Meal Prep Pro" — après chaque génération, les
--    déjeuners deviennent automatiquement les restes du dîner de la veille
--    (courses réduites, lunchbox du lendemain).
-- ============================================================================

alter table public.profiles
  add column if not exists prix_max_portion numeric(6,2) check (prix_max_portion is null or prix_max_portion > 0),
  add column if not exists equipements text[] not null default '{}',
  add column if not exists auto_restes boolean not null default false;
