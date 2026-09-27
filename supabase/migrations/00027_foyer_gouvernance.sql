-- ============================================================================
-- 00027 — Gouvernance du foyer : délai des recettes aimées + saison à la carte
--
-- 1. `households.delai_recettes_aimees_jours` : réglage du créateur du foyer
--    (« chef du foyer ») — au bout de combien de jours une recette déjà aimée
--    (au moins un « J'adore » en historique) redevient proposable. S'applique
--    à tous les membres du foyer (planning encore individuel par compte,
--    cf. migration 00021 — seul ce réglage est désormais partagé).
--    Remplace, pour CES recettes, le minimum générique de 21 jours.
--    Déjà couvert par la policy "Owner updates household" (00021) : aucune
--    nouvelle policy nécessaire.
--
-- 2. `profiles.utiliser_saison` : choisi à l'inscription (modifiable ensuite),
--    active ou coupe le favoritisme saisonnier du moteur (recettes d'hiver
--    déconseillées en été, etc.).
--
-- 100 % additif et idempotent.
-- ============================================================================

alter table public.households
  add column if not exists delai_recettes_aimees_jours integer not null default 21
    check (delai_recettes_aimees_jours between 1 and 180);

comment on column public.households.delai_recettes_aimees_jours is
  'Jours avant qu''une recette déjà aimée par un membre du foyer redevienne proposable. Réglable par le créateur du foyer uniquement (policy "Owner updates household").';

alter table public.profiles
  add column if not exists utiliser_saison boolean not null default true;

comment on column public.profiles.utiliser_saison is
  'Choisi à l''inscription : le moteur favorise-t-il les recettes de la saison en cours ? Coupe le facteur saison du moteur si false.';
