-- ============================================================================
-- PLANMYMEAL — SCRIPT SQL COMPLET
-- À coller dans : Supabase → SQL Editor → New query → Run
-- (Le script est idempotent : tu peux le relancer sans casser la base)
--
-- Ce script crée :
--   1. Les extensions (pg_cron, pg_net)
--   2. Toutes les tables + index + contraintes
--   3. La sécurité RLS (chaque utilisateur ne voit que ses données)
--   4. Le déclencheur qui crée un profil à chaque inscription
--   5. La vue de score de rotation (moteur de recommandation)
--   6. Les jobs cron (régénération automatique du planning le dimanche)
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 0. EXTENSIONS
-- ────────────────────────────────────────────────────────────────────────────
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema pg_catalog;

-- ────────────────────────────────────────────────────────────────────────────
-- 1. PROFILS UTILISATEUR (étendu depuis auth.users de Supabase)
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid references auth.users(id) primary key,
  email text unique not null,
  full_name text,
  nb_personnes smallint not null default 2 check (nb_personnes between 1 and 20),

  -- Objectif nutritionnel
  objectif text not null default 'maintien'
    check (objectif in ('perte_poids', 'maintien', 'prise_masse', 'sans_regime')),
  calories_par_jour integer check (calories_par_jour between 800 and 8000),

  -- Niveau cuisine
  niveau_cuisine text not null default 'intermediaire'
    check (niveau_cuisine in ('debutant', 'intermediaire', 'expert')),

  -- Temps de cuisson max
  temps_max_semaine smallint not null default 30,
  temps_max_weekend smallint not null default 60,

  -- Cuisines préférées
  cuisines_preferees text[] default '{}',

  -- Batch cooking (ajouté par la migration 00002)
  batch_cooking boolean not null default false,
  batch_cooking_jour smallint not null default 6, -- 0=lundi..6=dimanche

  -- Stripe
  plan text not null default 'gratuit' check (plan in ('gratuit', 'pro', 'famille')),
  stripe_customer_id text,
  stripe_subscription_id text,

  -- Onboarding
  onboarding_complete boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.profiles.batch_cooking is 'Active le mode batch cooking : le jour J on cuisine pour les jours suivants';
comment on column public.profiles.batch_cooking_jour is 'Jour de la semaine dédié au batch cooking (0=lundi..6=dimanche)';

-- Garde updated_at à jour automatiquement
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ── Sécurité RLS : chaque utilisateur ne voit/édite que son propre profil ──
alter table public.profiles enable row level security;

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
  on public.profiles for select using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles for insert with check (auth.uid() = id);

-- ── Déclencheur : crée le profil automatiquement à chaque inscription ──────
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ────────────────────────────────────────────────────────────────────────────
-- 2. INGREDIENTS (référentiel public)
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists public.ingredients (
  id serial primary key,
  nom text unique not null,
  rayon text not null check (rayon in (
    'fruits_legumes', 'epicerie_salee', 'epicerie_sucree',
    'frais', 'surgeles', 'viande_poisson', 'boissons',
    'boulangerie', 'conserves', 'epices'
  )),
  saison text not null default 'toutes'
    check (saison in ('ete', 'hiver', 'printemps', 'automne', 'toutes')),
  prix_estime real,
  calories_pour_100g real,
  proteines_pour_100g real,
  glucides_pour_100g real,
  lipides_pour_100g real,
  est_allergene boolean not null default false,
  allergene_type text
);

-- ────────────────────────────────────────────────────────────────────────────
-- 3. RECETTES (meals) + ingrédients associés
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists public.meals (
  id serial primary key,
  titre text not null,
  description text,
  type_repas text not null check (type_repas in ('entree', 'plat', 'dessert', 'petit_dejeuner', 'snack')),
  temps_preparation smallint not null,
  temps_cuisson smallint,
  difficulte text not null default 'moyen' check (difficulte in ('facile', 'moyen', 'difficile')),
  saison text not null default 'toutes' check (saison in ('ete', 'hiver', 'printemps', 'automne', 'toutes')),
  cuisine text,
  calories_par_portion integer,
  proteines real,
  glucides real,
  lipides real,
  fibres real,
  conservation_jours smallint, -- ajouté par la migration 00002
  instructions text[] not null default '{}',
  image_url text,
  portions_par_defaut smallint not null default 2,
  created_by uuid references public.profiles(id),
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.meals.conservation_jours is 'Jours de conservation au frigo. NULL=inconnu, 3+=idéal batch cooking';

create table if not exists public.meal_ingredients (
  meal_id integer references public.meals(id) on delete cascade,
  ingredient_id integer references public.ingredients(id),
  quantite real not null check (quantite > 0),
  unite text not null check (unite in ('g', 'ml', 'pcs', 'cac', 'cas', 'pincee', 'sachet', 'boite', 'botte', 'tranche')),
  est_optionnel boolean not null default false,
  primary key (meal_id, ingredient_id)
);

-- Sécurité RLS : recettes publiques visibles par tous, privées par leur auteur
alter table public.meals enable row level security;

drop policy if exists "Public meals visible by all" on public.meals;
create policy "Public meals visible by all"
  on public.meals for select using (is_public = true or created_by = auth.uid());

drop policy if exists "Users can create meals" on public.meals;
create policy "Users can create meals"
  on public.meals for insert with check (auth.uid() = created_by);

-- Ingrédients : catalogue public (lecture pour tous, écriture réservée au seed/admin)
alter table public.ingredients enable row level security;
drop policy if exists "Ingredients visible by all" on public.ingredients;
create policy "Ingredients visible by all"
  on public.ingredients for select using (true);

alter table public.meal_ingredients enable row level security;
drop policy if exists "Meal ingredients visible by all" on public.meal_ingredients;
create policy "Meal ingredients visible by all"
  on public.meal_ingredients for select using (true);

-- ────────────────────────────────────────────────────────────────────────────
-- 4. ALLERGIES & PRÉFÉRENCES
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists public.user_allergies (
  user_id uuid references public.profiles(id) on delete cascade,
  ingredient_id integer references public.ingredients(id),
  primary key (user_id, ingredient_id)
);

create table if not exists public.user_dislikes (
  user_id uuid references public.profiles(id) on delete cascade,
  ingredient_id integer references public.ingredients(id),
  primary key (user_id, ingredient_id)
);

create table if not exists public.user_diets (
  user_id uuid references public.profiles(id) on delete cascade,
  regime text not null check (regime in (
    'vegan', 'vegetarien', 'pesco_vegetarien',
    'keto', 'sans_gluten', 'sans_lactose',
    'halal', 'cacher', 'sans_porc', 'sans_alcool'
  )),
  primary key (user_id, regime)
);

alter table public.user_allergies enable row level security;
drop policy if exists "Users manage own allergies" on public.user_allergies;
create policy "Users manage own allergies"
  on public.user_allergies for all using (auth.uid() = user_id);

alter table public.user_dislikes enable row level security;
drop policy if exists "Users manage own dislikes" on public.user_dislikes;
create policy "Users manage own dislikes"
  on public.user_dislikes for all using (auth.uid() = user_id);

alter table public.user_diets enable row level security;
drop policy if exists "Users manage own diets" on public.user_diets;
create policy "Users manage own diets"
  on public.user_diets for all using (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────────────────────
-- 5. LA MÉMOIRE DE ROTATION ⭐ (historique des plats)
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists public.meal_history (
  id serial primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  meal_id integer references public.meals(id),
  planned_date date not null,
  status text not null default 'planned'
    check (status in ('planned', 'cooked', 'skipped', 'liked', 'disliked')),
  rating smallint check (rating between 1 and 5),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_meal_history_user_date on meal_history(user_id, planned_date desc);
create index if not exists idx_meal_history_meal on meal_history(user_id, meal_id, planned_date desc);

alter table public.meal_history enable row level security;
drop policy if exists "Users manage own meal history" on public.meal_history;
create policy "Users manage own meal history"
  on public.meal_history for all using (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────────────────────
-- 6. PLANS HEBDOMADAIRES
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists public.weekly_plans (
  id serial primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  semaine_debut date not null,
  generated_at timestamptz not null default now(),
  is_active boolean not null default true,
  unique (user_id, semaine_debut)
);

create table if not exists public.plan_meals (
  plan_id integer references public.weekly_plans(id) on delete cascade,
  jour_semaine smallint not null check (jour_semaine between 0 and 6),
  repas_type text not null check (repas_type in ('dejeuner', 'diner', 'dessert', 'dessert_midi')),
  meal_id integer references public.meals(id),
  primary key (plan_id, jour_semaine, repas_type)
);

alter table public.weekly_plans enable row level security;
drop policy if exists "Users manage own plans" on public.weekly_plans;
create policy "Users manage own plans"
  on public.weekly_plans for all using (auth.uid() = user_id);

-- plan_meals : accès via le plan parent (le client fait select/insert/update)
alter table public.plan_meals enable row level security;
drop policy if exists "Plan meals visible by owner" on public.plan_meals;
create policy "Plan meals visible by owner"
  on public.plan_meals for select using (
    plan_id in (select id from public.weekly_plans where user_id = auth.uid())
  );

drop policy if exists "Plan meals insert by owner" on public.plan_meals;
create policy "Plan meals insert by owner"
  on public.plan_meals for insert with check (
    plan_id in (select id from public.weekly_plans where user_id = auth.uid())
  );

drop policy if exists "Plan meals update by owner" on public.plan_meals;
create policy "Plan meals update by owner"
  on public.plan_meals for update using (
    plan_id in (select id from public.weekly_plans where user_id = auth.uid())
  );

-- ────────────────────────────────────────────────────────────────────────────
-- 7. LISTES DE COURSES
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists public.shopping_lists (
  id serial primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  plan_id integer references public.weekly_plans(id) on delete set null,
  generated_at timestamptz not null default now(),
  is_active boolean not null default true
);

create table if not exists public.shopping_list_items (
  list_id integer references public.shopping_lists(id) on delete cascade,
  ingredient_id integer references public.ingredients(id),
  quantite_totale real not null,
  unite text not null,
  rayon text not null,
  checked boolean not null default false,
  primary key (list_id, ingredient_id)
);

alter table public.shopping_lists enable row level security;
drop policy if exists "Users manage own shopping lists" on public.shopping_lists;
create policy "Users manage own shopping lists"
  on public.shopping_lists for all using (auth.uid() = user_id);

-- shopping_list_items : accès via la liste parente (select + cocher)
alter table public.shopping_list_items enable row level security;
drop policy if exists "Shopping list items visible by owner" on public.shopping_list_items;
create policy "Shopping list items visible by owner"
  on public.shopping_list_items for select using (
    list_id in (select id from public.shopping_lists where user_id = auth.uid())
  );

drop policy if exists "Shopping list items update by owner" on public.shopping_list_items;
create policy "Shopping list items update by owner"
  on public.shopping_list_items for update using (
    list_id in (select id from public.shopping_lists where user_id = auth.uid())
  );

-- ────────────────────────────────────────────────────────────────────────────
-- 8. VUE : SCORE DE ROTATION (avec conservation pour le batch cooking)
-- ────────────────────────────────────────────────────────────────────────────
drop view if exists meal_rotation_score;
create or replace view meal_rotation_score as
select
  m.id as meal_id,
  m.titre,
  m.calories_par_portion,
  m.temps_preparation,
  m.saison as meal_saison,
  m.cuisine,
  m.conservation_jours,
  mh.user_id,
  max(mh.planned_date) as derniere_planification,
  count(mh.id) filter (where mh.status = 'liked') as nb_likes,
  count(mh.id) filter (where mh.status = 'disliked') as nb_dislikes,
  count(mh.id) as nb_total_apparitions,
  (current_date - max(mh.planned_date)) as jours_depuis_derniere
from meals m
left join meal_history mh on m.id = mh.meal_id
where m.is_public = true
group by m.id, mh.user_id;

-- ────────────────────────────────────────────────────────────────────────────
-- 9. CRON : RÉGÉNÉRATION AUTOMATIQUE DU PLANNING (chaque dimanche)
-- ────────────────────────────────────────────────────────────────────────────
-- ⚠️ L'auto-génération N'EST PLUS un cron Supabase : elle est assurée par la
-- route Next.js /api/cron/auto-generate-week (planifiée dans vercel.json,
-- dimanche 19h UTC), qui délègue au vrai moteur de rotation du dépôt
-- (src/lib/rotation-engine.ts) via la RPC transactionnelle save_weekly_plan.
-- L'ancien job 'auto-generate-week-sunday' appelait une Edge Function fork
-- périmée : il est supprimé ci-dessous (cron.unschedule(), comme en migration
-- 00020 — pg_cron refuse l'UPDATE direct de cron.job). Ne le re-programmez pas.
-- (Les anciens fallbacks projet_ref/secret en dur ont été retirés de ce
-- fichier : un secret ne se versionne jamais.)

do $$
begin
  if exists (select 1 from cron.job where jobname = 'auto-generate-week-sunday') then
    perform cron.unschedule('auto-generate-week-sunday');
  end if;
  if exists (select 1 from cron.job where jobname = 'deactivate-old-plans') then
    perform cron.unschedule('deactivate-old-plans');
  end if;
end $$;

-- Opt-out de l'auto-génération (lu par /api/cron/auto-generate-week)
alter table public.profiles
  add column if not exists auto_generate boolean not null default true;
comment on column public.profiles.auto_generate is
  'Auto-génération hebdomadaire du planning par le cron (opt-out utilisateur)';

-- Désactive les plans de la semaine passée (18h30 UTC, avant la génération)
select cron.schedule(
  'deactivate-old-plans',
  '30 18 * * 0', -- dimanche 18h30 UTC
  $$
  update public.weekly_plans
  set is_active = false
  where semaine_debut < date_trunc('week', now())::date;
  $$
);


-- ────────────────────────────────────────────────────────────────────────────
-- ✅ FIN — Vérifications rapides (à exécuter séparément si besoin)
-- ────────────────────────────────────────────────────────────────────────────
-- select table_name from information_schema.tables where table_schema = 'public';
-- select * from cron.job;
