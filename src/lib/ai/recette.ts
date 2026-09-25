// ============================================================================
// Validation de la recette extraite par l'IA — PlanMyMeal
//
// Règle 35 du produit : une sortie LLM n'entre JAMAIS en base sans validation.
// Ce module est le filet : il reçoit `unknown` (JSON brut du modèle) et
// renvoie une RecetteExtraite PROPRE — quantités positives, unités de la liste
// fermée du catalogue, chaînes bornées — ou null si rien n'est récupérable.
//
// Pourquoi un validateur à la main plutôt qu'une dépendance zod : le projet
// n'a aucune dépendance de validation, la forme à vérifier est petite, et ce
// validateur est testé par tests/ai-recette.test.ts sans aucun mock réseau.
// ============================================================================

import type { Unite } from '@/types';

/** Unités acceptées en base — contrainte SQL de meal_ingredients (00001) */
const UNITES_VALIDES: readonly Unite[] = [
  'g', 'ml', 'pcs', 'cac', 'cas', 'pincee', 'sachet', 'boite', 'botte', 'tranche',
];

export interface LigneIngredientExtraite {
  nom: string;
  quantite: number;
  unite: Unite;
  est_optionnel: boolean;
}

export interface RecetteExtraite {
  titre: string;
  description: string | null;
  /** 'entree' | 'plat' | 'dessert' (jamais snack/petit-déjeuner dans le moteur) */
  type_repas: 'entree' | 'plat' | 'dessert';
  temps_preparation_min: number;
  temps_cuisson_min: number | null;
  portions: number;
  instructions: string[];
  ingredients: LigneIngredientExtraite[];
  /** Cuisine si le modèle l'identifie, sinon null (le catalogue décidera) */
  cuisine: string | null;
  /** true si la source mentionnait explicitement des quantités */
  quantites_explicites: boolean;
}

/** Repli unité : une quantité non convertie reste utile (affichage, courses) */
const UNITE_DEFAUT: Unite = 'pcs';

/** Borne générique : nombre fini, arrondi, dans [min, max] — sinon null */
function nombre(v: unknown, min: number, max: number): number | null {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  const arrondi = Math.round(n);
  if (arrondi < min || arrondi > max) return null;
  return arrondi;
}

/** Chaîne non vide, bornée, uniligne — sinon null */
function texte(v: unknown, maxLen: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.replace(/\s+/g, ' ').trim();
  if (t.length === 0 || t.length > maxLen) return null;
  return t;
}

/** Normalise une ligne d'ingrédient — null si irrécupérable */
function ligne(v: unknown): LigneIngredientExtraite | null {
  if (typeof v !== 'object' || v === null) return null;
  const o = v as Record<string, unknown>;

  const nom = texte(o.nom, 120);
  if (!nom) return null;

  // Quantité absente ou nulle = ingrédient « à discrétion » → 0 est refusé en
  // base (check quantite > 0). On la remplace par 1 pc, convention du catalogue.
  const quantite = nombre(o.quantite, 0, 100_000);
  const q = quantite == null || quantite <= 0 ? 1 : quantite;

  const uniteBrute = typeof o.unite === 'string' ? o.unite.toLowerCase().trim() : '';
  const unite = UNITES_VALIDES.includes(uniteBrute as Unite) ? (uniteBrute as Unite) : UNITE_DEFAUT;

  return {
    nom,
    quantite: q,
    unite,
    est_optionnel: o.est_optionnel === true,
  };
}

/**
 * Valide la sortie du LLM pour un import de recette.
 * @param source 'url' | 'texte' — pilote le drapeau quantites_explicites
 */
export function validerRecetteExtraite(
  brut: unknown,
  source: 'url' | 'texte'
): RecetteExtraite | null {
  if (typeof brut !== 'object' || brut === null) return null;
  const o = brut as Record<string, unknown>;

  const titre = texte(o.titre, 200);
  if (!titre) return null;

  const ingredientsBrut = Array.isArray(o.ingredients) ? o.ingredients : [];
  if (ingredientsBrut.length === 0 || ingredientsBrut.length > 50) return null;

  const ingredients: LigneIngredientExtraite[] = [];
  for (const li of ingredientsBrut) {
    const l = ligne(li);
    if (l) ingredients.push(l);
  }
  // Une recette sans AU MOINS 2 ingrédients lisibles n'est pas exploitable :
  // ni prix, ni courses, ni filtres allergie.
  if (ingredients.length < 2) return null;

  const instructionsBrut = Array.isArray(o.instructions) ? o.instructions : [];
  const instructions: string[] = [];
  for (const i of instructionsBrut.slice(0, 40)) {
    const t = texte(i, 2000);
    if (t) instructions.push(t);
  }
  // Des étapes manquantes ne bloquent pas (l'utilisateur complétera), mais on
  // refuse un texte d'étape qui serait en réalité tout le contenu de la page.
  if (instructions.length > 40) return null;

  const tempsPrep = nombre(o.temps_preparation_min, 1, 600);
  if (tempsPrep == null) return null;

  const typeBrut = typeof o.type_repas === 'string' ? o.type_repas : 'plat';
  const typeRepas = ['entree', 'plat', 'dessert'].includes(typeBrut)
    ? (typeBrut as RecetteExtraite['type_repas'])
    : 'plat';

  return {
    titre,
    description: texte(o.description, 500),
    type_repas: typeRepas,
    temps_preparation_min: tempsPrep,
    temps_cuisson_min: nombre(o.temps_cuisson_min, 0, 600),
    // Une recette pour 0 ou 1000 personnes n'existe pas — défaut du catalogue
    portions: nombre(o.portions, 1, 20) ?? 2,
    instructions,
    ingredients,
    cuisine: texte(o.cuisine, 40),
    quantites_explicites: source === 'url',
  };
}
