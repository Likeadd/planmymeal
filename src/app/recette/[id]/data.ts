import { cache } from 'react';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { MealWithIngredients } from '@/lib/db-rows';

/**
 * Recette PUBLIQUE complète (ingrédients compris), lue côté serveur.
 * `cache` : metadata, layout (JSON-LD) et page partagent UNE seule requête
 * par rendu — auparavant la recette était lue deux fois côté serveur puis
 * une troisième fois dans le navigateur.
 * Une recette privée renvoie null : la page la charge alors côté client,
 * avec la session de son auteur (RLS).
 */
export const getRecettePublique = cache(async (id: number): Promise<MealWithIngredients | null> => {
  if (!Number.isInteger(id) || id <= 0) return null;
  try {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from('meals')
      .select('*, meal_ingredients(quantite, unite, est_optionnel, ingredients!inner(*))')
      .eq('id', id)
      .eq('is_public', true)
      .maybeSingle();
    return (data as unknown as MealWithIngredients) ?? null;
  } catch {
    return null;
  }
});
