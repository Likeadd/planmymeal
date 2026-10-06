-- Demandes de recettes : les utilisateurs proposent un plat qu'ils aimeraient
-- voir au catalogue. Écriture et lecture uniquement via l'API serveur (clé de
-- service) ; l'utilisateur ne peut lire que ses propres demandes.
create table if not exists public.recipe_requests (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  titre text not null check (char_length(titre) between 3 and 120),
  details text check (details is null or char_length(details) <= 600),
  statut text not null default 'nouvelle' check (statut in ('nouvelle', 'en_cours', 'ajoutee', 'refusee')),
  created_at timestamptz not null default now()
);

create index if not exists recipe_requests_user_idx on public.recipe_requests (user_id, created_at desc);

alter table public.recipe_requests enable row level security;

drop policy if exists "Users read own recipe requests" on public.recipe_requests;
create policy "Users read own recipe requests"
  on public.recipe_requests for select
  using (auth.uid() = user_id);

notify pgrst, 'reload schema';
