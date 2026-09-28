import { describe, it, expect } from 'vitest';
import { caloriesRecommandees, profilEffectif, kcalValide } from '@/lib/nutrition';

describe('caloriesRecommandees', () => {
  it('sans aucune donnée : valeurs de référence (~2 200 kcal en maintien)', () => {
    const kcal = caloriesRecommandees('maintien', {});
    expect(kcal).toBeGreaterThanOrEqual(2000);
    expect(kcal).toBeLessThanOrEqual(2400);
    expect(kcal % 50).toBe(0);
    expect(profilEffectif({}).estimation).toBe(true);
  });

  it('suit la formule de Mifflin-St Jeor (femme 30 ans, 165 cm, 60 kg)', () => {
    // BMR = 10*60 + 6.25*165 - 5*30 - 161 = 1320.25 → ×1.4 = 1848 → 1850
    expect(caloriesRecommandees('maintien', { sexe: 'femme', age: 30, taille_cm: 165, poids_kg: 60 })).toBe(1850);
    expect(profilEffectif({ sexe: 'femme', age: 30, taille_cm: 165, poids_kg: 60 }).estimation).toBe(false);
  });

  it('ajuste selon l’objectif : perte < maintien < prise de masse', () => {
    const p = { sexe: 'homme' as const, age: 28, taille_cm: 180, poids_kg: 80 };
    const perte = caloriesRecommandees('perte_poids', p);
    const maintien = caloriesRecommandees('maintien', p);
    const masse = caloriesRecommandees('prise_masse', p);
    expect(perte).toBeLessThan(maintien);
    expect(masse).toBeGreaterThan(maintien);
    expect(caloriesRecommandees('sans_regime', p)).toBe(maintien);
  });

  it('respecte un plancher de sécurité en perte de poids', () => {
    expect(caloriesRecommandees('perte_poids', { sexe: 'femme', age: 80, taille_cm: 150, poids_kg: 40 })).toBeGreaterThanOrEqual(1200);
  });

  it('ignore une saisie hors bornes (remplacée par la référence)', () => {
    expect(caloriesRecommandees('maintien', { poids_kg: 999 })).toBe(caloriesRecommandees('maintien', {}));
  });
});

describe('kcalValide', () => {
  it('accepte 1000–5000, refuse le reste', () => {
    expect(kcalValide(2000)).toBe(2000);
    expect(kcalValide(500)).toBeNull();
    expect(kcalValide(null)).toBeNull();
  });
});

import { cibleCaloriqueJour, facteurCalories } from '@/lib/nutrition';

describe('cibleCaloriqueJour', () => {
  const corps = { sexe: null, age: null, taille_cm: null, poids_kg: null };
  it('« sans objectif » : aucune cible', () => {
    expect(cibleCaloriqueJour({ objectif: 'sans_regime', calories_par_jour: 2000, ...corps })).toBeNull();
  });
  it('utilise la valeur choisie, sinon le calcul par défaut', () => {
    expect(cibleCaloriqueJour({ objectif: 'maintien', calories_par_jour: 2600, ...corps })).toBe(2600);
    expect(cibleCaloriqueJour({ objectif: 'maintien', calories_par_jour: null, ...corps })).toBe(caloriesRecommandees('maintien', {}));
  });
});

describe('facteurCalories', () => {
  it('favorise un plat dans la cible, pénalise les extrêmes, sans jamais éliminer', () => {
    // cible 2000 → repas principal ≈ 720 kcal
    expect(facteurCalories(700, 2000)).toBeGreaterThan(1);
    expect(facteurCalories(1300, 2000)).toBeLessThan(1);
    expect(facteurCalories(250, 2000)).toBeLessThan(1);
    expect(facteurCalories(250, 2000)).toBeGreaterThan(0);
    expect(facteurCalories(null, 2000)).toBe(1);
    expect(facteurCalories(700, null)).toBe(1);
  });
  it('la cible d’une prise de masse favorise des plats plus caloriques qu’une perte de poids', () => {
    const p = { sexe: 'homme' as const, age: 28, taille_cm: 180, poids_kg: 80 };
    const perte = caloriesRecommandees('perte_poids', p);
    const masse = caloriesRecommandees('prise_masse', p);
    expect(facteurCalories(1100, masse)).toBeGreaterThan(facteurCalories(1100, perte));
  });
});
