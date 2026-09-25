-- ============================================================================
-- MIGRATION 00002 : Batch Cooking
-- Conservation des recettes + préférences batch cooking utilisateur
-- ============================================================================

-- 1. Ajouter la durée de conservation aux recettes
alter table public.meals
  add column if not exists conservation_jours smallint;
-- NULL = non testé, 1-2 = mange vite, 3-5 = idéal batch cooking, 5+ = longue conservation
comment on column public.meals.conservation_jours is 'Jours de conservation au frigo. NULL=inconnu, 3+=idéal batch cooking';

-- 2. Préférences batch cooking pour l'utilisateur
alter table public.profiles
  add column if not exists batch_cooking boolean not null default false;
alter table public.profiles
  add column if not exists batch_cooking_jour smallint not null default 6;
-- 6 = dimanche (0=lundi..6=dimanche)
comment on column public.profiles.batch_cooking is 'Active le mode batch cooking : le jour J on cuisine pour les jours suivants';
comment on column public.profiles.batch_cooking_jour is 'Jour de la semaine dédié au batch cooking (0=lundi..6=dimanche)';

-- 3. Vue : score de rotation avec conservation
drop view if exists meal_rotation_score;
create or replace view meal_rotation_score as
select
  m.id as meal_id,
  m.titre,
  m.calories_par_portion,
  m.temps_preparation,
  m.saison as meal_saison,
  m.cuisine,
  m.conservation_jours,
  mh.user_id,
  max(mh.planned_date) as derniere_planification,
  count(mh.id) filter (where mh.status = 'liked') as nb_likes,
  count(mh.id) filter (where mh.status = 'disliked') as nb_dislikes,
  count(mh.id) as nb_total_apparitions,
  (current_date - max(mh.planned_date)) as jours_depuis_derniere
from meals m
left join meal_history mh on m.id = mh.meal_id
where m.is_public = true
group by m.id, mh.user_id;