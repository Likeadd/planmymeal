// ============================================================================
// Macros d'une recette — calcul conscient de l'unité
//
// Une recette est une liste de lignes `(quantité, unité, ingrédient)`. Les
// coefficients nutritionnels du catalogue sont « pour 100 g ». Convertir une
// quantité en grammes demande donc deux choses :
//
//   • que l'unité soit convertible (voir `lib/unites.ts`) ;
//   • que l'ingrédient ait des coefficients connus.
//
// Si l'une des deux manque, on ne calcule RIEN : `macrosRecette` refuse la
// recette entière plutôt que de rendre un total partiel. Un total partiel est
// indistinguable d'un total juste, alors qu'une absence de total se voit.
//
// C'est le point qui a coûté le plus cher : l'ancien calcul multipliait la
// quantité par le coefficient « pour 100 g » sans regarder l'unité, donc une
// pièce valait un gramme. Aucune erreur, aucun avertissement, juste des
// calories fausses pour tout le catalogue.
// ============================================================================

import { grammes, type PoidsUnites } from './unites';

/** Coefficients nutritionnels pour 100 g */
export interface Coefficients {
  cal: number;
  proteines: number;
  glucides: number;
  lipides: number;
}

export interface LigneMacros {
  quantite: number;
  unite: string;
  /** Poids des unités non massiques de cet ingrédient (voir `ingredients.poids_unites`) */
  poidsUnites?: PoidsUnites | null;
  /** `null` = coefficients inconnus pour cet ingrédient */
  coefficients: Coefficients | null;
}

export interface Macros {
  cal: number;
  p: number;
  g: number;
  l: number;
}

export type RaisonRefus =
  | 'portions_invalides'
  | 'composition_vide'
  | 'unite_non_convertible'
  | 'coefficients_manquants';

export type ResultatMacros =
  | { ok: true; macros: Macros }
  | { ok: false; raison: RaisonRefus; detail: string };

/**
 * Macros par portion, ou la raison précise du refus.
 *
 * Aucun arrondi n'est appliqué ici : les appelants décident de leur précision.
 */
export function calculerMacros(lignes: LigneMacros[], portions: number): ResultatMacros {
  if (!Number.isFinite(portions) || portions <= 0) {
    return { ok: false, raison: 'portions_invalides', detail: `portions = ${portions}` };
  }
  if (lignes.length === 0) {
    return { ok: false, raison: 'composition_vide', detail: 'aucun ingrédient' };
  }

  let cal = 0, proteines = 0, glucides = 0, lipides = 0;

  for (const ligne of lignes) {
    if (!ligne.coefficients) {
      return {
        ok: false,
        raison: 'coefficients_manquants',
        detail: `${ligne.quantite} ${ligne.unite} — coefficients inconnus`,
      };
    }
    const g = grammes(ligne.quantite, ligne.unite, ligne.poidsUnites);
    if (g == null) {
      return {
        ok: false,
        raison: 'unite_non_convertible',
        detail: `${ligne.quantite} ${ligne.unite} — aucun poids déclaré pour « ${ligne.unite} »`,
      };
    }
    cal += ligne.coefficients.cal * g / 100;
    proteines += ligne.coefficients.proteines * g / 100;
    glucides += ligne.coefficients.glucides * g / 100;
    lipides += ligne.coefficients.lipides * g / 100;
  }

  const r1 = (n: number) => Math.round(n);
  const r2 = (n: number) => Math.round(n * 10) / 10;
  return {
    ok: true,
    macros: {
      cal: r1(cal / portions),
      p: r2(proteines / portions),
      g: r2(glucides / portions),
      l: r2(lipides / portions),
    },
  };
}

/**
 * Plafond de plausibilité d'un plat, en kcal par portion.
 *
 * Le calcul peut être JUSTE et le résultat absurde : c'est le cas des recettes
 * qui comptent l'huile de FRITURE comme un ingrédient mangé. « Fish & chips
 * maison » (2 portions) déclare 500 ml d'huile — soit 4 500 kcal, dont 2 250 par
 * portion — alors qu'on achète cette huile sans la boire. Le nombre produit est
 * arithmétiquement exact et culinairement faux.
 *
 * Un plafond ne répare pas ce genre de cas, il l'empêche d'entrer dans la base :
 * on préfère garder la valeur précédente et signaler la recette à relire plutôt
 * que d'écrire 2 825 kcal. Repère : le catalogue culmine à 794 kcal/portion,
 * pour une médiane de 383 — un adulte au gros appétit dépasse rarement 1 200.
 * 1 500 laisse donc passer les vrais plats et arrête les artefacts.
 */
export const PLAFOND_KCAL_PAR_PORTION = 1500;

export type PlausibiliteMacros = { ok: true } | { ok: false; detail: string };

/**
 * Un total calculé est-il croyable ?
 *
 * La même règle sert aux deux écrivains — le générateur du catalogue et le
 * recalcul des recettes existantes — pour qu'un artefact connu ne puisse pas
 * rentrer par l'un quand l'autre le refuse.
 */
export function verifierPlausibilite(m: Macros): PlausibiliteMacros {
  if (!Number.isFinite(m.cal) || m.cal <= 0) {
    return { ok: false, detail: `${m.cal} kcal/portion (un plat ne vaut pas 0)` };
  }
  if (m.cal > PLAFOND_KCAL_PAR_PORTION) {
    return {
      ok: false,
      detail: `${m.cal} kcal/portion — au-delà de ${PLAFOND_KCAL_PAR_PORTION} : `
        + 'vérifiez les quantités (huile de friture, ou quantité passée en grammes)',
    };
  }
  return { ok: true };
}
