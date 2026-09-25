// ============================================================================
// Edge Function : POST /create-checkout
// Crée une session Stripe Checkout pour l'abonnement Pro ou Famille
//
// Déploiement Supabase :
//   supabase functions deploy create-checkout
//   → Secrets requis : STRIPE_SECRET_KEY, STRIPE_PRICE_ID_PRO, STRIPE_PRICE_ID_FAMILLE
//   → JWT vérification : activée (l'utilisateur doit être connecté)
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')!;
const STRIPE_PRICE_ID_PRO = Deno.env.get('STRIPE_PRICE_ID_PRO')!;
const STRIPE_PRICE_ID_FAMILLE = Deno.env.get('STRIPE_PRICE_ID_FAMILLE')!;
// URL de retour fixe (jamais l'en-tête Origin, falsifiable) — secret APP_URL
const APP_URL = (Deno.env.get('APP_URL') ?? 'https://planmymeal.app').replace(/\/$/, '');

/** Erreur dont le message peut être montré à l'utilisateur. */
class PublicError extends Error {}

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2025-06-30.basil',
  httpClient: Stripe.createFetchHttpClient(),
});

const corsHeaders = {
  'Access-Control-Allow-Origin': APP_URL,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Récupérer le token JWT depuis le header Authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new PublicError('Authentification requise');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) throw new PublicError('Non authentifié');

    // Charger le profil
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('email, plan, stripe_customer_id')
      .eq('id', user.id)
      .single();

    if (!profile) throw new PublicError('Profil introuvable');

    const body = await req.json();
    const plan: 'pro' | 'famille' = body.plan === 'famille' ? 'famille' : 'pro';

    // Déterminer le price_id selon le plan
    const priceId = plan === 'famille'
      ? STRIPE_PRICE_ID_FAMILLE
      : STRIPE_PRICE_ID_PRO;

    // Créer ou récupérer le customer Stripe
    let customerId = profile.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: profile.email,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;

      // Sauvegarder le customer_id dans le profil — service role : la colonne
      // est verrouillée pour les clients (trigger guard_profiles_sensitive).
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        { auth: { persistSession: false } }
      );
      await supabaseAdmin
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id);
    }

    // Créer la session Checkout
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${APP_URL}/compte?success=true`,
      cancel_url: `${APP_URL}/compte?canceled=true`,
      metadata: {
        supabase_user_id: user.id,
        plan,
      },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: any) {
    console.error('Erreur create-checkout:', error?.message);
    const message = error instanceof PublicError
      ? error.message
      : 'Paiement momentanément indisponible. Réessayez dans un instant.';
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});