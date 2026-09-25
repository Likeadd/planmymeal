// ============================================================================
// Filtre régimes — végan, végétarien, halal, sans porc, sans alcool, etc.
// Fonction PURE (testable) : à partir des ingrédients d'une recette et d'une
// liste de régimes, retourne les ingrédients interdits.
//
// Modèle de données : ingredients.rayon ('viande_poisson' | 'frais' | ...)
// + noms normalisés (minuscules, sans accents) pour les cas précis
// (porc, alcool, poisson…).
// ============================================================================

import type { Regime } from '@/types';

/** minuscules + suppression des accents + ligature œ → oe (côte de porc → cote de porc, œuf → oeuf) */
export function normaliserNom(nom: string): string {
  return nom
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/œ/g, 'oe');
}

/** Au moins un motif est contenu dans le nom (déjà normalisé) */
function match(nomNormalise: string, motifs: string[]): boolean {
  return motifs.some(m => nomNormalise.includes(m));
}

// ─── Familles d'ingrédients ─────────────────────────────────────────────────

const VIANDE = ['porc', 'lardon', 'bacon', 'jambon', 'chorizo', 'boeuf', 'veau', 'agneau', 'poulet', 'dinde', 'canard', 'saucisse', 'merguez', 'filet mignon', 'roti de', 'viande hachee', 'steak', 'rumsteck', 'faux-filet', 'magret', 'pilons', 'echine', 'paupiette', 'blanc de'];
const POISSON = ['saumon', 'cabillaud', 'merlu', 'colin', 'thon', 'truite', 'bar ', 'dorade', 'sole', 'moules', 'crevettes', 'gambas', 'calamar', 'encornet', 'sardine', 'maquereau', 'lieu', 'cabri', 'saumon fume', 'surimi', 'bulot'];
const PRODUITS_ANIMAUX = ['oeuf', 'jaune d', 'lait', 'creme', 'beurre', 'yaourt', 'fromage', 'parmesan', 'mozzarella', 'gruyere', 'cheddar', 'reblochon', 'mascarpone', 'feta', 'ricotta', 'chevre', 'roquefort', 'comte', 'emmental', 'miel'];
const PORC = ['porc', 'lardon', 'bacon', 'jambon', 'chorizo', 'saucisse de toulouse', 'echine', 'roti de porc', 'cote de porc', 'filet mignon', 'paupiette', 'gelatine', 'saindoux'];
const ALCOOL = ['vin blanc', 'vin rouge', 'vin cuit', 'biere', 'rhum', 'whisky', 'cognac', 'armagnac', 'porto', 'madeira', 'marsala', 'cidre', 'liqueur', 'grand marnier', 'cointreau', 'kir'];

export interface IngredientPourRegime {
  id: number;
  nom: string;
  rayon: string | null;
  est_optionnel?: boolean;
}

/**
 * Ingrédients interdits pour une liste de régimes.
 * - L'assaisonnement (est_optionnel) est toléré pour les régimes souples.
 * - Pour les régimes stricts (halal/casher/sans_porc/sans_alcool), les
 *   optionnels alcoolisés/porcins sont simplement IGNORÉS (traités comme
 *   absents de la recette) — recetteServable les écarte donc de l'analyse.
 */
export function ingredientsInterdits(
  ingredients: IngredientPourRegime[],
  regimes: Regime[]
): IngredientPourRegime[] {
  if (!regimes.length) return [];

  const regles = new Set(regimes);
  const obligatoires = ingredients.filter(i => !i.est_optionnel);
  const optionnels = ingredients.filter(i => i.est_optionnel);

  const estInterdit = (i: IngredientPourRegime, strict: boolean): boolean => {
    const n = normaliserNom(i.nom);
    const rayon = i.rayon || '';

    if (regles.has('vegan')) {
      if (rayon === 'viande_poisson') return true;
      if (PRODUITS_ANIMAUX.some(m => n.includes(m))) return true;
      if (strict && ALCOOL.some(m => n.includes(m))) return true;
    }
    if (regles.has('vegetarien') || regles.has('pesco_vegetarien')) {
      const carnivore = match(n, VIANDE) || (!regles.has('pesco_vegetarien') && match(n, POISSON));
      if (carnivore) return true;
      // Un ingrédient du rayon viande_poisson non reconnu → exclu par précaution
      if (rayon === 'viande_poisson' && !match(n, POISSON)) return true;
    }
    if (regles.has('sans_gluten')) {
      if (match(n, ['ble', 'farine de ble', 'pate feuilletee', 'pate brisee', 'semoule', 'boulgour', 'orge', 'seigle', 'biscuit', 'chapelure', 'nouilles de ble', 'crozets', 'panure', 'pate a pizza'])) return true;
    }
    if (regles.has('sans_lactose')) {
      if (PRODUITS_ANIMAUX.some(m => ['lait', 'creme', 'beurre', 'yaourt', 'fromage', 'parmesan', 'mozzarella', 'gruyere', 'cheddar', 'reblochon', 'mascarpone', 'feta', 'ricotta', 'chevre', 'roquefort', 'comte', 'emmental'].includes(m) && n.includes(m))) return true;
    }
    if (regles.has('halal') || regles.has('cacher') || regles.has('sans_porc')) {
      if (match(n, PORC)) return true;
    }
    if (regles.has('halal') || regles.has('cacher')) {
      if (match(n, ALCOOL)) return true;
    }
    if (regles.has('sans_alcool')) {
      if (match(n, ALCOOL)) return true;
    }
    return false;
  };

  const strict = regimes.some(r => ['halal', 'cacher', 'sans_porc', 'sans_alcool'].includes(r));
  return [...obligatoires, ...(strict ? [] : optionnels)].filter(i => estInterdit(i, strict));
}

/** Une recette est servable si AUCUN ingrédient obligatoire n'est interdit. */
export function recetteServable(
  ingredients: IngredientPourRegime[],
  regimes: Regime[]
): boolean {
  return ingredientsInterdits(ingredients, regimes)
    .every(i => i.est_optionnel === true);
}
