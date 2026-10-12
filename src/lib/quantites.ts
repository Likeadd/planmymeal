// ============================================================================
// Lecture humaine des quantités d'ingrédients — partagée par la fiche recette
// (affichage) et le balisage schema.org (recipeIngredient).
// ============================================================================

const nombre = (q: number) => String(Math.round(q * 10) / 10).replace('.', ',');

/** « 2 pcs » → « 2 pièces », « 1 cac » → « 1 c. à café », « 3 pcs d'ail » → « 3 gousses » */
export function quantiteLisible(q: number, unite: string, nom = ''): string {
  if (unite === 'pcs' && /^Ail$/i.test(nom)) return `${nombre(q)} gousse${q > 1 ? 's' : ''}`;
  const mots: Record<string, string> = {
    pcs: q > 1 ? 'pièces' : 'pièce', cas: 'c. à soupe', cac: 'c. à café',
    tranche: q > 1 ? 'tranches' : 'tranche', botte: q > 1 ? 'bottes' : 'botte',
    boite: q > 1 ? 'boîtes' : 'boîte', sachet: q > 1 ? 'sachets' : 'sachet',
  };
  return `${nombre(q)} ${mots[unite] ?? unite}`;
}

/** « de yaourt grec », « d'ail » : préposition avec élision */
const de = (nom: string) => (/^([aeiouéèêàâîôû]|h(erbe|uile|uître))/i.test(nom) ? `d’${nom}` : `de ${nom}`);

/** Pluriel simple d'un nom d'ingrédient compté en pièces (« 2 courgettes », « 3 tomates ») */
const pluriel = (n: string, q: number) => (q > 1 && !/[sxz]$/i.test(n) ? `${n}s` : n);

/**
 * Ligne d'ingrédient en français courant pour les moteurs de recherche :
 * « 120 g de yaourt grec », « 1 gousse d'ail », « 1 c. à café de paprika fumé »,
 * « 2 oignons » (pièces : le nom suit directement la quantité).
 */
export function ingredientTexte(q: number, unite: string, nom: string): string {
  const n = nom.charAt(0).toLowerCase() + nom.slice(1);
  if (unite === 'pcs') return /^Ail$/i.test(nom) ? `${quantiteLisible(q, unite, nom)} d’ail` : `${nombre(q)} ${pluriel(n, q)}`;
  return `${quantiteLisible(q, unite, nom)} ${de(n)}`;
}
