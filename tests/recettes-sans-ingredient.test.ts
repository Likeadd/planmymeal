import { describe, it, expect } from 'vitest';
import { prixParPortion, prixRecette, prixMoyenPortions, facteurBudget } from '@/lib/budget';
import { recetteServable } from '@/lib/regimes';
import { couvertureFrigo } from '@/lib/frigo';
import { raisonExclusion, type FiltresDurs } from '@/lib/rotation-engine';
import type { RecetteMoteur } from '@/types';

// ============================================================================
// Recettes SANS ingrédient : ce qu'elles produisent vraiment
//
// 455 recettes publiques de la base sont dans ce cas (dont 439 plats, 45 % du
// catalogue) — un import les a insérées sans leurs liens d'ingrédients. Ces
// tests ne corrigent rien : ils FIGENT le comportement réel, pour qu'il soit
// connu plutôt que découvert à l'usage. Deux d'entre eux décrivent des trous
// assumés (régimes, allergies) : si quelqu'un les comble un jour, le test
// changera — et c'est exactement ce qu'on veut d'une décision explicite.
// ============================================================================

const SANS_INGREDIENT: RecetteMoteur = {
  id: 1043,
  titre: 'Panna cotta à la vanille',
  type_repas: 'dessert',
  saison: 'toutes',
  cuisine: 'Italienne',
  conservation_jours: 2,
  difficulte: 'facile',
  temps_preparation: 15,
  temps_cuisson: 0,
  calories_par_portion: 400,
  macros_verifiables: false,
  ustensiles: [],
  portions_par_defaut: 4,
  ingredients: [],
};

/** Le même plat, mais chiffrable : 500 g de poulet à 10 €/kg, 4 portions. */
const CHIFFRABLE: RecetteMoteur = {
  ...SANS_INGREDIENT,
  id: 7,
  ingredients: [{
    quantite: 500, unite: 'g', est_optionnel: false,
    ingredient: { id: 1, nom: 'Poulet', prix_unitaire: 10, unite_prix: 'kg' },
  }],
};

function filtres(p: Partial<FiltresDurs> = {}): FiltresDurs {
  return {
    allergiesIds: new Set<number>(),
    dislikesIds: new Set<number>(),
    regimes: [],
    prixMax: null,
    alimentsInterditsFamille: new Set<number>(),
    recettesVeteesFamille: new Set<number>(),
    bannies: new Set<number>(),
    ...p,
  };
}

describe('sans ingrédient — les PRIX', () => {
  it('affiche un prix indéterminé, jamais 0 €', () => {
    // C'est la différence qui compte : 0 € passerait pour la recette la moins
    // chère du catalogue et gagnerait tous les arbitrages de budget.
    expect(prixParPortion(SANS_INGREDIENT)).toBeNull();
    expect(prixRecette(SANS_INGREDIENT)).toEqual({ total: 0, chiffres: 0, nonChiffrables: 0 });
  });

  it('reste neutre dans le facteur budget', () => {
    expect(facteurBudget(prixParPortion(SANS_INGREDIENT), 40, 2, 12)).toBe(1);
    expect(prixParPortion(CHIFFRABLE)).toBeCloseTo(1.25);
  });

  it('ne tire pas la moyenne des prix vers le bas', () => {
    // Sinon toutes les autres recettes seraient jugées « chères » par
    // comparaison, et le budget serré écarterait les bonnes.
    expect(prixMoyenPortions([{ meal: SANS_INGREDIENT }, { meal: CHIFFRABLE }]))
      .toBeCloseTo(1.25);
  });

  it('n\'est jamais écartée par le cap prix de l\'offre Pro', () => {
    expect(raisonExclusion(SANS_INGREDIENT, [], [], filtres({ prixMax: 1 }))).toBeNull();
  });
});

describe('sans ingrédient — le MOTEUR de rotation', () => {
  it('est ÉCARTÉE quand une allergie, un régime ou un interdit du foyer est déclaré', () => {
    // Composition inconnue = aucune règle de sécurité évaluable. Servir à
    // l'aveugle n'est pas un choix par défaut.
    expect(raisonExclusion(SANS_INGREDIENT, [], [], filtres({ allergiesIds: new Set([1]) })))
      .toBe('composition_inconnue');
    expect(raisonExclusion(SANS_INGREDIENT, [], [], filtres({ regimes: ['vegan'] })))
      .toBe('composition_inconnue');
    expect(raisonExclusion(SANS_INGREDIENT, [], [], filtres({ alimentsInterditsFamille: new Set([1]) })))
      .toBe('composition_inconnue');
  });

  it('reste proposée quand aucune contrainte de sécurité n\'est déclarée', () => {
    // Le goût et le prix sont des préférences : ils ne justifient pas
    // d'écarter 45 % du catalogue.
    expect(raisonExclusion(SANS_INGREDIENT, [], [], filtres())).toBeNull();
    expect(raisonExclusion(SANS_INGREDIENT, [], [], filtres({ dislikesIds: new Set([1, 2, 3]) }))).toBeNull();
    expect(raisonExclusion(SANS_INGREDIENT, [], [], filtres({ prixMax: 1 }))).toBeNull();
  });

  it('n\'écarte QUE les recettes illisibles : une recette complète passe', () => {
    // La règle ne doit pas se transformer en « on n'ose plus rien servir ».
    const veg = filtres({ regimes: ['vegan'], allergiesIds: new Set([9]) });
    expect(raisonExclusion(CHIFFRABLE, [1], [{ id: 1, nom: 'Poulet', rayon: 'viande_poisson', est_optionnel: false }], veg))
      .toBe('regime');
    expect(raisonExclusion(CHIFFRABLE, [1], [], filtres())).toBeNull();
  });

  it('garde bannissement et veto prioritaires sur la composition inconnue', () => {
    // L'ordre des motifs compte : le plus précis d'abord. Un utilisateur qui a
    // dit « ne plus jamais proposer » veut ce motif-là, pas « composition
    // inconnue ».
    const tout = filtres({ bannies: new Set([1043]), recettesVeteesFamille: new Set([1043]), regimes: ['vegan'] });
    expect(raisonExclusion(SANS_INGREDIENT, [], [], tout)).toBe('bannie');
    expect(raisonExclusion(SANS_INGREDIENT, [], [], filtres({ recettesVeteesFamille: new Set([1043]), regimes: ['vegan'] })))
      .toBe('veto_famille');
  });

  it('reste « servable » au sens des régimes : c\'est le moteur qui écarte, pas le filtre d\'ingrédients', () => {
    // `recetteServable([], regimes)` ne peut rien déduire d'une liste vide : le
    // garde-fou est donc dans `raisonExclusion`, en amont, et sur la présence
    // d'une contrainte déclarée.
    expect(recetteServable([], ['vegan'])).toBe(true);
    expect(recetteServable([], ['halal'])).toBe(true);
  });

  it('ne gagne rien du frigo — mais n\'est pas pénalisée', () => {
    expect(couvertureFrigo(SANS_INGREDIENT, new Set([1, 2, 3]))).toEqual({ presents: 0, part: 0 });
    expect(couvertureFrigo(CHIFFRABLE, new Set([1]))).toEqual({ presents: 1, part: 1 });
  });
});

describe('sans ingrédient — la LISTE DE COURSES', () => {
  it('n\'apporte aucune ligne : le panier est incomplet (voir README)', () => {
    // La RPC `recompute_shopping_list` agrège `meal_ingredients` sur les repas
    // du plan : un repas sans liens compte pour zéro article. Sur la semaine en
    // cours, 10 des 21 repas planifiés sont dans ce cas.
    //
    // Ce qu'on peut affirmer ici, sans base : une liste bâtie uniquement sur
    // ces recettes est VIDE (la RPC renvoie alors null, donc aucune liste).
    const prix = prixRecette(SANS_INGREDIENT);
    expect(prix.total).toBe(0);
    expect(prix.chiffres + prix.nonChiffrables).toBe(0);
  });
});
