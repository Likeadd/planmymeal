// ============================================================================
// Tests fondation IA — validateur de recette extraite + extraction JSON
//
// Aucun appel réseau : on teste le filet de validation (règle 35 du produit —
// une sortie LLM n'entre jamais en base sans validation) et l'extracteur JSON
// de l'adaptateur. Les LLM produisent des sorties imparfaites ; ces tests
// décrivent CE QUE LE FILET TOLÈRE et CE QU'IL REFUSE.
// ============================================================================

import { describe, expect, it } from 'vitest';
import { validerRecetteExtraite, type RecetteExtraite } from '@/lib/ai/recette';
import { extraireJson } from '@/lib/ai/anthropic';

const SORTIE_VALIDE = {
  titre: 'Pâtes à la crème de courgettes',
  description: 'Un plat rapide de semaine',
  type_repas: 'plat',
  temps_preparation_min: 10,
  temps_cuisson_min: 15,
  portions: 2,
  instructions: ['Faire revenir les courgettes.', 'Cuire les pâtes.', 'Mélanger.'],
  ingredients: [
    { nom: 'Courgette', quantite: 2, unite: 'pcs', est_optionnel: false },
    { nom: 'Crème fraîche', quantite: 200, unite: 'g', est_optionnel: false },
    { nom: 'Parmesan', quantite: 40, unite: 'g', est_optionnel: true },
  ],
  cuisine: 'Italienne',
};

describe('validerRecetteExtraite', () => {
  it('accepte une sortie complète et la normalise', () => {
    const r = validerRecetteExtraite(SORTIE_VALIDE, 'url');
    expect(r).not.toBeNull();
    expect(r?.titre).toBe('Pâtes à la crème de courgettes');
    expect(r?.ingredients).toHaveLength(3);
    expect(r?.quantites_explicites).toBe(true);
    expect(r?.portions).toBe(2);
  });

  it('marque quantites_explicites=false pour une source texte (quantités incertaines)', () => {
    const r = validerRecetteExtraite(SORTIE_VALIDE, 'texte');
    expect(r?.quantites_explicites).toBe(false);
  });

  it('refuse un titre vide ou absent', () => {
    expect(validerRecetteExtraite({ ...SORTIE_VALIDE, titre: '   ' }, 'url')).toBeNull();
    expect(validerRecetteExtraite({ ...SORTIE_VALIDE, titre: 42 }, 'url')).toBeNull();
  });

  it('refuse une recette sans ingrédient (ni prix, ni courses, ni filtres possibles)', () => {
    expect(validerRecetteExtraite({ ...SORTIE_VALIDE, ingredients: [] }, 'url')).toBeNull();
  });

  it('exige au moins 2 ingrédients lisibles (1 ligne valide sur 3 ne suffit pas)', () => {
    const r = validerRecetteExtraite(
      { ...SORTIE_VALIDE, ingredients: [{ nom: 'Sel', quantite: 1, unite: 'cac' }, '???', 42] },
      'url'
    );
    expect(r).toBeNull();
  });

  it('remplace une unité inventée par pcs au lieu de faire échouer la recette entière', () => {
    const r = validerRecetteExtraite(
      { ...SORTIE_VALIDE, ingredients: [
        { nom: 'Ail', quantite: 2, unite: 'gousse' },   // unité hors liste SQL
        { nom: 'Persil', quantite: 1, unite: 'bouquet' },
      ] },
      'url'
    );
    expect(r).not.toBeNull();
    expect(r?.ingredients.every(i => ['g', 'ml', 'pcs', 'cac', 'cas', 'pincee', 'sachet', 'boite', 'botte', 'tranche'].includes(i.unite))).toBe(true);
  });

  it('remplace une quantité nulle ou absente par 1 (contrainte SQL quantite > 0)', () => {
    const r = validerRecetteExtraite(
      { ...SORTIE_VALIDE, ingredients: [
        { nom: 'Ciboulette', quantite: 0, unite: 'g' },
        { nom: 'Beurre', unite: 'g' },
      ] },
      'url'
    );
    expect(r?.ingredients.every(i => i.quantite > 0)).toBe(true);
  });

  it('refuse un temps de préparation invraisemblable', () => {
    expect(validerRecetteExtraite({ ...SORTIE_VALIDE, temps_preparation_min: 0 }, 'url')).toBeNull();
    expect(validerRecetteExtraite({ ...SORTIE_VALIDE, temps_preparation_min: 9999 }, 'url')).toBeNull();
  });

  it('borne les portions et retombe sur 2 (défaut du catalogue)', () => {
    expect(validerRecetteExtraite({ ...SORTIE_VALIDE, portions: 500 }, 'url')?.portions).toBe(2);
    expect(validerRecetteExtraite({ ...SORTIE_VALIDE, portions: 'beaucoup' }, 'url')?.portions).toBe(2);
    expect(validerRecetteExtraite({ ...SORTIE_VALIDE, portions: 6 }, 'url')?.portions).toBe(6);
  });

  it('ramène un type_repas inconnu à plat (jamais snack/petit-déjeuner dans le moteur)', () => {
    expect(validerRecetteExtraite({ ...SORTIE_VALIDE, type_repas: 'snack' }, 'url')?.type_repas).toBe('plat');
    expect(validerRecetteExtraite({ ...SORTIE_VALIDE, type_repas: 'dessert' }, 'url')?.type_repas).toBe('dessert');
  });

  it('purge les instructions non textuelles et borne leur nombre', () => {
    const r = validerRecetteExtraite(
      { ...SORTIE_VALIDE, instructions: ['Étape ok', 42, null, 'Autre étape'] },
      'url'
    );
    expect(r?.instructions).toEqual(['Étape ok', 'Autre étape']);
  });

  it('refuse franchement du non-objet (le LLM a ignoré le format)', () => {
    expect(validerRecetteExtraite('une recette', 'url')).toBeNull();
    expect(validerRecetteExtraite(null, 'url')).toBeNull();
    expect(validerRecetteExtraite([SORTIE_VALIDE], 'url')).toBeNull();
  });
});

describe('extraireJson (adaptateur Anthropic)', () => {
  it('isole le JSON dans une réponse prose', () => {
    const extrait = extraireJson('Voici la recette demandée :\n{"titre":"Tarte"}\nBonne cuisine !');
    expect(extrait).toBe('{"titre":"Tarte"}');
  });

  it('tolère un bloc de code markdown', () => {
    const extrait = extraireJson('```json\n{"a": 1, "b": {"c": "}"}}\n```');
    expect(JSON.parse(extrait!)).toEqual({ a: 1, b: { c: '}' } });
  });

  it('gère les accolades dans les chaînes et les échappements', () => {
    const extrait = extraireJson('{"titre": "Crème brûlée \\"spéciale\\"", "note": "}}"}');
    expect(JSON.parse(extrait!)).toEqual({ titre: 'Crème brûlée "spéciale"', note: '}}' });
  });

  it('retourne null sur un JSON tronqué (réponse coupée par max_tokens)', () => {
    expect(extraireJson('{"titre": "Tarte", "ingredients": [{"nom": "Pommes"')).toBeNull();
  });

  it('retourne null sans aucun JSON', () => {
    expect(extraireJson('Désolé, je ne peux pas extraire cette recette.')).toBeNull();
  });

  it('supporte un tableau racine', () => {
    expect(JSON.parse(extraireJson('[1, {"x": 2}]')!)).toEqual([1, { x: 2 }]);
  });
});

// Garde de forme : le type RecetteExtraite reste consommable par la route
describe('forme RecetteExtraite', () => {
  it('expose les champs attendus par la persistance', () => {
    const r: RecetteExtraite | null = validerRecetteExtraite(SORTIE_VALIDE, 'url');
    expect(r && typeof r.titre === 'string' && typeof r.portions === 'number' && Array.isArray(r.instructions)).toBe(true);
  });
});
