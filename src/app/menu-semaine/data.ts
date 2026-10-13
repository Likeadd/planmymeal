import { cache } from 'react';
import { getIndex } from '@/lib/catalogue-index';
import { composerMenu, varianteParSlug, type MenuPublic } from '@/lib/menu-public';
import { getMondayParis } from '@/lib/dates';

/** Menu de la semaine en cours pour une variante (composé une fois par rendu, partagé entre metadata et page). */
export const getMenuSemaine = cache(async (slug: string): Promise<MenuPublic | null> => {
  const variante = varianteParSlug(slug);
  if (!variante) return null;
  try {
    return composerMenu(await getIndex(), variante, getMondayParis());
  } catch {
    return null;
  }
});
