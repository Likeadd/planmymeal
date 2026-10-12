-- 00039 — Source d'acquisition de l'inscrit (?ref=, ?utm_source=, site référent)
alter table public.profiles add column if not exists acquisition_source text;
comment on column public.profiles.acquisition_source is 'Source de la 1re visite (tiktok, instagram, partage, recette, google.com…) — jamais de donnée personnelle.';
