import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { chiffrerListeCourses } from '@/lib/budget';
import { snapshotBudget, type ShoppingListItemWithIngredient } from '@/lib/rotation-engine';
import { getMonday } from '@/lib/dates';
import { publicErrorMessage } from '@/lib/utils';
import { enforceRateLimit, enforceUserRateLimit } from '@/lib/rate-limit';

/**
 * GET /api/prix?semaine_debut=YYYY-MM-DD
 * Retourne la liste de courses de la semaine avec les prix détaillés
 * (prix de référence, surcharge utilisateur, quantité d'achat, total par rayon).
 */
export async function GET(request: NextRequest) {
  try {
    const { user } = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    const userLimited = enforceUserRateLimit(request, user.id, { name: 'prix-get', limit: 120, windowMs: 60_000 });
    if (userLimited) return userLimited;

    const admin = getSupabaseAdmin();
    const semaine_debut = request.nextUrl.searchParams.get('semaine_debut') || getMonday();

    const { data: plan } = await admin.from('weekly_plans')
      .select('id').eq('user_id', user.id).eq('semaine_debut', semaine_debut).maybeSingle();
    if (!plan) return NextResponse.json({ sections: [], total: 0 });

    const { data: list } = await admin.from('shopping_lists')
      .select('id').eq('plan_id', plan.id).eq('is_active', true).maybeSingle();
    if (!list) return NextResponse.json({ sections: [], total: 0 });

    const { data: items } = await admin.from('shopping_list_items')
      .select('ingredient_id, quantite_totale, unite, rayon, checked, ingredients!inner(id, nom, prix_unitaire, unite_prix)')
      .eq('list_id', list.id)
      .order('rayon');
    if (!items) return NextResponse.json({ sections: [], total: 0 });

    const { data: overrides } = await admin.from('user_prix_ingredients')
      .select('ingredient_id, prix_unitaire').eq('user_id', user.id);
    const overrideMap = new Map<number, number>(
      (overrides || []).map(o => [o.ingredient_id, o.prix_unitaire])
    );

    const sections = chiffrerListeCourses(
      (items as unknown as ShoppingListItemWithIngredient[]).map(it => ({
        ingredient_id: it.ingredient_id,
        quantite_totale: it.quantite_totale,
        unite: it.unite,
        rayon: it.rayon,
        checked: it.checked,
        ingredient: it.ingredients,
      })),
      overrideMap
    );

    const total = Math.round(sections.reduce((s, sec) => s + sec.total, 0) * 100) / 100;

    return NextResponse.json({ sections, total });
  } catch (error) {
    console.error('Erreur GET /api/prix:', error);
    return NextResponse.json({ error: publicErrorMessage(error) }, { status: 500 });
  }
}

/**
 * PUT /api/prix
 * Body : { ingredient_id, prix_unitaire, semaine_debut? }
 * Enregistre le prix personnalisé d'un ingrédient puis rafraîchit le snapshot.
 */
export async function PUT(request: NextRequest) {
  // Anti-abus : écriture prix + recalcul snapshot
  const limited = enforceRateLimit(request, { name: 'prix', limit: 60, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const { user } = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    const userLimited = enforceUserRateLimit(request, user.id, { name: 'prix', limit: 60, windowMs: 60_000 });
    if (userLimited) return userLimited;

    const body = await request.json();
    const prix = Number(body.prix_unitaire);
    const ingredientId = Number(body.ingredient_id);
    if (!Number.isFinite(prix) || prix < 0 || prix > 1000 || !Number.isInteger(ingredientId)) {
      return NextResponse.json({ error: 'Prix invalide' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const { error: upsertError } = await admin.from('user_prix_ingredients').upsert(
      { user_id: user.id, ingredient_id: ingredientId, prix_unitaire: prix, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,ingredient_id' }
    );
    if (upsertError) throw new Error(upsertError.message);

    // Rafraîchir le snapshot budget de la semaine
    const semaine_debut = body.semaine_debut || getMonday();
    const { data: plan } = await admin.from('weekly_plans')
      .select('id').eq('user_id', user.id).eq('semaine_debut', semaine_debut).maybeSingle();
    if (plan) await snapshotBudget(user.id, semaine_debut, plan.id, admin);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erreur PUT /api/prix:', error);
    return NextResponse.json({ error: publicErrorMessage(error) }, { status: 500 });
  }
}
