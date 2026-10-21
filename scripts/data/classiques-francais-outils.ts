import type { RecetteSaisie } from './recettes-proteinees';

type Ligne = RecetteSaisie['ingredients'][number];

/** Plat du quotidien : cuisine française et difficulté facile par défaut */
export function plat(
  titre: string, prep: number, cuisson: number, portions: number, conservation: number,
  ustensiles: string[], ingredients: Ligne[], etapes: string[],
  options: { cuisine?: string; difficulte?: RecetteSaisie['difficulte'] } = {},
): RecetteSaisie {
  return {
    titre, type: 'plat', cuisine: options.cuisine ?? 'Française', prep, cuisson,
    difficulte: options.difficulte ?? 'facile', portions, conservation, ustensiles, ingredients, etapes,
  };
}
