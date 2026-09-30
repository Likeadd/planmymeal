-- ============================================================================
-- 00032 — Crédits des photos de recettes
--
-- `image_url` existe déjà (mais contient ~100 images générées qui ne
-- correspondent pas aux plats : elles ne sont PAS affichées). Une photo n'est
-- affichée que si `image_source` est renseignée, c'est-à-dire validée à l'œil
-- puis appliquée par `npm run photos:appliquer` (scripts/photos-appliquer.ts).
-- Les colonnes portent l'attribution exigée par les banques d'images.
--
-- 100 % additif et idempotent.
-- ============================================================================

alter table public.meals
  add column if not exists image_source text,       -- 'pixabay' | 'pexels' | 'unsplash'
  add column if not exists image_auteur text,       -- nom du photographe
  add column if not exists image_auteur_url text,   -- profil du photographe
  add column if not exists image_page_url text,     -- page de la photo sur le site source
  add column if not exists image_licence text;      -- ex. 'Pixabay Content License'

notify pgrst, 'reload schema';
