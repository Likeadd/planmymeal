// ============================================================================
// GET /api/compte/export — droit à la portabilité (RGPD art. 20) : toutes les
// données rattachées au compte connecté, au format JSON structuré et lisible.
// Lecture seule, identifiant issu de la SESSION (jamais d'un paramètre).
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getAuthUser } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { publicErrorMessage } from '@/lib/utils';
import { enforceRateLimit, enforceUserRateLimit } from '@/lib/rate-limit';

/** Tables liées au compte par `user_id` (table → colonne de rattachement) */
const TABLES_UTILISATEUR = [
  'user_allergies', 'user_allergy_families', 'user_diets', 'user_dislikes', 'user_dislike_families',
  'user_meal_preferences', 'user_prix_ingredients', 'family_members', 'fridge_items',
  'meal_history', 'weekly_budget_snapshots', 'recipe_requests', 'household_members',
] as const;

export async function GET(request: NextRequest) {
  const limited = await enforceRateLimit(request, { name: 'compte-export', limit: 10, windowMs: 60_000 });
  if (limited) return limited;
  try {
    const { user } = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    const userLimited = await enforceUserRateLimit(request, user.id, { name: 'compte-export', limit: 5, windowMs: 60 * 60_000 });
    if (userLimited) return userLimited;

    // Client non typé : lecture générique de tables listées ci-dessus
    const admin = getSupabaseAdmin() as unknown as SupabaseClient;
    const lire = async (requete: PromiseLike<{ data: unknown; error: { message: string } | null }>) => {
      const { data, error } = await requete;
      if (error) throw new Error(error.message);
      return data;
    };

    const donnees: Record<string, unknown> = {
      export_genere_le: new Date().toISOString(),
      compte: {
        id: user.id, email: user.email, cree_le: user.created_at, derniere_connexion: user.last_sign_in_at,
        cgu_acceptees_le: (user.user_metadata as Record<string, unknown> | null)?.cgu_acceptees_le ?? null,
      },
      profil: await lire(admin.from('profiles').select('*').eq('id', user.id).maybeSingle()),
      plannings: await lire(admin.from('weekly_plans').select('*, plan_meals(*)').eq('user_id', user.id)),
      listes_de_courses: await lire(admin.from('shopping_lists').select('*, shopping_list_items(*)').eq('user_id', user.id)),
      recettes_creees: await lire(admin.from('meals').select('*').eq('created_by', user.id)),
    };
    for (const table of TABLES_UTILISATEUR) {
      donnees[table] = await lire(admin.from(table).select('*').eq('user_id', user.id));
    }

    return new NextResponse(JSON.stringify(donnees, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': 'attachment; filename="mes-donnees-planmymeal.json"',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Erreur GET /api/compte/export:', error);
    return NextResponse.json({ error: publicErrorMessage(error) }, { status: 500 });
  }
}
