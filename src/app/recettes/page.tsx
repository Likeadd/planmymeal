import { getIndex, interroger } from '@/lib/catalogue-index';
import RecettesClient, { type CatalogueInitial } from './RecettesClient';

// Première tranche rendue côté serveur et mise en cache (ISR 5 min) :
// les recettes sont dans le HTML, sans aller-retour /api/recettes au chargement.
export const revalidate = 300;

const TRANCHE_GRILLE = 48;

async function chargerInitial(): Promise<CatalogueInitial | null> {
  try {
    const idx = await getIndex();
    const { total, items } = interroger(idx, {
      type: 'tous', q: '', equipement: 'tous', difficulte: 'toutes', cuisine: 'toutes', saison: 'toutes',
      tempsMax: null, kcalMax: null, prixMax: null, batch: false, proteines: false, regimes: [], tri: 'idees',
    }, 0, TRANCHE_GRILLE);
    return { total, items, facettes: idx.facettes };
  } catch {
    return null; // Catalogue indisponible : le client retente via l'API.
  }
}

export default async function RecettesPage() {
  return <RecettesClient initial={await chargerInitial()} />;
}
