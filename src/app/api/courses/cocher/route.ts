import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { publicErrorMessage } from '@/lib/utils';
import { enforceUserRateLimit } from '@/lib/rate-limit';

/**
 * POST /api/courses/cocher — coche / décoche la liste de courses côté serveur.
 *   { list_id, ingredient_id, checked }   → un article
 *   { list_id, tout_decocher: true }      → nouveau passage en magasin
 * La liste doit appartenir à l'utilisateur de la session.
 */
export async function POST(request: NextRequest) {
  try {
    const { user } = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    // Généreux : on coche vite en magasin (et la file hors ligne se rejoue d'un coup)
    const limited = await enforceUserRateLimit(request, user.id, { name: 'courses-cocher', limit: 300, windowMs: 60_000 });
    if (limited) return limited;

    const body = await request.json().catch(() => ({}));
    const listId = Number(body.list_id);
    if (!Number.isInteger(listId) || listId <= 0) return NextResponse.json({ error: 'list_id invalide' }, { status: 400 });

    const admin = getSupabaseAdmin();
    const { data: liste } = await admin.from('shopping_lists').select('id').eq('id', listId).eq('user_id', user.id).maybeSingle();
    if (!liste) return NextResponse.json({ error: 'Liste introuvable' }, { status: 404 });

    if (body.tout_decocher === true) {
      const { error } = await admin.from('shopping_list_items').update({ checked: false }).eq('list_id', listId).eq('checked', true);
      if (error) throw new Error(error.message);
      return NextResponse.json({ success: true });
    }

    const ingredientId = Number(body.ingredient_id);
    if (!Number.isInteger(ingredientId) || ingredientId <= 0 || typeof body.checked !== 'boolean') {
      return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
    }
    const { error } = await admin.from('shopping_list_items').update({ checked: body.checked })
      .eq('list_id', listId).eq('ingredient_id', ingredientId);
    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: publicErrorMessage(error) }, { status: 500 });
  }
}
