// ============================================================================
// Index du catalogue de recettes — côté SERVEUR
//
// /recettes ne télécharge plus tout le catalogue (≈ 10 Mo de JSON pour 6 000
// recettes) : le serveur le garde en mémoire (rechargé au plus toutes les
// heures, sans bloquer les requêtes une fois chaud) et ne renvoie que la page
// demandée (48 cartes ≈ 60 ko) avec les compteurs des filtres.
//
// Serveur uniquement : lit la base avec la clé de service (jamais exposée).
// ============================================================================

import { getSupabaseAdmin } from '@/lib/supabase';
import { chargerCatalogue } from '@/lib/catalogue';
import { toMealCatalogue, type MealCatalogue } from '@/lib/db-rows';
import { prixParPortion } from '@/lib/budget';
import { recetteServable, normaliserNom, type IngredientPourRegime } from '@/lib/regimes';
import { EQUIPEMENTS } from '@/types';
import type { Regime, Saison, TypeRepas } from '@/types';

export const TEMPS_MAX = [15, 30, 45, 60];
export const KCAL_MAX = [300, 500, 750];
export const PRIX_MAX = [2, 3, 5];
export const BATCH_MIN_JOURS = 3;
export const PROTEINES_MIN_G = 25;
export const REGIMES_FILTRES: Regime[] = [
  'vegetarien', 'vegan', 'pesco_vegetarien', 'sans_gluten', 'sans_lactose', 'sans_porc',
  'halal', 'sans_alcool', 'keto', 'low_carb', 'paleo', 'sans_sucre_ajoute',
];
export const TAILLE_PAGE_MAX = 96;

export type TriChamp = 'idees' | 'nom' | 'temps' | 'calories' | 'prix' | 'proteines';

export interface FiltresCatalogue {
  type: TypeRepas | 'tous';
  q: string;
  equipement: string;
  difficulte: string;
  cuisine: string;
  saison: Saison | 'toutes';
  tempsMax: number | null;
  kcalMax: number | null;
  prixMax: number | null;
  batch: boolean;
  proteines: boolean;
  regimes: Regime[];
  tri: TriChamp;
}

export interface Facettes {
  total: number;
  cuisines: string[];
  /** Nombre de recettes par cuisine (page d'accueil) */
  parCuisine: Record<string, number>;
  types: Record<string, number>;
  equipements: Record<string, number>;
  temps: Record<number, number>;
  kcal: Record<number, number>;
  prix: Record<number, number>;
  batch: number;
  proteines: number;
  regimes: Record<string, number>;
}

interface Entree {
  m: MealCatalogue;
  temps: number;
  prix: number | null;
  haystack: string;
  titreNorm: string;
  ingredientsRegime: IngredientPourRegime[];
}

interface Index {
  entrees: Entree[];
  facettes: Facettes;
  charge: number;
}

const DUREE_VALIDE_MS = 60 * 60_000;
let index: Index | null = null;
let enCours: Promise<Index> | null = null;

const equipementOk = (m: MealCatalogue, eq: string) => (m.ustensiles || []).some(u => u === eq || u.startsWith(eq));

function construire(meals: MealCatalogue[]): Index {
  const entrees: Entree[] = meals.map(m => ({
    m,
    temps: m.temps_preparation + (m.temps_cuisson || 0),
    prix: prixParPortion(m),
    titreNorm: normaliserNom(m.titre),
    haystack: `${normaliserNom(m.titre)} ${m.ingredients.map(li => normaliserNom(li.ingredient.nom)).join(' ')}`,
    ingredientsRegime: m.ingredients.map(li => ({
      id: li.ingredient.id, nom: li.ingredient.nom, rayon: li.ingredient.rayon, est_optionnel: li.est_optionnel,
    })),
  }));

  const compte = (pred: (e: Entree) => boolean) => entrees.reduce((n, e) => n + (pred(e) ? 1 : 0), 0);
  const facettes: Facettes = {
    total: entrees.length,
    cuisines: Array.from(new Set(meals.map(m => m.cuisine).filter(Boolean))).sort() as string[],
    parCuisine: {},
    types: {},
    equipements: Object.fromEntries(EQUIPEMENTS.map(eq => [eq, compte(e => equipementOk(e.m, eq))])),
    temps: Object.fromEntries(TEMPS_MAX.map(v => [v, compte(e => e.temps <= v)])),
    kcal: Object.fromEntries(KCAL_MAX.map(v => [v, compte(e => (e.m.calories_par_portion ?? Infinity) <= v)])),
    prix: Object.fromEntries(PRIX_MAX.map(v => [v, compte(e => (e.prix ?? Infinity) <= v)])),
    batch: compte(e => (e.m.conservation_jours ?? 0) >= BATCH_MIN_JOURS),
    proteines: compte(e => (e.m.proteines ?? 0) >= PROTEINES_MIN_G),
    regimes: Object.fromEntries(REGIMES_FILTRES.map(r => [r, compte(e => recetteServable(e.ingredientsRegime, [r]))])),
  };
  for (const m of meals) {
    facettes.types[m.type_repas] = (facettes.types[m.type_repas] ?? 0) + 1;
    if (m.cuisine) facettes.parCuisine[m.cuisine] = (facettes.parCuisine[m.cuisine] ?? 0) + 1;
  }
  return { entrees, facettes, charge: Date.now() };
}

async function recharger(): Promise<Index> {
  const lignes = await chargerCatalogue(getSupabaseAdmin());
  index = construire(lignes.map(toMealCatalogue));
  return index;
}

/** Index en mémoire : chargé une fois, rafraîchi en arrière-plan passé une heure. */
export async function getIndex(): Promise<Index> {
  if (index) {
    if (Date.now() - index.charge > DUREE_VALIDE_MS && !enCours) {
      enCours = recharger().catch(() => index!).finally(() => { enCours = null; });
    }
    return index;
  }
  enCours ??= recharger().finally(() => { enCours = null; });
  return enCours;
}

/** Rang pseudo-aléatoire d'une recette, stable pendant une semaine */
function melangeSemaine(id: number): number {
  const semaine = Math.floor(Date.now() / (7 * 24 * 3600 * 1000));
  let h = (id * 2654435761 + semaine * 40503) >>> 0;
  h ^= h >>> 15; h = Math.imul(h, 2246822507) >>> 0; h ^= h >>> 13;
  return h;
}

const collator = new Intl.Collator('fr');

/** Filtre, trie et découpe : renvoie la page demandée et le total des résultats. */
export function interroger(idx: Index, f: FiltresCatalogue, offset: number, limite: number): { total: number; items: MealCatalogue[] } {
  const q = normaliserNom(f.q.trim());
  const res = idx.entrees.filter(e => {
    const m = e.m;
    if (f.type !== 'tous' && m.type_repas !== f.type) return false;
    if (q && !e.haystack.includes(q)) return false;
    if (f.equipement !== 'tous' && !equipementOk(m, f.equipement)) return false;
    if (f.difficulte !== 'toutes' && m.difficulte !== f.difficulte) return false;
    if (f.cuisine !== 'toutes' && m.cuisine !== f.cuisine) return false;
    if (f.saison !== 'toutes' && m.saison !== f.saison) return false;
    if (f.tempsMax != null && e.temps > f.tempsMax) return false;
    if (f.kcalMax != null && (m.calories_par_portion ?? Infinity) > f.kcalMax) return false;
    if (f.prixMax != null && (e.prix ?? Infinity) > f.prixMax) return false;
    if (f.batch && !((m.conservation_jours ?? 0) >= BATCH_MIN_JOURS)) return false;
    if (f.proteines && !((m.proteines ?? 0) >= PROTEINES_MIN_G)) return false;
    if (f.regimes.length > 0 && !recetteServable(e.ingredientsRegime, f.regimes)) return false;
    return true;
  });
  const nom = (a: Entree, b: Entree) => collator.compare(a.m.titre, b.m.titre);
  res.sort((a, b) => {
    switch (f.tri) {
      case 'temps': return a.temps - b.temps || nom(a, b);
      case 'calories': return (a.m.calories_par_portion || 9999) - (b.m.calories_par_portion || 9999) || nom(a, b);
      case 'prix': return (a.prix ?? Infinity) - (b.prix ?? Infinity) || nom(a, b);
      case 'proteines': return (b.m.proteines ?? -1) - (a.m.proteines ?? -1) || nom(a, b);
      case 'nom': return nom(a, b);
      default: return melangeSemaine(a.m.id) - melangeSemaine(b.m.id);
    }
  });
  return { total: res.length, items: res.slice(offset, offset + limite).map(e => e.m) };
}
