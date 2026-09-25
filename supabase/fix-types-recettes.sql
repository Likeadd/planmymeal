-- ============================================================================
-- RECATEGORISATION DES RECETTES MAL TYPEES
-- À coller dans : Supabase → SQL Editor → New query → Run
--
-- Idempotent : le script peut être relancé sans casser la base.
--
-- Il corrige les incohérences de type_repas dans le catalogue :
--   • desserts rangés en 'plat' (ex : "Crêpes sucrées", tiramisus, tartes...)
--   • plats salés rangés en 'dessert' (ex : "Crêpes salées", galettes de sarrasin)
--   • nettoie les plannings qui référencent ces recettes mal typées
--
-- Prérequis : le schéma avec la contrainte
--   type_repas in ('entree', 'plat', 'dessert', 'petit_dejeuner', 'snack')
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- A. AUDIT AVANT — recettes dont le type semble incohérent avec le titre
--    (à lire pour vérifier ce qui va être corrigé)
-- ────────────────────────────────────────────────────────────────────────────

-- A1. Mots-clés "dessert" mais type différent
select id, titre, type_repas
from meals
where titre ilike any(array[
  '%crêpes sucrées%', '%panna cotta%', '%crème brûlée%', '%mousse au chocolat%',
  '%tiramisu%', '%fondant%', '%brownie%', '%clafoutis%', '%gâteau%',
  '%compote de%', '%salade de fruits%', '%poires pochées%', '%mug cake%',
  '%moelleux%', '%tarte aux pommes%', '%tarte tatin%', '%tarte au citron%',
  '%crumble%', '%cookies%', '%galette des rois%'
]) and type_repas <> 'dessert'
order by titre;

-- A2. Mots-clés "plat salé" mais type différent
select id, titre, type_repas
from meals
where titre ilike any(array[
  '%crêpes salées%', '%crêpes complètes%', '%crêpes au jambon%',
  '%crêpes au fromage%', '%galettes bretonnes%', '%galette de sarrasin%',
  '%galette complète%', '%galettes complètes%'
]) and type_repas <> 'plat'
order by titre;

-- A3. Soupes & veloutés — vérification manuelle souhaitable
--     (une soupe peut être une entrée légère OU un plat complet : on ne
--      tranche pas automatiquement, cf. "Soupe à l'oignon gratinée" = plat)
select id, titre, type_repas
from meals
where titre ilike any(array['%soupe%', '%velouté%', '%potage%'])
order by type_repas, titre;


-- ────────────────────────────────────────────────────────────────────────────
-- B. CORRECTIONS PAR TITRE EXACT — cas connus des anciens seeds
--    (ne touche que les lignes dont le type est réellement faux)
-- ────────────────────────────────────────────────────────────────────────────

-- B1. Crêpes / galettes salées : c'est un PLAT du soir, pas un dessert
update meals
set type_repas = 'plat'
where titre in (
  'Crêpes salées',
  'Crêpes salées jambon-fromage',
  'Crêpes complètes',
  'Galettes complètes',
  'Galette complète',
  'Galettes de sarrasin',
  'Galettes de sarrasin complètes'
) and type_repas <> 'plat';

-- B2. Desserts classiques éventuellement rangés en plat par un ancien seed
update meals
set type_repas = 'dessert'
where titre in (
  'Crêpes sucrées',
  'Mousse au chocolat',
  'Tarte aux pommes',
  'Tiramisu',
  'Crème brûlée',
  'Salade de fruits frais'
) and type_repas <> 'dessert';


-- ────────────────────────────────────────────────────────────────────────────
-- C. CORRECTIONS PAR MOTS-CLÉS — rattrape les titres inconnus de ce script
--    (mots-clés volontairement conservateurs pour ne rien casser)
--    ⚠️ Appliqué à toutes les recettes ; restreindre avec
--    `and created_by is null` si on veut limiter au catalogue officiel.
-- ────────────────────────────────────────────────────────────────────────────

-- C1. Tout ce qui ressemble à un dessert → dessert
update meals
set type_repas = 'dessert'
where titre ilike any(array[
  '%crêpes sucrées%', '%panna cotta%', '%crème brûlée%', '%mousse au chocolat%',
  '%tiramisu%', '%fondant%', '%brownie%', '%clafoutis%', '%gâteau%',
  '%compote de%', '%salade de fruits%', '%poires pochées%', '%mug cake%',
  '%moelleux%', '%tarte aux pommes%', '%tarte tatin%', '%tarte au citron%',
  '%crumble%', '%cookies%', '%galette des rois%'
]) and type_repas <> 'dessert';

-- C2. Tout ce qui ressemble à un plat de crêpes/galettes salées → plat
update meals
set type_repas = 'plat'
where titre ilike any(array[
  '%crêpes salées%', '%crêpes complètes%', '%crêpes au jambon%',
  '%crêpes au fromage%', '%galettes bretonnes%', '%galette de sarrasin%',
  '%galette complète%', '%galettes complètes%'
]) and type_repas <> 'plat';


-- ────────────────────────────────────────────────────────────────────────────
-- D. NETTOYAGE DES PLANNINGS — retire des créneaux déjeuner/dîner les
--    recettes qui ne sont pas des plats (le créneau devient vide,
--    l'utilisateur peut le régénérer avec le bouton 🔄 du dashboard)
-- ────────────────────────────────────────────────────────────────────────────

-- D1. Retire de l'historique de rotation les entrées "planned" de ces recettes
--     (on conserve cooked / liked / disliked = la mémoire de rotation)
delete from meal_history mh
using meals m
where mh.meal_id = m.id
  and m.type_repas <> 'plat'
  and mh.status = 'planned';

-- D2. Retire les recettes non-plat des plannings actifs
delete from plan_meals pm
using meals m
where pm.meal_id = m.id
  and m.type_repas <> 'plat';


-- ────────────────────────────────────────────────────────────────────────────
-- E. AUDIT APRÈS — à exécuter pour vérifier le résultat
-- ────────────────────────────────────────────────────────────────────────────

-- E1. Répartition par type
select type_repas, count(*) as nb
from meals
group by type_repas
order by nb desc;

-- E2. Recettes encore incohérentes (devrait être vide, hors soupes à statuer)
select id, titre, type_repas
from meals
where (
  titre ilike any(array[
    '%crêpes sucrées%', '%panna cotta%', '%crème brûlée%', '%mousse au chocolat%',
    '%tiramisu%', '%fondant%', '%brownie%', '%clafoutis%', '%gâteau%',
    '%compote de%', '%salade de fruits%', '%poires pochées%', '%mug cake%',
    '%moelleux%', '%tarte aux pommes%', '%crumble%', '%cookies%', '%galette des rois%'
  ]) and type_repas <> 'dessert'
) or (
  titre ilike any(array[
    '%crêpes salées%', '%galettes bretonnes%', '%galette de sarrasin%',
    '%galette complète%'
  ]) and type_repas <> 'plat'
)
order by type_repas, titre;

-- E3. Créneaux de planning devenus vides (à régénérer depuis le dashboard)
select pm.plan_id, pm.jour_semaine, pm.repas_type
from plan_meals pm
where pm.meal_id is null
order by pm.plan_id, pm.jour_semaine;
