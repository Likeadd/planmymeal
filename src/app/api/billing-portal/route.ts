import type Stripe from 'stripe';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { publicErrorMessage } from '@/lib/utils';
import { enforceRateLimit, enforceUserRateLimit } from '@/lib/rate-limit';
import { STRIPE_ENABLED } from '@/lib/stripe';

// Import dynamique : Stripe peut ne pas être configuré (clé absente) — la
// route (et donc le build, qui charge ce module pour collecter les métadonnées
// de page) ne doit jamais planter pour autant. `new Stripe(undefined!, …)` au
// niveau module lève immédiatement et cassait tout le build sur Vercel dès que
// STRIPE_SECRET_KEY manquait pour l'environnement déployé (preview/prod).
async function getStripeClient(): Promise<Stripe | null> {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  const { default: StripeCtor } = await import('stripe');
  return new StripeCtor(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-06-30.basil' as Stripe.LatestApiVersion,
  });
}

/**
 * POST /api/billing-portal — crée une session du portail client Stripe.
 *
 * 🔒 SÉCURITÉ : l'ID utilisateur vient TOUJOURS de la session serveur
 * (cookie Supabase), jamais du body. La version précédente acceptait un
 * `user_id` du client → n'importe quel utilisateur authentifié pouvait
 * ouvrir le portail de facturation d'un autre (faille IDOR critique).
 */
export async function POST(request: NextRequest) {
  if (!STRIPE_ENABLED) {
    return NextResponse.json({ error: 'Facturation momentanément indisponible.' }, { status: 503 });
  }

  // Anti-abus : chaque appel consomme un quota d'API Stripe
  const limited = await enforceRateLimit(request, { name: 'billing-portal', limit: 10, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const { user } = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    const userLimited = await enforceUserRateLimit(request, user.id, { name: 'billing-portal', limit: 10, windowMs: 60_000 });
    if (userLimited) return userLimited;

    const stripe = await getStripeClient();
    if (!stripe) {
      console.error('Erreur billing portal: STRIPE_SECRET_KEY manquante');
      return NextResponse.json({ error: 'Facturation momentanément indisponible.' }, { status: 503 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single();

    const customerId = profile?.stripe_customer_id ?? null;

    if (profileError || !customerId) {
      return NextResponse.json({ error: 'Pas de compte Stripe associé' }, { status: 400 });
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin}/compte`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (error) {
    console.error('Erreur billing portal:', error);
    return NextResponse.json({ error: publicErrorMessage(error) }, { status: 500 });
  }
}
