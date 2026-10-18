-- Anti brute-force des codes d'invitation de foyer : household_join(p_code) était appelable
-- directement par tout compte connecté via /rest/v1/rpc, sans aucune limite de débit (codes de
-- 8 caractères = 16^8 combinaisons). household_join_as() reprend la même logique mais n'est
-- exécutable que par la clé de service : seule l'API Next.js (avec limite de débit) peut l'appeler.
create or replace function public.household_join_as(p_user uuid, p_code text)
 returns bigint
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_user uuid := p_user;
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_inv public.household_invitations;
  v_existing bigint;
  v_role text;
  v_created_by uuid;
  v_nb_membres bigint;
begin
  if v_user is null then
    raise exception 'Utilisateur non authentifié';
  end if;
  if v_code !~ '^[A-Z0-9]{4}-[A-Z0-9]{4}$' then
    raise exception 'Code invalide (format attendu : XXXX-XXXX)';
  end if;

  select * into v_inv from public.household_invitations where code = v_code limit 1;
  if v_inv is null then
    raise exception 'Code inconnu';
  end if;
  if v_inv.revoked_at is not null then
    raise exception 'Code révoqué';
  end if;
  if v_inv.used_by is not null then
    raise exception 'Code déjà utilisé';
  end if;
  if v_inv.expires_at < now() then
    raise exception 'Code expiré';
  end if;
  if v_inv.created_by = v_user then
    raise exception 'Vous ne pouvez pas rejoindre votre propre foyer';
  end if;

  update public.household_invitations
  set used_by = v_user, used_at = now()
  where id = v_inv.id and used_by is null;
  if not found then
    raise exception 'Code déjà utilisé';
  end if;

  select hm.household_id, hm.role into v_existing, v_role
  from public.household_members hm where hm.user_id = v_user limit 1;
  if v_existing is not null then
    if v_role = 'owner' then
      select h.created_by, count(hm2.id) into v_created_by, v_nb_membres
      from public.households h
      left join public.household_members hm2 on hm2.household_id = h.id
      where h.id = v_existing
      group by h.created_by;
      if v_created_by = v_user and v_nb_membres = 1 then
        delete from public.households where id = v_existing;
      else
        raise exception 'Vous appartenez déjà à un foyer (quittez-le d''abord)';
      end if;
    else
      raise exception 'Vous appartenez déjà à un foyer (quittez-le d''abord)';
    end if;
  end if;

  insert into public.household_members (household_id, user_id, role)
  values (v_inv.household_id, v_user, 'membre');

  return v_inv.household_id;
end;
$function$;

revoke all on function public.household_join_as(uuid, text) from public, anon, authenticated;
grant execute on function public.household_join_as(uuid, text) to service_role;
