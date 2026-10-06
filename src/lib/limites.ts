// ============================================================================
// Limites des plans — source unique partagée entre les routes (contrôle), le
// paywall et la page Tarifs (affichage), pour que l'affiche ne dérive jamais
// du code.
//
// Plan Gratuit : de quoi découvrir le produit (une vraie semaine par semaine),
// sans les fonctions qui font gagner du temps et de l'argent au quotidien.
// ============================================================================

import type { PlanAbonnement } from '@/types';

/** Jours de la semaine planifiée visibles en gratuit (aujourd'hui et demain). */
export const JOURS_VISIBLES_GRATUIT = 2;
/** Articles de la liste de courses visibles en gratuit. */
export const ARTICLES_COURSES_GRATUITS = 8;
/** Optimisations complètes de la semaine (7 jours glissants). */
export const OPTIMISATIONS_GRATUITES_PAR_SEMAINE = 1;
/** Remplacements automatiques d'un repas (« Changer » → au hasard), 7 jours glissants. */
export const REMPLACEMENTS_GRATUITS_PAR_SEMAINE = 3;
/** Recherches « recettes avec mon frigo » (7 jours glissants). */
export const RECHERCHES_FRIGO_GRATUITES_PAR_SEMAINE = 2;
/** Imports IA de recettes personnelles (30 jours glissants). */
export const IMPORTS_GRATUITS_PAR_MOIS = 1;

export const estPayant = (plan: PlanAbonnement | string | null | undefined) => plan === 'pro' || plan === 'famille';

/** Motif d'ouverture du paywall — choisit le titre et le message affichés. */
export type RaisonPaywall =
  | 'semaine' | 'courses' | 'generation' | 'optimisations' | 'remplacements' | 'desserts' | 'intentions'
  | 'frigo' | 'imports' | 'prix-max' | 'famille' | 'foyer-partage' | 'decouvrir';
