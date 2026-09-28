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
/** Céréales et dérivés (pain, pâtes, riz, farines…) */
const FECULENTS_CEREALES = ['farine', 'pain', 'pates', 'spaghetti', 'tagliatelle', 'macaroni', 'lasagne', 'gnocchi', 'semoule', 'boulgour', 'couscous', 'riz', 'quinoa', 'millet', 'sarrasin', 'epeautre', 'orzo', 'coquillettes', 'crozets', 'nouilles', 'flocons d', 'granola', 'biscotte', 'tortilla', 'chapelure', 'pate brisee', 'pate feuilletee', 'pate filo', 'feuilles de brick', 'mais', 'polenta', 'fecule', 'biscuit', 'speculoos', 'injera', 'galette de sarrasin'];
/** Féculents = céréales + tubercules */
const FECULENTS = [...FECULENTS_CEREALES, 'pomme de terre', 'patate douce', 'frites', 'igname', 'manioc', 'topinambour'];
const LEGUMINEUSES = ['lentille', 'pois chiche', 'haricots rouges', 'haricots blancs', 'haricots noirs', 'pois casses', 'petits pois', 'petit pois', 'edamame', 'farine de pois'];
const SUCRES_RAFFINES = ['sucre', 'sirop', 'confiture', 'pate a tartiner', 'chocolat', 'pepites de chocolat', 'speculoos', 'biscuit', 'glace', 'sorbet', 'chantilly', 'ketchup', 'sauce barbecue', 'sauce hoisin', 'granola'];
const SUCRES = [...SUCRES_RAFFINES, 'miel', 'datte', 'raisins secs', 'pruneau', 'jus d'];
const FRUITS_SUCRES = ['banane', 'mangue', 'ananas', 'raisin', 'pomme', 'poire', 'figue', 'cerise', 'peche', 'nectarine', 'abricot', 'papaye', 'melon', 'pasteque', 'orange', 'clementine', 'kiwi', 'grenade', 'coing'];
const TRANSFORMES = ['nuggets', 'frites surgelees', 'mayonnaise', 'ketchup', 'sauce barbecue', 'surimi', 'jambon blanc', 'jambon de dinde', 'margarine', 'huile de palme'];
const PRODUITS_LAITIERS = ['lait', 'creme', 'beurre', 'yaourt', 'fromage', 'parmesan', 'mozzarella', 'gruyere', 'cheddar', 'reblochon', 'mascarpone', 'feta', 'ricotta', 'chevre', 'comte', 'emmental', 'brie', 'camembert', 'halloumi', 'labneh', 'skyr', 'chantilly'];
const LAITS_VEGETAUX = ["lait de coco", "lait d’amande", "lait d'amande", "lait d’avoine", "lait d'avoine", "lait de soja", "creme vegetale", "beurre de cacahuete", "coco"];
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
    // Keto : ni féculents, ni céréales, ni légumineuses, ni sucres, ni fruits sucrés.
    if (regles.has('keto')) {
      if (match(n, FECULENTS) || match(n, LEGUMINEUSES) || match(n, SUCRES) || match(n, FRUITS_SUCRES)) return true;
    }
    // Low carb (souple) : féculents et sucres exclus, légumineuses et fruits tolérés.
    if (regles.has('low_carb')) {
      if (match(n, FECULENTS) || match(n, SUCRES)) return true;
    }
    // Paléo : ni céréales, ni légumineuses, ni laitages, ni sucres raffinés, ni produits transformés.
    if (regles.has('paleo')) {
      if (match(n, FECULENTS_CEREALES) || match(n, LEGUMINEUSES) || match(n, SUCRES_RAFFINES) || match(n, TRANSFORMES)) return true;
      if (PRODUITS_LAITIERS.some(m => n.includes(m)) && !match(n, LAITS_VEGETAUX)) return true;
    }
    if (regles.has('sans_sucre_ajoute')) {
      if (match(n, SUCRES_RAFFINES)) return true;
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

/** Régimes proposés à l'inscription et dans « Mon compte » (libellés partagés). */
export const REGIMES_CHOIX: { value: Regime; label: string }[] = [
  { value: 'vegan', label: 'Vegan 🌱' },
  { value: 'vegetarien', label: 'Végétarien 🥬' },
  { value: 'pesco_vegetarien', label: 'Pesco-végétarien 🐟' },
  { value: 'sans_gluten', label: 'Sans gluten 🌾' },
  { value: 'sans_lactose', label: 'Sans lactose 🥛' },
  { value: 'keto', label: 'Keto 🥑 (très pauvre en glucides)' },
  { value: 'low_carb', label: 'Low carb 🥩 (pauvre en glucides)' },
  { value: 'paleo', label: 'Paléo 🍖 (sans céréales ni laitages)' },
  { value: 'sans_sucre_ajoute', label: 'Sans sucre ajouté 🍬' },
  { value: 'halal', label: 'Halal 🕌' },
  { value: 'cacher', label: 'Casher ✡️' },
  { value: 'sans_porc', label: 'Sans porc 🐷' },
  { value: 'sans_alcool', label: 'Sans alcool 🚫' },
];
