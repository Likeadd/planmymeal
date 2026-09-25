-- ============================================================================
-- MIGRATION 00014 : Mise à jour desserts + RPC — PlanMyMeal
--
-- Corrige l'écart entre le code et la base observée en production :
--   • plan_meals.refuse 'dessert' et 'dessert_midi' (contrainte 00010/00013
--     absente) → tout ajout/sélection de dessert échoue côté app
--   • RPC transactionnelles (00012/00013) absentes → génération de semaine
--     et recalcul liste de courses en erreur
--
-- 100 % idempotent : peut être relancé sans risque.
-- Ordre : 00010 (dessert) → 00013 (dessert_midi + RPC jour midi) + 00012
-- (RPC transactionnelles, ici recréées en dernier pour intégrer dessert_midi).
-- ============================================================================

-- 1. Créneaux desserts (soir + midi) dans plan_meals --------------------------
alter table public.plan_meals
  drop constraint if exists plan_meals_repas_type_check;

alter table public.plan_meals
  add constraint plan_meals_repas_type_check
  check (repas_type in ('dejeuner', 'diner', 'dessert', 'dessert_midi'));

-- Préférence par foyer : desserts ajoutés automatiquement aux semaines générées
alter table public.profiles
  add column if not exists desserts_activees boolean not null default true;

comment on column public.profiles.desserts_activees is 'Desserts ajoutés automatiquement aux semaines générées (3-4/semaine)';

-- ============================================================================
-- 2. RPC transactionnelles (miroir 00012, filtre étendu dessert_midi — 00013)
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- Helper : quantité « achetable » (miroir de budget.ts / quantiteAchatListe)
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.quantite_achat_liste(
  p_quantite real,
  p_unite text,
  p_unite_prix text
) returns real
language plpgsql immutable
set search_path = public
as $$
begin
  if p_unite_prix is null then
    return null;
  end if;

  case p_unite_prix
    when 'kg' then
      return case when p_unite = 'g'
        then (ceil((p_quantite / 1000.0) * 10) / 10.0)::real
        else null end;
    when 'L' then
      return case when p_unite = 'ml'
        then (ceil((p_quantite / 1000.0) * 10) / 10.0)::real
        else null end;
    when 'pcs' then
      return case
        when p_unite = 'pcs'     then greatest(1, ceil(p_quantite))::real
        when p_unite = 'tranche' then greatest(1, ceil(p_quantite / 2.0))::real
        else null
      end;
    when 'botte', 'boite', 'sachet', 'tranche' then
      return case when p_unite = p_unite_prix
        then greatest(1, ceil(p_quantite))::real
        else null end;
    else
      return null;
  end case;
end;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- recompute_shopping_list(p_plan_id) — liste de courses en une transaction
-- (déjeuners-reste n'achètent rien ; dîner source cuit ×2 ; optionnels ignorés)
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.recompute_shopping_list(
  p_plan_id bigint
) returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_nb_personnes smallint;
  v_list_id bigint;
  v_nb_items integer;
  v_checked_ids integer[];
begin
  select wp.user_id into v_user_id
  from weekly_plans wp
  where wp.id = p_plan_id;
  if v_user_id is null then
    raise exception 'Plan introuvable (id %)', p_plan_id;
  end if;

  select coalesce(pr.nb_personnes, 2) into v_nb_personnes
  from profiles pr
  where pr.id = v_user_id;

  with agregation as (
    select
      mi.ingredient_id,
      round(sum(mi.quantite * ratio.ratio)::numeric, 1)::real as quantite_totale,
      min(mi.unite) as unite,
      min(coalesce(i.rayon, 'epicerie_salee')) as rayon
    from plan_meals pm
    join meals m on m.id = pm.meal_id
    join meal_ingredients mi
      on mi.meal_id = pm.meal_id and mi.est_optionnel = false
    left join ingredients i on i.id = mi.ingredient_id
    cross join lateral (
      select
        (v_nb_personnes::real / coalesce(m.portions_par_defaut, 2)::real) *
        case when exists (
          select 1 from plan_meals pm2
          where pm2.plan_id = p_plan_id
            and pm2.repas_type = 'dejeuner'
            and pm2.est_reste_de = pm.meal_id
        ) then 2.0 else 1.0 end
      as ratio
    ) ratio
    where pm.plan_id = p_plan_id
      and pm.meal_id is not null
      and not (pm.repas_type = 'dejeuner' and pm.est_reste_de is not null)
    group by mi.ingredient_id
  )
  select count(*) into v_nb_items from agregation;

  select sl.id into v_list_id
  from shopping_lists sl
  where sl.plan_id = p_plan_id and sl.is_active = true
  limit 1;

  if v_list_id is null then
    if v_nb_items = 0 then
      return null;
    end if;
    insert into shopping_lists (user_id, plan_id, is_active)
    values (v_user_id, p_plan_id, true)
    returning id into v_list_id;
  end if;

  select coalesce(array_agg(sli.ingredient_id) filter (where sli.checked), '{}')
    into v_checked_ids
  from shopping_list_items sli
  where sli.list_id = v_list_id;

  delete from shopping_list_items where list_id = v_list_id;

  with agregation as (
    select
      mi.ingredient_id,
      round(sum(mi.quantite * ratio.ratio)::numeric, 1)::real as quantite_totale,
      min(mi.unite) as unite,
      min(coalesce(i.rayon, 'epicerie_salee')) as rayon
    from plan_meals pm
    join meals m on m.id = pm.meal_id
    join meal_ingredients mi
      on mi.meal_id = pm.meal_id and mi.est_optionnel = false
    left join ingredients i on i.id = mi.ingredient_id
    cross join lateral (
      select
        (v_nb_personnes::real / coalesce(m.portions_par_defaut, 2)::real) *
        case when exists (
          select 1 from plan_meals pm2
          where pm2.plan_id = p_plan_id
            and pm2.repas_type = 'dejeuner'
            and pm2.est_reste_de = pm.meal_id
        ) then 2.0 else 1.0 end
      as ratio
    ) ratio
    where pm.plan_id = p_plan_id
      and pm.meal_id is not null
      and not (pm.repas_type = 'dejeuner' and pm.est_reste_de is not null)
    group by mi.ingredient_id
  )
  insert into shopping_list_items (list_id, ingredient_id, quantite_totale, unite, rayon, checked)
  select
    v_list_id,
    agg.ingredient_id,
    agg.quantite_totale,
    agg.unite,
    agg.rayon,
    agg.ingredient_id = any(v_checked_ids)
  from agregation agg;

  return v_list_id;
end;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- save_weekly_plan — sauvegarde atomique d'une semaine générée
-- (accepte les clés 'dessert' ET 'dessert_midi' dans p_days)
-- ────────────────────────────────────────────────────────────────────────────
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
      delete from shopping_lists where id = v_old_list_id;
    end if;
    delete from weekly_plans where id = v_old_plan_id;
  end if;

  -- 2. Nouveau plan
  -- NB : cuisines_diversifiees est text[] (00007) alors que le paramètre
  -- arrive en jsonb (sérialisation PostgREST des tableaux JS) → conversion
  -- explicite jsonb → text[] (aucune base n'accepte l'insertion directe).
  insert into weekly_plans (user_id, semaine_debut, is_active, fallback_utilise, cuisines_diversifiees)
  values (
    p_user_id, p_semaine_debut, true, p_fallback_utilise,
    coalesce(
      (select array_agg(x) from jsonb_array_elements_text(coalesce(p_cuisines_diversifiees, '[]'::jsonb)) x),
      '{}'
    )
  )
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

  -- 4. Historique de rotation (dédupliqué, cap 90 jours)
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

-- ────────────────────────────────────────────────────────────────────────────
-- Permissions : moteur serveur uniquement (service_role)
-- ────────────────────────────────────────────────────────────────────────────
revoke execute on function public.quantite_achat_liste(real, text, text) from public, anon, authenticated;
revoke execute on function public.recompute_shopping_list(bigint) from public, anon, authenticated;
revoke execute on function public.save_weekly_plan(uuid, date, jsonb, boolean, jsonb) from public, anon, authenticated;
grant execute on function public.quantite_achat_liste(real, text, text) to service_role;
grant execute on function public.recompute_shopping_list(bigint) to service_role;
grant execute on function public.save_weekly_plan(uuid, date, jsonb, boolean, jsonb) to service_role;
