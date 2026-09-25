import { describe, it, expect } from 'vitest';
import {
  COLONNES_RECETTE_PLANNING,
  COLONNES_RECETTE_FAVORI,
  COLONNES_RECETTE_RESUME,
  COLONNES_RECETTE_MOTEUR,
  COLONNES_RECETTE_FRIGO,
} from '@/lib/db-rows';
import { SELECT_CATALOGUE, SELECT_SUGGESTIONS } from '@/lib/catalogue';

// ============================================================================
// Listes de colonnes des select allégés
//
// Ces tests couvrent le même contrat que `scripts/verifier-colonnes.ts`, mais
// sans base de données : ils tournent donc en CI à chaque commit. Le vrai
// risque n'est pas la faute de frappe (le script la voit), c'est le RETOUR
// silencieux à `select('*')` lors d'une modification future.
// ============================================================================

/** Champs lourds qu'aucun de ces écrans n'affiche */
const CHAMPS_INTERDITS = [
  'instructions', 'image_url', 'description',
  'glucides', 'lipides', 'fibres', 'saison', 'created_by',
];

const SELECTS = {
  planning: COLONNES_RECETTE_PLANNING,
  favori: COLONNES_RECETTE_FAVORI,
  resume: COLONNES_RECETTE_RESUME,
  catalogue: SELECT_CATALOGUE,
  suggestions: SELECT_SUGGESTIONS,
  moteur: COLONNES_RECETTE_MOTEUR,
  frigo: COLONNES_RECETTE_FRIGO,
};

/** Champs que chaque sélecteur DOIT contenir (contrat type ↔ base) */
const REQUIS: Record<keyof typeof SELECTS, string[]> = {
  planning: ['id', 'titre', 'temps_preparation', 'temps_cuisson', 'calories_par_portion', 'difficulte', 'ustensiles', 'portions_par_defaut'],
  favori: ['id', 'titre', 'type_repas', 'cuisine', 'difficulte', 'calories_par_portion', 'conservation_jours'],
  resume: ['id', 'titre', 'temps_preparation', 'temps_cuisson', 'calories_par_portion'],
  catalogue: ['id', 'titre', 'type_repas', 'cuisine', 'saison', 'ustensiles', 'difficulte', 'conservation_jours', 'proteines'],
  suggestions: ['id', 'titre', 'temps_preparation', 'temps_cuisson', 'calories_par_portion', 'portions_par_defaut'],
  // `RecetteMoteur` : le socle d'une carte + ce qui alimente une DÉCISION
  moteur: ['id', 'titre', 'type_repas', 'saison', 'cuisine', 'conservation_jours', 'ustensiles', 'portions_par_defaut', 'difficulte', 'temps_preparation', 'temps_cuisson', 'calories_par_portion'],
  // `RecetteFrigo` : le socle d'une carte + cuisine et image
  frigo: ['id', 'titre', 'cuisine', 'image_url', 'ustensiles', 'portions_par_defaut', 'difficulte', 'temps_preparation', 'temps_cuisson', 'calories_par_portion'],
};

/** Sélecteurs qui ont besoin des ingrédients (prix affiché ou avis du foyer) */
const AVEC_INGREDIENTS: (keyof typeof SELECTS)[] = ['planning', 'favori', 'catalogue', 'suggestions'];

/**
 * Moteur et vider-le-frigo lisent EN PLUS `ingredient_id` et `rayon` :
 * `ingredient_id` porte le frigo, les allergies et les dislikes, `rayon` les
 * règles de régime (viande, poisson…). Les perdre ne casserait rien — les
 * filtres durs cesseraient simplement de s'appliquer, en silence.
 */
const AVEC_INGREDIENTS_MOTEUR: (keyof typeof SELECTS)[] = ['moteur', 'frigo'];

/**
 * Deux sélecteurs demandent un champ par ailleurs interdit, pour une raison
 * précise et documentée (voir `db-rows.ts`) — jamais par commodité.
 */
const EXCEPTIONS: Partial<Record<keyof typeof SELECTS, string[]>> = {
  moteur: ['saison'],     // facteur saison du score : donnée de décision
  frigo: ['image_url'],   // renvoyée dans la réponse de /api/vider-le-frigo
  catalogue: ['saison', 'proteines'],
  // catalogue :
  //   • saison     → filtre « saison » : donnée affichée ET filtrable ;
  //   • proteines  → tri « le plus protéiné » : la seule macro que la page lit
  //     (4 octets de données par recette, contre ~1 Mo d'instructions pour le
  //     catalogue entier). Les AUTRES macros restent interdites ci-dessus.
};

describe('listes de colonnes — aucun retour à select(\'*\')', () => {
  for (const [nom, select] of Object.entries(SELECTS)) {
    it(`« ${nom} » ne sélectionne pas toutes les colonnes`, () => {
      expect(select.trim()).not.toBe('*');
      // Un `*` se glisserait en tête, après une virgule, ou dans un embed `(*`
      expect(select).not.toMatch(/(^|[(,])\s*\*/);
    });
  }

  it('seul l\'historique se passe des ingrédients (aucun prix affiché)', () => {
    expect(SELECTS.resume).not.toContain('meal_ingredients');
  });
});

describe('listes de colonnes — contrat type ↔ base', () => {
  for (const [nom, champs] of Object.entries(REQUIS)) {
    it(`« ${nom} » contient tous les champs déclarés par son type`, () => {
      const select = SELECTS[nom as keyof typeof SELECTS];
      for (const champ of champs) {
        expect(select, `champ manquant : ${champ}`).toMatch(new RegExp(`\\b${champ}\\b`));
      }
    });
  }

  // Une ligne n'est chiffrable que si sa CONVERSION D'UNITÉ est possible :
  // `poids_unites` est donc requis partout où un prix est calculé, au même titre
  // que le prix lui-même. L'oublier ne casse rien de visible — la ligne devient
  // simplement « non chiffrable » et le budget de la semaine est sous-estimé.
  for (const nom of AVEC_INGREDIENTS) {
    it(`« ${nom} » embarque les ingrédients chiffrables (nom, prix, poids d'unité)`, () => {
      const select = SELECTS[nom];
      expect(select).toContain('meal_ingredients(');
      // Le catalogue insère `rayon` entre `nom` et le prix (filtre régimes) :
      // le contrat porte sur ce qui est requis, pas sur l'ordre exact.
      expect(select).toMatch(/ingredients\(id, nom(, rayon)?, prix_unitaire, unite_prix, poids_unites\)/);
    });
  }

  it('« catalogue » embarque le rayon des ingrédients (filtre de régime)', () => {
    // `recetteServable` (même source de vérité que le moteur) classifie par
    // rayon : le perdre rendrait les puces de régime muettes, en silence.
    expect(SELECTS.catalogue).toMatch(/ingredients\([^)]*\brayon\b/);
  });

  for (const nom of AVEC_INGREDIENTS_MOTEUR) {
    it(`« ${nom} » embarque les ingrédients lisibles par les filtres durs`, () => {
      const select = SELECTS[nom];
      expect(select).toContain('meal_ingredients(ingredient_id,');
      expect(select).toContain('ingredients(id, nom, rayon, prix_unitaire, unite_prix, poids_unites)');
    });
  }
});

describe('listes de colonnes — champs lourds exclus', () => {
  for (const [nom, select] of Object.entries(SELECTS)) {
    it(`« ${nom} » ne télécharge plus les champs non affichés`, () => {
      const interdits = CHAMPS_INTERDITS.filter(c => !(EXCEPTIONS[nom as keyof typeof SELECTS] ?? []).includes(c));
      const presents = interdits.filter(c => new RegExp(`\\b${c}\\b`).test(select));
      expect(presents, `champs encore demandés : ${presents.join(', ')}`).toEqual([]);
    });
  }
});
