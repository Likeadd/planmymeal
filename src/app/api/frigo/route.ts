// ============================================================================
// API Frigo / garde-manger — PlanMyMeal
//
// GET    → contenu du frigo (trié : périme bientôt d'abord)
// POST   → ajoute (ou cumule) un article
// DELETE → retire un article (?id=) ou vide le frigo entier
//
// Chaque écriture recalcule la liste de courses de la semaine en cours : c'est
// ce qui rend l'ajout au frigo immédiatement visible (« je viens d'acheter
// 6 œufs » → ils sortent du panier). Le calcul passe par la RPC frigo-aware
// (migration 00016), donc la déduction reste cohérente avec le moteur.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { enforceRateLimit, enforceUserRateLimit } from '@/lib/rate-limit';
import { publicErrorMessage } from '@/lib/utils';
import { getMonday } from '@/lib/dates';
import { ajouterAuFrigo, chargerFrigo, supprimerDuFrigo, viderFrigo } from '@/lib/frigo';
import { recomputeShoppingList } from '@/lib/rotation-engine';

/** Recalcule la liste de courses de la semaine visée, si un plan existe. */
async function rafraichirListeCourses(
  userId: string,
  semaineDebut: string,
  admin: ReturnType<typeof getSupabaseAdmin>
): Promise<boolean> {
  const { data: plan } = await admin
    .from('weekly_plans')
    .select('id')
    .eq('user_id', userId)
    .eq('semaine_debut', semaineDebut)
    .maybeSingle();
  if (!plan) return false;
  await recomputeShoppingList(userId, plan.id, admin);
  return true;
}

export async function GET(request: NextRequest) {
  try {
    const { user } = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    const userLimited = enforceUserRateLimit(request, user.id, { name: 'frigo-get', limit: 120, windowMs: 60_000 });
    if (userLimited) return userLimited;

    const items = await chargerFrigo(user.id, getSupabaseAdmin());
    return NextResponse.json({ items });
  } catch (error) {
    console.error('Erreur GET /api/frigo:', error);
    return NextResponse.json({ error: publicErrorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(request, { name: 'frigo', limit: 60, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const { user } = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    const userLimited = enforceUserRateLimit(request, user.id, { name: 'frigo', limit: 60, windowMs: 60_000 });
    if (userLimited) return userLimited;

    const body = await request.json().catch(() => ({} as Record<string, unknown>));
    const ingredientId = Number(body.ingredient_id);
    const quantite = Number(body.quantite);

    if (!Number.isInteger(ingredientId) || ingredientId <= 0) {
      return NextResponse.json({ error: 'Ingrédient invalide' }, { status: 400 });
    }
    if (!Number.isFinite(quantite) || quantite <= 0) {
      return NextResponse.json({ error: 'Quantité invalide' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    await ajouterAuFrigo(user.id, {
      ingredient_id: ingredientId,
      quantite,
      unite: typeof body.unite === 'string' ? body.unite : 'g',
      expiration: typeof body.expiration === 'string' && body.expiration ? body.expiration : null,
    }, admin);

    const semaine = typeof body.semaine_debut === 'string' ? body.semaine_debut : getMonday();
    const listeRecalculee = await rafraichirListeCourses(user.id, semaine, admin);
    const items = await chargerFrigo(user.id, admin);

    return NextResponse.json({ success: true, items, liste_recalculee: listeRecalculee });
  } catch (error) {
    console.error('Erreur POST /api/frigo:', error);
    return NextResponse.json({ error: publicErrorMessage(error) }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const limited = enforceRateLimit(request, { name: 'frigo-delete', limit: 60, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const { user } = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    const userLimited = enforceUserRateLimit(request, user.id, { name: 'frigo-delete', limit: 60, windowMs: 60_000 });
    if (userLimited) return userLimited;

    const admin = getSupabaseAdmin();
    const rawId = request.nextUrl.searchParams.get('id');

    if (rawId === null) {
      await viderFrigo(user.id, admin);
    } else {
      const id = Number(rawId);
      if (!Number.isInteger(id) || id <= 0) {
        return NextResponse.json({ error: 'id invalide' }, { status: 400 });
      }
      await supprimerDuFrigo(user.id, id, admin);
    }

    const semaine = request.nextUrl.searchParams.get('semaine_debut') ?? getMonday();
    const listeRecalculee = await rafraichirListeCourses(user.id, semaine, admin);
    const items = await chargerFrigo(user.id, admin);

    return NextResponse.json({ success: true, items, liste_recalculee: listeRecalculee });
  } catch (error) {
    console.error('Erreur DELETE /api/frigo:', error);
    return NextResponse.json({ error: publicErrorMessage(error) }, { status: 500 });
  }
}
