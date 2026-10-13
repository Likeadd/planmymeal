-- ============================================================================
-- 00040 — Assainissement de la base (audit SQL du 13/10/2026)
--   1. security_events : la table de la migration 00023 n'existait pas en production
--   2. suppression en cascade : meals.created_by et profiles.id (le compte d'un
--      utilisateur ayant créé une recette ne pouvait pas être supprimé)
--   3. contraintes de cohérence sur les recettes (portions, temps, calories, macros)
--   4. titre unique parmi les recettes publiques
--   5. index redondants supprimés (déjà couverts par une clé primaire ou unique)
-- ============================================================================

-- 1. Journal des événements de sécurité (écrit par le serveur uniquement)
create table if not exists public.security_events (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  type        text not null,
  ip          text,
  user_id     uuid,
  route       text,
  details     jsonb not null default '{}'::jsonb
);
alter table public.security_events enable row level security;
revoke all on public.security_events from anon, authenticated;
create index if not exists security_events_created_at_idx on public.security_events (created_at desc);
create index if not exists security_events_type_ip_idx on public.security_events (type, ip);

-- Rétention : 90 jours
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'purge-security-events') then
      perform cron.unschedule('purge-security-events');
    end if;
    perform cron.schedule('purge-security-events', '15 3 * * *',
      $cron$delete from public.security_events where created_at < now() - interval '90 days'$cron$);
  end if;
end $$;

-- 2. Suppression en cascade
alter table public.meals drop constraint if exists meals_created_by_fkey;
alter table public.meals add constraint meals_created_by_fkey
  foreign key (created_by) references public.profiles(id) on delete cascade;

alter table public.profiles drop constraint if exists profiles_id_fkey;
alter table public.profiles add constraint profiles_id_fkey
  foreign key (id) references auth.users(id) on delete cascade;

-- 3. Cohérence des recettes
alter table public.meals
  add constraint meals_portions_check check (portions_par_defaut between 1 and 24),
  add constraint meals_temps_preparation_check check (temps_preparation between 0 and 1440),
  add constraint meals_temps_cuisson_check check (temps_cuisson is null or temps_cuisson between 0 and 1440),
  add constraint meals_calories_check check (calories_par_portion is null or calories_par_portion between 0 and 5000),
  add constraint meals_macros_check check (coalesce(proteines, 0) >= 0 and coalesce(glucides, 0) >= 0 and coalesce(lipides, 0) >= 0 and coalesce(fibres, 0) >= 0),
  add constraint meals_conservation_check check (conservation_jours is null or conservation_jours between 0 and 60);

-- 4. Un titre = une recette publique
create unique index if not exists uq_meals_public_titre on public.meals (lower(titre)) where is_public;

-- 5. Index redondants (le même préfixe est déjà couvert par une clé primaire ou unique)
drop index if exists public.weekly_plans_share_token_idx;                 -- doublon de weekly_plans_share_token_key
drop index if exists public.idx_household_members_household;              -- préfixe de (household_id, user_id)
drop index if exists public.idx_family_member_ingredients_member;         -- préfixe de la clé primaire
drop index if exists public.idx_family_member_meal_prefs_member;          -- préfixe de la clé primaire
drop index if exists public.idx_user_meal_preferences_user;               -- préfixe de la clé primaire
drop index if exists public.idx_fridge_items_user;                        -- préfixe de (user_id, ingredient_id, unite)
drop index if exists public.idx_budget_snapshots_user;                    -- couvert par (user_id, semaine_debut)
drop index if exists public.newsletter_subscribers_active_idx;            -- quasi doublon de la clé unique sur l'email
