// ============================================================================
// POST /api/abonnement/retractation
// Droit de rétractation de 14 jours (art. L221-18) : accordé sans condition,
// remboursement INTÉGRAL même si le service a été utilisé pendant le délai.
// Ordre des opérations : 1) résiliation immédiate (plus aucun prélèvement
// possible), 2) retour au plan gratuit, 3) remboursement du dernier paiement.
// Si le remboursement échoue après la résiliation, l'utilisateur en est
// informé et l'erreur est journalisée pour un traitement manuel : on ne
// prend jamais le risque de rembourser sans avoir stoppé la facturation.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { enforceRateLimit, enforceUserRateLimit } from '@/lib/rate-limit';
import { getStripeClient } from '@/lib/stripe-serveur';
import { etatDepuisStripe, montantRemboursement } from '@/lib/abonnement';
import { sendEmail } from '@/lib/email';
import { abonnementEmailHtml } from '@/lib/email-templates';
import { SITE_URL } from '@/lib/seo';
import { DELAI_RETRACTATION_JOURS, EMAIL_CONTACT } from '@/lib/legal';
import { publicErrorMessage } from '@/lib/utils';

export async function POST(request: NextRequest) {
  const limited = await enforceRateLimit(request, { name: 'abonnement-retractation', limit: 5, windowMs: 60_000 });
  if (limited) return limited;
  try {
    const { user } = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    const userLimited = await enforceUserRateLimit(request, user.id, { name: 'abonnement-retractation', limit: 5, windowMs: 60_000 });
    if (userLimited) return userLimited;

    const admin = getSupabaseAdmin();
    const { data: profile } = await admin
      .from('profiles').select('stripe_subscription_id, stripe_customer_id, email').eq('id', user.id).single();
    const subId = profile?.stripe_subscription_id;
    const customerId = profile?.stripe_customer_id;
    if (!subId || !customerId) return NextResponse.json({ error: 'Aucun abonnement actif.' }, { status: 400 });

    const stripe = await getStripeClient();
    if (!stripe) return NextResponse.json({ error: 'Facturation momentanément indisponible.' }, { status: 503 });

    const sub = await stripe.subscriptions.retrieve(subId);
    const etat = etatDepuisStripe(sub);
    if (!etat.actif) return NextResponse.json({ error: 'Aucun abonnement actif.' }, { status: 400 });
    if (!etat.retractationJusquau) {
      return NextResponse.json({
        error: `Le délai de rétractation de ${DELAI_RETRACTATION_JOURS} jours est dépassé. Vous pouvez résilier à tout moment : l’accès reste ouvert jusqu’à la fin de la période payée.`,
      }, { status: 409 });
    }

    // Rétractation déjà exercée par ce client ? (abonnements annulés marqués « retractation »)
    const anciens = await stripe.subscriptions.list({ customer: customerId, status: 'canceled', limit: 20 });
    const dejaRetracte = anciens.data.some(s => s.metadata?.retractation === 'oui');

    // 1) Plus aucun prélèvement possible (marqué pour les prochaines rétractations)
    await stripe.subscriptions.update(subId, { metadata: { ...sub.metadata, retractation: 'oui' } });
    await stripe.subscriptions.cancel(subId);
    // 2) Retour au plan gratuit tout de suite (le webhook ferait de même)
    await admin.from('profiles').update({ plan: 'gratuit', stripe_subscription_id: null }).eq('id', user.id);

    // 3) Remboursement intégral du paiement qui a ouvert l'abonnement
    let rembourse = false;
    let remboursementPartiel = false;
    try {
      const charges = await stripe.charges.list({ customer: customerId, limit: 10 });
      const paiement = charges.data.find(c => c.status === 'succeeded' && !c.refunded && c.created >= sub.start_date - 3600);
      if (paiement) {
        const item = sub.items.data[0];
        const montant = montantRemboursement(
          paiement.amount, item?.current_period_start ?? sub.start_date, item?.current_period_end ?? sub.start_date,
          Date.now(), dejaRetracte,
        );
        if (montant > 0) {
          await stripe.refunds.create(
            { charge: paiement.id, amount: montant, reason: 'requested_by_customer' },
            { idempotencyKey: `retractation-${subId}` },
          );
        }
        rembourse = true;
        remboursementPartiel = montant < paiement.amount;
      }
    } catch (e) {
      console.error('[retractation] remboursement à traiter MANUELLEMENT', { userId: user.id, subId, erreur: e instanceof Error ? e.message : e });
    }
    if (!rembourse) console.error('[retractation] aucun remboursement effectué — à traiter MANUELLEMENT', { userId: user.id, subId });

    const destinataire = profile?.email ?? user.email;
    if (destinataire) {
      void sendEmail({
        to: destinataire,
        subject: 'Votre rétractation PlanMyMeal est enregistrée',
        html: abonnementEmailHtml({
          titre: 'Rétractation enregistrée',
          paragraphes: [
            'Nous avons bien enregistré votre rétractation : votre abonnement est terminé et votre compte est repassé en formule gratuite.',
            rembourse && !remboursementPartiel
              ? 'La totalité des sommes versées vous est remboursée sur le moyen de paiement utilisé ; le crédit apparaît sous quelques jours selon votre banque (14 jours maximum).'
              : rembourse
              ? 'Ayant déjà exercé votre droit de rétractation lors d’un précédent abonnement, vous êtes remboursé au prorata de la période non utilisée (article L221-25 du Code de la consommation), sur le moyen de paiement utilisé, sous 14 jours maximum.'
              : `Votre remboursement intégral est en cours de traitement manuel : vous serez recontacté sous 48 h. En cas de doute, écrivez-nous à ${EMAIL_CONTACT}.`,
          ],
        }, SITE_URL),
        replyTo: EMAIL_CONTACT,
      });
    }

    return NextResponse.json({ ok: true, rembourse, partiel: remboursementPartiel });
  } catch (error) {
    console.error('Erreur rétractation:', error);
    return NextResponse.json({ error: publicErrorMessage(error) }, { status: 500 });
  }
}
