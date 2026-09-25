// ============================================================================
// Moteur Budget & Prix — PlanMyMeal
// - Calcule le prix d'une recette à partir du prix unitaire des ingrédients
// - Chiffre la liste de courses (prix par rayon, total semaine)
// - Convertit les quantités de recette (g, ml, pcs...) en unités achetables
// - Calcule les économies réalisées (budget − dépense)
// - Fournit le facteur budget pour le score de rotation
// ============================================================================

import type { Ingredient, IngredientChiffrable, RecetteChiffrable } from '@/types';
import { grammes, type PoidsUnites } from '@/lib/unites';
import { LOCALE_CONFIG } from '@/lib/i18n/config';

/** Unités vendues au poids → conversion vers l'unité de prix 'kg' */
const KG_UNITS = new Set(['g']);
/** Unités vendues au volume → conversion vers l'unité de prix 'L' */
const L_UNITS = new Set(['ml']);

/**
 * Prix effectif d'un ingrédient : la surcharge utilisateur prime sur le prix
 * de référence du catalogue.
 */
export function prixEffectif(
  ingredient: Pick<Ingredient, 'id' | 'prix_unitaire' | 'unite_prix'>,
  overrides?: Map<number, number> | null
): number | null {
  if (overrides && overrides.has(ingredient.id)) {
    return overrides.get(ingredient.id)!;
  }
  return ingredient.prix_unitaire ?? null;
}

/**
 * Convertit une quantité de recette (g, ml, pcs, cas...) en quantité
 * "achetable" dans l'unité de prix de l'ingrédient.
 * Retourne null si impossible à chiffrer (pas de prix, unité inconnue, ou
 * poids unitaire absent pour une conversion qui en aurait besoin).
 *
 * `poidsUnites` (voir `lib/unites.ts`) est ce qui rend convertibles les lignes
 * jadis refusées : « 4 oranges » à 2,50 €/kg était NON CHIFFRABLE (pcs → kg),
 * elle vaut aujourd'hui 0,72 kg → 1,80 €. 381 liens du catalogue étaient dans
 * ce cas. Le `null` reste pour ce qu'on ne sait pas convertir : on préfère une
 * ligne sans prix à un prix inventé, qui fausserait le budget de la semaine.
 */
export function quantiteAchetee(
  quantite: number,
  unite: string,
  unitePrix: string | null,
  poidsUnites?: PoidsUnites | null
): number | null {
  if (!unitePrix) return null;
  switch (unitePrix) {
    case 'kg': {
      const g = grammes(quantite, unite, poidsUnites);
      return g == null ? null : g / 1000;
    }
    case 'L': {
      if (L_UNITS.has(unite)) return quantite / 1000;
      // 1 L ≈ 1 kg : une pièce pesée se convertit en volume au même taux.
      const g = grammes(quantite, unite, poidsUnites);
      return g == null ? null : g / 1000;
    }
    case 'pcs':
    case 'botte':
    case 'boite':
    case 'sachet':
    case 'tranche': {
      // Vendu à la pièce : on achète max(1, quantité arrondie au supérieur)
      if (unite === unitePrix || (unitePrix === 'pcs' && unite === 'tranche')) {
        return Math.max(1, Math.ceil(quantite));
      }
      // Recette en masse, ingrédient vendu à la pièce (60 g de pain à la
      // tranche) : le nombre de pièces se déduit du poids de l'unité vendue.
      const poids = poidsUnites?.[unitePrix];
      const g = grammes(quantite, unite, poidsUnites);
      if (g != null && poids != null && poids > 0) return Math.max(1, Math.ceil(g / poids));
      return null;
    }
    default:
      return null;
  }
}

/**
 * Prix d'une ligne d'ingrédient (pour la quantité exacte utilisée en cuisine).
 */
export function prixLigne(
  iq: { quantite: number; unite: string; ingredient: IngredientChiffrable },
  overrides?: Map<number, number> | null
): number | null {
  const prix = prixEffectif(iq.ingredient, overrides);
  if (prix == null) return null;
  const q = quantiteAchetee(iq.quantite, iq.unite, iq.ingredient.unite_prix, iq.ingredient.poids_unites);
  if (q == null) return null;
  return Math.round(prix * q * 100) / 100;
}

/**
 * Prix total d'une recette pour ses portions par défaut.
 * Les ingrédients non chiffrables sont ignorés (mais retournés en compteur).
 */
export function prixRecette(
  meal: RecetteChiffrable,
  overrides?: Map<number, number> | null
): { total: number; chiffres: number; nonChiffrables: number } {
  let total = 0;
  let chiffres = 0;
  let nonChiffrables = 0;

  for (const iq of meal.ingredients || []) {
    if (iq.est_optionnel) continue;
    const p = prixLigne(iq, overrides);
    if (p == null) {
      nonChiffrables++;
      continue;
    }
    total += p;
    chiffres++;
  }

  return { total: Math.round(total * 100) / 100, chiffres, nonChiffrables };
}

/** Prix par portion d'une recette. */
export function prixParPortion(meal: RecetteChiffrable, overrides?: Map<number, number> | null): number | null {
  const { total, chiffres } = prixRecette(meal, overrides);
  if (chiffres === 0) return null;
  const portions = meal.portions_par_defaut || 2;
  return Math.round((total / portions) * 100) / 100;
}

// ─── Liste de courses chiffrée ─────────────────────────────────────────────

export interface PricedShoppingItem {
  ingredient_id: number;
  nom: string;
  rayon: string;
  quantite_totale: number;
  unite: string;
  /** Quantité convertie dans l'unité d'achat (kg, L, pcs...) */
  quantite_achat: number | null;
  unite_prix: string | null;
  prix_unitaire: number | null;
  /** Prix estimé de la ligne (null si non chiffrable) */
  prix: number | null;
  checked: boolean;
}

export interface PricedShoppingSection {
  rayon: string;
  label: string;
  items: PricedShoppingItem[];
  total: number;
}

/**
 * Chiffre la liste de courses : chaque item est converti en unité d'achat,
 * arrondi au conditionnement supérieur (on n'achète pas 0,3 oignon), puis
 * multiplié par le prix unitaire.
 */
export function chiffrerListeCourses(
  items: {
    ingredient_id: number;
    quantite_totale: number;
    unite: string;
    rayon: string;
    checked: boolean;
    ingredient: Pick<Ingredient, 'id' | 'nom' | 'prix_unitaire' | 'unite_prix'>;
  }[],
  overrides?: Map<number, number> | null
): PricedShoppingSection[] {
  const byRayon = new Map<string, PricedShoppingItem[]>();

  for (const it of items) {
    const pu = prixEffectif(it.ingredient, overrides);
    const qAchat = pu != null ? quantiteAchatListe(it.quantite_totale, it.unite, it.ingredient.unite_prix) : null;
    const prix = pu != null && qAchat != null ? Math.round(pu * qAchat * 100) / 100 : null;

    const priced: PricedShoppingItem = {
      ingredient_id: it.ingredient_id,
      nom: it.ingredient.nom,
      rayon: it.rayon,
      quantite_totale: it.quantite_totale,
      unite: it.unite,
      quantite_achat: qAchat,
      unite_prix: it.ingredient.unite_prix,
      prix_unitaire: pu,
      prix,
      checked: it.checked,
    };

    if (!byRayon.has(it.rayon)) byRayon.set(it.rayon, []);
    byRayon.get(it.rayon)!.push(priced);
  }

  const sections: PricedShoppingSection[] = [];
  for (const [rayon, its] of byRayon) {
    sections.push({
      rayon,
      label: rayon,
      items: its,
      total: Math.round(its.reduce((s, i) => s + (i.prix ?? 0), 0) * 100) / 100,
    });
  }
  return sections;
}

/**
 * Quantité d'achat pour un item de liste : comme quantiteAchetee mais
 * agrégée sur plusieurs recettes (donc souvent > 1 pcs).
 */
export function quantiteAchatListe(
  quantite: number,
  unite: string,
  unitePrix: string | null
): number | null {
  if (!unitePrix) return null;
  switch (unitePrix) {
    case 'kg':
      return KG_UNITS.has(unite) ? Math.ceil((quantite / 1000) * 10) / 10 : null;
    case 'L':
      return L_UNITS.has(unite) ? Math.ceil((quantite / 1000) * 10) / 10 : null;
    case 'pcs':
    case 'botte':
    case 'boite':
    case 'sachet':
      if (unite === unitePrix) return Math.max(1, Math.ceil(quantite));
      // Les tranches se convertissent en pcs (pain de mie, cheddar...)
      if (unitePrix === 'pcs' && unite === 'tranche') return Math.max(1, Math.ceil(quantite / 2));
      return null;
    default:
      return null;
  }
}

// ─── Économies ─────────────────────────────────────────────────────────────

export interface BudgetRecap {
  budget: number | null;
  depense: number;
  economie: number;
  /** Dépassement (depense > budget) */
  depassement: boolean;
  /** % du budget consommé (0-100+) */
  pourcentage: number;
}

/** Récap budget vs dépense pour une semaine. */
export function calculerEconomies(
  budget: number | null,
  depense: number
): BudgetRecap {
  if (budget == null || budget <= 0) {
    return { budget, depense, economie: 0, depassement: false, pourcentage: 0 };
  }
  const economie = Math.round((budget - depense) * 100) / 100;
  return {
    budget,
    depense: Math.round(depense * 100) / 100,
    economie,
    depassement: depense > budget,
    pourcentage: Math.min(150, Math.round((depense / budget) * 100)),
  };
}

// ─── Économies vs base déclarée (décision produit : ancrage utilisateur) ────

export interface EconomieReference {
  /** Base hebdomadaire déclarée par l'utilisateur (€) */
  depenseReference: number;
  /** dépense (prévue ou réelle) − base → positif = économie */
  economie: number;
  /** % économisé par rapport à la base (0–100+) */
  pourcentage: number;
  /** true si la dépense dépasse la base déclarée */
  depassement: boolean;
}

/**
 * Économie vs la base DÉCLARÉE par l'utilisateur (jamais une moyenne
 * théorique — décision produit). Retourne null si la base n'est pas saisie :
 * le widget économies reste alors masqué, la base n'est jamais devinée.
 */
export function calculerEconomieReference(
  depenseReference: number | null | undefined,
  depense: number
): EconomieReference | null {
  if (depenseReference == null || depenseReference <= 0) return null;
  const economie = Math.round((depenseReference - depense) * 100) / 100;
  return {
    depenseReference,
    economie,
    pourcentage: Math.round((economie / depenseReference) * 100),
    depassement: depense > depenseReference,
  };
}

// ─── Facteur budget pour le moteur de rotation ─────────────────────────────

/**
 * Facteur budget multiplicatif du score d'une recette (0.5 à 1.5).
 *
 * - Budget élevé  (≥ 1.4× le coût moyen) : les recettes chères ne sont plus
 *   pénalisées → facteur neutre à léger bonus pour tout le monde.
 * - Budget serré (≤ 0.8× le coût moyen) : les recettes chères sont fortement
 *   dépriorisées, les recettes économiques sont boostées.
 * - Pas de budget défini : facteur neutre 1.0.
 *
 * @param prixPortion  prix par portion de la recette (null si non chiffrable)
 * @param budgetHebdo  budget hebdomadaire en € (null si non défini)
 * @param nbPersonnes  nombre de personnes au foyer
 * @param prixMoyenPortion prix moyen par portion du catalogue (€)
 * @param nbRepasParSemaine nombre de repas planifiés par semaine (défaut 14)
 */
export function facteurBudget(
  prixPortion: number | null,
  budgetHebdo: number | null,
  nbPersonnes: number,
  prixMoyenPortion: number,
  nbRepasParSemaine = 14
): number {
  if (prixPortion == null || !budgetHebdo || budgetHebdo <= 0) return 1.0;
  if (prixMoyenPortion <= 0) return 1.0;

  // Budget par repas et par personne
  const budgetParRepas = budgetHebdo / (nbRepasParSemaine * Math.max(1, nbPersonnes));

  // Ratio : cette recette coûte 1.2× le budget idéal par repas → ratio = 1.2
  const ratio = prixPortion / budgetParRepas;

  // Sous le seuil (≤ 1.3× le budget par repas) → neutre : un budget
  // confortable ne déforme pas la sélection, la variété est préservée.
  // Seules les recettes AU-DESSUS du budget sont pénalisées → un budget
  // serré penche naturellement vers les recettes économiques.
  if (ratio <= 1.3) return 1.0;

  // Pénalité progressive au-delà du seuil (plancher 0.5)
  const exces = ratio - 1.3;
  return Math.max(0.5, 1 - exces * 0.7);
}

/** Prix moyen par portion d'une liste de recettes scorées (€). */
export function prixMoyenPortions(
  candidats: { meal: RecetteChiffrable }[]
): number {
  const prix = candidats
    .map(c => prixParPortion(c.meal))
    .filter((p): p is number => p != null && p > 0);
  if (prix.length === 0) return 0;
  return prix.reduce((s, p) => s + p, 0) / prix.length;
}

// ─── Formatage ─────────────────────────────────────────────────────────────

/**
 * Formate un prix dans la devise du marché actif (lib/i18n/config.ts).
 * Une seule implémentation : changer de devise = changer LOCALE_CONFIG,
 * pas les dizaines d'appels 'fr-FR'/'EUR' dispersés avant la fondation i18n.
 */
export function formatPrix(p: number | null | undefined): string {
  if (p == null) return '—';
  return p.toLocaleString(LOCALE_CONFIG.locale, { style: 'currency', currency: LOCALE_CONFIG.currency });
}
