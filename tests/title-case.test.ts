import { describe, it, expect } from 'vitest';
import { titreRecette } from '../src/lib/utils';

// ============================================================================
// titreRecette — casse de phrase à la française : majuscule initiale seule,
// noms propres conservés, titres TOUT EN MAJUSCULES normalisés.
// ============================================================================

describe('titreRecette', () => {
  it('met la majuscule à la première lettre seulement', () => {
    expect(titreRecette('curry de poulet au coco')).toBe('Curry de poulet au coco');
    expect(titreRecette('éclair au chocolat')).toBe('Éclair au chocolat');
  });

  it('conserve les noms propres et sigles', () => {
    expect(titreRecette('Poulet aux herbes de Provence')).toBe('Poulet aux herbes de Provence');
    expect(titreRecette('BBQ tofu bowl')).toBe('BBQ tofu bowl');
  });

  it('normalise un titre tout en majuscules', () => {
    expect(titreRecette('GÂTEAU AU CHOCOLAT')).toBe('Gâteau au chocolat');
  });

  it('gère les cas limites', () => {
    expect(titreRecette('')).toBe('');
    expect(titreRecette('pâtisserie')).toBe('Pâtisserie');
  });
});
