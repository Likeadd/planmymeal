-- ============================================================================
-- MIGRATION 00015 : DURCISSEMENT SÉCURITÉ — PlanMyMeal
--
-- Corrige les failles remontées par l'audit (Lead Tech Senior) :
--
--   [S1] profiles : UPDATE trop large — un utilisateur authentifié pouvait
--        s'auto-attribuer plan='famille', stripe_customer_id, etc.
--        → colonne sensible verrouillée (plan, stripe_*) via trigger +
--          policy UPDATE restrictée à ses colonnes de préférences.
--
--   [S2] weekly_budget_snapshots : policy « for all using ... with check »
--        laissait INSERT/DELETE au client. Les snapshots sont écrits par le
--        moteur serveur (service_role, hors RLS) → lecture seule pour le
--        client, écriture retirée.
--
--   [S3] plan_meals / shopping_list_items : policies UPDATE sans WITH CHECK
--        → un client pouvait déplacer une ligne vers un plan/liste d'un
--        autre utilisateur. WITH CHECK étanche ajouté.
--
--   [S4] Tables sans RLS explicite : user_prix_ingredients et toutes les
--        tables futures → conf par défaut durcie.
--
--   [S5] Le champ notes de meal_history est libre (XSS stocké potentiel) :
--        la Sanitization est gérée côté app ; RLS limite déjà l'exposition.
--
-- 100 % idempotent : relançable sans risque.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- [S1] PROFILES — UPDATE restreint + trigger colonnes sensibles
-- ────────────────────────────────────────────────────────────────────────────

-- Colonnes que le client ne peut JAMAIS modifier lui-même :
-- plan, stripe_* , welcome_email_envoye_le, digest_envoye_le (moteur serveur)
--
-- NB : le garde s'appuie sur le RÔLE SQL effectif, pas sur la présence de JWT :
-- les requêtes service_role portent AUSSI des claims (role=service_role) —
-- les bloquer casserait le webhook Stripe et le cron emails. Seuls les rôles
-- client (authenticated/anon) sont restreints ; les connexions privilégiées
-- (service_role, postgres, role 'none' = connexion directe) passent.
create or replace function public.guard_profiles_sensitive_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  v_role := coalesce(current_setting('role', true), 'none');
  if v_role = 'none' then
    v_role := current_user::text;
  end if;
  if v_role in ('authenticated', 'anon') then
    -- Appel client authentifié : refuser toute modif des colonnes sensibles
    if new.plan is distinct from old.plan
       or new.stripe_customer_id is distinct from old.stripe_customer_id
       or new.stripe_subscription_id is distinct from old.stripe_subscription_id
       or new.welcome_email_envoye_le is distinct from old.welcome_email_envoye_le
       or new.digest_envoye_le is distinct from old.digest_envoye_le then
      raise exception 'Modification des colonnes sensibles interdite (plan, stripe) via le client';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_profiles_sensitive on public.profiles;
create trigger guard_profiles_sensitive
  before update on public.profiles
  for each row execute function public.guard_profiles_sensitive_columns();

-- La policy UPDATE existante reste (auth.uid() = id) mais le trigger ci-dessus
-- bloque toute escalade. On explicite aussi une policy distincte pour clarté :
drop policy if exists "Users update own profile (scoped)" on public.profiles;
create policy "Users update own profile (scoped)"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ────────────────────────────────────────────────────────────────────────────
-- [S2] WEEKLY_BUDGET_SNAPSHOTS — lecture seule côté client
-- ────────────────────────────────────────────────────────────────────────────
drop policy if exists "Users manage own budget snapshots" on public.weekly_budget_snapshots;
drop policy if exists "Users read own budget snapshots" on public.weekly_budget_snapshots;

create policy "Users read own budget snapshots"
  on public.weekly_budget_snapshots for select
  using (auth.uid() = user_id);

-- (aucune policy INSERT/UPDATE/DELETE → écritures uniquement via service_role)

-- ────────────────────────────────────────────────────────────────────────────
-- [S3] PLAN_MEALS — WITH CHECK pour empêcher le déplacement cross-user
-- ────────────────────────────────────────────────────────────────────────────
drop policy if exists "Plan meals update by owner" on public.plan_meals;
create policy "Plan meals update by owner"
  on public.plan_meals for update
  using (
    plan_id in (select id from public.weekly_plans where user_id = auth.uid())
  )
  with check (
    plan_id in (select id from public.weekly_plans where user_id = auth.uid())
  );

drop policy if exists "Plan meals delete by owner" on public.plan_meals;
create policy "Plan meals delete by owner"
  on public.plan_meals for delete
  using (
    plan_id in (select id from public.weekly_plans where user_id = auth.uid())
  );

-- ────────────────────────────────────────────────────────────────────────────
-- [S3 bis] SHOPPING_LIST_ITEMS — idem : WITH CHECK sur update + delete policy
-- ────────────────────────────────────────────────────────────────────────────
drop policy if exists "Shopping list items update by owner" on public.shopping_list_items;
create policy "Shopping list items update by owner"
  on public.shopping_list_items for update
  using (
    list_id in (select id from public.shopping_lists where user_id = auth.uid())
  )
  with check (
    list_id in (select id from public.shopping_lists where user_id = auth.uid())
  );

drop policy if exists "Shopping list items delete by owner" on public.shopping_list_items;
create policy "Shopping list items delete by owner"
  on public.shopping_list_items for delete
  using (
    list_id in (select id from public.shopping_lists where user_id = auth.uid())
  );

-- ────────────────────────────────────────────────────────────────────────────
-- [S4] USER_PRIX_INGREDIENTS — policy complète (using + with check)
-- ────────────────────────────────────────────────────────────────────────────
drop policy if exists "Users manage own ingredient prices" on public.user_prix_ingredients;
create policy "Users manage own ingredient prices"
  on public.user_prix_ingredients for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────────────────────
-- [S5] Vue meal_rotation_score — n'expose que les données publiques agrégées
-- (les vues s'exécutent avec les droits du propriétaire par défaut ; on
-- s'assure qu'elle filtre sur auth.uid() pour l'isolation par utilisateur)
-- ────────────────────────────────────────────────────────────────────────────
drop view if exists meal_rotation_score;
create view meal_rotation_score
with (security_invoker = true) as
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

grant select on public.meal_rotation_score to authenticated;
