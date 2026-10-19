-- Audit VULN-017 : codes d'invitation de foyer sur 12 caractères (XXXX-XXXX-XXXX, 2^48 combinaisons)
-- au lieu de 8 (2^32). Les codes à 8 caractères déjà émis restent acceptés jusqu'à leur expiration.
alter table public.household_invitations drop constraint if exists household_invitations_code_format;
alter table public.household_invitations add constraint household_invitations_code_format
  check (code ~ '^[A-Z0-9]{4}-[A-Z0-9]{4}(-[A-Z0-9]{4})?$');

create or replace function public.household_invite(p_days integer DEFAULT 7)
 returns text
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_user uuid := auth.uid();
  v_household bigint;
  v_role text;
  v_uuid text;
  v_code text;
  v_attempt int := 0;
begin
  if v_user is null then
    raise exception 'Utilisateur non authentifié';
  end if;

  select hm.household_id, hm.role into v_household, v_role
  from public.household_members hm
  where hm.user_id = v_user
  limit 1;
  if v_household is null then
    raise exception 'Aucun foyer pour ce compte';
  end if;
  if v_role <> 'owner' then
    raise exception 'Seul le créateur du foyer peut inviter';
  end if;
  if p_days is null or p_days < 1 or p_days > 30 then
    raise exception 'Durée de validité entre 1 et 30 jours';
  end if;

  update public.household_invitations
  set revoked_at = now()
  where household_id = v_household and revoked_at is null and used_by is null;

  loop
    v_attempt := v_attempt + 1;
    if v_attempt > 5 then
      raise exception 'Génération du code impossible (collision répétée)';
    end if;
    v_uuid := replace(gen_random_uuid()::text, '-', '');
    v_code := '';
    -- 12 quartets aléatoires (le 13e caractère d'un UUID v4 est fixe : on prend 1-12)
    for i in 1..12 loop
      v_code := v_code || substr('ABCDEFHJKMNPQRVT', ('x' || substr(v_uuid, i, 1))::bit(4)::int + 1, 1);
    end loop;
    v_code := substring(v_code, 1, 4) || '-' || substring(v_code, 5, 4) || '-' || substring(v_code, 9, 4);
    begin
      insert into public.household_invitations (household_id, code, created_by, expires_at)
      values (v_household, v_code, v_user, now() + make_interval(days => p_days));
      return v_code;
    exception when unique_violation then
      null;
    end;
  end loop;
end;
$function$;

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
  if v_code !~ '^[A-Z0-9]{4}-[A-Z0-9]{4}(-[A-Z0-9]{4})?$' then
    raise exception 'Code invalide (format attendu : XXXX-XXXX-XXXX)';
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
