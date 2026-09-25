-- ============================================================================
-- MIGRATION 00023 : RLS PARTOUT, TABLES PRIVÉES PAR DÉFAUT, JOURNAL SÉCURITÉ
--
--   [R1] RLS forcé sur TOUTES les tables du schéma public (existantes).
--   [R2] Aucune table publique par défaut : les futures tables ne sont plus
--        accessibles à anon, et le RLS s'active automatiquement à leur
--        création (event trigger). Une table sans policy = inaccessible.
--   [R3] Table security_events : journal des attaques (rate-limit, honeypot,
--        secrets cron invalides…). Écrite uniquement par le serveur
--        (service_role) — aucune policy : invisible pour les clients.
--
-- Le catalogue (meals publics, ingredients, meal_ingredients) reste lisible
-- volontairement (SEO, fiches recettes) via ses policies SELECT explicites.
--
-- 100 % idempotent : relançable sans risque.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- [R1] RLS sur toutes les tables existantes
-- ────────────────────────────────────────────────────────────────────────────
do $$
declare
  t record;
begin
  for t in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
  loop
    execute format('alter table public.%I enable row level security', t.relname);
  end loop;
end;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- [R2] Tables privées par défaut
-- ────────────────────────────────────────────────────────────────────────────

-- Les tables créées à l'avenir par postgres ne donnent plus aucun droit à anon.
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke all on functions from anon, public;

-- RLS activé automatiquement sur toute nouvelle table du schéma public.
create or replace function public.rls_auto_enable()
returns event_trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  cmd record;
begin
  for cmd in
    select * from pg_event_trigger_ddl_commands()
    where command_tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      and object_type in ('table', 'partitioned table')
      and schema_name = 'public'
  loop
    execute format('alter table %s enable row level security', cmd.object_identity);
  end loop;
end;
$$;

revoke all on function public.rls_auto_enable() from public, anon, authenticated;

drop event trigger if exists ensure_rls;
create event trigger ensure_rls
  on ddl_command_end
  when tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
  execute function public.rls_auto_enable();

-- ────────────────────────────────────────────────────────────────────────────
-- [R3] Journal des événements de sécurité
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists public.security_events (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  type        text not null,          -- rate_limit, honeypot, cron_secret, auth_callback…
  ip          text,
  user_id     uuid,
  route       text,
  details     jsonb not null default '{}'::jsonb
);

alter table public.security_events enable row level security;
-- Aucune policy : lecture/écriture réservées au service_role (hors RLS).
revoke all on public.security_events from anon, authenticated;

create index if not exists security_events_created_at_idx on public.security_events (created_at desc);
create index if not exists security_events_type_ip_idx on public.security_events (type, ip);
