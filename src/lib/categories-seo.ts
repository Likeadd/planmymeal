// ============================================================================
// Pages catégories SEO — /recettes/categorie/[slug]
//
// Objectif : capter les recherches à forte intention (« menu pas cher »,
// « batch cooking »…) avec une page dédiée, rendue serveur, plutôt que de
// tout miser sur le catalogue client-side (/recettes, non indexable dans son
// contenu initial). Chaque catégorie filtre le même catalogue public que
// /recettes et renvoie vers lui (query params) pour affiner.
// ============================================================================

import type { MealCatalogue } from '@/lib/db-rows';
import { prixParPortion } from '@/lib/budget';
import { recetteServable, type IngredientPourRegime } from '@/lib/regimes';
import type { Regime } from '@/types';

export interface CategorieSeo {
  slug: string;
  /** Libellé court des liens (pied de page, puces du catalogue) */
  court: string;
  h1: string;
  metaTitle: string;
  metaDescription: string;
  intro: string;
  /** Query params ajoutés au lien « voir tout le catalogue ». */
  hrefCatalogue: string;
  filtre: (meal: MealCatalogue) => boolean;
  tri: (a: MealCatalogue, b: MealCatalogue) => number;
}

function ingredientsRegime(m: MealCatalogue): IngredientPourRegime[] {
  return m.ingredients.map(li => ({
    id: li.ingredient.id,
    nom: li.ingredient.nom,
    rayon: li.ingredient.rayon,
    est_optionnel: li.est_optionnel,
  }));
}

const parTemps = (m: MealCatalogue) => m.temps_preparation + (m.temps_cuisson || 0);
const parPrix = (m: MealCatalogue) => prixParPortion(m) ?? Infinity;
const parNom = (a: MealCatalogue, b: MealCatalogue) => a.titre.localeCompare(b.titre, 'fr');

export const CATEGORIES_SEO: CategorieSeo[] = [
  {
    slug: 'pas-cher',
    court: 'Recettes pas chères',
    h1: 'Recettes pas chères (moins de 2 €/portion)',
    metaTitle: 'Recettes pas chères — moins de 2 €/portion',
    metaDescription:
      'Recettes économiques à moins de 2 € par portion, avec le prix affiché sur chaque fiche. Idéal pour un menu de la semaine serré.',
    intro:
      'Des recettes complètes à moins de 2 € la portion, prix calculé automatiquement à partir des ingrédients. Composez votre menu de la semaine sans dépasser votre budget.',
    hrefCatalogue: '/recettes?prixMax=2',
    filtre: m => (prixParPortion(m) ?? Infinity) <= 2,
    tri: (a, b) => parPrix(a) - parPrix(b) || parNom(a, b),
  },
  {
    slug: 'batch-cooking',
    court: 'Batch cooking',
    h1: 'Recettes batch cooking (se conservent 3 jours et plus)',
    metaTitle: 'Recettes batch cooking — à préparer en avance',
    metaDescription:
      'Recettes qui se conservent 3 jours ou plus : préparez en une fois, mangez toute la semaine. Parfait pour le batch cooking du dimanche.',
    intro:
      'Ces recettes se conservent au moins 3 jours au frigo : préparez-les en grande quantité un jour de repos et gagnez du temps le reste de la semaine.',
    hrefCatalogue: '/recettes?batch=1',
    filtre: m => (m.conservation_jours ?? 0) >= 3,
    tri: (a, b) => (b.conservation_jours ?? 0) - (a.conservation_jours ?? 0) || parNom(a, b),
  },
  {
    slug: 'rapides',
    court: 'Recettes rapides',
    h1: 'Recettes rapides (30 minutes ou moins)',
    metaTitle: 'Recettes rapides — prêtes en 30 minutes',
    metaDescription:
      'Recettes prêtes en 30 minutes ou moins, préparation et cuisson comprises. Pour les soirs où le temps manque.',
    intro:
      'Toutes ces recettes sont prêtes en 30 minutes maximum, préparation et cuisson comprises — pratique pour les soirs de semaine.',
    hrefCatalogue: '/recettes?tempsMax=30',
    filtre: m => parTemps(m) <= 30,
    tri: (a, b) => parTemps(a) - parTemps(b) || parNom(a, b),
  },
  {
    slug: 'vegetarien',
    court: 'Recettes végétariennes',
    h1: 'Recettes végétariennes',
    metaTitle: 'Recettes végétariennes — menu de la semaine sans viande ni poisson',
    metaDescription:
      'Recettes végétariennes compatibles avec un menu de la semaine complet : plats, prix par portion et calories affichés.',
    intro: 'Des recettes végétariennes prêtes à planifier, avec prix par portion et calories affichés sur chaque fiche.',
    hrefCatalogue: '/recettes?regime=vegetarien',
    filtre: m => recetteServable(ingredientsRegime(m), ['vegetarien'] as Regime[]),
    tri: parNom,
  },
  {
    slug: 'riches-en-proteines',
    court: 'Riches en protéines',
    h1: 'Recettes riches en protéines',
    metaTitle: 'Recettes riches en protéines (25 g et plus par portion)',
    metaDescription:
      'Recettes à 25 g de protéines ou plus par portion, avec les macros affichées. Pour la prise de masse ou un objectif sportif.',
    intro: 'Recettes à au moins 25 g de protéines par portion, macros détaillées sur chaque fiche.',
    hrefCatalogue: '/recettes?proteines=1',
    filtre: m => (m.proteines ?? 0) >= 25,
    tri: (a, b) => (b.proteines ?? 0) - (a.proteines ?? 0) || parNom(a, b),
  },
];

export function getCategorieSeo(slug: string): CategorieSeo | undefined {
  return CATEGORIES_SEO.find(c => c.slug === slug);
}
