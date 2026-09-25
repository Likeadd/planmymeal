// ============================================================================
// Checkout Stripe — redirection vers la page de paiement hébergée
// ============================================================================

import { createBrowserClient } from '@/lib/supabase';
import { STRIPE_ENABLED } from '@/lib/stripe';

/**
 * Redirige vers la page de checkout Stripe pour le plan choisi
 */
export async function redirectToCheckout(plan: 'pro' | 'famille') {
  // Garde de sécurité : aucun bouton de l'app n'appelle cette fonction tant
  // que STRIPE_ENABLED est à false, mais on la bloque aussi ici en dernier
  // recours (défense en profondeur).
  if (!STRIPE_ENABLED) throw new Error('Les paiements ne sont pas encore ouverts.');

  // Appel à l'Edge Function Supabase
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  // JWT de l'utilisateur connecté (la fonction vérifie son identité)
  const { data: { session: authSession } } = await createBrowserClient().auth.getSession();
  if (!authSession) throw new Error('Connectez-vous pour vous abonner.');

  const session = await fetch(
    `${supabaseUrl}/functions/v1/create-checkout`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authSession.access_token}`,
        'apikey': supabaseAnonKey,
      },
      body: JSON.stringify({ plan }),
    }
  );

  const { url, error } = await session.json();

  if (error) throw new Error(error);
  if (url) window.location.href = url;
}