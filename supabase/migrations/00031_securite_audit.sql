-- ============================================================================
-- 00031 — Correctifs de l'audit (sécurité, newsletter, allergies)
--
-- 1. meals : un utilisateur ne peut plus insérer une recette PUBLIQUE depuis
--    le navigateur. Avant : `with check (auth.uid() = created_by)` laissait
--    passer `is_public = true` → recette injectée dans le catalogue public,
--    le sitemap et les menus générés des autres utilisateurs.
-- 2. rate_limits + rate_limit_hit() : limite de débit PARTAGÉE entre toutes
--    les instances serveur (l'ancienne limite en mémoire était par instance
--    sur Vercel, donc contournable). Appelée par la clé de service uniquement.
-- 3. newsletter_subscribers.confirmed_at : double opt-in (RGPD) — seul un
--    abonné qui a cliqué le lien de confirmation reçoit la newsletter.
-- 4. user_allergy_families / user_dislike_families : allergies et aliments
--    détestés stockés par FAMILLE (lib/exclusions-alimentaires.ts), résolus
--    en ingrédients au moment de la génération → un ingrédient ajouté plus
--    tard au catalogue est couvert automatiquement.
--    + conversion des lignes héritées de l'ancien onboarding, qui stockait
--    des identifiants en dur ne correspondant pas au catalogue.
--
-- Idempotent.
-- ============================================================================

-- ── 1. meals : insertion privée uniquement ─────────────────────────────────
drop policy if exists "Users can create meals" on public.meals;
drop policy if exists "Users can create private meals" on public.meals;
create policy "Users can create private meals"
  on public.meals for insert
  with check (auth.uid() = created_by and is_public = false);

-- À vérifier une fois : recettes publiques créées par un utilisateur (le
-- catalogue officiel a created_by NULL). S'il y en a, examinez-les puis :
--   update public.meals set is_public = false where created_by is not null and is_public;
-- select id, titre, created_by from public.meals where created_by is not null and is_public;

-- ── 2. Limite de débit partagée ────────────────────────────────────────────
create table if not exists public.rate_limits (
  cle text primary key,
  fenetre_debut timestamptz not null,
  compteur integer not null
);
alter table public.rate_limits enable row level security; -- aucune policy : service_role uniquement

create or replace function public.rate_limit_hit(p_cle text, p_limite integer, p_fenetre_ms integer)
returns table (ok boolean, retry_after_sec integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_fenetre interval := make_interval(secs => p_fenetre_ms / 1000.0);
  v_debut timestamptz;
  v_compteur integer;
begin
  insert into public.rate_limits as r (cle, fenetre_debut, compteur)
  values (p_cle, v_now, 1)
  on conflict (cle) do update set
    fenetre_debut = case when r.fenetre_debut + v_fenetre <= v_now then v_now else r.fenetre_debut end,
    compteur      = case when r.fenetre_debut + v_fenetre <= v_now then 1 else r.compteur + 1 end
  returning r.fenetre_debut, r.compteur into v_debut, v_compteur;

  -- Ménage occasionnel (≈ 1 appel sur 200) : fenêtres expirées depuis 1 jour
  if random() < 0.005 then
    delete from public.rate_limits where fenetre_debut < v_now - interval '1 day';
  end if;

  if v_compteur <= p_limite then
    return query select true, 0;
  else
    return query select false,
      greatest(1, ceil(extract(epoch from (v_debut + v_fenetre - v_now))))::integer;
  end if;
end;
$$;

revoke all on function public.rate_limit_hit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, integer, integer) to service_role;

-- ── 3. Newsletter : double opt-in ──────────────────────────────────────────
alter table public.newsletter_subscribers
  add column if not exists confirmed_at timestamptz;

-- ── 4. Allergies / détestés par famille ────────────────────────────────────
create table if not exists public.user_allergy_families (
  user_id uuid not null references public.profiles(id) on delete cascade,
  code text not null,
  primary key (user_id, code)
);
create table if not exists public.user_dislike_families (
  user_id uuid not null references public.profiles(id) on delete cascade,
  code text not null,
  primary key (user_id, code)
);
alter table public.user_allergy_families enable row level security;
alter table public.user_dislike_families enable row level security;

drop policy if exists "Users manage own allergy families" on public.user_allergy_families;
create policy "Users manage own allergy families"
  on public.user_allergy_families for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage own dislike families" on public.user_dislike_families;
create policy "Users manage own dislike families"
  on public.user_dislike_families for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Conversion de l'ancien onboarding (identifiants en dur 1-8 / 10-17).
-- Seuls les identifiants SANS ambiguïté sont convertis : aucune famille
-- actuelle ne contient ces ingrédients (poulet entier, patate douce…), ces
-- lignes ne peuvent donc venir que de l'ancien bug.
insert into public.user_allergy_families (user_id, code)
select user_id, case ingredient_id
  when 1 then 'arachides' when 2 then 'fruits_coque' when 3 then 'lait'
  when 5 then 'oeufs' when 6 then 'crustaces' when 7 then 'poisson' when 8 then 'soja' end
from public.user_allergies
where ingredient_id in (1, 2, 3, 5, 6, 7, 8)
on conflict do nothing;
delete from public.user_allergies where ingredient_id in (1, 2, 3, 5, 6, 7, 8);

-- Détestés : 12 (avocat) et 13 (concombre) sont ambigus (choix possibles
-- avec le nouvel onboarding) → laissés tels quels.
insert into public.user_dislike_families (user_id, code)
select user_id, case ingredient_id
  when 10 then 'champignons' when 11 then 'chou_fleur' when 14 then 'aubergine'
  when 15 then 'olives' when 17 then 'abats' end
from public.user_dislikes
where ingredient_id in (10, 11, 14, 15, 17)
on conflict do nothing;
delete from public.user_dislikes where ingredient_id in (10, 11, 14, 15, 17);

notify pgrst, 'reload schema';
