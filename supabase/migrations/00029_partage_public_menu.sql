-- ============================================================================
-- 00029 — Partage public d'un menu de la semaine (/menu/[token])
--
-- `share_token` : NULL par défaut (rien n'est partageable tant que
-- l'utilisateur ne clique pas « Partager »). Généré côté API
-- (POST /api/planning/partager), jamais par la base — évite un
-- token prévisible ou généré en masse.
-- Aucune policy RLS ajoutée : la page publique lit via la clé de service
-- (comme /recette/[id]), jamais avec la session du visiteur anonyme.
--
-- 100 % additif et idempotent.
-- ============================================================================

alter table public.weekly_plans
  add column if not exists share_token uuid unique;

create index if not exists weekly_plans_share_token_idx
  on public.weekly_plans (share_token)
  where share_token is not null;
