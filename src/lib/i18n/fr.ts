// ============================================================================
// Dictionnaire français — PlanMyMeal
//
// Premier dictionnaire de la fondation i18n (audit P0.4). Il regroupe les
// chaînes MÉTIER qui étaient dispersées en dur dans le code (labels de rayons
// dans useWeeklyPlan, jours dans le moteur et les composants, intentions du
// jour dans types/index.ts). Les libellés d'UI restent en place : ils seront
// migrés vers un dictionnaire le jour où l'UI change de langue au runtime —
// pas avant (règle 8 : pas de complexité sans bénéfice).
// ============================================================================

import type { ContexteJour, Rayon } from '@/types';

export const DICT_FR = {
  jours: ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'] as const,
  joursMini: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'] as const,
  rayons: {
    fruits_legumes: '🥬 Fruits & Légumes',
    epicerie_salee: '🧂 Épicerie salée',
    epicerie_sucree: '🍫 Épicerie sucrée',
    frais: '🧀 Frais',
    surgeles: '❄️ Surgelés',
    viande_poisson: '🥩 Viande & Poisson',
    boissons: '🥤 Boissons',
    boulangerie: '🍞 Boulangerie',
    conserves: '🥫 Conserves',
    epices: '🌿 Épices',
  } as Record<Rayon, string>,
  contextesJour: {
    normal: 'Normal',
    rapide: 'Rapide',
    leger: 'Léger',
    plaisir: 'Plaisir',
  } as Record<ContexteJour, string>,
} as const;

/** Label d'affichage d'un rayon (repli : la valeur brute si inconnue) */
export function labelRayon(rayon: string): string {
  return DICT_FR.rayons[rayon as Rayon] ?? rayon;
}

/** Label d'affichage d'une intention du jour */
export function labelContexteJour(ctx: ContexteJour): string {
  return DICT_FR.contextesJour[ctx] ?? ctx;
}
