// ============================================================================
// Liste de courses et budget d'une semaine planifiée — extrait du moteur de
// rotation (rotation-engine.ts faisait 1 650 lignes : sélection, restes,
// desserts, courses ET budget). Ici : l'agrégation transactionnelle de la
// liste (RPC Postgres) et le snapshot dépense / budget / économie.
// ============================================================================

import { chiffrerListeCourses } from '@/lib/budget';
import type { Db, ShoppingListItemWithIngredient } from '@/lib/rotation-engine';

// ─── Liste de courses : agrégation depuis plan_meals ────────────────────────

export async function recomputeShoppingList(
  userId: string, planId: number, supabase: Db
): Promise<number | null> {
  // ⭐ Transaction atomique côté Postgres (migration 00012) — remplace l'ancien
  // delete-all + insert non transactionnel (risque #1 de l'audit : un échec
  // entre les deux laissait une liste vide ; course possible cron × clic).
  // La fonction SQL conserve l'état coché des ingrédients qui restent et
  // retourne NULL si aucun ingrédient à acheter (comportement JS identique).
  // Version consciente du frigo (migration 00016) : la liste déduit ce qui est
  // déjà au garde-manger. Si la migration n'est pas encore appliquée, on
  // retombe sur la RPC d'agrégation seule (00014) — l'app reste fonctionnelle.
  const frigo = await supabase.rpc('recompute_shopping_list_frigo', { p_plan_id: planId });
  if (!frigo.error) return frigo.data ?? null;

  const { data, error } = await supabase.rpc('recompute_shopping_list', { p_plan_id: planId });
  if (error) throw new Error(`Erreur liste de courses : ${error.message}`);
  return data ?? null;
}

// ─── Snapshot budget : dépense de la semaine vs budget défini ───────────────

/**
 * Calcule la dépense prévue de la semaine (liste de courses chiffrée) et
 * enregistre un snapshot budget / dépense / économie. Appelé à chaque
 * génération ou régénération de semaine pour garder le snapshot à jour.
 */
export async function snapshotBudget(
  userId: string,
  semaineDebut: string,
  planId: number,
  supabase: Db
): Promise<{ budget: number | null; depense: number; economie: number } | null> {
  try {
    const { data: profile } = await supabase
      .from('profiles').select('budget_hebdo, nb_personnes').eq('id', userId).single();
    if (!profile) return null;

    const depense = await calculerDepenseSemaine(userId, planId, supabase);
    const budget = profile.budget_hebdo ?? null;
    const economie = budget != null ? Math.round((budget - depense) * 100) / 100 : 0;

    await supabase.from('weekly_budget_snapshots').upsert(
      {
        user_id: userId,
        semaine_debut: semaineDebut,
        budget: budget ?? 0,
        depense,
        economie,
        nb_personnes: profile.nb_personnes || 2,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,semaine_debut' }
    );

    return { budget, depense, economie };
  } catch (e) {
    // Le snapshot ne doit jamais faire échouer la génération
    console.error('Erreur snapshot budget:', e);
    return null;
  }
}

/**
 * Dépense totale prévue pour le plan : somme des prix des items de la liste
 * de courses (prix surchargés par l'utilisateur si définis).
 */
export async function calculerDepenseSemaine(
  userId: string,
  planId: number,
  supabase: Db
): Promise<number> {
  const { data: list } = await supabase.from('shopping_lists')
    .select('id').eq('plan_id', planId).eq('is_active', true).maybeSingle();
  if (!list) return 0;

  const { data: items } = await supabase.from('shopping_list_items')
    .select('ingredient_id, quantite_totale, unite, rayon, ingredients!inner(id, nom, prix_unitaire, unite_prix)')
    .eq('list_id', list.id);
  if (!items) return 0;

  const { data: overrides } = await supabase.from('user_prix_ingredients')
    .select('ingredient_id, prix_unitaire').eq('user_id', userId);
  const overrideMap = new Map<number, number>(
    (overrides || []).map(o => [o.ingredient_id, o.prix_unitaire])
  );

  return chiffrerListeCourses(
    (items as unknown as ShoppingListItemWithIngredient[]).map(it => ({
      ingredient_id: it.ingredient_id,
      quantite_totale: it.quantite_totale,
      unite: it.unite,
      rayon: it.rayon,
      checked: false,
      ingredient: it.ingredients,
    })),
    overrideMap
  ).reduce((s, section) => s + section.total, 0);
}