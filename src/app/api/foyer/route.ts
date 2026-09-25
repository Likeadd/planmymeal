// ============================================================================
// API Foyer — profilage multi-foyer (Famille vs Solo)
// PATCH { nb_personnes } → met à jour le profil ET recalcule la liste de
// courses + le snapshot budget de la semaine en cours (les quantités de
// toutes les recettes planned passent de 1 à 4 personnes en un clic).
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { recomputeShoppingList, snapshotBudget } from '@/lib/rotation-engine';
import { getMonday } from '@/lib/dates';
import { publicErrorMessage } from '@/lib/utils';
import { enforceRateLimit, enforceUserRateLimit } from '@/lib/rate-limit';

export async function PATCH(request: NextRequest) {
  // Anti-abus : le PATCH recalcule toute la liste de courses (compute non trivial)
  const limited = enforceRateLimit(request, { name: 'foyer', limit: 20, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const { user } = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    const userLimited = enforceUserRateLimit(request, user.id, { name: 'foyer', limit: 20, windowMs: 60_000 });
    if (userLimited) return userLimited;

    const body = await request.json().catch(() => ({}));
    const nb = Number(body.nb_personnes);
    if (!Number.isInteger(nb) || nb < 1 || nb > 8) {
      return NextResponse.json({ error: 'Nombre de personnes invalide (1 – 8)' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    const { error: updateError } = await admin.from('profiles')
      .update({ nb_personnes: nb }).eq('id', user.id);
    if (updateError) throw new Error(updateError.message);

    // Recalcul immédiat de la semaine en cours : nouvelles quantités + budget
    const semaine_debut = body.semaine_debut || getMonday();
    const { data: plan } = await admin.from('weekly_plans')
      .select('id').eq('user_id', user.id).eq('semaine_debut', semaine_debut).maybeSingle();

    let listeRecalculee = false;
    if (plan) {
      await recomputeShoppingList(user.id, plan.id, admin);
      await snapshotBudget(user.id, semaine_debut, plan.id, admin);
      listeRecalculee = true;
    }

    return NextResponse.json({
      success: true,
      nb_personnes: nb,
      liste_recalculee: listeRecalculee,
    });
  } catch (error) {
    console.error('Erreur PATCH /api/foyer:', error);
    return NextResponse.json({ error: publicErrorMessage(error) }, { status: 500 });
  }
}
