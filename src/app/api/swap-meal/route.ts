import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getMonday } from '@/lib/dates';
import { publicErrorMessage } from '@/lib/utils';
import { enforceRateLimit, enforceUserRateLimit } from '@/lib/rate-limit';
import { recomputeShoppingList, snapshotBudget } from '@/lib/rotation-engine';

/**
 * POST /api/swap-meal — remplace (ou ajoute) UN repas sur un créneau du
 * planning de la semaine. Serveur-side pour :
 *   1. appliquer les mêmes contraintes que le moteur (créneau valide, recette
 *      publique existante — un créneau dessert ne peut recevoir qu'un dessert
 *      via le type_repas, validé par la contrainte SQL après migration 00014)
 *   2. recalculer la liste de courses (RPC transactionnelle) — un swap via le
 *      client direct laissait la liste désynchronisée
 *   3. rafraîchir le snapshot budget
 */
export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(request, { name: 'swap-meal', limit: 40, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const { user } = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    const userLimited = enforceUserRateLimit(request, user.id, { name: 'swap-meal', limit: 40, windowMs: 60_000 });
    if (userLimited) return userLimited;

    const body = await request.json();
    const semaine_debut: string = body.semaine_debut || getMonday();
    const jour = Number(body.jour_semaine);
    const repasType = String(body.repas_type ?? '');
    const mealId = Number(body.meal_id);

    if (!Number.isInteger(jour) || jour < 0 || jour > 6) {
      return NextResponse.json({ error: 'jour_semaine invalide' }, { status: 400 });
    }
    if (!['dejeuner', 'diner', 'dessert', 'dessert_midi'].includes(repasType)) {
      return NextResponse.json({ error: 'repas_type invalide' }, { status: 400 });
    }
    if (!Number.isInteger(mealId) || mealId <= 0) {
      return NextResponse.json({ error: 'meal_id invalide' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    // Le plan de la semaine doit exister
    const { data: plan } = await admin.from('weekly_plans')
      .select('id').eq('user_id', user.id).eq('semaine_debut', semaine_debut).maybeSingle();
    if (!plan) {
      return NextResponse.json(
        { error: "Aucun planning pour cette semaine — générez d'abord la semaine" },
        { status: 404 }
      );
    }

    // La recette doit exister et être publique
    const { data: meal } = await admin.from('meals')
      .select('id, type_repas').eq('id', mealId).eq('is_public', true).maybeSingle();
    if (!meal) {
      return NextResponse.json({ error: 'Recette introuvable' }, { status: 404 });
    }

    // Cohérence créneau / type de recette : les créneaux dessert ne reçoivent
    // que des desserts ; les créneaux principaux que des plats ou entrées.
    const estSlotDessert = repasType === 'dessert' || repasType === 'dessert_midi';
    if (estSlotDessert && meal.type_repas !== 'dessert') {
      return NextResponse.json({ error: 'Ce créneau accepte uniquement un dessert' }, { status: 400 });
    }
    if (!estSlotDessert && meal.type_repas === 'dessert') {
      return NextResponse.json({ error: 'Un dessert ne peut pas occuper un créneau repas principal' }, { status: 400 });
    }

    // Ancien repas du créneau (pour délier un éventuel reste du lendemain)
    // NB : plan_meals n'a pas de PK mono-colonne — on cible le créneau par sa
    // clé composite (plan_id, jour_semaine, repas_type).
    const { data: existing } = await admin.from('plan_meals')
      .select('meal_id').eq('plan_id', plan.id)
      .eq('jour_semaine', jour).eq('repas_type', repasType).maybeSingle();

    if (existing) {
      const { error } = await admin.from('plan_meals')
        .update({ meal_id: meal.id, est_reste_de: null })
        .eq('plan_id', plan.id).eq('jour_semaine', jour).eq('repas_type', repasType);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await admin.from('plan_meals').insert({
        plan_id: plan.id, jour_semaine: jour,
        repas_type: repasType, meal_id: meal.id, est_reste_de: null,
      });
      if (error) throw new Error(error.message);
    }

    // Si un dîner est remplacé, le déjeuner-reste du lendemain perd son lien
    // (il garde son plat d'origine, l'utilisateur peut re-basculer le mode)
    if (repasType === 'diner' && existing?.meal_id) {
      await admin.from('plan_meals')
        .update({ est_reste_de: null })
        .eq('plan_id', plan.id).eq('est_reste_de', existing.meal_id);
    }

    // Liste de courses recalculée (le dessert remplacé change les achats)
    let shoppingListId: number | null = null;
    try {
      shoppingListId = await recomputeShoppingList(user.id, plan.id, admin);
    } catch (e) {
      // Best-effort : le planning est déjà à jour, on log et on continue
      console.error('Erreur recompute liste de courses (swap):', e);
    }

    // Snapshot budget rafraîchi (best-effort, ne fait jamais échouer le swap)
    try {
      await snapshotBudget(user.id, semaine_debut, plan.id, admin);
    } catch { /* ignoré */ }

    return NextResponse.json({ success: true, shopping_list_id: shoppingListId, semaine_debut });
  } catch (error) {
    console.error('Erreur swap meal:', error);
    return NextResponse.json({ error: publicErrorMessage(error) }, { status: 500 });
  }
}
