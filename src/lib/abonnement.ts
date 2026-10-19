// ============================================================================
// Abonnement — état lu chez Stripe (source de vérité) pour la page Compte et
// les routes de résiliation / rétractation.
// ============================================================================

import type Stripe from 'stripe';
import { DELAI_RETRACTATION_JOURS } from '@/lib/legal';

export interface EtatAbonnement {
  actif: boolean;
  periode?: 'mensuel' | 'annuel';
  /** ISO — fin de la période payée en cours (dernier jour d'accès si résilié) */
  fin?: string;
  resiliationProgrammee?: boolean;
  /** ISO — dernier instant pour se rétracter ; null une fois le délai passé */
  retractationJusquau?: string | null;
}

export function etatDepuisStripe(sub: Stripe.Subscription, maintenant = Date.now()): EtatAbonnement {
  if (sub.status === 'canceled' || sub.status === 'incomplete_expired') return { actif: false };
  const item = sub.items.data[0];
  const finSec = item?.current_period_end;
  const limiteMs = (sub.start_date + DELAI_RETRACTATION_JOURS * 86_400) * 1000;
  return {
    actif: true,
    periode: item?.price.recurring?.interval === 'year' ? 'annuel' : 'mensuel',
    fin: finSec ? new Date(finSec * 1000).toISOString() : undefined,
    resiliationProgrammee: sub.cancel_at_period_end === true,
    retractationJusquau: maintenant < limiteMs ? new Date(limiteMs).toISOString() : null,
  };
}

export const dateFr = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' });

/**
 * Montant à rembourser (centimes) lors d'une rétractation (audit VULN-003) :
 *   - première rétractation du client : 100 % (geste commercial annoncé dans les CGV) ;
 *   - rétractations suivantes : au prorata du service non fourni (art. L221-25 du Code de la consommation,
 *     l'exécution immédiate ayant été demandée au paiement) — empêche « s'abonner / se rétracter » en boucle.
 */
export function montantRemboursement(
  montant: number, debutSec: number, finSec: number, maintenantMs: number, dejaRetracte: boolean,
): number {
  if (!dejaRetracte) return montant;
  const duree = Math.max(1, finSec - debutSec);
  const utilise = Math.min(1, Math.max(0, (maintenantMs / 1000 - debutSec) / duree));
  return Math.max(0, Math.round(montant * (1 - utilise)));
}
