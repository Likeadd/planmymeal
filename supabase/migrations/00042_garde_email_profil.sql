-- Un client authentifié ne doit pas pouvoir changer profiles.email (adresse utilisée pour les
-- emails du récapitulatif) : sinon il pourrait faire écrire le service à une adresse tierce.
create or replace function public.guard_profiles_sensitive_columns()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_role text;
begin
  v_role := coalesce(current_setting('role', true), 'none');
  if v_role = 'none' then
    v_role := current_user::text;
  end if;
  if v_role in ('authenticated', 'anon') then
    if new.plan is distinct from old.plan
       or new.email is distinct from old.email
       or new.stripe_customer_id is distinct from old.stripe_customer_id
       or new.stripe_subscription_id is distinct from old.stripe_subscription_id
       or new.welcome_email_envoye_le is distinct from old.welcome_email_envoye_le
       or new.digest_envoye_le is distinct from old.digest_envoye_le then
      raise exception 'Modification des colonnes sensibles interdite (plan, email, stripe) via le client';
    end if;
  end if;
  return new;
end;
$function$;
