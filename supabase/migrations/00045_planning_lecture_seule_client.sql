-- Les plannings, repas planifiés et listes de courses ne s'écrivent QUE via l'API Next.js
-- (clé de service, qui applique les limites du plan gratuit). Un compte ne doit pas pouvoir les
-- modifier directement avec son jeton (contournement des limites de remplacements/optimisations).
-- Rollback : recréer les policies « ALL / insert / update / delete by owner » supprimées ici.
drop policy if exists "Plan meals insert by owner" on public.plan_meals;
drop policy if exists "Plan meals update by owner" on public.plan_meals;
drop policy if exists "Plan meals delete by owner" on public.plan_meals;
drop policy if exists "Shopping list items update by owner" on public.shopping_list_items;
drop policy if exists "Shopping list items delete by owner" on public.shopping_list_items;

drop policy if exists "Users manage own plans" on public.weekly_plans;
create policy "Users read own plans" on public.weekly_plans
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Users manage own shopping lists" on public.shopping_lists;
create policy "Users read own shopping lists" on public.shopping_lists
  for select to authenticated using ((select auth.uid()) = user_id);
