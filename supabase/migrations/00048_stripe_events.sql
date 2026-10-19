-- Audit VULN-005 : journal des événements Stripe déjà traités (idempotence du webhook).
create table if not exists public.stripe_events (
  id text primary key,
  type text not null,
  recu_le timestamptz not null default now()
);
alter table public.stripe_events enable row level security;
revoke all on public.stripe_events from anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'purge-stripe-events') then
      perform cron.unschedule('purge-stripe-events');
    end if;
    -- Stripe ne renvoie pas un événement au-delà de 30 jours : 90 jours de journal suffisent
    perform cron.schedule('purge-stripe-events', '50 3 * * *',
      $cron$delete from public.stripe_events where recu_le < now() - interval '90 days'$cron$);
  end if;
end $$;
