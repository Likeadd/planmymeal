import { cache } from 'react';
import { getIndex } from '@/lib/catalogue-index';
import { composerMenu, varianteDeLaSemaine, varianteParSlug, type MenuPublic } from '@/lib/menu-public';
import { getMondayMenu } from '@/lib/dates';

/** Menu de la semaine en cours pour une variante (composé une fois par rendu, partagé entre metadata et page). */
export const getMenuSemaine = cache(async (slug: string): Promise<MenuPublic | null> => {
  const variante = varianteParSlug(slug);
  if (!variante) return null;
  try {
    return composerMenu(await getIndex(), variante, getMondayMenu());
  } catch {
    return null;
  }
});

/**
 * Menu EXEMPLE de la semaine (page /menu-de-la-semaine) : un seul menu complet, de budget différent
 * chaque semaine, publié le lundi à 8 h. Graine distincte des pages /menu-semaine/[slug] pour ne pas
 * dupliquer leur contenu.
 */
export const getMenuExemple = cache(async (): Promise<MenuPublic | null> => {
  const lundi = getMondayMenu();
  try {
    return composerMenu(await getIndex(), varianteDeLaSemaine(lundi), lundi, `${lundi}|exemple`);
  } catch {
    return null;
  }
});
