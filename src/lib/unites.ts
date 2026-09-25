// ============================================================================
// Conversion des unités de recette en grammes
//
// Une quantité de recette s'exprime en `g`, `ml`, `pcs`, `cas`, `cac`, `botte`,
// `tranche`, `sachet` ou `boite`. Tout ce qui n'est pas une masse doit être
// converti AVANT d'être multiplié par un coefficient « pour 100 g » — sinon une
// pièce est comptée comme autant de grammes.
//
// C'est exactement l'erreur qui a rendu les macros du catalogue fausses : les
// 3 œufs et les 4 poires d'un clafoutis pesaient 7 g au lieu de ~780 g, soit des
// calories sous-estimées d'environ 35 % pour cette recette.
//
// Cette règle est partagée par les trois consommateurs de quantités — les macros
// (`scripts/seed-catalogue-1000.ts`), le recalcul des macros existantes
// (`scripts/recalculer-macros.ts`) et les prix (`lib/budget.ts`) — pour qu'ils ne
// puissent pas diverger. La même divergence recopiée trois fois serait invisible
// jusqu'au jour où un seul des trois serait corrigé.
// ============================================================================

/** Poids en grammes d'UNE unité non massique : `{ pcs: 180, cas: 10 }` */
export type PoidsUnites = Record<string, number>;

/**
 * Unités dont la quantité EST déjà une masse, ou s'y assimile.
 *
 * `ml` est assimilé à 1 g/ml : c'est l'hypothèse que fait déjà le budget
 * (1 L = 1 kg) et celle des coefficients « pour 100 g » du catalogue. Elle est
 * exacte pour l'eau, le lait et le vin, acceptable pour la crème, fausse de
 * quelques pour cent pour l'huile — mais l'ordre de grandeur est le bon, alors
 * que compter un millilitre pour un gramme n'est jamais absurde. Traiter `ml`
 * par un coefficient de densité par ingrédient serait plus juste ; ça n'entre
 * pas dans la même colonne et ça ne change aucun classement.
 */
const UNITES_MASSE = new Set(['g', 'ml']);

/**
 * Rétrécit une valeur JSON de la base (`Json | null`) en barème de poids.
 *
 * La colonne est libre : une valeur d'une autre forme (chaîne, tableau, nombre
 * négatif) est traitée comme ABSENTE plutôt que de faire échouer la conversion
 * plus loin. Un barème illisible ne doit pas casser le chiffrage d'une recette,
 * il doit le rendre impossible pour cette unité — et le dire.
 */
export function poidsUnitesDe(valeur: unknown): PoidsUnites | null {
  if (valeur == null || typeof valeur !== 'object' || Array.isArray(valeur)) return null;
  const entrees = Object.entries(valeur as Record<string, unknown>)
    .filter(([, v]) => typeof v === 'number' && Number.isFinite(v) && v > 0);
  if (entrees.length === 0) return null;
  return Object.fromEntries(entrees) as PoidsUnites;
}

/** true si la quantité est déjà exprimée en masse (g ou ml assimilé) */
export function uniteEstMasse(unite: string): boolean {
  return UNITES_MASSE.has(unite);
}

/**
 * Poids en grammes d'une quantité de recette, ou `null` si la conversion est
 * impossible.
 *
 * `null` n'est pas une valeur de repli, c'est un AVERTISSEMENT : mieux vaut une
 * recette non chiffrable qu'une recette chiffrée faux. Les appelants doivent
 * traiter explicitement ce cas (le catalogue refuse d'écrire, le recalcul saute
 * la recette et la signale).
 */
export function grammes(
  quantite: number,
  unite: string,
  poidsUnites?: PoidsUnites | null
): number | null {
  if (!Number.isFinite(quantite) || quantite <= 0) return null;
  if (uniteEstMasse(unite)) return quantite;

  const poids = poidsUnites?.[unite];
  if (poids == null || !Number.isFinite(poids) || poids <= 0) return null;

  return quantite * poids;
}
