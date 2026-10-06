import { cache } from 'react';
import { getIndex } from '@/lib/catalogue-index';
import type { MealCatalogue } from '@/lib/db-rows';

/**
 * Catalogue public complet, lu côté serveur pour les pages catégories SEO.
 * Même source que /recettes (chargerCatalogue) mais avec la clé de service —
 * jamais exposée au client — et mise en cache par rendu (`cache`) : une seule
 * requête partagée entre generateMetadata et la page.
 */
export const getCatalogueSeo = cache(async (): Promise<MealCatalogue[]> => {
  try {
    return (await getIndex()).entrees.map(e => e.m);
  } catch {
    return [];
  }
});
