import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { publicErrorMessage } from '@/lib/utils';
import { enforceRateLimit, enforceUserRateLimit } from '@/lib/rate-limit';
import { noterRepas, type NoteRepas } from '@/lib/memoire';
import { RAISONS_NOTE, type RaisonNote } from '@/types';

/**
 * POST /api/noter { meal_id, note: 1..5, raison? } — note d'un repas après
 * dégustation, écrite côté serveur (historique + mémoire de la recette).
 */
export async function POST(request: NextRequest) {
  const ipLimited = await enforceRateLimit(request, { name: 'noter-ip', limit: 120, windowMs: 60_000 });
  if (ipLimited) return ipLimited;

  try {
    const { user } = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    const limited = await enforceUserRateLimit(request, user.id, { name: 'noter', limit: 60, windowMs: 60_000 });
    if (limited) return limited;

    const body = await request.json().catch(() => ({}));
    const mealId = Number(body.meal_id);
    const note = Number(body.note);
    if (!Number.isInteger(mealId) || mealId <= 0) return NextResponse.json({ error: 'meal_id invalide' }, { status: 400 });
    if (!Number.isInteger(note) || note < 1 || note > 5) return NextResponse.json({ error: 'Note invalide (1 à 5)' }, { status: 400 });
    const raisons: string[] = RAISONS_NOTE.map(r => r.value);
    const raison = typeof body.raison === 'string' && raisons.includes(body.raison) ? (body.raison as RaisonNote) : null;

    const admin = getSupabaseAdmin();
    // Clé admin : on restreint aux recettes publiques ou créées par l'utilisateur.
    const { data: meal } = await admin.from('meals').select('id').eq('id', mealId)
      .or(`is_public.eq.true,created_by.eq.${user.id}`).maybeSingle();
    if (!meal) return NextResponse.json({ error: 'Recette introuvable' }, { status: 404 });

    await noterRepas(user.id, mealId, note as NoteRepas, raison, admin);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erreur POST /api/noter:', error);
    return NextResponse.json({ error: publicErrorMessage(error) }, { status: 500 });
  }
}
