import { describe, it, expect } from 'vitest';
import {
  ingredientsInterdits,
  recetteServable,
  normaliserNom,
  type IngredientPourRegime,
} from '@/lib/regimes';

const ing = (id: number, nom: string, rayon: string, est_optionnel = false): IngredientPourRegime => ({
  id, nom, rayon, est_optionnel,
});

describe('normaliserNom', () => {
  it('met en minuscule et supprime les accents', () => {
    expect(normaliserNom('Côte de Porc')).toBe('cote de porc');
    expect(normaliserNom('Œuf')).toBe('oeuf');
    expect(normaliserNom('Crème Fraîche')).toBe('creme fraiche');
    expect(normaliserNom('Rôti de Porc')).toBe('roti de porc');
  });
});

describe('recetteServable — végétarien', () => {
  const regimes = ['vegetarien' as const];

  it('accepte une recette sans viande ni poisson', () => {
    const quiche = [
      ing(1, 'Farine de blé', 'epicerie_salee'),
      ing(2, 'Œuf', 'frais'),
      ing(3, 'Crème fraîche', 'frais'),
      ing(4, 'Gruyère râpé', 'frais'),
    ];
    expect(recetteServable(quiche, regimes)).toBe(true);
  });

  it('refuse une recette au poulet', () => {
    const curry = [ing(10, 'Blanc de poulet', 'viande_poisson'), ing(11, 'Lait de coco', 'conserves')];
    expect(recetteServable(curry, regimes)).toBe(false);
  });

  it('refuse une recette au saumon (végétarien strict)', () => {
    const pates = [ing(20, 'Pavé de saumon', 'viande_poisson'), ing(21, 'Pâtes', 'epicerie_salee')];
    expect(recetteServable(pates, regimes)).toBe(false);
  });

  it('pesco_végétarien accepte le poisson mais pas la viande', () => {
    const pesco = ['pesco_vegetarien' as const];
    expect(recetteServable([ing(20, 'Pavé de saumon', 'viande_poisson')], pesco)).toBe(true);
    expect(recetteServable([ing(10, 'Blanc de poulet', 'viande_poisson')], pesco)).toBe(false);
  });

  it('refuse un ingrédient viande_poisson inconnu (précaution)', () => {
    const mystere = [ing(30, 'Filet spécial', 'viande_poisson')];
    expect(recetteServable(mystere, regimes)).toBe(false);
  });
});

describe('recetteServable — végan', () => {
  const regimes = ['vegan' as const];

  it('refuse les produits animaux', () => {
    expect(recetteServable([ing(2, 'Œuf', 'frais')], regimes)).toBe(false);
    expect(recetteServable([ing(3, 'Crème liquide', 'frais')], regimes)).toBe(false);
    expect(recetteServable([ing(4, 'Parmesan', 'frais')], regimes)).toBe(false);
    expect(recetteServable([ing(5, 'Miel', 'epicerie_sucree')], regimes)).toBe(false);
  });

  it('accepte le tofu et les légumes', () => {
    const stirfry = [ing(40, 'Tofu ferme', 'frais'), ing(41, 'Brocoli', 'fruits_legumes')];
    expect(recetteServable(stirfry, regimes)).toBe(true);
  });

  it('refuse tout le rayon viande_poisson', () => {
    expect(recetteServable([ing(20, 'Moules', 'viande_poisson')], regimes)).toBe(false);
  });
});

describe('recetteServable — halal / sans porc / sans alcool', () => {
  it('halal refuse porc ET alcool', () => {
    const halal = ['halal' as const];
    expect(recetteServable([ing(50, 'Lardons', 'viande_poisson')], halal)).toBe(false);
    expect(recetteServable([ing(51, 'Vin blanc', 'boissons')], halal)).toBe(false);
    expect(recetteServable([ing(52, 'Poulet', 'viande_poisson')], halal)).toBe(true);
  });

  it('casher comme halal (porc + alcool)', () => {
    const cacher = ['cacher' as const];
    expect(recetteServable([ing(50, 'Bacon', 'viande_poisson')], cacher)).toBe(false);
    expect(recetteServable([ing(51, 'Bière', 'boissons')], cacher)).toBe(false);
  });

  it('sans_porc tolère le vin de cuisine', () => {
    const sansPorc = ['sans_porc' as const];
    expect(recetteServable([ing(50, 'Échine de porc', 'viande_poisson')], sansPorc)).toBe(false);
    expect(recetteServable([ing(51, 'Vin rouge', 'boissons')], sansPorc)).toBe(true);
  });

  it('sans_alcool refuse uniquement l\u2019alcool', () => {
    const sansAlcool = ['sans_alcool' as const];
    expect(recetteServable([ing(51, 'Vin blanc', 'boissons')], sansAlcool)).toBe(false);
    expect(recetteServable([ing(50, 'Jambon blanc', 'viande_poisson')], sansAlcool)).toBe(true);
  });

  it('régime strict : un optionnel alcoolisé est IGNORÉ (traité comme absent)', () => {
    const halal = ['halal' as const];
    const boeufBourguignon = [
      ing(60, 'Bœuf à braiser', 'viande_poisson'),
      ing(61, 'Vin rouge', 'boissons', true), // optionnel → ignoré en régime strict
    ];
    // l'optionnel est écarté de l'analyse (pas dans les obligatoires analysés)
    expect(ingredientsInterdits(boeufBourguignon, halal).map(i => i.id)).toEqual([]);
    // la recette est servable sans le vin
    expect(recetteServable(boeufBourguignon, halal)).toBe(true);
  });
});

describe('recetteServable — sans gluten / sans lactose', () => {
  it('sans_gluten refuse blé, semoule, chapelure', () => {
    const sg = ['sans_gluten' as const];
    expect(recetteServable([ing(70, 'Semoule (couscous)', 'epicerie_salee')], sg)).toBe(false);
    expect(recetteServable([ing(71, 'Chapelure', 'epicerie_salee')], sg)).toBe(false);
    expect(recetteServable([ing(72, 'Riz', 'epicerie_salee')], sg)).toBe(true);
  });

  it('sans_lactose refuse lait, crème, fromages', () => {
    const sl = ['sans_lactose' as const];
    expect(recetteServable([ing(80, 'Lait', 'frais')], sl)).toBe(false);
    expect(recetteServable([ing(81, 'Mozzarella', 'frais')], sl)).toBe(false);
    expect(recetteServable([ing(82, 'Crème fraîche', 'frais')], sl)).toBe(false);
    expect(recetteServable([ing(83, 'Tofu ferme', 'frais')], sl)).toBe(true);
  });
});

describe('recetteServable — pas de régime', () => {
  it('tout est servable sans régime', () => {
    expect(recetteServable([ing(50, 'Lardons', 'viande_poisson'), ing(51, 'Vin blanc', 'boissons')], [])).toBe(true);
  });

  it('keto ne bloque rien au niveau ingrédient', () => {
    expect(recetteServable([ing(70, 'Pâtes', 'epicerie_salee')], ['keto'])).toBe(true);
  });
});

describe('ingredientsInterdits — détail', () => {
  it('liste uniquement les ingrédients problématiques', () => {
    const interdits = ingredientsInterdits(
      [
        ing(1, 'Farine', 'epicerie_salee'),
        ing(2, 'Œuf', 'frais'),
        ing(3, 'Blanc de poulet', 'viande_poisson'),
      ],
      ['vegetarien']
    );
    expect(interdits.map(i => i.id)).toEqual([3]);
  });
});
