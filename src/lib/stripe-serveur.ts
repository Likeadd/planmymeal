// Client Stripe côté serveur — import dynamique : Stripe peut ne pas être
// configuré (clé absente) et ni la route ni le build ne doivent planter pour autant.
import type Stripe from 'stripe';

export async function getStripeClient(): Promise<Stripe | null> {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  const { default: StripeCtor } = await import('stripe');
  return new StripeCtor(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-06-30.basil' as Stripe.LatestApiVersion,
  });
}
