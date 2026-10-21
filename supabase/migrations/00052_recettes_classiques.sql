-- Plats simples du quotidien français (lentilles-saucisses, steak frites, saumon riz…).
-- Le moteur de rotation les favorise d'autant plus que le curseur Confort ↔ Découverte
-- penche vers le confort (voir calculateMealScore).
alter table public.meals add column if not exists classique boolean not null default false;
create index if not exists meals_classique_idx on public.meals (classique) where classique;
