// ============================================================================
// Authentification des routes API — PlanMyMeal
//
// Toutes les routes API passent par ici (createServerClient + cookies +
// getUser) : une seule implémentation, un seul endroit à corriger si
// @supabase/ssr évolue. Un email non confirmé est traité comme non connecté.
// ============================================================================

import { createServerClient } from '@supabase/ssr';
import type { NextRequest } from 'next/server';
import type { User } from '@supabase/supabase-js';

/** Client Supabase lié aux cookies de la requête + utilisateur éventuel. */
export async function getAuthUser(
  request: NextRequest
): Promise<{ user: User | null; error: string | null }> {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll() { /* pas besoin d'écrire depuis une API */ },
      },
    }
  );

  const { data: { user }, error } = await supabase.auth.getUser();
  // Email non confirmé → traité comme non authentifié
  if (user && !user.email_confirmed_at) return { user: null, error: 'Email non confirmé' };
  return { user: user ?? null, error: error?.message ?? null };
}
