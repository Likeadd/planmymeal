-- ============================================================================
-- 00025 — Index de performance
--
-- Audit : aucune clé étrangère n'était indexée côté « enfant » hors user_id.
-- Postgres n'indexe PAS automatiquement une FK : chaque recherche par
-- ingredient_id / meal_id (frigo, allergies, dégoûts, liste de courses) et
-- chaque suppression en cascade parcourait la table entière — dont
-- meal_ingredients (16 000 lignes).
--
-- 100 % additif et idempotent : aucune donnée modifiée, relançable sans risque.
-- ============================================================================

-- Recettes ↔ ingrédients : filtres allergies/dégoûts/frigo, fusion d'ingrédients
create index if not exists idx_meal_ingredients_ingredient on public.meal_ingredients(ingredient_id);

-- Catalogue public paginé trié par titre (/recettes) : tri servi par l'index
create index if not exists idx_meals_public_titre on public.meals(titre, id) where is_public;
-- Pool du moteur (plats + desserts publics, paginé par id)
create index if not exists idx_meals_public_type on public.meals(type_repas, id) where is_public;
-- « Mes recettes » (recettes privées d'un utilisateur)
create index if not exists idx_meals_created_by on public.meals(created_by) where created_by is not null;

-- Planning
create index if not exists idx_plan_meals_meal on public.plan_meals(meal_id);
create index if not exists idx_meal_history_meal_id on public.meal_history(meal_id);

-- Listes de courses
create index if not exists idx_shopping_lists_user on public.shopping_lists(user_id);
create index if not exists idx_shopping_lists_plan on public.shopping_lists(plan_id);
create index if not exists idx_shopping_list_items_ingredient on public.shopping_list_items(ingredient_id);

-- Préférences et contraintes (FK → ingredients / meals)
create index if not exists idx_user_allergies_ingredient on public.user_allergies(ingredient_id);
create index if not exists idx_user_dislikes_ingredient on public.user_dislikes(ingredient_id);
create index if not exists idx_user_prix_ingredients_ingredient on public.user_prix_ingredients(ingredient_id);
create index if not exists idx_fridge_items_ingredient on public.fridge_items(ingredient_id);
create index if not exists idx_family_member_ingredients_ingredient on public.family_member_ingredients(ingredient_id);
create index if not exists idx_family_member_meal_prefs_meal on public.family_member_meal_preferences(meal_id);
create index if not exists idx_user_meal_preferences_meal on public.user_meal_preferences(meal_id);

-- Webhook Stripe : retrouve le profil par customer id
create index if not exists idx_profiles_stripe_customer on public.profiles(stripe_customer_id)
  where stripe_customer_id is not null;

-- Statistiques à jour pour le planificateur
analyze public.meals, public.meal_ingredients, public.plan_meals, public.meal_history,
        public.shopping_lists, public.shopping_list_items, public.ingredients, public.profiles;
