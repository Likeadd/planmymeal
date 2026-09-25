-- ============================================================================
-- 00013 : Desserts du midi — créneau repas optionnel au déjeuner
-- - plan_meals.repas_type accepte désormais 'dessert_midi' (en plus de
--   'dejeuner', 'diner', 'dessert')
-- - Le moteur attribue aussi des desserts légers (yaourt, fruits...) à 2-3
--   déjeuners par semaine, en plus des 3-4 desserts du soir.
-- - La liste de courses agrège déjà toutes les lignes plan_meals → les
--   ingrédients des desserts du midi sont achetés automatiquement.
-- - Idempotent : peut être relancé sans risque.
-- ============================================================================

alter table public.plan_meals
  drop constraint if exists plan_meals_repas_type_check;

alter table public.plan_meals
  add constraint plan_meals_repas_type_check
  check (repas_type in ('dejeuner', 'diner', 'dessert', 'dessert_midi'));

-- ============================================================================
-- save_weekly_plan : accepte la clé 'dessert_midi' dans p_days (jsonb).
-- Miroir de la migration 00012 : suppression AVANT insertion obsolete —
-- ici on recrée simplement la fonction avec le filtre étendu.
-- ============================================================================
create or replace function public.save_weekly_plan(
  p_user_id uuid,
  p_semaine_debut date,
  p_days jsonb,
  p_fallback_utilise boolean default false,
  p_cuisines_diversifiees jsonb default '[]'::jsonb
) returns table (plan_id bigint, shopping_list_id bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_plan_id bigint;
  v_old_list_id bigint;
  v_new_plan_id bigint;
  v_list_id bigint;
  v_nb_meals integer;
begin
  -- Garde-fou anti-abus : un navigateur ne peut écrire QUE pour lui-même.
  -- (Le moteur serveur appelle via service_role → auth.uid() est NULL.)
  if auth.uid() is not null and auth.uid() <> p_user_id then
    raise exception 'Opération non autorisée pour ce compte';
  end if;

  -- 1. Ancien plan de la même semaine + sa liste (cascade items)
  select wp.id into v_old_plan_id
  from weekly_plans wp
  where wp.user_id = p_user_id and wp.semaine_debut = p_semaine_debut;

  if v_old_plan_id is not null then
    select sl.id into v_old_list_id
    from shopping_lists sl
    where sl.plan_id = v_old_plan_id;
    if v_old_list_id is not null then
      delete from shopping_lists where id = v_old_list_id;  -- cascade items
    end if;
    delete from weekly_plans where id = v_old_plan_id;      -- cascade plan_meals
  end if;

  -- 2. Nouveau plan
  insert into weekly_plans (user_id, semaine_debut, is_active, fallback_utilise, cuisines_diversifiees)
  values (p_user_id, p_semaine_debut, true, p_fallback_utilise, p_cuisines_diversifiees)
  returning id into v_new_plan_id;

  insert into plan_meals (plan_id, jour_semaine, repas_type, meal_id, est_reste_de)
  select
    v_new_plan_id,
    (day->>'jourIndex')::smallint,
    kv.key::text as repas_type,
    (kv.value->>'id')::integer,
    case when kv.key = 'dejeuner' then (nullif(day->>'restesDe', '')::integer) else null end
  from jsonb_array_elements(p_days) as d(day),
       lateral jsonb_each(day) as kv(key, value)
  where kv.key in ('dejeuner', 'diner', 'dessert', 'dessert_midi')
    and jsonb_typeof(kv.value) = 'object'
    and kv.value ? 'id';

  -- 3. Jamais de plan vide en base : rollback complet + message explicite
  select count(*) into v_nb_meals from plan_meals pm where pm.plan_id = v_new_plan_id;
  if v_nb_meals = 0 then
    raise exception 'Aucune recette disponible pour cette semaine — vérifiez vos allergies/dislikes ou réessayez plus tard.';
  end if;

  -- 4. Historique de rotation (dédupliqué via l'index unique partiel ; les
  -- doublons résiduels sont ignorés — non bloquant, comme en JS)
  insert into meal_history (user_id, meal_id, planned_date, status)
  select p_user_id, pm.meal_id, p_semaine_debut, 'planned'
  from plan_meals pm
  where pm.plan_id = v_new_plan_id and pm.meal_id is not null
  on conflict do nothing;

  delete from meal_history
  where user_id = p_user_id
    and status = 'planned'
    and planned_date < current_date - 90;

  -- 5. Liste de courses (même transaction)
  v_list_id := public.recompute_shopping_list(v_new_plan_id);
  if v_list_id is null then
    raise exception 'Erreur lors de la création de la liste de courses (aucun ingrédient agrégé ?). Vérifiez que les recettes ont des ingrédients.';
  end if;

  return query select v_new_plan_id, v_list_id;
end;
$$;

-- Permissions inchangées : moteur serveur uniquement (service_role)
revoke execute on function public.save_weekly_plan(uuid, date, jsonb, boolean, jsonb) from public, anon, authenticated;
grant execute on function public.save_weekly_plan(uuid, date, jsonb, boolean, jsonb) to service_role;
