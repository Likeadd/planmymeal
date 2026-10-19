-- Audit VULN-009 : après un changement d'email confirmé (auth.users), profiles.email suit — sinon les
-- emails du compte (récapitulatif, abonnement, rétractation) partaient vers l'ancienne adresse.
create or replace function public.sync_profile_email()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  update public.profiles set email = new.email
  where id = new.id and email is distinct from new.email;
  return new;
end;
$function$;
revoke all on function public.sync_profile_email() from public, anon, authenticated;

drop trigger if exists on_auth_user_email_change on auth.users;
create trigger on_auth_user_email_change
  after update of email on auth.users
  for each row execute function public.sync_profile_email();
