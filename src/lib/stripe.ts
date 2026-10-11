// ============================================================================
// Configuration Stripe — Prix et plans
// ============================================================================

/**
 * Paiements ouverts. Coupe-circuit : NEXT_PUBLIC_STRIPE_ENABLED=false sur le
 * déploiement désactive tous les boutons d'abonnement (maintenance Stripe).
 */
export const STRIPE_ENABLED = process.env.NEXT_PUBLIC_STRIPE_ENABLED !== 'false';

// Features alignées sur la landing (src/app/page.tsx) : les deux écrans
// vendent le même produit — toute divergence serait un signal de méfiance.
// Limites du plan gratuit : lib/limites.ts (contrôlées côté serveur).
export const STRIPE_PLANS = {
  pro: {
    name: 'Pro',
    price: 5.99,
    /** Prix de l'abonnement annuel (facturé en une fois, 12 mois) */
    priceAnnuel: 49.99,
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_PRO || 'price_pro',
    features: [
      'Votre semaine complète et toute la liste de courses',
      'Optimisations de semaine illimitées',
      'Desserts planifiés, du rythme léger au Gourmand',
      'Changements de repas illimités',
      'Optimisations Budget, Gain de temps et Anti-gaspi',
      'Recettes avec votre frigo illimitées',
      'Semaines planifiées automatiquement chaque dimanche',
      'Prix max par portion et imports de recettes illimités',
    ],
    cta: 'Passer à Pro',
  },
  famille: {
    name: 'Famille',
    price: 9.99,
    priceAnnuel: 79.99,
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_FAMILLE || 'price_famille',
    features: [
      'Tout le plan Pro',
      '5 profils avec allergies et goûts de chacun',
      'Menus de compromis pour toute la famille',
      'Foyer partagé entre plusieurs comptes',
    ],
    cta: 'Passer à Famille',
  },
} as const;

export type PlanType = keyof typeof STRIPE_PLANS;

/** Périodicité de facturation : l'annuel est facturé en une fois, 12 mois d'accès. */
export type Periode = 'mensuel' | 'annuel';

const euros = (n: number) => n.toFixed(2).replace('.', ',');

/**
 * Prix d'un plan pour une périodicité, prêt à afficher.
 * `montant` = prix facturé (« 49,99 »), `unite` = « mois » ou « an », `parMois` =
 * équivalent mensuel (« 4,17 »), `economie` = remise annuelle en % (0 en mensuel).
 */
export function prixPlan(plan: PlanType, periode: Periode) {
  const p = STRIPE_PLANS[plan];
  if (periode === 'mensuel') {
    return { montant: euros(p.price), unite: 'mois' as const, parMois: euros(p.price), economie: 0 };
  }
  return {
    montant: euros(p.priceAnnuel),
    unite: 'an' as const,
    parMois: euros(p.priceAnnuel / 12),
    economie: Math.round(100 - (p.priceAnnuel / (p.price * 12)) * 100),
  };
}
