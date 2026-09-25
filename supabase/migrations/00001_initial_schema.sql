-- ============================================================================
-- MIGRATION 00001 : Schéma initial — PlanMyMeal
-- Cœur du produit : rotation mémorisée, onboarding, liste de courses auto
-- ============================================================================

-- 1. PROFILS UTILISATEUR (étendu depuis auth.users de Supabase)
create table public.profiles (
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

  -- Stripe
  plan text not null default 'gratuit' check (plan in ('gratuit', 'pro', 'famille')),
  stripe_customer_id text,
  stripe_subscription_id text,

  -- Onboarding
  onboarding_complete boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
create policy "Users can view own profile" on profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on profiles for insert with check (auth.uid() = id);

create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2. INGREDIENTS
create table public.ingredients (
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

-- 3. RECETTES
create table public.meals (
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
  instructions text[] not null default '{}',
  image_url text,
  portions_par_defaut smallint not null default 2,
  created_by uuid references public.profiles(id),
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.meal_ingredients (
  meal_id integer references public.meals(id) on delete cascade,
  ingredient_id integer references public.ingredients(id),
  quantite real not null check (quantite > 0),
  unite text not null check (unite in ('g', 'ml', 'pcs', 'cac', 'cas', 'pincee', 'sachet', 'boite', 'botte', 'tranche')),
  est_optionnel boolean not null default false,
  primary key (meal_id, ingredient_id)
);

alter table public.meals enable row level security;
create policy "Public meals visible by all" on meals for select using (is_public = true or created_by = auth.uid());
create policy "Users can create meals" on meals for insert with check (auth.uid() = created_by);

-- Ingrédients : catalogue public (lecture pour tous, écriture réservée au seed/admin)
alter table public.ingredients enable row level security;
create policy "Ingredients visible by all" on ingredients for select using (true);

alter table public.meal_ingredients enable row level security;
create policy "Meal ingredients visible by all" on meal_ingredients for select using (true);

-- 4. ALLERGIES & PREFERENCES
create table public.user_allergies (
  user_id uuid references public.profiles(id) on delete cascade,
  ingredient_id integer references public.ingredients(id),
  primary key (user_id, ingredient_id)
);

create table public.user_dislikes (
  user_id uuid references public.profiles(id) on delete cascade,
  ingredient_id integer references public.ingredients(id),
  primary key (user_id, ingredient_id)
);

create table public.user_diets (
  user_id uuid references public.profiles(id) on delete cascade,
  regime text not null check (regime in (
    'vegan', 'vegetarien', 'pesco_vegetarien',
    'keto', 'sans_gluten', 'sans_lactose',
    'halal', 'cacher', 'sans_porc', 'sans_alcool'
  )),
  primary key (user_id, regime)
);

alter table public.user_allergies enable row level security;
create policy "Users manage own allergies" on user_allergies for all using (auth.uid() = user_id);
alter table public.user_dislikes enable row level security;
create policy "Users manage own dislikes" on user_dislikes for all using (auth.uid() = user_id);
alter table public.user_diets enable row level security;
create policy "Users manage own diets" on user_diets for all using (auth.uid() = user_id);

-- 5. LA MEMOIRE DE ROTATION ⭐
create table public.meal_history (
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

create index idx_meal_history_user_date on meal_history(user_id, planned_date desc);
create index idx_meal_history_meal on meal_history(user_id, meal_id, planned_date desc);

alter table public.meal_history enable row level security;
create policy "Users manage own meal history" on meal_history for all using (auth.uid() = user_id);

-- 6. PLANS HEBDOMADAIRES
create table public.weekly_plans (
  id serial primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  semaine_debut date not null,
  generated_at timestamptz not null default now(),
  is_active boolean not null default true,
  unique (user_id, semaine_debut)
);

create table public.plan_meals (
  plan_id integer references public.weekly_plans(id) on delete cascade,
  jour_semaine smallint not null check (jour_semaine between 0 and 6),
  repas_type text not null check (repas_type in ('dejeuner', 'diner')),
  meal_id integer references public.meals(id),
  primary key (plan_id, jour_semaine, repas_type)
);

alter table public.weekly_plans enable row level security;
create policy "Users manage own plans" on weekly_plans for all using (auth.uid() = user_id);

-- plan_meals : accès via le plan parent (le client fait select/insert/update)
alter table public.plan_meals enable row level security;
create policy "Plan meals visible by owner" on plan_meals for select using (
  plan_id in (select id from weekly_plans where user_id = auth.uid())
);
create policy "Plan meals insert by owner" on plan_meals for insert with check (
  plan_id in (select id from weekly_plans where user_id = auth.uid())
);
create policy "Plan meals update by owner" on plan_meals for update using (
  plan_id in (select id from weekly_plans where user_id = auth.uid())
);

-- 7. LISTE DE COURSES
create table public.shopping_lists (
  id serial primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  plan_id integer references public.weekly_plans(id) on delete set null,
  generated_at timestamptz not null default now(),
  is_active boolean not null default true
);

create table public.shopping_list_items (
  list_id integer references public.shopping_lists(id) on delete cascade,
  ingredient_id integer references public.ingredients(id),
  quantite_totale real not null,
  unite text not null,
  rayon text not null,
  checked boolean not null default false,
  primary key (list_id, ingredient_id)
);

alter table public.shopping_lists enable row level security;

-- shopping_list_items : accès via la liste parente (select + cocher)
alter table public.shopping_list_items enable row level security;
create policy "Shopping list items visible by owner" on shopping_list_items for select using (
  list_id in (select id from shopping_lists where user_id = auth.uid())
);
create policy "Shopping list items update by owner" on shopping_list_items for update using (
  list_id in (select id from shopping_lists where user_id = auth.uid())
);
create policy "Users manage own shopping lists" on shopping_lists for all using (auth.uid() = user_id);

-- 8. VUE : score de rotation
create or replace view meal_rotation_score as
select
  m.id as meal_id,
  m.titre,
  m.calories_par_portion,
  m.temps_preparation,
  m.saison as meal_saison,
  m.cuisine,
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