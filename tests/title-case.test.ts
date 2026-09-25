import { describe, expect, it } from 'vitest';
import { titreMajuscules } from '../src/lib/utils';

// ============================================================================
// titreMajuscules — majuscule initiale à chaque mot des titres de recettes.
// Articles français courts en minuscule en milieu de titre ; en tête de titre,
// tout prend la majuscule ; un titre déjà bien capitalisé reste inchangé.
// ============================================================================

describe('titreMajuscules', () => {
  it('met une majuscule à chaque mot significatif', () => {
    expect(titreMajuscules('curry de poulet au coco')).toBe('Curry de Poulet au Coco');
  });

  it('garde les articles courts en minuscule en milieu de titre', () => {
    expect(titreMajuscules('gateau au chocolat de grand-mère')).toBe('Gateau au Chocolat de Grand-Mère');
    expect(titreMajuscules('salade de tomates et mozzarella')).toBe('Salade de Tomates et Mozzarella');
    expect(titreMajuscules('poulet à la crème')).toBe('Poulet à la Crème');
    expect(titreMajuscules('riz pour sushi sans gluten')).toBe('Riz pour Sushi sans Gluten');
  });

  it('majuscule en tête de titre même pour un article', () => {
    expect(titreMajuscules('des crêpes légères')).toBe('Des Crêpes Légères');
  });

  it('gère les tirets (grand-mère, bowl-cake)', () => {
    expect(titreMajuscules('bowl-cake pomme cannelle')).toBe('Bowl-Cake Pomme Cannelle');
  });

  it('laisse inchangé un titre déjà capitalisé', () => {
    expect(titreMajuscules('Curry de Poulet au Coco')).toBe('Curry de Poulet au Coco');
  });

  it('préserve les sigles courts tout-caps (BBQ, USA)', () => {
    expect(titreMajuscules('BBQ tofu bowl')).toBe('BBQ Tofu Bowl');
    expect(titreMajuscules('poke bowl USA')).toBe('Poke Bowl USA');
  });

  it('préserve les espaces multiples tels quels', () => {
    expect(titreMajuscules('soupe  à   l’oignon')).toBe('Soupe à   L’oignon');
  });

  it('gère les cas limites', () => {
    expect(titreMajuscules('')).toBe('');
    expect(titreMajuscules('pâtisserie')).toBe('Pâtisserie');
    // Mot long tout-caps → normalisé (1re maj + minuscules)
    expect(titreMajuscules('ÉCLAIR au chocolat')).toBe('Éclair au Chocolat');
  });
});
