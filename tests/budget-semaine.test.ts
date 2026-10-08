import { describe, it, expect } from 'vitest';
import { coutSemaine, respecterBudget, type Candidate } from '@/lib/rotation-engine';
import type { DayPlan, RecetteMoteur } from '@/types';

// Recette chiffrée : 1 kg d'un ingrédient au prix donné, 2 portions → prix/portion = prixKg / 2
let id = 0;
const recette = (prixKg: number, temps = 20): RecetteMoteur => ({
  id: ++id, titre: `R${id}`, type_repas: 'plat', temps_preparation: temps, temps_cuisson: 0,
  portions_par_defaut: 2,
  ingredients: [{ quantite: 1000, unite: 'g', est_optionnel: false,
    ingredient: { id: id, nom: 'x', prix_unitaire: prixKg, unite_prix: 'kg', poids_unites: null } }],
} as unknown as RecetteMoteur);

const cand = (meal: RecetteMoteur, score = 1): Candidate => ({ meal, score } as unknown as Candidate);
const slot = (tempsMax: number | null = null) => () => ({ jourIndex: 0, repasType: 'diner' as const, tempsMax, contexte: 'normal', nouveaute: 50 } as never);

const semaine = (m: () => RecetteMoteur): DayPlan[] =>
  Array.from({ length: 7 }, (_, i) => ({ jour: `J${i}`, jourIndex: i, dejeuner: m(), diner: m(), dessert: null, dessertMidi: null } as unknown as DayPlan));

describe('respecterBudget', () => {
  it('ramène une semaine chère sous le budget', () => {
    const days = semaine(() => recette(10)); // 5 €/portion × 2 pers × 14 = 140 €
    const pool = Array.from({ length: 20 }, () => cand(recette(2))); // 1 €/portion
    expect(coutSemaine(days, 2)).toBe(140);
    const res = respecterBudget(days, pool, 50, 2, slot());
    expect(coutSemaine(res, 2)).toBeLessThanOrEqual(50);
    // Jamais deux fois le même plat
    const ids = res.flatMap(d => [d.dejeuner!.id, d.diner!.id]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('préfère les plats compatibles avec le temps du jour', () => {
    const days = semaine(() => recette(10));
    const lents = Array.from({ length: 20 }, () => cand(recette(2, 90), 5));
    const rapides = Array.from({ length: 20 }, () => cand(recette(3, 20), 1));
    const res = respecterBudget(days, [...lents, ...rapides], 50, 2, slot(30));
    expect(coutSemaine(res, 2)).toBeLessThanOrEqual(50);
    expect(res.every(d => d.diner!.temps_preparation <= 30)).toBe(true);
  });

  it('sans plat compatible avec le temps du jour, le budget prime', () => {
    const days = semaine(() => recette(10));
    const pool = Array.from({ length: 20 }, () => cand(recette(2, 90)));
    expect(coutSemaine(respecterBudget(days, pool, 50, 2, slot(30)), 2)).toBeLessThanOrEqual(50);
  });

  it('le coût suit la liste de courses : un ingrédient partagé est additionné puis arrondi', () => {
    const commun = { quantite: 300, unite: 'g', est_optionnel: false, ingredient: { id: 999, nom: 'x', prix_unitaire: 10, unite_prix: 'kg', poids_unites: null } };
    const m = () => ({ ...recette(1), ingredients: [commun] } as unknown as RecetteMoteur);
    const days = semaine(m).slice(0, 1); // 2 repas × 300 g × (2 pers / 2 portions) = 0,6 kg → 6 €
    expect(coutSemaine(days, 2)).toBe(6);
  });

  it('souple : autour du budget, strict : sous le budget', () => {
    const pool = () => Array.from({ length: 40 }, (_, i) => cand(recette(2 + i * 0.4), 40 - i));
    const strict = respecterBudget(semaine(() => recette(10)), pool(), 80, 2, slot(), true);
    const souple = respecterBudget(semaine(() => recette(10)), pool(), 80, 2, slot(), false);
    expect(coutSemaine(strict, 2)).toBeLessThanOrEqual(80);
    expect(coutSemaine(souple, 2)).toBeLessThanOrEqual(88);
    expect(coutSemaine(souple, 2)).toBeGreaterThanOrEqual(coutSemaine(strict, 2)); // souple garde les plats mieux notés
  });

  it('laisse intacte une semaine déjà sous le budget', () => {
    const days = semaine(() => recette(2));
    expect(respecterBudget(days, [], 50, 2, slot())).toEqual(days);
  });
});
