// Données structurées schema.org (JSON-LD) — PlanMyMeal

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://planmymeal.app').replace(/\/$/, '');

/** Sérialise pour une balise <script type="application/ld+json"> : `<` échappé
 *  pour qu'un titre de recette ne puisse jamais fermer la balise. */
export function serialiserJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
