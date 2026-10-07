import { describe, it, expect } from 'vitest';
import * as L from '@/lib/limites';
import { verifierPlausibilite, PLAFOND_KCAL_PAR_PORTION } from '@/lib/macros';

describe('estPayant', () => {
  it('pro et famille sont payants', () => {
    expect(L.estPayant('pro')).toBe(true);
    expect(L.estPayant('famille')).toBe(true);
  });
  it('gratuit, vide ou inconnu ne le sont pas', () => {
    for (const p of ['gratuit', 'free', 'PRO', '', null, undefined]) expect(L.estPayant(p)).toBe(false);
  });
});

describe('quotas du plan gratuit', () => {
  it('sont des entiers positifs (0 ou NaN bloquerait tout le produit)', () => {
    for (const v of [
      L.JOURS_VISIBLES_GRATUIT, L.ARTICLES_COURSES_GRATUITS, L.OPTIMISATIONS_GRATUITES_PAR_SEMAINE,
      L.REMPLACEMENTS_GRATUITS_PAR_SEMAINE, L.RECHERCHES_FRIGO_GRATUITES_PAR_SEMAINE, L.IMPORTS_GRATUITS_PAR_MOIS,
    ]) {
      expect(Number.isInteger(v) && v > 0).toBe(true);
    }
  });
  it('le gratuit ne voit pas la semaine entière', () => {
    expect(L.JOURS_VISIBLES_GRATUIT).toBeLessThan(7);
  });
});

describe('verifierPlausibilite', () => {
  const m = (cal: number) => ({ cal, p: 0, g: 0, l: 0 }) as Parameters<typeof verifierPlausibilite>[0];
  it('accepte un plat normal et le plafond exact', () => {
    expect(verifierPlausibilite(m(550)).ok).toBe(true);
    expect(verifierPlausibilite(m(PLAFOND_KCAL_PAR_PORTION)).ok).toBe(true);
  });
  it('refuse 0, négatif, NaN et au-delà du plafond', () => {
    for (const c of [0, -5, NaN, Infinity, PLAFOND_KCAL_PAR_PORTION + 1]) {
      expect(verifierPlausibilite(m(c)).ok).toBe(false);
    }
  });
});
