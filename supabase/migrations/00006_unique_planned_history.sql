-- ============================================================================
-- MIGRATION 00006 : Intégrité rotation + cuisines variées en fallback
-- 1. Index unique partiel : un seul marqueur 'planned' par (user, repas, date).
--    Partiel volontairement : les retours liked/disliked/cooked pour le même
--    repas le même jour restent autorisés.
-- 2. Purge préalable des doublons hérités (sinon l'index ne se crée pas).
-- ============================================================================

-- 1. Supprimer les doublons 'planned' existants (on garde le plus ancien)
delete from public.meal_history mh
using public.meal_history mh2
where mh.user_id = mh2.user_id
  and mh.meal_id = mh2.meal_id
  and mh.planned_date = mh2.planned_date
  and mh.status = 'planned'
  and mh2.status = 'planned'
  and mh.id > mh2.id;

-- 2. Index unique partiel (durcit la dédup applicative côté base)
create unique index if not exists uq_meal_history_planned
  on public.meal_history(user_id, meal_id, planned_date)
  where status = 'planned';
