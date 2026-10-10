-- ============================================================================
-- 00037 — Durcissement issu de l'audit pré-production
--   1. search_path fixe sur les 3 fonctions qui n'en avaient pas
--   2. EXECUTE retiré aux rôles qui n'en ont pas l'usage (fonctions de trigger
--      et RPC foyer : jamais appelables sans connexion)
--   3. Politiques RLS : auth.uid() enveloppé dans (select …) → évalué une seule
--      fois par requête et non par ligne
--   4. Politique UPDATE en doublon sur profiles retirée
--   5. Index sur 4 clés étrangères
-- ============================================================================

-- 1. search_path fixe
alter function public.set_updated_at() set search_path = public;
alter function public.handle_new_user() set search_path = public;
alter function public.sync_desserts_activees() set search_path = public;

-- 2. EXECUTE
-- Fonctions de trigger : le droit d'exécution n'est vérifié qu'à la création du trigger.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.guard_profiles_sensitive_columns() from public, anon, authenticated;
revoke execute on function public.ensure_personal_household_on_signup() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
grant execute on function public.handle_new_user() to supabase_auth_admin, service_role;

-- RPC foyer : réservées aux utilisateurs connectés (elles lèvent déjà une erreur si auth.uid() est nul)
revoke execute on function public.ensure_household(text) from public, anon;
revoke execute on function public.household_annuler_invitation(bigint) from public, anon;
revoke execute on function public.household_invite(integer) from public, anon;
revoke execute on function public.household_join(text) from public, anon;
revoke execute on function public.household_leave() from public, anon;
revoke execute on function public.household_list_members() from public, anon;
revoke execute on function public.household_remove_member(uuid) from public, anon;
grant execute on function public.ensure_household(text) to authenticated, service_role;
grant execute on function public.household_annuler_invitation(bigint) to authenticated, service_role;
grant execute on function public.household_invite(integer) to authenticated, service_role;
grant execute on function public.household_join(text) to authenticated, service_role;
grant execute on function public.household_leave() to authenticated, service_role;
grant execute on function public.household_list_members() to authenticated, service_role;
grant execute on function public.household_remove_member(uuid) to authenticated, service_role;

-- 4. Doublon : « Users update own profile (scoped) » couvre déjà le cas (USING + WITH CHECK)
drop policy if exists "Users can update own profile" on public.profiles;

-- 3. auth.uid() → (select auth.uid()) dans toutes les politiques du schéma public
do $$
declare
  p record;
  q text;
  w text;
  sql text;
begin
  for p in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (coalesce(qual, '') like '%auth.uid()%' or coalesce(with_check, '') like '%auth.uid()%')
  loop
    -- on protège les occurrences déjà enveloppées avant de traiter les autres
    q := replace(coalesce(p.qual, ''), '( SELECT auth.uid() AS uid)', '@@DEJA@@');
    q := replace(q, 'auth.uid()', '(select auth.uid())');
    q := replace(q, '@@DEJA@@', '( SELECT auth.uid() AS uid)');
    w := replace(coalesce(p.with_check, ''), '( SELECT auth.uid() AS uid)', '@@DEJA@@');
    w := replace(w, 'auth.uid()', '(select auth.uid())');
    w := replace(w, '@@DEJA@@', '( SELECT auth.uid() AS uid)');

    sql := format('alter policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
    if p.qual is not null then sql := sql || format(' using (%s)', q); end if;
    if p.with_check is not null then sql := sql || format(' with check (%s)', w); end if;
    execute sql;
  end loop;
end $$;

-- 5. Index sur clés étrangères
create index if not exists idx_household_invitations_created_by on public.household_invitations (created_by);
create index if not exists idx_household_invitations_used_by on public.household_invitations (used_by);
create index if not exists idx_households_created_by on public.households (created_by);
create index if not exists idx_plan_meals_est_reste_de on public.plan_meals (est_reste_de);
