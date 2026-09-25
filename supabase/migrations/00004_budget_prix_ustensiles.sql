-- ============================================================================
-- MIGRATION 00004 : Prix, budget hebdomadaire & ustensiles — PlanMyMeal
-- 1. Prix unitaires des ingrédients (base du calcul des économies)
-- 2. Ustensiles par recette (fouet, poêle, four, air fryer...)
-- 3. Budget hebdomadaire défini par l'utilisateur
-- 4. Prix personnalisés par utilisateur (l'utilisateur peut corriger un prix)
-- 5. Historique hebdomadaire budget / dépenses / économies
-- ============================================================================

-- 1. PRIX DES INGRÉDIENTS ────────────────────────────────────────────────────
-- prix_unitaire : prix en euros pour l'unité de référence unite_prix
-- unite_prix   : 'kg', 'L', 'pcs', 'botte', 'boite', 'sachet'
alter table public.ingredients
  add column if not exists prix_unitaire real;

alter table public.ingredients
  add column if not exists unite_prix text;

-- 2. USTENSILES PAR RECETTE ──────────────────────────────────────────────────
alter table public.meals
  add column if not exists ustensiles text[] not null default '{}';

-- 3. BUDGET HEBDOMADAIRE UTILISATEUR ────────────────────────────────────────
alter table public.profiles
  add column if not exists budget_hebdo real;

-- 4. PRIX PERSONNALISÉS PAR UTILISATEUR ─────────────────────────────────────
-- L'utilisateur peut ajuster le prix d'un ingrédient (ex : le prix de son
-- boucher). Ces surcharges remplacent le prix par défaut dans tous les calculs.
create table if not exists public.user_prix_ingredients (
  user_id uuid references public.profiles(id) on delete cascade,
  ingredient_id integer references public.ingredients(id) on delete cascade,
  prix_unitaire real not null check (prix_unitaire >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, ingredient_id)
);

alter table public.user_prix_ingredients enable row level security;
create policy "Users manage own ingredient prices" on user_prix_ingredients
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 5. HISTORIQUE HEBDOMADAIRE BUDGET / DÉPENSES / ÉCONOMIES ──────────────────
-- Un snapshot par semaine : ce que le plan devait coûter vs le budget défini.
create table if not exists public.weekly_budget_snapshots (
  id serial primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  semaine_debut date not null,
  budget real not null default 0,
  depense real not null default 0,
  economie real not null default 0,
  nb_personnes smallint not null default 2,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, semaine_debut)
);

create index if not exists idx_budget_snapshots_user
  on weekly_budget_snapshots(user_id, semaine_debut desc);

alter table public.weekly_budget_snapshots enable row level security;
create policy "Users manage own budget snapshots" on weekly_budget_snapshots
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
