-- 00038 — Indexation prudente des fiches recettes
alter table public.meals add column if not exists indexable boolean not null default false;
comment on column public.meals.indexable is 'true = fiche exposée aux moteurs de recherche (sitemap + robots index). Recettes rédigées à la main uniquement au lancement.';
create index if not exists idx_meals_indexable on public.meals (id) where indexable and is_public;
