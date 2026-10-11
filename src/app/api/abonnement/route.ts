// ============================================================================
// GET /api/abonnement — état de l'abonnement (périodicité, fin de période,
// résiliation programmée, délai de rétractation) lu chez Stripe.
// 🔒 L'identifiant vient de la session serveur, jamais du client.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { enforceRateLimit, enforceUserRateLimit } from '@/lib/rate-limit';
import { getStripeClient } from '@/lib/stripe-serveur';
import { etatDepuisStripe } from '@/lib/abonnement';
import { publicErrorMessage } from '@/lib/utils';

export async function GET(request: NextRequest) {
  const limited = await enforceRateLimit(request, { name: 'abonnement', limit: 30, windowMs: 60_000 });
  if (limited) return limited;
  try {
    const { user } = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    const userLimited = await enforceUserRateLimit(request, user.id, { name: 'abonnement', limit: 30, windowMs: 60_000 });
    if (userLimited) return userLimited;

    const { data: profile } = await getSupabaseAdmin()
      .from('profiles').select('stripe_subscription_id').eq('id', user.id).single();
    const subId = profile?.stripe_subscription_id;
    if (!subId) return NextResponse.json({ actif: false });

    const stripe = await getStripeClient();
    if (!stripe) return NextResponse.json({ error: 'Facturation momentanément indisponible.' }, { status: 503 });

    const sub = await stripe.subscriptions.retrieve(subId);
    return NextResponse.json(etatDepuisStripe(sub));
  } catch (error) {
    console.error('Erreur abonnement:', error);
    return NextResponse.json({ error: publicErrorMessage(error) }, { status: 500 });
  }
}
