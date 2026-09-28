import { cache } from 'react';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/../supabase/database.types';
import {
  COLONNES_RECETTE_PLANNING, toRecettePlanning,
  type WeeklyPlanEmbed,
} from '@/lib/db-rows';
import { chiffrerListeCourses, type PricedShoppingSection } from '@/lib/budget';
import type { RecettePlanning } from '@/types';

export interface RepasJour {
  dejeuner?: RecettePlanning;
  diner?: RecettePlanning;
  dessert?: RecettePlanning;
}

export interface PlanPartage {
  semaineDebut: string;
  jours: RepasJour[]; // index 0 = lundi … 6 = dimanche
  courses: PricedShoppingSection[];
}

function admin() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/** Planning public par token de partage — lu avec la clé de service, aucune
 *  session visiteur requise (comme /recette/[id]). `cache` : une seule
 *  requête partagée entre generateMetadata et la page. */
export const getPlanPartage = cache(async (token: string): Promise<PlanPartage | null> => {
  if (!token) return null;
  try {
    const supabase = admin();
    const { data: plan } = await supabase
      .from('weekly_plans')
      .select(`id, semaine_debut, plan_meals(jour_semaine, repas_type, meal_id, est_reste_de, meals!plan_meals_meal_id_fkey(${COLONNES_RECETTE_PLANNING}))`)
      .eq('share_token', token)
      .maybeSingle();
    if (!plan) return null;

    const embed = plan as unknown as WeeklyPlanEmbed;
    const jours: RepasJour[] = Array.from({ length: 7 }, () => ({}));
    for (const pm of embed.plan_meals || []) {
      if (!pm.meals || pm.jour_semaine < 0 || pm.jour_semaine > 6) continue;
      const recette = toRecettePlanning(pm.meals);
      if (pm.repas_type === 'dejeuner') jours[pm.jour_semaine].dejeuner = recette;
      else if (pm.repas_type === 'diner') jours[pm.jour_semaine].diner = recette;
      else if (pm.repas_type === 'dessert' || pm.repas_type === 'dessert_midi') jours[pm.jour_semaine].dessert = recette;
    }

    // Liste de courses : dernière shopping_list active de ce planning.
    const { data: liste } = await supabase
      .from('shopping_lists')
      .select('id')
      .eq('plan_id', plan.id)
      .eq('is_active', true)
      .maybeSingle();

    let courses: PricedShoppingSection[] = [];
    if (liste) {
      const { data: items } = await supabase
        .from('shopping_list_items')
        .select('ingredient_id, quantite_totale, unite, rayon, checked, ingredients(id, nom, prix_unitaire, unite_prix)')
        .eq('list_id', liste.id);
      if (items) {
        courses = chiffrerListeCourses(
          items
            .filter(it => it.ingredients)
            .map(it => ({
              ingredient_id: it.ingredient_id,
              quantite_totale: it.quantite_totale,
              unite: it.unite,
              rayon: it.rayon,
              checked: it.checked,
              ingredient: it.ingredients!,
            }))
        );
      }
    }

    return { semaineDebut: plan.semaine_debut, jours, courses };
  } catch {
    return null;
  }
});
