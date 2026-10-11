// ============================================================================
// POST /api/abonnement/resilier   { action: 'resilier' | 'reprendre' }
// Résiliation en un clic depuis le compte (aucun motif, aucun frais, pas de
// passage par le support). L'accès reste ouvert jusqu'à la fin de la période
// payée ; l'utilisateur reçoit une confirmation par email (support durable).
// 'reprendre' annule une résiliation programmée tant que la période court.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { enforceRateLimit, enforceUserRateLimit } from '@/lib/rate-limit';
import { getStripeClient } from '@/lib/stripe-serveur';
import { dateFr, etatDepuisStripe } from '@/lib/abonnement';
import { sendEmail } from '@/lib/email';
import { abonnementEmailHtml } from '@/lib/email-templates';
import { SITE_URL } from '@/lib/seo';
import { EMAIL_CONTACT } from '@/lib/legal';
import { publicErrorMessage } from '@/lib/utils';

export async function POST(request: NextRequest) {
  const limited = await enforceRateLimit(request, { name: 'abonnement-resilier', limit: 10, windowMs: 60_000 });
  if (limited) return limited;
  try {
    const { user } = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    const userLimited = await enforceUserRateLimit(request, user.id, { name: 'abonnement-resilier', limit: 10, windowMs: 60_000 });
    if (userLimited) return userLimited;

    const body = await request.json().catch(() => ({}));
    const resilier = body?.action !== 'reprendre';

    const { data: profile } = await getSupabaseAdmin()
      .from('profiles').select('stripe_subscription_id, email').eq('id', user.id).single();
    const subId = profile?.stripe_subscription_id;
    if (!subId) return NextResponse.json({ error: 'Aucun abonnement actif.' }, { status: 400 });

    const stripe = await getStripeClient();
    if (!stripe) return NextResponse.json({ error: 'Facturation momentanément indisponible.' }, { status: 503 });

    const sub = await stripe.subscriptions.update(subId, { cancel_at_period_end: resilier });
    const etat = etatDepuisStripe(sub);

    const destinataire = profile?.email ?? user.email;
    if (destinataire && etat.fin) {
      void sendEmail({
        to: destinataire,
        subject: resilier ? 'Votre résiliation PlanMyMeal est confirmée' : 'Votre abonnement PlanMyMeal est réactivé',
        html: abonnementEmailHtml({
          titre: resilier ? 'Résiliation confirmée' : 'Abonnement réactivé',
          paragraphes: resilier
            ? [`Nous avons bien enregistré votre résiliation. Vous gardez l’accès à toutes les fonctions de votre abonnement jusqu’au ${dateFr(etat.fin)}, puis votre compte repassera en formule gratuite. Aucun nouveau prélèvement ne sera effectué.`,
               `Vous avez changé d’avis ? Vous pouvez réactiver votre abonnement depuis la page Compte avant cette date. Une question : ${EMAIL_CONTACT}.`]
            : [`Votre abonnement continue normalement : prochaine échéance le ${dateFr(etat.fin)}.`],
        }, SITE_URL),
        replyTo: EMAIL_CONTACT,
      });
    }

    return NextResponse.json(etat);
  } catch (error) {
    console.error('Erreur résiliation:', error);
    return NextResponse.json({ error: publicErrorMessage(error) }, { status: 500 });
  }
}
