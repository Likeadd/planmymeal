-- Audit VULN-002 : un profil famille ne peut noter / écarter que des recettes publiques ou créées par
-- l'utilisateur (sinon GET /api/famille renvoyait le titre de recettes privées d'autres comptes).
create or replace function public.save_family_member(p_user_id uuid, p_nom text, p_membre_id bigint DEFAULT NULL::bigint, p_emoji text DEFAULT '👤'::text, p_poids smallint DEFAULT 3, p_age smallint DEFAULT NULL::smallint, p_ingredients jsonb DEFAULT '[]'::jsonb, p_preferences jsonb DEFAULT '[]'::jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_id bigint;
  v_nom text;
  v_poids smallint;
begin
  v_nom := btrim(coalesce(p_nom, ''));
  if char_length(v_nom) < 1 or char_length(v_nom) > 40 then
    raise exception 'Nom de membre invalide';
  end if;

  v_poids := least(5, greatest(1, coalesce(p_poids, 3)));

  if p_membre_id is null then
    insert into family_members (user_id, nom, emoji, poids, age, updated_at)
    values (
      p_user_id, v_nom,
      coalesce(nullif(btrim(p_emoji), ''), '👤'),
      v_poids,
      case when p_age is null then null else least(120, greatest(0, p_age)) end,
      now()
    )
    returning id into v_id;
  else
    update family_members
    set nom = v_nom,
        emoji = coalesce(nullif(btrim(p_emoji), ''), '👤'),
        poids = v_poids,
        age = case when p_age is null then null else least(120, greatest(0, p_age)) end,
        updated_at = now()
    where id = p_membre_id and user_id = p_user_id
    returning id into v_id;

    if v_id is null then
      raise exception 'Membre introuvable';
    end if;

    delete from family_member_ingredients where member_id = v_id;
    delete from family_member_meal_preferences where member_id = v_id;
  end if;

  insert into family_member_ingredients (member_id, ingredient_id, relation)
  select v_id, (e ->> 'ingredient_id')::integer, e ->> 'relation'
  from jsonb_array_elements(coalesce(p_ingredients, '[]'::jsonb)) as e
  where (e ->> 'relation') in ('aime', 'n_aime_pas', 'interdit')
    and exists (
      select 1 from ingredients i where i.id = (e ->> 'ingredient_id')::integer
    );

  insert into family_member_meal_preferences (member_id, meal_id, note, ne_plus_proposer, updated_at)
  select v_id,
         (e ->> 'meal_id')::integer,
         case
           when (e ->> 'note') is null or (e ->> 'note') = '' then null
           else least(5, greatest(1, (e ->> 'note')::smallint))
         end,
         coalesce((e ->> 'ne_plus_proposer')::boolean, false),
         now()
  from jsonb_array_elements(coalesce(p_preferences, '[]'::jsonb)) as e
  where exists (
      select 1 from meals m
      where m.id = (e ->> 'meal_id')::integer
        and (m.is_public or m.created_by = p_user_id)
    )
    and (
      e ->> 'note' is not null
      or coalesce((e ->> 'ne_plus_proposer')::boolean, false)
    );

  return v_id;
end;
$function$;

revoke all on function public.save_family_member(uuid, text, bigint, text, smallint, smallint, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.save_family_member(uuid, text, bigint, text, smallint, smallint, jsonb, jsonb) to service_role;
