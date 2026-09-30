import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { publicErrorMessage } from '@/lib/utils';
import { enforceRateLimit, enforceUserRateLimit } from '@/lib/rate-limit';
import { enregistrerPreference } from '@/lib/memoire';

/**
 * Favoris et avis rapides sur une recette — côté serveur (plus d'écriture
 * directe depuis le navigateur).
 *
 *   GET  /api/favori?meal_id=12   → { avis: 'liked' | 'disliked' | null }
 *   POST /api/favori { meal_id, avis: 'liked' | 'disliked' | null }
 *
 * Un favori = statut `liked` dans meal_history (compté par le moteur) + note 5
 * dans la mémoire. `null` retire l'avis : les lignes liked/disliked de la
 * recette sont supprimées et la note effacée — un favori se retire vraiment.
 */
export async function GET(request: NextRequest) {
  try {
    const { user } = await getAuthUser(request);
    if (!user) return NextResponse.json({ avis: null });
    const mealId = Number(request.nextUrl.searchParams.get('meal_id'));
    if (!Number.isInteger(mealId) || mealId <= 0) return NextResponse.json({ error: 'meal_id invalide' }, { status: 400 });

    const { data } = await getSupabaseAdmin().from('meal_history')
      .select('status').eq('user_id', user.id).eq('meal_id', mealId)
      .in('status', ['liked', 'disliked'])
      .order('created_at', { ascending: false }).limit(1);
    return NextResponse.json({ avis: data?.[0]?.status ?? null });
  } catch (error) {
    return NextResponse.json({ error: publicErrorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const limited = await enforceRateLimit(request, { name: 'favori', limit: 60, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const { user } = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    const userLimited = await enforceUserRateLimit(request, user.id, { name: 'favori', limit: 60, windowMs: 60_000 });
    if (userLimited) return userLimited;

    const body = await request.json();
    const mealId = Number(body.meal_id);
    const avis = body.avis === 'liked' || body.avis === 'disliked' ? body.avis : null;
    if (!Number.isInteger(mealId) || mealId <= 0) return NextResponse.json({ error: 'meal_id invalide' }, { status: 400 });

    const admin = getSupabaseAdmin();
    const { data: meal } = await admin.from('meals').select('id').eq('id', mealId).eq('is_public', true).maybeSingle();
    if (!meal) return NextResponse.json({ error: 'Recette introuvable' }, { status: 404 });

    // Un seul avis à la fois : on efface les avis précédents de cette recette
    const { error: delErr } = await admin.from('meal_history').delete()
      .eq('user_id', user.id).eq('meal_id', mealId).in('status', ['liked', 'disliked']);
    if (delErr) throw new Error(delErr.message);

    if (avis) {
      const { error } = await admin.from('meal_history').insert({
        user_id: user.id, meal_id: mealId, status: avis,
        rating: avis === 'liked' ? 5 : 2,
        planned_date: new Date().toISOString().split('T')[0],
      });
      if (error) throw new Error(error.message);
    }
    await enregistrerPreference(user.id, mealId, { note: avis === 'liked' ? 5 : avis === 'disliked' ? 2 : null }, admin);

    return NextResponse.json({ success: true, avis });
  } catch (error) {
    console.error('Erreur favori:', error);
    return NextResponse.json({ error: publicErrorMessage(error) }, { status: 500 });
  }
}
