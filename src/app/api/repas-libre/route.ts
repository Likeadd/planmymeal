import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getMonday } from '@/lib/dates';
import { publicErrorMessage } from '@/lib/utils';
import { enforceRateLimit, enforceUserRateLimit } from '@/lib/rate-limit';
import { recomputeShoppingList, snapshotBudget } from '@/lib/rotation-engine';

const TEXTE_MAX = 80;

/**
 * POST /api/repas-libre — remplace un créneau du planning par un texte libre
 * (« Repas anniversaire », « Apéro dinatoire »…). Le créneau garde meal_id NULL :
 * pas d'ingrédients, donc la liste de courses et le budget sont recalculés sans lui.
 * `vider: true` → le créneau est simplement supprimé (« pas de repas »).
 */
export async function POST(request: NextRequest) {
  const limited = await enforceRateLimit(request, { name: 'repas-libre', limit: 40, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const { user } = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    const userLimited = await enforceUserRateLimit(request, user.id, { name: 'repas-libre', limit: 40, windowMs: 60_000 });
    if (userLimited) return userLimited;

    const body = await request.json();
    const semaine_debut: string = body.semaine_debut || getMonday();
    const jour = Number(body.jour_semaine);
    const repasType = String(body.repas_type ?? '');
    const texte = String(body.texte ?? '').replace(/\s+/g, ' ').trim();
    const vider = body.vider === true;

    if (!Number.isInteger(jour) || jour < 0 || jour > 6) {
      return NextResponse.json({ error: 'jour_semaine invalide' }, { status: 400 });
    }
    if (!['dejeuner', 'diner', 'dessert', 'dessert_midi'].includes(repasType)) {
      return NextResponse.json({ error: 'repas_type invalide' }, { status: 400 });
    }
    if (!vider && !texte) return NextResponse.json({ error: 'Écrivez le nom du repas' }, { status: 400 });
    if (texte.length > TEXTE_MAX) {
      return NextResponse.json({ error: `${TEXTE_MAX} caractères maximum` }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const { data: plan } = await admin.from('weekly_plans')
      .select('id').eq('user_id', user.id).eq('semaine_debut', semaine_debut).maybeSingle();
    if (!plan) {
      return NextResponse.json(
        { error: "Aucun planning pour cette semaine — générez d'abord la semaine" },
        { status: 404 }
      );
    }

    // Ancien repas du créneau : un éventuel reste du lendemain perd son lien
    const { data: existing } = await admin.from('plan_meals')
      .select('meal_id').eq('plan_id', plan.id)
      .eq('jour_semaine', jour).eq('repas_type', repasType).maybeSingle();

    const { error } = vider
      ? await admin.from('plan_meals').delete()
          .eq('plan_id', plan.id).eq('jour_semaine', jour).eq('repas_type', repasType)
      : await admin.from('plan_meals').upsert(
          { plan_id: plan.id, jour_semaine: jour, repas_type: repasType, meal_id: null, est_reste_de: null, texte_libre: texte },
          { onConflict: 'plan_id,jour_semaine,repas_type' }
        );
    if (error) throw new Error(error.message);

    if (existing?.meal_id) {
      await admin.from('plan_meals')
        .update({ est_reste_de: null })
        .eq('plan_id', plan.id).eq('est_reste_de', existing.meal_id);
    }

    let shoppingListId: number | null = null;
    try {
      shoppingListId = await recomputeShoppingList(user.id, plan.id, admin);
    } catch (e) {
      console.error('Erreur recompute liste de courses (repas libre):', e);
    }
    try {
      await snapshotBudget(user.id, semaine_debut, plan.id, admin);
    } catch { /* best-effort */ }

    return NextResponse.json({ success: true, shopping_list_id: shoppingListId, semaine_debut });
  } catch (error) {
    console.error('Erreur repas libre:', error);
    return NextResponse.json({ error: publicErrorMessage(error) }, { status: 500 });
  }
}
