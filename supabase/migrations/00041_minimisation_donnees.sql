-- Minimisation RGPD : plus de source d'acquisition rattachée aux comptes ; purge des
-- inscriptions newsletter jamais confirmées (double opt-in non finalisé) et des
-- comptes gratuits sans connexion depuis 24 mois est faite par cron Vercel (cf. api/cron/purge-inactifs).
alter table public.profiles drop column if exists acquisition_source;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'purge-newsletter-non-confirmee') then
      perform cron.unschedule('purge-newsletter-non-confirmee');
    end if;
    perform cron.schedule('purge-newsletter-non-confirmee', '30 3 * * *',
      $cron$delete from public.newsletter_subscribers where confirmed_at is null and created_at < now() - interval '7 days'$cron$);
  end if;
end $$;
