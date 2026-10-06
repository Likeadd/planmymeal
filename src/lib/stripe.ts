// ============================================================================
// Configuration Stripe — Prix et plans
// ============================================================================

/**
 * Interrupteur des paiements : activé par NEXT_PUBLIC_STRIPE_ENABLED=true sur
 * le déploiement, une fois les clés, les prix et le webhook Stripe en place.
 * Tant qu'il est faux, aucun bouton ne déclenche de checkout : le paywall
 * s'affiche mais indique que l'abonnement ouvre bientôt.
 */
export const STRIPE_ENABLED = process.env.NEXT_PUBLIC_STRIPE_ENABLED === 'true';

// Features alignées sur la landing (src/app/page.tsx) : les deux écrans
// vendent le même produit — toute divergence serait un signal de méfiance.
// Limites du plan gratuit : lib/limites.ts (contrôlées côté serveur).
export const STRIPE_PLANS = {
  pro: {
    name: 'Pro',
    price: 5.99,
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
