-- Mesure d'audience INTERNE (alternative à Google Analytics / Amplitude, affichée dans /admin).
-- Anonyme et sans cookie : aucune adresse IP n'est stockée ; `visiteur` est un hash journalier non
-- réversible (le même navigateur a un identifiant différent chaque jour) ; pays au niveau du pays
-- seulement. Écrite et lue uniquement avec la clé de service. Conservation : 25 mois.
create table if not exists public.mesure_evenements (
  id bigint generated always as identity primary key,
  cree_le timestamptz not null default now(),
  jour date not null default ((now() at time zone 'Europe/Paris')::date),
  visiteur text not null,
  type text not null check (type in ('page', 'evenement')),
  chemin text,
  nom text,
  source text,
  pays text,
  appareil text,
  navigateur text,
  systeme text,
  props jsonb
);
alter table public.mesure_evenements enable row level security;
revoke all on public.mesure_evenements from anon, authenticated;
create index if not exists idx_mesure_jour_type on public.mesure_evenements (jour, type);
create index if not exists idx_mesure_cree_le on public.mesure_evenements (cree_le);

-- Synthèse pour /admin : une seule requête, agrégats uniquement.
create or replace function public.mesure_resume(p_jours integer default 30)
 returns jsonb
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  with b as (
    select * from public.mesure_evenements
    where jour >= (now() at time zone 'Europe/Paris')::date - (greatest(1, least(p_jours, 365)) - 1)
  ),
  pages as (select * from b where type = 'page'),
  entrees as (select distinct on (jour, visiteur) * from pages order by jour, visiteur, cree_le),
  visites as (select jour, visiteur, count(*) nb from pages group by jour, visiteur)
  select jsonb_build_object(
    'visiteurs', (select count(*) from visites),
    'pages_vues', (select count(*) from pages),
    'rebond', (select coalesce(round(100.0 * count(*) filter (where nb = 1) / nullif(count(*), 0)), 0) from visites),
    'pages_par_visite', (select coalesce(round(avg(nb), 1), 0) from visites),
    'temps_reel', (select count(distinct visiteur) from public.mesure_evenements where type = 'page' and cree_le > now() - interval '30 minutes'),
    'serie', (select coalesce(jsonb_agg(to_jsonb(x) order by x.jour), '[]'::jsonb)
              from (select jour, count(*) pages_vues, count(distinct visiteur) visiteurs from pages group by jour) x),
    'pages', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
              from (select chemin, count(*) vues, count(distinct (jour, visiteur)) visiteurs from pages group by chemin order by 2 desc limit 20) x),
    'sources', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
                from (select coalesce(source, 'direct') nom, count(*) visiteurs from entrees group by 1 order by 2 desc limit 15) x),
    'pays', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
             from (select coalesce(pays, '??') nom, count(*) visiteurs from entrees group by 1 order by 2 desc limit 15) x),
    'appareils', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
                  from (select coalesce(appareil, '?') nom, count(*) visiteurs from entrees group by 1 order by 2 desc) x),
    'navigateurs', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
                    from (select coalesce(navigateur, '?') nom, count(*) visiteurs from entrees group by 1 order by 2 desc limit 8) x),
    'systemes', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
                 from (select coalesce(systeme, '?') nom, count(*) visiteurs from entrees group by 1 order by 2 desc limit 8) x),
    'evenements', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
                   from (select nom, count(*) total, count(distinct (jour, visiteur)) visiteurs
                         from b where type = 'evenement' group by nom order by 2 desc limit 40) x),
    'visiteurs_inscription', (select count(distinct (jour, visiteur)) from pages where chemin = '/signup')
  );
$function$;
revoke all on function public.mesure_resume(integer) from public, anon, authenticated;
grant execute on function public.mesure_resume(integer) to service_role;

-- Purge : 25 mois au plus
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'purge-mesure-evenements') then
      perform cron.unschedule('purge-mesure-evenements');
    end if;
    perform cron.schedule('purge-mesure-evenements', '45 3 * * *',
      $cron$delete from public.mesure_evenements where cree_le < now() - interval '25 months'$cron$);
  end if;
end $$;
