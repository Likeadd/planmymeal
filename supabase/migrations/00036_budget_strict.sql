-- Mode du budget hebdomadaire : strict (la semaine ne dépasse pas le budget) ou souple (autour du budget).
alter table public.profiles
  add column if not exists budget_strict boolean not null default true;
