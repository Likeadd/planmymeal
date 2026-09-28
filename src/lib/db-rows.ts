// ============================================================================
// Types de lignes DB + normalisateurs — PlanMyMeal
// - Alias lisibles sur les Row types générés par `supabase gen types`
// - Normalisateurs : lignes brutes PostgREST → interfaces applicatives
//   (les enums DB sont des `string`, l'app attend des unions strictes)
// ============================================================================

import type { Database } from '@/../supabase/database.types';
import type {
  Difficulte, Ingredient, IngredientCarte, IngredientQuantity, LigneIngredient, Meal,
  Profile, RecetteCarte, RecetteChiffrable, RecetteFavori, RecetteFrigo, RecetteMoteur,
  RecettePlanning, RecetteResume, RecetteSwap, Rayon, Saison, TypeRepas,
} from '@/types';
import { parseContexteJours, parseTempsMaxParJour } from '@/lib/memoire';
import { validerRythmeDesserts } from '@/lib/rotation-engine';
import { poidsUnitesDe } from '@/lib/unites';

type Rows = Database['public']['Tables'];
type RowOf<T extends keyof Rows> = Rows[T]['Row'];

export type IngredientRow = RowOf<'ingredients'>;
export type MealRow = RowOf<'meals'>;
export type MealIngredientRow = RowOf<'meal_ingredients'>;
export type PlanMealRow = RowOf<'plan_meals'>;
export type ProfileRow = RowOf<'profiles'>;
export type WeeklyPlanRow = RowOf<'weekly_plans'>;
export type ShoppingListItemRow = RowOf<'shopping_list_items'>;
export type ShoppingListRow = RowOf<'shopping_lists'>;
export type MealHistoryRow = RowOf<'meal_history'>;
export type UserPrixIngredientRow = RowOf<'user_prix_ingredients'>;
export type UserMealPreferenceRow = RowOf<'user_meal_preferences'>;
export type FridgeItemRow = RowOf<'fridge_items'>;
export type FamilyMemberRow = RowOf<'family_members'>;
export type FamilyMemberIngredientRow = RowOf<'family_member_ingredients'>;
export type FamilyMemberMealPreferenceRow = RowOf<'family_member_meal_preferences'>;

/** Ingrédient embarqué via meal_ingredients + embed `ingredients!inner(...)` */
export type EmbeddedIngredient = IngredientRow | null;
/** meal_ingredients tel que renvoyé par un embed PostgREST */
export interface MealIngredientEmbed {
  ingredient_id: number;
  quantite: number;
  unite: string;
  est_optionnel: boolean | null;
  ingredients?: EmbeddedIngredient | null;
}

/** weekly_plans tel que renvoyé avec l'embed plan_meals + meals + meal_ingredients */
export interface WeeklyPlanEmbed extends WeeklyPlanRow {
  plan_meals: PlanMealEmbed[];
}
export interface PlanMealEmbed extends PlanMealRow {
  /** Recette allégée : le planning ne charge que les colonnes affichées */
  meals: RecettePlanningEmbed | null;
}
/** meals tel que renvoyé avec l'embed meal_ingredients(+ingredients) */
export interface MealWithIngredients extends MealRow {
  meal_ingredients: MealIngredientEmbed[];
}

// ─── Liste de colonnes : la source de vérité de ce qui est téléchargé ───────
//
// Ces listes sont le pendant des types `RecetteCarte` / `RecettePlanning` /
// `RecetteFavori` : le type garantit qu'aucune carte ne LIT un champ absent,
// ces listes garantissent que la base ne renvoie rien de plus. Un `select('*')`
// téléchargeait `instructions` (≈1 ko par recette, soit 1 Mo pour le catalogue)
// et les macros détaillées — pour des écrans qui ne les affichent jamais.

/** Champs communs à toute carte (voir `RecetteCarte`) */
const COLONNES_CARTE =
  'id, titre, temps_preparation, temps_cuisson, calories_par_portion, difficulte';

/** Ingrédients : noms (filtres dessert, pastilles du foyer) et prix (tri, affichage) */
// `poids_unites` (poids d'une pièce, d'une cuillère…) est ce qui permet au
// chiffrage de convertir « 4 pcs » en kilos. Sans lui, la ligne de courses est
// simplement non chiffrable — la colonne est donc lue partout où un prix est
// calculé, y compris par le moteur (facteur budget du score).
const COLONNES_INGREDIENTS =
  'meal_ingredients(quantite, unite, est_optionnel, ingredients(id, nom, prix_unitaire, unite_prix, poids_unites))';

/** Planning : + ustensiles (MealCard) et portions (prix par portion) */
export const COLONNES_RECETTE_PLANNING =
  `${COLONNES_CARTE}, ustensiles, portions_par_defaut, ${COLONNES_INGREDIENTS}`;

/** Favoris : + type (filtres), cuisine et conservation (badges) */
export const COLONNES_RECETTE_FAVORI =
  `${COLONNES_CARTE}, type_repas, cuisine, conservation_jours, ${COLONNES_INGREDIENTS}`;

/**
 * Historique : le strict minimum d'une ligne de résumé — pas d'ingrédients.
 * Cette requête charge toutes les semaines enregistrées, donc c'est ici que
 * l'épargne est la plus forte.
 */
export const COLONNES_RECETTE_RESUME =
  'id, titre, temps_preparation, temps_cuisson, calories_par_portion';

// ─── Moteur de rotation (`generateWeeklyPlan`, `/api/pourquoi`) ──────────────
//
// Le pool du moteur charge TOUT le catalogue public à chaque génération :
// c'est ici que le `select('*')` coûtait le plus cher de l'application.
// Mesuré sur la base réelle : `instructions` pèse 1 016 ko sur les 1 122
// recettes publiques, téléchargées pour un moteur qui ne les lit JAMAIS (il
// classe sur la saison, la cuisine, la conservation, le temps, le prix et les
// ingrédients — pas sur la recette rédigée).
//
// L'embed d'ingrédients diffère de `COLONNES_INGREDIENTS` sur deux points, tous
// deux lus par le moteur : `ingredient_id` (frigo, allergies, dislikes,
// régimes) et `rayon` (règles de régime par rayon : viande, poisson…).

/** Ingrédient embarqué tel que le lit le moteur : + `rayon` (filtres de régime) */
export interface IngredientMoteur extends IngredientCarte {
  rayon: string;
}

/** Ligne `meal_ingredients` telle que la lit le moteur */
export interface MealIngredientMoteurEmbed {
  ingredient_id: number;
  quantite: number;
  unite: string;
  est_optionnel: boolean | null;
  ingredients: IngredientMoteur | null;
}

const COLONNES_INGREDIENTS_MOTEUR =
  'meal_ingredients(ingredient_id, quantite, unite, est_optionnel, ingredients(id, nom, rayon, prix_unitaire, unite_prix, poids_unites))';

/** Pool de candidats du moteur (voir `RecetteMoteur`) */
export const COLONNES_RECETTE_MOTEUR =
  `${COLONNES_CARTE}, type_repas, saison, cuisine, conservation_jours, ustensiles, portions_par_defaut, macros_verifiables, ${COLONNES_INGREDIENTS_MOTEUR}`;

/** Recettes rapides de `/api/vider-le-frigo` (voir `RecetteFrigo`) */
export const COLONNES_RECETTE_FRIGO =
  `${COLONNES_CARTE}, cuisine, image_url, ustensiles, portions_par_defaut, ${COLONNES_INGREDIENTS_MOTEUR}`;

// ─── Catalogue de recettes (`/recettes`) ────────────────────────────────────
//
// Volontairement PARTIEL. La page ne montre ni les instructions ni l'image ni
// les macros détaillées ; elle a besoin en revanche des ingrédients (prix pour
// le tri « le moins cher », et noms pour les pastilles du foyer).
//
// Les macros mesurées sur la vraie base : les `instructions` pèsent 1 016 ko
// pour tout le catalogue, contre 150 ko pour les ingrédients. Un `select('*')`
// téléchargeait donc 1 Mo de texte jamais affiché.

/** Ligne de catalogue normalisée, telle que la consomment les cartes de `/recettes`. */
export interface MealCatalogue extends RecetteChiffrable {
  id: number;
  titre: string;
  type_repas: TypeRepas;
  cuisine: string | null;
  /** Filtre « saison » du catalogue : donnée affichée ET filtrable */
  saison: Saison;
  ustensiles: string[];
  difficulte: Difficulte;
  temps_preparation: number;
  temps_cuisson: number | null;
  calories_par_portion: number | null;
  /** Tri « le plus protéiné » : seule macro lue par le catalogue (g/portion) */
  proteines: number | null;
  conservation_jours: number | null;
  /** Ingrédients AVEC rayon : le filtre « régime » du catalogue en a besoin */
  ingredients: LigneIngredientCatalogue[];
}

/** Une ligne `meal_ingredients` telle que la renvoie un embed PostgREST. */
export interface IngredientEmbedLigne {
  quantite: number;
  unite: string;
  est_optionnel: boolean | null;
  ingredients: IngredientCarte | null;
}

/**
 * Normalise l'embed d'ingrédients. Un embed rompu n'écarte PAS la recette, il
 * la prive simplement d'ingrédient chiffrable (même philosophie que `toMeal`).
 * Partagé par le catalogue et le vivier de suggestions.
 *
 * Générique : le catalogue demande `rayon` en plus (filtres de régime), les
 * autres écrans non — `G` porte les colonnes additionnelles RÉELLEMENT
 * demandées par le select, pour que le type ne mente jamais sur l'embed.
 */
function normaliserIngredients<G extends object = object>(
  lignes: {
    quantite: number;
    unite: string;
    est_optionnel: boolean | null;
    ingredients: (IngredientCarte & G) | null;
  }[] | null
): { quantite: number; unite: string; est_optionnel: boolean; ingredient: IngredientCarte & G }[] {
  // `poids_unites` vient d'une colonne jsonb libre : on la rétrécit ici pour
  // que le chiffrage ne reçoive jamais une forme inattendue.
  return (lignes ?? [])
    .filter(mi => mi.ingredients != null)
    .map(mi => ({
      quantite: mi.quantite,
      unite: mi.unite,
      est_optionnel: mi.est_optionnel ?? false,
      ingredient: {
        ...(mi.ingredients as IngredientCarte & G),
        poids_unites: poidsUnitesDe((mi.ingredients as { poids_unites?: unknown }).poids_unites),
      },
    }));
}

/** Ligne brute renvoyée par PostgREST pour le select du catalogue */
export interface MealCatalogueEmbed {
  id: number;
  titre: string;
  type_repas: string;
  cuisine: string | null;
  /** Filtre « saison » du catalogue (voir SELECT_CATALOGUE) */
  saison: string;
  ustensiles: string[] | null;
  difficulte: string;
  temps_preparation: number;
  temps_cuisson: number | null;
  calories_par_portion: number | null;
  /** Tri « le plus protéiné » (voir SELECT_CATALOGUE) */
  proteines: number | null;
  conservation_jours: number | null;
  portions_par_defaut: number;
  /** Embed avec `rayon` : le filtre « régime » du catalogue lit les rayons */
  meal_ingredients: {
    quantite: number;
    unite: string;
    est_optionnel: boolean | null;
    ingredients: IngredientCarteRayon | null;
  }[] | null;
}

/**
 * Ingrédient tel que demandé PAR LE CATALOGUE : + `rayon`, requis par le filtre
 * de régime (`recetteServable`, même source de vérité que le moteur).
 */
export type IngredientCarteRayon = IngredientCarte & { rayon: string };

/** Ligne d'ingrédient de catalogue : l'ingrédient embarqué porte son rayon */
export interface LigneIngredientCatalogue extends LigneIngredient {
  ingredient: IngredientCarteRayon;
}

/** Normalise une ligne de catalogue. */
export function toMealCatalogue(row: MealCatalogueEmbed): MealCatalogue {
  return {
    id: row.id,
    titre: row.titre,
    type_repas: row.type_repas as TypeRepas,
    cuisine: row.cuisine,
    saison: row.saison as Saison,
    ustensiles: row.ustensiles ?? [],
    difficulte: row.difficulte as Difficulte,
    temps_preparation: row.temps_preparation,
    temps_cuisson: row.temps_cuisson,
    calories_par_portion: row.calories_par_portion,
    proteines: row.proteines,
    conservation_jours: row.conservation_jours,
    portions_par_defaut: row.portions_par_defaut,
    ingredients: normaliserIngredients<{ rayon: string }>(row.meal_ingredients),
  };
}

// ─── Recettes de liste (planning, favoris) ──────────────────────────────────

/** Champs communs à tout embed de carte (voir `RecetteCarte`) */
interface CarteEmbedCommun {
  id: number;
  titre: string;
  temps_preparation: number;
  temps_cuisson: number | null;
  calories_par_portion: number | null;
  difficulte: string;
  meal_ingredients: IngredientEmbedLigne[] | null;
}

function baseCarte(row: CarteEmbedCommun): RecetteCarte {
  return {
    id: row.id,
    titre: row.titre,
    temps_preparation: row.temps_preparation,
    temps_cuisson: row.temps_cuisson,
    calories_par_portion: row.calories_par_portion,
    difficulte: row.difficulte as Difficulte,
    ingredients: normaliserIngredients(row.meal_ingredients),
  };
}

/** meals tel que renvoyé pour le planning (voir `COLONNES_RECETTE_PLANNING`) */
export interface RecettePlanningEmbed extends CarteEmbedCommun {
  ustensiles: string[] | null;
  portions_par_defaut: number;
}

export function toRecettePlanning(row: RecettePlanningEmbed): RecettePlanning {
  return {
    ...baseCarte(row),
    ustensiles: row.ustensiles ?? [],
    portions_par_defaut: row.portions_par_defaut,
  };
}

/** meals tel que renvoyé pour les favoris (voir `COLONNES_RECETTE_FAVORI`) */
export interface RecetteFavoriEmbed extends CarteEmbedCommun {
  type_repas: string;
  cuisine: string | null;
  conservation_jours: number | null;
}

/** meals tel que renvoyé pour l'historique (voir `COLONNES_RECETTE_RESUME`) */
export interface RecetteResumeEmbed {
  id: number;
  titre: string;
  temps_preparation: number;
  temps_cuisson: number | null;
  calories_par_portion: number | null;
}

export function toRecetteResume(row: RecetteResumeEmbed): RecetteResume {
  return {
    id: row.id,
    titre: row.titre,
    temps_preparation: row.temps_preparation,
    temps_cuisson: row.temps_cuisson,
    calories_par_portion: row.calories_par_portion,
  };
}

export function toRecetteFavori(row: RecetteFavoriEmbed): RecetteFavori {
  return {
    ...baseCarte(row),
    type_repas: row.type_repas as TypeRepas,
    cuisine: row.cuisine,
    conservation_jours: row.conservation_jours,
  };
}

// ─── Vivier de suggestions de remplacement ──────────────────────────────────
// LE sous-ensemble minimal : la modale de remplacement n'affiche ni les
// instructions (le poste le plus lourd), ni l'image, ni les macros détaillées,
// ni le type de repas, ni la difficulté. Chaque colonne ci-dessous est lue par
// `SwapModal` (titre, temps, calories), `prixParPortion` (portions + prix des
// ingrédients) ou les filtres express dessert (nom des ingrédients).

export interface RecetteSwapEmbed {
  id: number;
  titre: string;
  temps_preparation: number;
  temps_cuisson: number | null;
  calories_par_portion: number | null;
  portions_par_defaut: number;
  meal_ingredients: IngredientEmbedLigne[] | null;
}

export function toRecetteSwap(row: RecetteSwapEmbed): RecetteSwap {
  return {
    id: row.id,
    titre: row.titre,
    temps_preparation: row.temps_preparation,
    temps_cuisson: row.temps_cuisson,
    calories_par_portion: row.calories_par_portion,
    portions_par_defaut: row.portions_par_defaut,
    ingredients: normaliserIngredients(row.meal_ingredients),
  };
}

// ─── Moteur de rotation ─────────────────────────────────────────────────────

/** meals tel que renvoyé pour le moteur (voir `COLONNES_RECETTE_MOTEUR`) */
export interface RecetteMoteurEmbed extends CarteEmbedCommun {
  type_repas: string;
  saison: string;
  cuisine: string | null;
  conservation_jours: number | null;
  ustensiles: string[] | null;
  portions_par_defaut: number;
  /** Calibrée par le recalcul : voir `meals.macros_verifiables` */
  macros_verifiables: boolean;
  meal_ingredients: MealIngredientMoteurEmbed[] | null;
}

export function toRecetteMoteur(row: RecetteMoteurEmbed): RecetteMoteur {
  return {
    ...baseCarte(row),
    ustensiles: row.ustensiles ?? [],
    portions_par_defaut: row.portions_par_defaut,
    type_repas: row.type_repas as TypeRepas,
    saison: row.saison as Saison,
    cuisine: row.cuisine,
    conservation_jours: row.conservation_jours,
    macros_verifiables: row.macros_verifiables,
  };
}

/** meals tel que renvoyé pour `/api/vider-le-frigo` (voir `COLONNES_RECETTE_FRIGO`) */
export interface RecetteFrigoEmbed extends RecettePlanningEmbed {
  cuisine: string | null;
  image_url: string | null;
  meal_ingredients: MealIngredientMoteurEmbed[] | null;
}

export function toRecetteFrigo(row: RecetteFrigoEmbed): RecetteFrigo {
  return {
    ...toRecettePlanning(row),
    cuisine: row.cuisine,
    image_url: row.image_url,
  };
}

// ─── Normalisateurs ─────────────────────────────────────────────────────────

export function toProfile(row: ProfileRow, emailFallback = ''): Profile {
  return {
    id: row.id,
    email: row.email || emailFallback,
    full_name: row.full_name,
    nb_personnes: row.nb_personnes,
    budget_hebdo: row.budget_hebdo,
    objectif: row.objectif as Profile['objectif'],
    calories_par_jour: row.calories_par_jour,
    // Colonnes 00030 : absentes tant que la migration n'a pas tourné → null.
    sexe: row.sexe === 'homme' || row.sexe === 'femme' ? row.sexe : null,
    age: row.age ?? null,
    taille_cm: row.taille_cm ?? null,
    poids_kg: row.poids_kg ?? null,
    niveau_cuisine: row.niveau_cuisine as Profile['niveau_cuisine'],
    temps_max_semaine: row.temps_max_semaine,
    temps_max_weekend: row.temps_max_weekend,
    cuisines_preferees: row.cuisines_preferees ?? [],
    plan: row.plan as Profile['plan'],
    onboarding_complete: row.onboarding_complete,
    batch_cooking: row.batch_cooking,
    batch_cooking_jour: row.batch_cooking_jour,
    prix_max_portion: row.prix_max_portion,
    equipements: row.equipements ?? [],
    auto_restes: row.auto_restes,
    desserts_activees: row.desserts_activees,
    // Colonne 00022 ; si la migration n'a pas encore tourné sur l'env, la
    // valeur absente/invalidée retombe sur le défaut historique ('equilibre').
    rythme_desserts: validerRythmeDesserts(row.rythme_desserts),
    temps_max_par_jour: parseTempsMaxParJour(row.temps_max_par_jour),
    contexte_jours: parseContexteJours(row.contexte_jours),
    nouveaute: row.nouveaute ?? 20,
    utiliser_saison: row.utiliser_saison ?? true,
    poids_famille: row.poids_famille ?? 70,
    depense_reference_hebdo: row.depense_reference_hebdo,
    depense_reference_saisie_le: row.depense_reference_saisie_le,
    emails_transactionnels: row.emails_transactionnels,
    welcome_email_envoye_le: row.welcome_email_envoye_le,
    digest_envoye_le: row.digest_envoye_le,
  };
}

function toIngredient(row: IngredientRow): Ingredient {
  return {
    id: row.id,
    nom: row.nom,
    rayon: row.rayon as Rayon,
    saison: row.saison as Ingredient['saison'],
    prix_unitaire: row.prix_unitaire,
    unite_prix: row.unite_prix,
    poids_unites: poidsUnitesDe(row.poids_unites),
  };
}

export function toMeal(row: MealWithIngredients): Meal {
  return {
    id: row.id,
    titre: row.titre,
    description: row.description,
    type_repas: row.type_repas as Meal['type_repas'],
    temps_preparation: row.temps_preparation,
    temps_cuisson: row.temps_cuisson,
    difficulte: row.difficulte as Meal['difficulte'],
    saison: row.saison as Meal['saison'],
    cuisine: row.cuisine,
    calories_par_portion: row.calories_par_portion,
    proteines: row.proteines,
    glucides: row.glucides,
    lipides: row.lipides,
    macros_verifiables: row.macros_verifiables,
    fibres: row.fibres,
    conservation_jours: row.conservation_jours,
    ustensiles: row.ustensiles ?? [],
    instructions: row.instructions ?? [],
    image_url: row.image_url,
    portions_par_defaut: row.portions_par_defaut,
    created_by: row.created_by,
    is_public: row.is_public,
    ingredients: row.meal_ingredients.map(toIngredientQuantity),
  };
}

function toIngredientQuantity(mi: MealIngredientEmbed): IngredientQuantity {
  return {
    // Embed rompu → placeholder sans prix : la recette reste affichée mais
    // l'ingrédient est compté « non chiffrable » dans les calculs de prix.
    ingredient: mi.ingredients ? toIngredient(mi.ingredients) : {
      id: mi.ingredient_id,
      nom: `Ingrédient #${mi.ingredient_id}`,
      rayon: 'epicerie_salee',
      saison: 'toutes',
      prix_unitaire: null,
      unite_prix: null,
      poids_unites: null,
    },
    quantite: mi.quantite,
    unite: mi.unite as IngredientQuantity['unite'],
    est_optionnel: mi.est_optionnel ?? false,
  };
}
