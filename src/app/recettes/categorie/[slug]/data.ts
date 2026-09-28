import { cache } from 'react';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/../supabase/database.types';
import { chargerCatalogue } from '@/lib/catalogue';
import { toMealCatalogue, type MealCatalogue } from '@/lib/db-rows';

/**
 * Catalogue public complet, lu côté serveur pour les pages catégories SEO.
 * Même source que /recettes (chargerCatalogue) mais avec la clé de service —
 * jamais exposée au client — et mise en cache par rendu (`cache`) : une seule
 * requête partagée entre generateMetadata et la page.
 */
export const getCatalogueSeo = cache(async (): Promise<MealCatalogue[]> => {
  try {
    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const lignes = await chargerCatalogue(supabase);
    return lignes.map(toMealCatalogue);
  } catch {
    return [];
  }
});
