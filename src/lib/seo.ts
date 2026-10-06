// Données structurées schema.org (JSON-LD) — PlanMyMeal

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://getplanmymeal.com').replace(/\/$/, '');

/** Sérialise pour une balise <script type="application/ld+json"> : `<` échappé
 *  pour qu'un titre de recette ne puisse jamais fermer la balise. */
export function serialiserJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

/** Slug SEO à partir d'un titre de recette (accents retirés, minuscules, tirets).
 *  Pas de colonne en base : calculé à la volée, donc toujours cohérent avec le titre actuel. */
export function slugify(titre: string): string {
  return titre
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** URL canonique d'une recette : /recette/{id}-{slug}. L'id seul reste résolu
 *  (voir [id]/page.tsx) mais redirige vers cette forme pour le SEO. */
export function recetteHref(meal: { id: number; titre: string }): string {
  const slug = slugify(meal.titre);
  return slug ? `/recette/${meal.id}-${slug}` : `/recette/${meal.id}`;
}

/** Extrait l'id numérique du paramètre de route /recette/[id], qu'il soit
 *  "123" (ancien format, toujours résolu) ou "123-curry-pois-chiches". */
export function parseRecetteId(param: string): number | null {
  const id = Number(param.split('-', 1)[0]);
  return Number.isInteger(id) && id > 0 ? id : null;
}
