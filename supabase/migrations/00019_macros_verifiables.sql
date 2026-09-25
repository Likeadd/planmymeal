-- ============================================================================
-- 00019 — Drapeau de vérifiabilité des macros d'une recette
--
-- Pourquoi une colonne plutôt qu'une déduction à la lecture : le moteur note
-- une recette « légère » d'après `calories_par_portion` (bonus ×1,2 sous
-- 550 kcal). Une recette dont les calories n'ont jamais été CALCULÉES depuis sa
-- composition — valeur d'auteur, ou refus du recalcul — peut donc paraître
-- légère alors qu'elle est lourde, et le moteur la FAVORISE sur les jours que
-- l'utilisateur déclare légers. C'est l'effet exact du calcul d'avant, qui
-- comptait une pièce pour un gramme : le clafoutis était sous-estimé de 35 %.
--
-- `macros_verifiables` vaut true quand `scripts/recalculer-macros.ts` a pu
-- calculer les macros depuis la composition ET que le total est croyable
-- (`verifierPlausibilite`, plafond 1 500 kcal/portion). Le DÉFAUT est false :
-- une recette créée par l'application ou par un import futur n'obtient le
-- bonus de légèreté qu'une fois vérifiée. Un drapeau optimiste par défaut
-- rouvrirait le trou à chaque nouvelle recette ; un drapeau pessimiste le
-- ferme.
--
-- Ce que le moteur en fait : il n'accorde NI bonus NI malus de légèreté sur une
-- recette non vérifiée (le facteur reste ×1). On ne favorise pas ce qu'on ne
-- peut pas mesurer — et on ne pénalise pas non plus une valeur qu'on ne sait
-- pas fausse.
--
-- Après `recalculer-macros.ts --write` : 1 135 recettes à true, 3 à false
-- (« Poulet rôti aux herbes & patates douces » 1 pcs de poulet entier pour
-- 2 portions, « Croziflette » 1 reblochon entier pour 2, « Fish & chips
-- maison » 500 ml d'huile de friture comptée comme mangée). Leurs totaux
-- calculés dépassent le plafond : elles gardent leur ancienne valeur et leur
-- drapeau à false, en attendant un arbitrage sur leurs portions.
-- ============================================================================

alter table public.meals
  add column if not exists macros_verifiables boolean not null default false;

comment on column public.meals.macros_verifiables is
  'true si calories_par_portion/proteines/glucides/lipides ont été calculés depuis la composition et jugés croyables (voir scripts/recalculer-macros.ts). false = macros d''auteur non vérifiées : le moteur n''en tire ni bonus ni malus de légèreté.';
