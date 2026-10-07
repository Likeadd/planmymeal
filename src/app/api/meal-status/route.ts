// ============================================================================
// API Statut d'un repas (cuisiné / sauté)
//
// POST /api/meal-status
// { meal_id, status: 'cooked' | 'skipped' }
//
// Serveur-side pour deux raisons :
//   1. cohérence de l'historique de rotation : l'ancienne écriture directe
//      navigateur contournait les mêmes garde-fous que le serveur (date
//      d'historique = aujourd'hui à Paris, pas le jour UTC du runtime) ;
//   2. la logique métier ne doit pas vivre dans l'UI — le statut alimente le
//      moteur de rotation (status cooked/skipped de meal_history), il doit
//      passer par la même porte que les autres écritures.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { dateParis } from '@/lib/dates';
import { publicErrorMessage } from '@/lib/utils';
import { enforceRateLimit, enforceUserRateLimit } from '@/lib/rate-limit';

const STATUTS_VALIDES = ['cooked', 'skipped'];

export async function POST(request: NextRequest) {
  // Anti-abus : un clic utilisateur, pas une boucle
  const limited = await enforceRateLimit(request, { name: 'meal-status', limit: 60, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const { user } = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    const userLimited = await enforceUserRateLimit(request, user.id, { name: 'meal-status', limit: 60, windowMs: 60_000 });
    if (userLimited) return userLimited;

    const body = await request.json().catch(() => ({}));
    const mealId = Number(body.meal_id);
    const status = body.status;

    if (!Number.isInteger(mealId) || mealId <= 0) {
      return NextResponse.json({ error: 'meal_id invalide' }, { status: 400 });
    }
    if (typeof status !== 'string' || !STATUTS_VALIDES.includes(status)) {
      return NextResponse.json({ error: "status invalide (cooked | skipped)" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    // La recette doit exister (publique ou créée par l'utilisateur)
    const { data: meal } = await admin.from('meals')
      .select('id').eq('id', mealId)
      .or(`is_public.eq.true,created_by.eq.${user.id}`).maybeSingle();
    if (!meal) {
      return NextResponse.json({ error: 'Recette introuvable' }, { status: 404 });
    }

    const { error } = await admin.from('meal_history').insert({
      user_id: user.id,
      meal_id: mealId,
      // Fuseau de référence de l'app (Europe/Paris) — l'ancienne version
      // client écrivait la date UTC du runtime : entre 23 h et minuit UTC,
      // le statut tombait « la veille » pour un utilisateur français.
      planned_date: dateParis(),
      status: status as 'cooked' | 'skipped',
    });
    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erreur meal status:', error);
    return NextResponse.json({ error: publicErrorMessage(error) }, { status: 500 });
  }
}
