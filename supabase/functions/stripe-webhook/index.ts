// ============================================================================
// Edge Function : POST /stripe-webhook
// Reçoit les événements Stripe et met à jour le profil utilisateur
//
// Déploiement Supabase :
//   supabase functions deploy stripe-webhook
//   → Secrets requis : STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
//   → JWT vérification : DÉSACTIVÉE (appelée par Stripe, pas par l'utilisateur)
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')!;
const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2025-06-30.basil',
  httpClient: Stripe.createFetchHttpClient(),
});

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req: Request) => {
  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return new Response(JSON.stringify({ error: 'Signature manquante' }), { status: 400 });
  }

  try {
    const body = await req.text();
    const event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      STRIPE_WEBHOOK_SECRET
    );

    console.log(`📦 Événement Stripe reçu : ${event.type}`);

    switch (event.type) {
      // ── Paiement réussi → activer le plan ──────────
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata?.supabase_user_id;
        const plan = session.metadata?.plan || 'pro';
        const subscriptionId = session.subscription as string;
        const customerId = session.customer as string;

        if (!userId) {
          console.error('❌ Pas de supabase_user_id dans les metadata');
          break;
        }

        const { error } = await supabaseAdmin
          .from('profiles')
          .update({
            plan,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
          })
          .eq('id', userId);

        if (error) {
          console.error('❌ Erreur mise à jour profil:', error.message);
        } else {
          console.log(`✅ Utilisateur ${userId} → plan ${plan}`);
        }
        break;
      }

      // ── Abonnement annulé ou expiré → retour au gratuit ─
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const customerId = subscription.customer as string;

        const { data: profiles, error: findError } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', customerId);

        if (findError || !profiles?.length) {
          console.error('❌ Aucun utilisateur trouvé pour le customer:', customerId);
          break;
        }

        const { error } = await supabaseAdmin
          .from('profiles')
          .update({
            plan: 'gratuit',
            stripe_subscription_id: null,
          })
          .eq('stripe_customer_id', customerId);

        if (error) {
          console.error('❌ Erreur retour au gratuit:', error.message);
        } else {
          console.log(`✅ Customer ${customerId} → gratuit`);
        }
        break;
      }

      // ── Abonnement mis à jour (upgrade/downgrade) ──
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const customerId = subscription.customer as string;
        const status = subscription.status;

        // Si l'abonnement est actif, on garde le plan (déjà défini au checkout)
        // Si past_due/unpaid, on pourrait downgrader, mais on laisse Stripe gérer
        if (status === 'active') {
          console.log(`✅ Abonnement actif pour customer ${customerId}`);
        }
        break;
      }
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (error: any) {
    console.error('❌ Erreur webhook:', error.message);
    return new Response(JSON.stringify({ error: 'Webhook invalide' }), { status: 400 });
  }
});