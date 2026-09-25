-- ============================================================================
-- 00018 — Poids unitaire des ingrédients
--
-- Problème mesuré : les macros d'une recette étaient calculées avec
-- `calories_pour_100g * quantite / 100` quel que soit `unite`. Les coefficients
-- étant « pour 100 g », une quantité exprimée en PIÈCES était donc comptée comme
-- autant de GRAMMES : les 3 œufs et les 4 poires d'un clafoutis pesaient 7 g au
-- lieu de ~780 g, et ses calories étaient sous-estimées d'environ 35 %.
--
-- Conséquence qui n'est pas qu'esthétique : le score lit `calories_par_portion`
-- pour le contexte de jour « léger » (≤ 550 kcal → ×1,2). Avec des valeurs
-- sous-estimées, 942 des 1 122 recettes publiques tombaient sous ce seuil et un
-- plat lourd y recevait le bonus du plat léger.
--
-- 1 706 des 6 806 liens `meal_ingredients` (25 %) ne sont pas en grammes.
--
-- `poids_unites` donne le poids d'UNE unité non massique, par unité :
--
--     {"pcs": 180, "cas": 10}   →  4 pcs d'orange = 720 g
--
-- Règles de lecture, appliquées par `src/lib/unites.ts` :
--   • `g` et `ml` sont des masses (1 ml ≈ 1 g, comme le fait déjà le budget) ;
--   • toute autre unité SANS poids déclaré reste non convertible → la recette
--     n'est pas chiffrable, elle n'est pas estimée au jugé ;
--   • c'est l'ingrédient qui porte le poids, pas l'unité : un « cas » de miel
--     (20 g) et un « cas » d'huile (10 g) ne pèsent pas pareil.
--
-- Sûre à rejouer : `add column if not exists`, aucune donnée supprimée.
-- ============================================================================

alter table ingredients add column if not exists poids_unites jsonb;

comment on column ingredients.poids_unites is
  'Poids en grammes d''une unité non massique, par unité ({"pcs": 180, "cas": 10}). NULL ou unité absente = quantité non convertible : ne jamais estimer au jugé. Voir src/lib/unites.ts.';
