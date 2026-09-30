import { describe, it, expect } from 'vitest';
import {
  scoreRecoupement, ingredientsPerissables, baseTitre, optimiserRecoupement,
  type Candidate, type SlotContexte,
} from '@/lib/rotation-engine';
import type { DayPlan, RecetteMoteur } from '@/types';

const ing = (id: number, rayon: string, est_optionnel = false) => ({
  quantite: 1, unite: 'pcs', est_optionnel,
  ingredient: { id, nom: `i${id}`, rayon, prix_unitaire: null, unite_prix: null, poids_unites: null },
});

function recette(id: number, titre: string, ingredients: ReturnType<typeof ing>[]): RecetteMoteur {
  return {
    id, titre, ingredients, temps_preparation: 10, temps_cuisson: 10, calories_par_portion: null,
    difficulte: 'facile', ustensiles: [], portions_par_defaut: 2, type_repas: 'plat', saison: 'toutes',
    cuisine: null, conservation_jours: null, macros_verifiables: false,
  } as unknown as RecetteMoteur;
}
const cand = (meal: RecetteMoteur, score = 1): Candidate => ({ meal, score } as Candidate);
const slots = (jourIndex: number, repasType: 'dejeuner' | 'diner' | 'dessert' | 'dessert_midi'): SlotContexte =>
  ({ jourIndex, repasType, tempsMax: null, contexte: 'normal', nouveaute: 50 } as unknown as SlotContexte);
const jour = (i: number, dejeuner: RecetteMoteur | null, diner: RecetteMoteur | null) =>
  ({ jour: '', jourIndex: i, dejeuner, diner, dessert: null, dessertMidi: null } as unknown as DayPlan);

describe('recoupement des ingrédients frais', () => {
  it('ne compte que les ingrédients frais obligatoires', () => {
    const r = recette(1, 'A', [ing(1, 'fruits_legumes'), ing(2, 'epices'), ing(3, 'frais', true), ing(4, 'viande_poisson')]);
    expect(ingredientsPerissables(r).sort()).toEqual([1, 4]);
  });

  it('score = réutilisations (occurrences − 1)', () => {
    const a = recette(1, 'A', [ing(10, 'frais'), ing(11, 'frais')]);
    const b = recette(2, 'B', [ing(10, 'frais')]);
    const c = recette(3, 'C', [ing(10, 'frais'), ing(11, 'frais')]);
    expect(scoreRecoupement([a, b, c])).toBe(3); // 10 ×3 → 2, 11 ×2 → 1
  });

  it('base de titre : ignore accents et casse, 3 premiers mots', () => {
    expect(baseTitre('Salade Roquette au tofu, avocat')).toBe(baseTitre('salade roquette au saumon fumé'));
    expect(baseTitre('Épinards à la crème')).toBe('epinards a la');
  });

  it('remplace un plat pour partager un ingrédient frais, à score comparable', () => {
    const lundi = recette(1, 'Curry de lentilles', [ing(100, 'fruits_legumes')]);
    const mardi = recette(2, 'Poulet rôti', [ing(200, 'viande_poisson')]);
    const alternative = recette(3, 'Soupe de légumes', [ing(100, 'fruits_legumes')]);
    const days = [jour(0, lundi, null), jour(1, mardi, null)];
    optimiserRecoupement(days, [cand(lundi), cand(mardi), cand(alternative)], slots, 200);
    expect(scoreRecoupement([days[0].dejeuner, days[1].dejeuner] as never[])).toBe(1);
  });

  it('ne sacrifie jamais un plat bien mieux noté', () => {
    const lundi = recette(1, 'Curry de lentilles', [ing(100, 'fruits_legumes')]);
    const mardi = recette(2, 'Poulet rôti', [ing(200, 'viande_poisson')]);
    const alternative = recette(3, 'Soupe de légumes', [ing(100, 'fruits_legumes')]);
    const days = [jour(0, lundi, null), jour(1, mardi, null)];
    optimiserRecoupement(days, [cand(lundi, 1), cand(mardi, 1), cand(alternative, 0.5)], slots, 200);
    expect(days[1].dejeuner?.id).toBe(2);
  });

  it('n’empile pas deux variantes du même plat', () => {
    const lundi = recette(1, 'Salade roquette au tofu', [ing(100, 'fruits_legumes')]);
    const mardi = recette(2, 'Poulet rôti', [ing(200, 'viande_poisson')]);
    const variante = recette(3, 'Salade roquette au saumon', [ing(100, 'fruits_legumes')]);
    const days = [jour(0, lundi, null), jour(1, mardi, null)];
    optimiserRecoupement(days, [cand(lundi), cand(mardi), cand(variante)], slots, 200);
    expect(days[1].dejeuner?.id).toBe(2);
  });
});
