// ============================================================================
// Configuration Stripe — Prix et plans
// ============================================================================

// Features alignées sur la landing (src/app/page.tsx) : les deux écrans
// vendent le même produit — toute divergence serait un signal de méfiance.
// Rappel des gates réels : générations 4/7j en gratuit (api/generate-week),
// prix max par portion refusé en 403 si gratuit (api/budget).
export const STRIPE_PLANS = {
  pro: {
    name: 'Pro',
    price: 5.99,
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_PRO || 'price_pro',
    features: [
      'Générations illimitées',
      'Rotation mémoire 21 jours complète',
      'Desserts planifiés & batch cooking',
      'Prix max par portion & macros détaillées',
      'Recettes personnelles illimitées',
    ],
    cta: 'Passer à Pro',
  },
  famille: {
    name: 'Famille',
    price: 9.99,
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_FAMILLE || 'price_famille',
    features: [
      'Tout le plan Pro',
      '5 profils avec allergies & dégoûts',
      'Menus de compromis négociés par le moteur',
      'Planning collaboratif',
      'Courses partagées',
    ],
    cta: 'Passer à Famille',
  },
} as const;

export type PlanType = keyof typeof STRIPE_PLANS;
