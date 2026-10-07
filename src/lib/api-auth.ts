// ============================================================================
// Authentification des routes API — PlanMyMeal
//
// Toutes les routes API passent par ici (createServerClient + cookies +
// getUser) : une seule implémentation, un seul endroit à corriger si
// @supabase/ssr évolue. Un email non confirmé est traité comme non connecté.
// ============================================================================

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { Database } from '@/../supabase/database.types';

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

/**
 * Client Supabase lié à la session de l'appelant (clé anon + cookies), PAS au
 * rôle service. Nécessaire pour les RPC SECURITY DEFINER qui lisent
 * `auth.uid()` (household_invite, household_join…) : appelées avec le client
 * admin, `auth.uid()` y vaudrait toujours NULL. Le rate limiting et le contrôle
 * d'auth restent à la charge de l'appelant, comme pour `getAuthUser`.
 */
export async function getAuthUserAndClient(
  request: NextRequest
): Promise<{ user: User | null; error: string | null; supabase: SupabaseClient<Database> }> {
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          // Réponse déjà envoyée par le handler au moment où l'on écrit ici ;
          // un rafraîchissement de token est best-effort et sans conséquence
          // si perdu (le prochain appel re-rafraîchira).
          cookiesToSet.forEach(({ name, value, options }) => {
            try { request.cookies.set(name, value); void options; } catch { /* no-op */ }
          });
        },
      },
    }
  );

  const { data: { user }, error } = await supabase.auth.getUser();
  if (user && !user.email_confirmed_at) return { user: null, error: 'Email non confirmé', supabase };
  return { user: user ?? null, error: error?.message ?? null, supabase };
}

/** Vérifie `Authorization: Bearer <secret>` en temps constant (routes cron). */
export function bearerValide(auth: string | null, secret: string): boolean {
  const a = Buffer.from(auth ?? '');
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}
