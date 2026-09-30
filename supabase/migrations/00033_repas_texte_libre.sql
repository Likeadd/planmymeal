-- Repas « texte libre » : l'utilisateur remplace un créneau du planning par son
-- propre texte (« Repas anniversaire », « Apéro dinatoire »…). Le créneau garde
-- meal_id = NULL et porte le texte ; aucun ingrédient, donc rien dans la liste
-- de courses ni dans le budget.
alter table public.plan_meals
  add column if not exists texte_libre text
  check (texte_libre is null or char_length(texte_libre) between 1 and 80);
