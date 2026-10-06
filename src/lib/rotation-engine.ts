// ============================================================================
// Moteur de Rotation — Le cœur du produit
// ============================================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/../supabase/database.types';
import type { RecetteMoteur, Profile, DayPlan, RepasSlot } from '@/types';
import { EQUIPEMENTS, type MealPreference, type Regime } from '@/types';
import { facteurBudget, prixParPortion, prixMoyenPortions } from '@/lib/budget';
import { recomputeShoppingList, snapshotBudget } from '@/lib/courses-budget';
import {
  isDessert, pickPourSlot, optimiserRecoupement, SCORE_MIN_PLAT,
  type Rng, type SlotContexte,
} from '@/lib/moteur-creneaux';

// Créneaux (contraintes du jour, tirage pondéré) et recoupement des ingrédients
// frais vivent dans lib/moteur-creneaux.ts — ré-exportés pour les imports existants.
export {
  isDessert, scorePourSlot, pickPourSlot, eligiblePourSlot, optimiserRecoupement,
  ingredientsPerissables, scoreRecoupement, baseTitre, ITERATIONS_RECOUPEMENT, TOLERANCE_RECOUPEMENT,
  type Rng, type SlotContexte,
} from '@/lib/moteur-creneaux';

// Liste de courses et snapshot budget vivent dans lib/courses-budget.ts ;
// ré-exportés ici pour les routes qui les importaient depuis le moteur.
export { recomputeShoppingList, snapshotBudget, calculerDepenseSemaine } from '@/lib/courses-budget';
import { getSaisonActuelle, JOURS_NOMS } from '@/lib/dates';
import { couvertureFrigo, ingredientIdsFrigo } from '@/lib/frigo';
import { recetteServable, type IngredientPourRegime } from '@/lib/regimes';
import {
  chargerMemoire, tempsMaxJour, contexteJour,
  type MemoireAlimentaire,
} from '@/lib/memoire';
import {
  alimentsInterdits, chargerFamille, compromisFamille, facteurFamille,
  recettesVetees, type Famille,
} from '@/lib/famille';
import {
  toRecetteMoteur, toProfile,
  COLONNES_RECETTE_MOTEUR,
  type RecetteMoteurEmbed, type MealIngredientMoteurEmbed,
} from '@/lib/db-rows';
import { UserError } from '@/lib/utils';
import { cibleCaloriqueJour, facteurCalories } from '@/lib/nutrition';
import { chargerExclusionsUtilisateur } from '@/lib/exclusions-alimentaires';

/** Client Supabase typé (browser ou admin) */
export type Db = SupabaseClient<Database>;

// ─── Intention d'optimisation (audit UX : « Optimiser ma semaine » au clic) ──

/**
 * Ce que l'utilisateur demande EN PLUS quand il clique « Optimiser ma
 * semaine ». Le moteur arbitre déjà les 7 dimensions à chaque génération ;
 * l'intention incline la pondération sans jamais la remplacer :
 *
 *  - 'budget'     → pousse davantage vers les recettes économiques ;
 *  - 'temps'      → favorise les recettes rapides toute la semaine ;
 *  - 'gaspillage' → survalorise ce que le frigo couvre (anti-gaspi express).
 *
 * Les autres dimensions (goûts, restes/batch, nutrition, équipement) restent
 * pondérées à l'identique — l'intention ne doit JAMAIS écraser les contraintes
 * dures : allergies, régimes, vetos, bannissements et cap budget s'appliquent
 * avant, exactement comme sans intention.
 */
export type IntentionOptimisation = 'budget' | 'temps' | 'gaspillage';

const INTENTIONS_VALIDES: readonly IntentionOptimisation[] = ['budget', 'temps', 'gaspillage'];

/** Garde d'entrée : valide une intention venue du réseau (undefined = défaut) */
export function validerIntention(v: unknown): IntentionOptimisation | undefined {
  if (v == null || v === 'equilibre') return undefined;
  return INTENTIONS_VALIDES.includes(v as IntentionOptimisation)
    ? (v as IntentionOptimisation)
    : undefined;
}

/**
 * Poids de chaque intention en FACTEUR BUDGET et en BOOST FRIGO (fraîcheur) :
 * sans intention ('equilibre'), l'anti-gaspi reste encadré (×1.3 au lieu de ×2)
 * pour ménager la mémoire alimentaire et la variété.
 */
export const POIDS_INTENTION = {
  equilibre: { budget: 1.0, frigoFraicheur: 1.3 },
  budget: { budget: 2.0, frigoFraicheur: 1.3 },
  temps: { budget: 1.0, frigoFraicheur: 1.3 },
  gaspillage: { budget: 1.0, frigoFraicheur: 2.0 },
} as const;
/** Recette scorée prête à être placée dans le planning */
export interface Candidate {
  meal: RecetteMoteur;
  score: number;
  /** Mémoire explicite de l'utilisateur pour cette recette (note, fréquence, jour…) */
  preference?: MealPreference | null;
  /** Part des ingrédients déjà présents au frigo (0 → 1) */
  partFrigo?: number;
  /** Compromis familial calculé (≈ 1 = neutre, jamais 0). Sert à l'explication. */
  compromis?: number;
}

/** shopping_list_items avec l'embed ingredients (chiffrage de la liste) */
export interface ShoppingListItemWithIngredient {
  ingredient_id: number;
  quantite_totale: number;
  unite: string;
  rayon: string;
  checked: boolean;
  ingredients: { id: number; nom: string; prix_unitaire: number | null; unite_prix: string | null };
}

const MIN_DAYS_BEFORE_REUSE = 21;

/**
 * Délai (jours) réglé par le créateur du foyer pour reproposer une recette
 * déjà aimée — réglage « Ma cuisine » (voir /api/foyer-partage). `null` si
 * indisponible (RLS, foyer non résolu…) : le moteur retombe alors sur le
 * minimum générique, comportement inchangé.
 */
async function chargerDelaiRecettesAimees(userId: string, supabase: Db): Promise<number | null> {
  const { data } = await supabase
    .from('household_members')
    .select('households(delai_recettes_aimees_jours)')
    .eq('user_id', userId)
    .maybeSingle();
  const households = (data as { households: { delai_recettes_aimees_jours: number } | null } | null)?.households;
  return households?.delai_recettes_aimees_jours ?? null;
}
const IDEAL_ROTATION_DAYS = 30;

/** Appareils "spécifiques" : en posséder change la manière de cuisiner. */
export const APPAREILS_CONNUES: readonly string[] = EQUIPEMENTS;

interface ScoreInput {
  meal: RecetteMoteur;
  profile: Profile;
  joursDepuisDerniere: number | null;
  nbLikes: number;
  nbDislikes: number;
  nbApparitions: number;
  saisonActuelle: string;
  /** Si true, le batch cooking est actif → boost de conservation */
  batchCooking?: boolean;
  /** Curseur Confort (0) ↔ Découverte (100) — profil.nouveaute */
  nouveaute?: number;
  /** Part des ingrédients déjà présents au frigo (0 → 1) */
  partFrigo?: number;
  /** Mémoire explicite : note / fréquence / jour préféré de l'utilisateur */
  preference?: MealPreference | null;
  /** Facteur de compromis familial (1 = neutre ; voir lib/famille.ts) */
  facteurCompromis?: number;
  /**
   * Délai (en jours) réglé par le foyer pour reproposer une recette AIMÉE
   * (au moins un « J'adore »/like en historique) — réglage « Ma cuisine »,
   * modifiable uniquement par le créateur du foyer. Remplace le minimum de
   * rotation générique (21 j) pour CES recettes précisément ; le reste du
   * catalogue garde le minimum générique. Une fréquence explicite posée sur
   * la recette elle-même (`preference.frequence_jours`) prime toujours.
   */
  delaiRecettesAimees?: number | null;
}

export function calculateMealScore(input: ScoreInput): number {
  const { joursDepuisDerniere, nbLikes, nbDislikes, nbApparitions, saisonActuelle, meal, profile, batchCooking, preference } = input;

  // Cible de rotation effective pour CETTE recette : la fréquence explicite
  // posée dessus prime, sinon le délai « recettes aimées » du foyer s'applique
  // si elle a déjà été aimée, sinon le minimum générique inchangé.
  const cibleExplicite = preference?.frequence_jours
    ?? (nbLikes > 0 ? (input.delaiRecettesAimees ?? null) : null);
  const minReprise = cibleExplicite ?? MIN_DAYS_BEFORE_REUSE;
  // Le palier « pleinement éligible » suit la cible : un délai court réglé
  // par le foyer (ex. 10 j) ne doit pas rester à 70 % de score jusqu'à 30 j.
  const rotationIdeale = cibleExplicite != null
    ? Math.max(minReprise + 1, Math.round(minReprise * 1.4))
    : IDEAL_ROTATION_DAYS;

  // Facteur ancienneté (0 à 1)
  let facteurAnciennete = 0;
  if (joursDepuisDerniere === null) {
    facteurAnciennete = 0.85; // Jamais mangé → bonus découverte
  } else if (joursDepuisDerniere < minReprise) {
    facteurAnciennete = 0; // Trop récent → bloqué
  } else if (joursDepuisDerniere < rotationIdeale) {
    facteurAnciennete = 0.3 + (0.7 * (joursDepuisDerniere - minReprise)) / (rotationIdeale - minReprise);
  } else {
    facteurAnciennete = 1.0; // +30 jours → pleinement éligible
  }

  // Facteur saison (0.4 à 1.0) — désactivable : `profile.utiliser_saison`
  // (choix fait à l'inscription, modifiable dans les préférences) coupe ce
  // favoritisme pour qui préfère un catalogue non filtré par la saison.
  let facteurSaison = 1.0;
  if (profile.utiliser_saison !== false && meal.saison !== 'toutes') {
    const saisonsOpposees: Record<string, string> = { ete: 'hiver', hiver: 'ete', printemps: 'automne', automne: 'printemps' };
    facteurSaison = meal.saison === saisonActuelle ? 1.0 : (saisonsOpposees[meal.saison] === saisonActuelle ? 0.4 : 0.7);
  }

  // Facteur préférence (0.2 à 1.5)
  let facteurPreference = 1.0;
  if (nbLikes > 0) facteurPreference = Math.min(1.5, 1.0 + nbLikes * 0.1);
  if (nbDislikes >= 2) facteurPreference = 0.2;
  else if (nbDislikes === 1) facteurPreference *= 0.5;
  if (meal.cuisine && profile.cuisines_preferees?.some((c) => c.toLowerCase() === meal.cuisine?.toLowerCase())) {
    facteurPreference *= 1.2;
  }

  // Facteur variété
  let facteurVariete = 1.0;
  if (nbApparitions >= 3) facteurVariete = 0.6;

  // ⭐ Facteur batch cooking / conservation (0.5 à 1.4)
  let facteurConservation = 1.0;
  if (batchCooking && meal.conservation_jours != null) {
    if (meal.conservation_jours >= 5) {
      facteurConservation = 1.4; // Excellent pour le batch cooking (gratins, tajines, soupes)
    } else if (meal.conservation_jours >= 3) {
      facteurConservation = 1.2; // Bonne conservation
    } else if (meal.conservation_jours <= 1) {
      facteurConservation = 0.5; // À manger immédiatement (salades, poisson frais, œufs)
    }
  }

  // ⭐ Facteur mémoire explicite (notation + fréquence souhaitée). C'est ici que
  // « J'adore » / « Je n'aime pas » et « environ tous les 20 jours » deviennent
  // des nombres : la note utilisateur pèse plus lourd que l'ancienneté.
  let facteurMemoire = 1.0;
  if (preference?.note != null) {
    if (preference.note >= 5) facteurMemoire = 1.35;
    else if (preference.note === 4) facteurMemoire = 1.15;
    else if (preference.note === 3) facteurMemoire = 1.0;
    else if (preference.note === 2) facteurMemoire = 0.45;
    else facteurMemoire = 0.15;
  }

  let facteurFrequence = 1.0;
  if (cibleExplicite != null) {
    if (joursDepuisDerniere == null) {
      facteurFrequence = 1.15; // jamais servie mais demandée souvent → on la place
    } else {
      const ratio = joursDepuisDerniere / cibleExplicite;
      facteurFrequence = ratio >= 1
        ? Math.min(1.3, 1 + 0.3 * Math.min(1, ratio - 1))
        : Math.max(0.35, ratio); // trop tôt par rapport au rythme voulu
    }
  }

  // ⭐ Curseur Confort ↔ Découverte : en mode découverte, une recette jamais
  // servie est boostée ; en mode confort, c'est l'inverse.
  const nouveaute = Math.min(100, Math.max(0, input.nouveaute ?? 50));
  const decouverte = nouveaute / 100;
  const facteurNouveaute = nbApparitions === 0
    ? 1 + 0.4 * decouverte
    : 1 + 0.4 * (1 - decouverte);

  // ⭐ Frigo : boost plafonné à +35 %. Volontairement modeste — le frigo est un
  // signal, pas un objectif (on ne construit pas un menu juste pour le vider).
  const partFrigo = Math.min(1, Math.max(0, input.partFrigo ?? 0));
  const facteurFrigo = 1 + 0.35 * partFrigo;

  // ⭐ Compromis familial : facteur calculé en amont par lib/famille.ts à partir
  // des préférences de CHAQUE membre (moyenne géométrique pondérée). Il arrive
  // tout fait pour que l'appelant puisse aussi produire l'explication sans
  // recalculer. 1 = neutre (foyer seul, ou poids_famille à 0).
  const facteurCompromis = input.facteurCompromis ?? 1;

  // ⭐ Objectif calorique : les repas principaux proches de la part attendue de
  // la cible journalière (calories_par_jour, choisie à l'inscription) sont
  // favorisés. Uniquement si les calories de la recette sont vérifiées — même
  // règle que le jour « léger » : on ne juge pas sur une donnée invérifiable.
  const facteurObjectifCalories = !isDessert(meal) && meal.macros_verifiables
    ? facteurCalories(meal.calories_par_portion, cibleCaloriqueJour(profile))
    : 1;

  return facteurAnciennete * facteurSaison * facteurPreference * facteurVariete
    * facteurConservation * facteurMemoire * facteurFrequence * facteurNouveaute
    * facteurFrigo * facteurCompromis * facteurObjectifCalories;
}

// Déplacée dans lib/dates.ts (module neutre) pour que la mémoire alimentaire
// y accède sans créer de dépendance circulaire. Ré-exportée ici : les appelants
// existants (et les tests) ne changent pas.
export { getSaisonActuelle };

// ─── Génération semaine ───────────────────────────────────────────────────

/** Seuil score en dessous duquel un plat n'entre pas dans la pioche */
/** Nombre max de desserts du soir par semaine (3 à 4 selon disponibilité) */
const DESSERTS_PAR_SEMAINE = 4;
/** Nombre max de desserts du midi par semaine (léger : yaourt, fruits...) */
export const DESSERTS_MIDI_PAR_SEMAINE = 3;

// ─── Rythme des desserts (axe 3 de l'audit : un réglage, pas un interrupteur)

/**
 * Palier choisi par le foyer (« Mon compte → Ma cuisine » + onboarding).
 * Remplace le binaire desserts_activees (colonne conservée en miroir, voir
 * migration 00022) : les attentes intermédiaires existaient — « plus léger »,
 * « tous les soirs » — et n'avaient aucune réponse.
 */
export type RythmeDesserts = 'aucun' | 'leger' | 'equilibre' | 'gourmand';

const RYTHMES_VALIDES: readonly RythmeDesserts[] = ['aucun', 'leger', 'equilibre', 'gourmand'];

/** Garde d'entrée : valide une valeur venue du profil/réseau (défaut sûr) */
export function validerRythmeDesserts(v: unknown): RythmeDesserts {
  return RYTHMES_VALIDES.includes(v as RythmeDesserts) ? (v as RythmeDesserts) : 'equilibre';
}

/**
 * Palier → nombres effectifs. `null` = aucun dessert du soir/midi.
 * ÉQUILIBRE = le comportement historique EXACT (4 soirs max via
 * DESSERTS_PAR_SEMAINE, jours prioritaires [sam, dim, mer, jeu] ; 3 midis max
 * via DESSERTS_MIDI_PAR_SEMAINE) — les semaines existantes ne changent pas.
 * LÉGER et GOURMAND encadrent : ils bornent respectivement au-dessus et
 * en-dessous, en gardant la même priorité de jours (week-end d'abord).
 */
export const RYTHME_DESSERTS: Record<RythmeDesserts, { soirs: number | null; midis: number | null }> = {
  aucun:     { soirs: null, midis: null },
  leger:     { soirs: 2,    midis: 1 },
  equilibre: { soirs: DESSERTS_PAR_SEMAINE, midis: DESSERTS_MIDI_PAR_SEMAINE },
  gourmand:  { soirs: 6,    midis: 3 },
};

/**
 * Nombre de repas principaux (déjeuner + dîner) qu'une semaine doit remplir.
 * En dessous, le moteur entre dans son filet de sécurité : il relâche la
 * rotation de 21 jours pour ne pas rendre un planning troué. C'est donc le seuil
 * au-dessous duquel un profil trop contraint cesse de garantir la variété — le
 * chiffre qu'un diagnostic d'éligibilité doit comparer (voir
 * `scripts/verifier-eligibilite.ts`).
 */
export const NB_REPAS_PRINCIPAUX = 14;
/** Un créneau du planning (ex : mercredi dîner, samedi dessert, mardi dessert du midi) */
export interface PlanSlot {
  jour_semaine: number;
  repas_type: RepasSlot;
}


/**
 * Desserts « express » du midi : préparation ≤ 10 min (yaourt, fruits,
 * compotes...). Le déjeuner appelle des desserts rapides — pas un gâteau
 * à cuire 35 min entre deux réunions.
 */
function isDessertExpress(meal: RecetteMoteur): boolean {
  return (meal.temps_preparation + (meal.temps_cuisson || 0)) <= 10;
}



export async function generateWeeklyPlan(
  userId: string,
  semaineDebut: string,
  supabase: Db,
  /** Source aléatoire injectable — les tests passent une suite déterministe */
  rng: Rng = Math.random,
  /** Inclinaison du clic « Optimiser ma semaine » (défaut : équilibré) */
  intention: IntentionOptimisation | undefined = undefined
): Promise<{ days: DayPlan[]; fallbackUtilise: boolean; cuisinesDiversifiees: string[] }> {
  const { candidats, fallbackUtilise, cuisinesDiversifiees, memoire } = await buildCandidates(userId, supabase, intention);

  // Pools séparés : les créneaux déjeuner/dîner ne reçoivent que des plats,
  // les desserts alimentent 3-4 dîners de la semaine.
  const plats = candidats.filter(c => !isDessert(c.meal));
  const desserts = candidats.filter(c => isDessert(c.meal));

  // select('*') plutôt que des colonnes explicites : si une migration
  // (00010 desserts_activees, 00013…) n'a pas été appliquée sur l'env, une
  // colonne manquante ferait échouer TOUTE la requête → profil null →
  // batch cooking et préférences silencieusement ignorés. Avec '*' la ligne
  // revient sans les clés absentes et les défauts s'appliquent.
  const { data: profileRow } = await supabase
    .from('profiles').select('*').eq('id', userId).single();
  const profile = profileRow as
    | {
        batch_cooking: boolean | null; batch_cooking_jour: number | null;
        auto_restes: boolean | null; desserts_activees: boolean | null;
        temps_max_semaine: number | null; temps_max_weekend: number | null;
      }
    | null;


  // Contraintes du jour : « mercredi soir → 15 min », « dimanche midi → élaboré ».
  // Évaluées à chaque créneau plutôt que sur le pool complet, sinon la règle
  // métier « un repas rapide le mercredi » n'aurait aucun effet.
  const slots = (jourIndex: number, repasType: RepasSlot): SlotContexte => ({
    jourIndex,
    repasType,
    tempsMax: tempsMaxJour(memoire, jourIndex, profile as unknown as Profile | null),
    contexte: contexteJour(memoire, jourIndex),
    nouveaute: memoire.nouveaute,
    intention,
  });

  let days = profile?.batch_cooking
    ? buildBatchWeek(plats, JOURS_NOMS, profile.batch_cooking_jour ?? 6, slots, rng)
    : buildStandardWeek(plats, JOURS_NOMS, slots, rng);

  // ⭐ Meal Prep Pro : d'abord, les déjeuners deviennent les restes du dîner de
  // la veille (cuisiner ×2 le soir, lunchbox le lendemain midi) — le choix des
  // desserts du midi en tient compte juste après.
  if (profile?.auto_restes) {
    days = days.map((d, i) => {
      const veille = i > 0 ? days[i - 1] : null;
      if (!d.dejeuner || !veille?.diner) return d;
      return { ...d, restesDe: veille.diner.id };
    });
  }

  // ⭐ Desserts — le RYTHME choisi par le foyer pilote les attributions
  // (jamais le même dessert deux fois dans la semaine ; pool vide → semaine
  // sans). 'aucun' → semaine sans dessert (équivalent de l'ancien
  // desserts_activees = false, colonne conservée en miroir).
  const rythmeBrut = (profile as { rythme_desserts?: unknown } | null)?.rythme_desserts;
  let rythme = validerRythmeDesserts(rythmeBrut);
  // Gate PRO (le seul de la gamme desserts, décidé avec l'audit) : « Gourmand »
  // (5-6 soirs + 3 midis) est réservé aux plans Pro/Famille. Un gratuit qui
  // aurait réussi à écrire 'gourmand' (client patché, RLS permissive) retombe
  // sur « Équilibré » — le moteur est la dernière ligne de défense, l'UI
  // verrouille déjà le choix en amont.
  // Desserts : avantage des plans payants (lib/limites.ts) — un compte
  // gratuit a des semaines sans dessert, quel que soit le rythme enregistré.
  const planProfil = (profile as { plan?: string } | null)?.plan;
  if (planProfil !== 'pro' && planProfil !== 'famille') rythme = 'aucun';
  const cible = RYTHME_DESSERTS[rythme];
  if (cible.soirs != null) {
    days = assignerDesserts(days, desserts, cible.soirs, 'dessert', rng);
    // Desserts du midi : desserts express d'abord (yaourt, fruits...). En
    // batch cooking, les jours couverts par le batch restent éligibles même
    // en mode restes — le dessert express complète naturellement la lunchbox.
    const dessertsExpress = desserts.filter(c => isDessertExpress(c.meal));
    const batchJourMidi = profile?.batch_cooking_jour ?? 6;
    const joursBatch = profile?.batch_cooking
      ? [batchJourMidi, (batchJourMidi + 1) % 7, (batchJourMidi + 2) % 7, (batchJourMidi + 3) % 7]
      : [];
    if (cible.midis != null) {
      days = assignerDessertsMidi(days, dessertsExpress.length > 0 ? dessertsExpress : desserts, cible.midis, joursBatch, rng);
    }
  }

  return { days, fallbackUtilise, cuisinesDiversifiees };
}

/**
 * Attribue un dessert du soir à au plus `max` jours (sam, dim, mer, jeu en
 * priorité — les dîners les plus festifs), sans répéter le même dessert.
 * Pool vide → aucun dessert, la semaine reste valide.
 */
function assignerDesserts(
  days: DayPlan[],
  pool: Candidate[],
  max: number,
  cleSlot: 'dessert' | 'dessert_midi',
  rng: Rng = Math.random
): DayPlan[] {
  if (pool.length === 0) return days;
  // Jours prioritaires : week-end d'abord puis milieu de semaine
  const joursCibles = [5, 6, 2, 3].slice(0, Math.min(max, pool.length));

  const restants = pool.slice();
  const picks = new Map<number, RecetteMoteur>();
  for (const jour of joursCibles) {
    const total = restants.reduce((s, c) => s + Math.max(c.score, SCORE_MIN_PLAT), 0);
    let r = rng() * total;
    let idx = restants.length - 1;
    for (let i = 0; i < restants.length; i++) {
      r -= Math.max(restants[i].score, SCORE_MIN_PLAT);
      if (r <= 0) { idx = i; break; }
    }
    picks.set(jour, restants.splice(idx, 1)[0].meal);
  }

  const cle = cleSlot === 'dessert' ? 'dessert' : 'dessertMidi';
  return days.map(d => picks.has(d.jourIndex) ? { ...d, [cle]: picks.get(d.jourIndex)! } : d);
}

/**
 * Attribue un dessert express (yaourt, fruits...) à au plus `max` déjeuners par
 * semaine (borne par le RYTHME choisi), jamais le même deux fois. Priorité aux
 * déjeuners « libres » (pas un reste meal prep) ; en batch cooking, les jours
 * couverts par le batch restent éligibles même si le déjeuner y est un reste —
 * le dessert express complète la lunchbox. Exporté pour testabilité.
 */
export function assignerDessertsMidi(
  days: DayPlan[],
  pool: Candidate[],
  max: number,
  joursBatch: readonly number[] = [],
  rng: Rng = Math.random
): DayPlan[] {
  if (pool.length === 0) return days;
  const estJourBatch = new Set(joursBatch);
  // 1. Déjeuners libres (pas de reste) — le dessert s'y prête le mieux
  // 2. Jours batch en mode restes — un yaourt/fruits voyage très bien
  // Un jour sans déjeuner n'est jamais éligible (dessert sans repas = bizarre).
  const joursEligibles = [
    ...days.filter(d => d.dejeuner && d.restesDe == null).map(d => d.jourIndex),
    ...days.filter(d => d.dejeuner && d.restesDe != null && estJourBatch.has(d.jourIndex)).map(d => d.jourIndex),
  ];
  const joursCibles = joursEligibles.slice(0, Math.min(max, pool.length));

  const restants = pool.slice();
  const picks = new Map<number, RecetteMoteur>();
  for (const jour of joursCibles) {
    const total = restants.reduce((s, c) => s + Math.max(c.score, SCORE_MIN_PLAT), 0);
    let r = rng() * total;
    let idx = restants.length - 1;
    for (let i = 0; i < restants.length; i++) {
      r -= Math.max(restants[i].score, SCORE_MIN_PLAT);
      if (r <= 0) { idx = i; break; }
    }
    picks.set(jour, restants.splice(idx, 1)[0].meal);
  }

  return days.map(d => picks.has(d.jourIndex) ? { ...d, dessertMidi: picks.get(d.jourIndex)! } : d);
}

// ─── Candidats scorés (partagé génération complète + régénération par slot) ─

export interface CandidatesResult {
  candidats: Candidate[];
  /** true si le filet de sécurité a levé le cooldown 21j (recettes récentes réutilisées) */
  fallbackUtilise: boolean;
  /** En fallback : cuisines peu servies récemment, mises en avant pour varier les plaisirs */
  cuisinesDiversifiees: string[];
  /** Mémoire alimentaire du foyer, chargée une seule fois pour toute la génération */
  memoire: MemoireAlimentaire;
  /** Compromis familial (membres + pondération), chargé une seule fois lui aussi */
  famille: Famille;
}

/**
 * Règles DURES d'éligibilité d'une recette.
 *
 * Regroupées ici parce qu'elles étaient recopiées à l'identique dans la passe
 * standard et dans le filet de sécurité : ajouter une règle (interdits du
 * foyer, cap budget) obligeait à penser aux deux endroits, et une divergence
 * entre les deux aurait laissé passer une recette interdite.
 *
 * Fonction PURE → testable sans base de données.
 */
export interface FiltresDurs {
  allergiesIds: Set<number>;
  dislikesIds: Set<number>;
  regimes: Regime[];
  /** Cap strict prix/portion (Pro), null = pas de cap */
  prixMax: number | null;
  /** Aliments interdits par un membre du foyer (allergie, intolérance, éthique) */
  alimentsInterditsFamille: Set<number>;
  /** Recettes bloquées par un veto majoritaire du foyer */
  recettesVeteesFamille: Set<number>;
  /** Recettes bannies par le propriétaire du compte (« ne plus jamais proposer ») */
  bannies: Set<number>;
}

/** Motif d'exclusion d'une recette */
export type MotifExclusion =
  | 'bannie' | 'veto_famille' | 'composition_inconnue' | 'allergie'
  | 'interdit_famille' | 'dislikes' | 'regime' | 'prix';

/** meal_ingredients (embed PostgREST) → forme attendue par le filtre régimes */
export function versIngredientsRegime(mi: MealIngredientMoteurEmbed[]): IngredientPourRegime[] {
  return mi.map(i => ({
    id: i.ingredient_id,
    nom: i.ingredients?.nom ?? '',
    rayon: i.ingredients?.rayon ?? null,
    est_optionnel: i.est_optionnel ?? false,
  }));
}

/**
 * Motif d'exclusion d'une recette, ou `null` si elle est éligible.
 * Ordre des règles : du non-négociable (bannissement, allergie) au préférentiel
 * (prix), pour que le motif renvoyé soit le plus significatif.
 */
export function raisonExclusion(
  meal: RecetteMoteur,
  ingredientIds: number[],
  ingredients: IngredientPourRegime[],
  filtres: FiltresDurs
): MotifExclusion | null {
  // Un bannissement explicite n'est JAMAIS relâché, même en filet de sécurité :
  // ni celui du compte, ni le veto majoritaire du foyer.
  if (filtres.bannies.has(meal.id)) return 'bannie';
  if (filtres.recettesVeteesFamille.has(meal.id)) return 'veto_famille';

  // Composition inconnue : la recette n'a AUCUN ingrédient enregistré. C'est le
  // cas de 455 recettes publiques (45 % des plats) — un import les a insérées
  // sans leurs liens d'ingrédients. Aucune règle de sécurité n'est alors
  // évaluable : ni allergie, ni régime, ni aliment interdit par un membre.
  //
  // Pour un foyer qui a déclaré l'une de ces trois contraintes, on écarte
  // plutôt que de supposer — servir à l'aveugle n'est pas un choix par défaut.
  // Les goûts (dislikes) et le prix, eux, restent des préférences : ils ne
  // justifient pas d'écarter 45 % du catalogue, donc ils ne déclenchent pas
  // cette règle.
  if (
    ingredientIds.length === 0
    && (filtres.allergiesIds.size > 0 || filtres.regimes.length > 0 || filtres.alimentsInterditsFamille.size > 0)
  ) {
    return 'composition_inconnue';
  }

  // Allergies : équivalentes pour tous, elles passent avant tout le reste
  if (ingredientIds.some(id => filtres.allergiesIds.has(id))) return 'allergie';
  // Aliments interdits par un membre : même traitement qu'une allergie
  if (ingredientIds.some(id => filtres.alimentsInterditsFamille.has(id))) return 'interdit_famille';

  // Dislikes → exclure si +50 % des ingrédients sont dislikés
  const nbDisliked = ingredientIds.filter(id => filtres.dislikesIds.has(id)).length;
  if (nbDisliked > ingredientIds.length * 0.5) return 'dislikes';

  // Régimes : végan/végétarien/halal/sans-porc/… excluent certaines recettes
  if (filtres.regimes.length > 0 && !recetteServable(ingredients, filtres.regimes)) return 'regime';

  // Cap strict prix/portion : la promesse budget prime aussi en filet de sécurité
  if (filtres.prixMax && filtres.prixMax > 0) {
    const pp = prixParPortion(meal);
    if (pp != null && pp > filtres.prixMax) return 'prix';
  }

  return null;
}

/**
 * Pool de candidats : les recettes PUBLIQUES servables en déjeuner / dîner
 * (plats et desserts), paginées jusqu'à épuisement.
 *
 * ⚠️ PAGINATION OBLIGATOIRE : PostgREST plafonne chaque réponse (1000 lignes par
 * défaut sur Supabase). Une requête unique ne renvoyait donc que 1000 recettes
 * sur les 1122 publiées — 11 % du catalogue n'était JAMAIS proposé, et le pool
 * d'un foyer qui filtre (allergies, interdits, régimes) se réduit d'autant.
 * `order('id')` est indispensable : sans ordre stable, deux pages peuvent se
 * chevaucher et une recette être manquée.
 *
 * `select('*')` ici était le plus gros téléchargement de l'application :
 * `instructions` seul pèse 1 016 ko sur les 1 122 recettes publiques, à chaque
 * génération — pour un moteur qui ne les lit jamais (voir
 * `COLONNES_RECETTE_MOTEUR`).
 *
 * Extraite de `buildCandidates` pour être exécutable telle quelle : c'est la
 * seule requête du moteur avant toute décision, donc la seule qu'un diagnostic
 * d'éligibilité doit reproduire — et le meilleur moyen de la reproduire est de
 * l'appeler, pas d'en recopier une copie qui divergera.
 */
export async function chargerPoolMoteur(supabase: Db): Promise<RecetteMoteurEmbed[]> {
  if (poolCache && Date.now() - poolCache.at < POOL_TTL_MS) return poolCache.rows;
  poolEnCours ??= chargerPoolDepuisBase(supabase)
    .then(rows => {
      poolCache = { at: Date.now(), rows };
      return rows;
    })
    .finally(() => { poolEnCours = null; });
  return poolEnCours;
}

// Le pool ne contient que des recettes PUBLIQUES, identiques pour tous les
// utilisateurs : une instance serveur chaude le réutilise quelques minutes au
// lieu de retélécharger ~2 500 recettes + ingrédients à chaque génération.
const POOL_TTL_MS = 10 * 60_000;

/** Pool normalisé, mémorisé par instantané (clé = tableau de lignes du cache). */
const poolConverti = new WeakMap<RecetteMoteurEmbed[], {
  repas: RecetteMoteur[];
  mealIngredientsByMeal: Map<number, MealIngredientMoteurEmbed[]>;
}>();

function convertirPool(rows: RecetteMoteurEmbed[]) {
  let v = poolConverti.get(rows);
  if (!v) {
    v = {
      repas: rows.map(toRecetteMoteur),
      mealIngredientsByMeal: new Map(rows.map(m => [m.id, m.meal_ingredients ?? []])),
    };
    poolConverti.set(rows, v);
  }
  return v;
}
let poolCache: { at: number; rows: RecetteMoteurEmbed[] } | null = null;
let poolEnCours: Promise<RecetteMoteurEmbed[]> | null = null;

async function chargerPoolDepuisBase(supabase: Db): Promise<RecetteMoteurEmbed[]> {
  const TAILLE_PAGE = 1000;
  const requete = () => supabase
    .from('meals').select(COLONNES_RECETTE_MOTEUR)
    .eq('is_public', true)
    .in('type_repas', ['plat', 'dessert']);

  // Compte d'abord, puis toutes les pages EN PARALLÈLE (un aller-retour au
  // lieu d'un par page).
  const { count, error: erreurCompte } = await supabase
    .from('meals').select('id', { count: 'exact', head: true })
    .eq('is_public', true)
    .in('type_repas', ['plat', 'dessert']);
  if (erreurCompte || count == null) throw new Error('Erreur chargement repas');

  const lots = await Promise.all(
    Array.from({ length: Math.max(1, Math.ceil(count / TAILLE_PAGE)) }, (_, page) =>
      requete().order('id').range(page * TAILLE_PAGE, (page + 1) * TAILLE_PAGE - 1)
    )
  );
  const lignes: RecetteMoteurEmbed[] = [];
  for (const { data, error } of lots) {
    if (error) throw new Error('Erreur chargement repas');
    lignes.push(...((data ?? []) as unknown as RecetteMoteurEmbed[]));
  }
  return lignes;
}

export async function buildCandidates(
  userId: string,
  supabase: Db,
  /** Inclinaison volontaire du clic « Optimiser » (défaut : équilibré) */
  intention: IntentionOptimisation | undefined = undefined
): Promise<CandidatesResult> {
  // 1. Toutes les lectures indépendantes partent EN MÊME TEMPS : profil,
  // mémoire, frigo, contraintes, pool de recettes et historique 60 jours.
  // Seule la famille attend le profil (elle lit `poids_famille`).
  const ilYa60Jours = new Date();
  ilYa60Jours.setDate(ilYa60Jours.getDate() - 60);
  const [
    { data: profileRow, error: profileError },
    memoire,
    frigoRes,
    exclusions,
    { data: regimesData },
    allMealsRows,
    { data: history },
    delaiRecettesAimees,
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).single(),
    chargerMemoire(userId, supabase),
    supabase.from('fridge_items').select('ingredient_id').eq('user_id', userId),
    chargerExclusionsUtilisateur(userId, supabase),
    supabase.from('user_diets').select('regime').eq('user_id', userId),
    chargerPoolMoteur(supabase),
    supabase.from('meal_history').select('meal_id, planned_date, status')
      .eq('user_id', userId).gte('planned_date', ilYa60Jours.toISOString().split('T')[0]),
    chargerDelaiRecettesAimees(userId, supabase),
  ]);
  if (profileError || !profileRow) throw new UserError('Profil introuvable');
  const profile: Profile = toProfile(profileRow);
  const familleChargee = await chargerFamille(userId, supabase, profile.poids_famille);
  // Profils des membres du foyer : avantage du plan Famille
  const famille = profile.plan === 'famille' ? familleChargee : { ...familleChargee, membres: [] };
  const frigoIds = ingredientIdsFrigo(frigoRes.data ?? []);

  // 2. Allergies + dislikes + régimes
  const regimes: Regime[] = (regimesData || []).map(r => r.regime as Regime);

  const { allergiesIds, dislikesIds } = exclusions;

  // 2bis. Filtres durs, calculés une seule fois pour toute la génération
  const filtresDurs: FiltresDurs = {
    allergiesIds,
    dislikesIds,
    regimes,
    prixMax: profile.prix_max_portion ?? null,
    alimentsInterditsFamille: alimentsInterdits(famille),
    recettesVeteesFamille: recettesVetees(famille),
    bannies: new Set(
      [...memoire.preferences].filter(([, p]) => p.ne_plus_proposer).map(([id]) => id)
    ),
  };

  // 3. Repas publics (chargés plus haut) → uniquement les vrais PLATS pour
  // déjeuner/dîner. Les desserts sont chargés aussi mais ignorés par la
  // sélection via isDessert.

  // Normalisation une seule fois PAR INSTANTANÉ DU POOL (partagé 10 min entre
  // toutes les générations de l'instance) : lignes brutes → recettes + index
  // des ingrédients. Les mêmes objets recettes étant réutilisés, le mémo du
  // prix par portion (lib/budget.ts) sert aussi d'une génération à l'autre.
  const { repas, mealIngredientsByMeal } = convertirPool(allMealsRows);

  // 4. Historique 60 jours (chargé plus haut)
  const historyByMeal: Record<number, { derniereDate: Date; likes: number; dislikes: number; total: number }> = {};
  (history || []).forEach(h => {
    if (h.meal_id == null) return;
    const d = new Date(h.planned_date);
    if (!historyByMeal[h.meal_id]) historyByMeal[h.meal_id] = { derniereDate: d, likes: 0, dislikes: 0, total: 0 };
    const e = historyByMeal[h.meal_id];
    if (d > e.derniereDate) e.derniereDate = d;
    if (h.status === 'liked') e.likes++;
    if (h.status === 'disliked') e.dislikes++;
    e.total++;
  });

  // 5. Filtrer + scorer
  const saisonActuelle = getSaisonActuelle();
  const candidats: Candidate[] = [];


  // ─── 1re passe : score standard ───
  for (const meal of repas) {
    const mealIngredients = mealIngredientsByMeal.get(meal.id) ?? [];

    const ingredientIds = mealIngredients.map(mi => mi.ingredient_id);

    // Toutes les règles dures en un seul endroit (partagées avec le filet de
    // sécurité) : bannissement, veto du foyer, allergies, interdits familiaux,
    // dislikes, régimes, cap budget.
    if (raisonExclusion(meal, ingredientIds, versIngredientsRegime(mealIngredients), filtresDurs)) continue;

    // Mémoire : recette bannie explicitement (« ne plus jamais proposer »)
    const preference = memoire.preferences.get(meal.id) ?? null;

    const h = historyByMeal[meal.id];
    const joursDepuis = h ? Math.floor((Date.now() - h.derniereDate.getTime()) / (1000 * 60 * 60 * 24)) : null;

    const partFrigo = couvertureFrigo(meal, frigoIds).part;

    // ⭐ Compromis familial : une seule évaluation par recette, réutilisée pour
    // le score ET pour l'explication « Pourquoi ce repas ? ».
    const compromis = famille.membres.length > 0
      ? compromisFamille(famille, meal.id, ingredientIds)
      : null;

    const score = calculateMealScore({
      meal, profile,
      joursDepuisDerniere: joursDepuis,
      nbLikes: h?.likes || 0,
      nbDislikes: h?.dislikes || 0,
      nbApparitions: h?.total || 0,
      saisonActuelle,
      batchCooking: profile.batch_cooking,
      nouveaute: memoire.nouveaute,
      partFrigo,
      preference,
      facteurCompromis: compromis ? facteurFamille(famille, compromis.compromis) : 1,
      delaiRecettesAimees,
    });

    if (score > 0) {
      candidats.push({ meal, score, preference, partFrigo, compromis: compromis?.compromis });
    }
  }

  // ⭐ Filet de sécurité : si le cooldown de rotation (21 jours) bloque TOUTES
  // les recettes — ou simplement trop de recettes pour remplir les 14 repas
  // principaux de la semaine — on retente avec les recettes récemment servies.
  // Mieux vaut un plan avec des répétitions qu'un planning troué (dîners vides)
  // ou une génération en erreur.
  let fallbackUtilise = false;
  if (candidats.filter(c => !isDessert(c.meal)).length < NB_REPAS_PRINCIPAUX) {
    fallbackUtilise = true;
    const candidatsRecents: Candidate[] = [];
    for (const meal of repas) {
      const mealIngredients = mealIngredientsByMeal.get(meal.id) ?? [];
      const ingredientIds = mealIngredients.map(mi => mi.ingredient_id);

      // Mêmes filtres durs que la passe standard, à l'identique : le filet de
      // sécurité ne relâche QUE la rotation de 21 jours. Allergies, interdits
      // du foyer, vetos, dislikes, régimes et cap budget restent actifs.
      if (raisonExclusion(meal, ingredientIds, versIngredientsRegime(mealIngredients), filtresDurs)) continue;

      // Un bannissement explicite n'est jamais relâché, même en fallback.
      const prefFallback = memoire.preferences.get(meal.id) ?? null;

      const h = historyByMeal[meal.id];
      const joursDepuis = h ? Math.floor((Date.now() - h.derniereDate.getTime()) / (1000 * 60 * 60 * 24)) : null;

      const partFrigoFallback = couvertureFrigo(meal, frigoIds).part;

      const compromisFallback = famille.membres.length > 0
        ? compromisFamille(famille, meal.id, ingredientIds)
        : null;

      candidatsRecents.push({
        meal,
        score: calculateMealScore({
          meal, profile,
          // On ignore l'ancienneté : toutes les recettes redeviennent éligibles,
          // les plus anciennes gardent toutefois un léger avantage.
          joursDepuisDerniere: joursDepuis != null ? Math.max(joursDepuis, MIN_DAYS_BEFORE_REUSE) : null,
          nbLikes: h?.likes || 0,
          nbDislikes: h?.dislikes || 0,
          nbApparitions: h?.total || 0,
          saisonActuelle,
          batchCooking: profile.batch_cooking,
          nouveaute: memoire.nouveaute,
          partFrigo: partFrigoFallback,
          preference: prefFallback,
          facteurCompromis: compromisFallback ? facteurFamille(famille, compromisFallback.compromis) : 1,
          delaiRecettesAimees,
        }),
        preference: prefFallback,
        partFrigo: partFrigoFallback,
        compromis: compromisFallback?.compromis,
      });
    }
    // Fusion sans doublons : les candidats déjà éligibles gardent leur score
    // d'origine, seuls les nouveaux (bloqués par le cooldown) sont ajoutés.
    const dejaPresents = new Set(candidats.map(c => c.meal.id));
    for (const c of candidatsRecents) {
      if (!dejaPresents.has(c.meal.id)) candidats.push(c);
    }
  }

  // ⭐ Diversité culinaire (fallback uniquement) : la rotation étant saturée, on
  // réutilise des recettes récentes — autant en profiter pour varier les plaisirs.
  // Les cuisines peu ou pas servies ces 21 derniers jours reçoivent un boost
  // (jusqu'à ×1.5) pour éviter une semaine 100 % française quand l'historique
  // est monoculture.
  const cuisinesDiversifiees: string[] = [];
  if (fallbackUtilise) {
    const cuisineParMeal = new Map<number, string>(
      repas.filter(m => m.cuisine).map(m => [m.id, m.cuisine as string])
    );
    const ilYa21Jours = Date.now() - MIN_DAYS_BEFORE_REUSE * 24 * 60 * 60 * 1000;
    const compteRecents: Record<string, number> = {};
    (history || []).forEach(h => {
      if (h.meal_id == null) return;
      if (new Date(h.planned_date).getTime() < ilYa21Jours) return;
      const cuisine = cuisineParMeal.get(h.meal_id);
      if (cuisine) compteRecents[cuisine] = (compteRecents[cuisine] || 0) + 1;
    });
    const maxCount = Math.max(0, ...Object.values(compteRecents));
    if (maxCount > 0) {
      const vues = new Set<string>();
      for (const c of candidats) {
        const cuisine = c.meal.cuisine as string | null;
        if (!cuisine) continue;
        const nb = compteRecents[cuisine] || 0;
        const facteurDiversite = Math.min(1.5, 1 + 0.5 * (1 - nb / maxCount));
        c.score *= facteurDiversite;
        if (facteurDiversite >= 1.2 && !vues.has(cuisine)) {
          vues.add(cuisine);
          cuisinesDiversifiees.push(cuisine);
        }
      }
      // Les cuisines les moins servies en premier (pour l'affichage bannière)
      cuisinesDiversifiees.sort((a, b) => (compteRecents[a] || 0) - (compteRecents[b] || 0));
    }
  }

  // ⭐ Anti-gaspi FRIGO — pondéré par l'INTENTION du clic « Optimiser » :
  // « équilibré » garde l'anti-gaspi encadré (×1.3 : ménage la mémoire et la
  // variété) ; « gaspillage » double la prime (×2, anti-gaspi express) ; les
  // autres intentions la laissent au poids standard. La prime ne joue que
  // sur les ingrédients PÉRISSABLES — garder du beurre au frigo ne dit rien
  // d'urgent ; voir `couvertureFrigo` pour la construction de partFrigo.
  const poidsIntention = POIDS_INTENTION[intention ?? 'equilibre'];
  for (const c of candidats) {
    const part = c.partFrigo ?? 0;
    if (part > 0) c.score *= 1 + (poidsIntention.frigoFraicheur - 1) * part;
  }

  // ⭐ Facteur budget : pondérer chaque score selon le budget hebdomadaire.
  // Un budget serré favorise les recettes économiques ; un budget confortable
  // laisse la place aux recettes plus chères (viande, poisson...).
  // L'intention « budget » AMPLIFIE ce facteur existant (×2) plutôt que d'en
  // créer un second : une seule loi par dimension, jamais deux poids rivaux.
  const budgetHebdo = profile.budget_hebdo ?? null;
  if (budgetHebdo && budgetHebdo > 0) {
    const prixMoyen = prixMoyenPortions(candidats);
    if (prixMoyen > 0) {
      // Le budget par repas était calculé sur les 14 déjeuners/dîners
      // uniquement (NB_REPAS_PRINCIPAUX) : les desserts du rythme choisi
      // (jusqu'à 6 soirs + 3 midis en « gourmand ») piochent dans le même
      // budget hebdo mais n'étaient jamais comptés au dénominateur — le
      // seuil de tolérance par repas était donc surestimé et laissait
      // passer trop de plats chers, d'où le dépassement de budget observé
      // en fin de semaine.
      let rythme = validerRythmeDesserts(
        (profile as unknown as { rythme_desserts?: unknown }).rythme_desserts
      );
      if (profile.plan !== 'pro' && profile.plan !== 'famille') rythme = 'aucun';
      const cibleDesserts = RYTHME_DESSERTS[rythme];
      const nbRepasReel = NB_REPAS_PRINCIPAUX + (cibleDesserts.soirs ?? 0) + (cibleDesserts.midis ?? 0);
      for (const c of candidats) {
        const pp = prixParPortion(c.meal);
        c.score *= Math.pow(
          facteurBudget(pp, budgetHebdo, profile.nb_personnes || 2, prixMoyen, nbRepasReel),
          poidsIntention.budget
        );
      }
    }
  } else if (poidsIntention.budget !== 1.0) {
    // Intention « budget » SANS budget défini : on ne peut pas pénaliser les
    // recettes chères sans référence de prix hebdo (aucune donnée inventée) —
    // mais on peut récompenser les recettes objectivement économiques :
    // moins cher que la moitié du prix moyen du catalogue → bonus doux.
    const prixMoyen = prixMoyenPortions(candidats);
    if (prixMoyen > 0) {
      for (const c of candidats) {
        const pp = prixParPortion(c.meal);
        if (pp != null && pp <= prixMoyen / 2) c.score *= 1.25;
      }
    }
  }

  // ⭐ Facteur équipement : les recettes utilisables avec les appareils possédés
  // sont boostées ; celles exigeant un appareil manquant sont pénalisées (les
  // basiques — poêle, casserole, four possédés par tous — sont neutres).
  const equipements = profile.equipements ?? [];
  if (equipements.length > 0) {
    const possede = (u: string) => equipements.some(e => u === e || u.startsWith(e));
    for (const c of candidats) {
      const ustensiles: string[] = c.meal.ustensiles || [];
      const specifiques = ustensiles.filter(u => APPAREILS_CONNUES.some(a => u === a || u.startsWith(a)));
      if (specifiques.length === 0) continue; // recette basique → neutre
      const manquants = specifiques.filter(u => !possede(u));
      if (manquants.length === 0) c.score *= 1.3;       // tout est là → boost
      else if (manquants.length === specifiques.length) c.score *= 0.4; // rien pour la faire
      else c.score *= 0.8;                              // faisable mais incomplète
    }
  }

  candidats.sort((a, b) => b.score - a.score);

  return { candidats, fallbackUtilise, cuisinesDiversifiees, memoire, famille };
}

// ─── Régénération d'un ou plusieurs créneaux (sans toucher au reste) ────────

/** Tire au sort un plat du pool (pondéré par score) en excluant ceux déjà utilisés */
function pickWeightedFromPool(
  pool: Candidate[],
  usedMealIds: Set<number>,
  rng: Rng = Math.random
): Candidate | null {
  const available = pool.filter(c => !usedMealIds.has(c.meal.id));
  if (available.length === 0) return null;

  const total = available.reduce((sum, c) => sum + c.score, 0);
  let random = rng() * total;
  for (const c of available) {
    random -= c.score;
    if (random <= 0) return c;
  }
  return available[available.length - 1];
}

export async function regeneratePlanSlots(
  userId: string,
  semaineDebut: string,
  slots: PlanSlot[],
  supabase: Db,
  rng: Rng = Math.random,
  /** Inclinaison du clic (défaut : équilibré) */
  intention: IntentionOptimisation | undefined = undefined
): Promise<{ planId: number; shoppingListId: number | null }> {
  if (!slots.length) throw new UserError('Aucun créneau à régénérer');

  // 1. Le plan existant de la semaine (sinon rien à régénérer)
  const { data: plan } = await supabase.from('weekly_plans')
    .select('id').eq('user_id', userId).eq('semaine_debut', semaineDebut).maybeSingle();
  if (!plan) throw new UserError("Aucun planning pour cette semaine — générez d'abord la semaine complète");

  const { data: currentPlanMeals } = await supabase.from('plan_meals')
    .select('jour_semaine, repas_type, meal_id').eq('plan_id', plan.id);

  // 2. Candidats scorés (mêmes règles que la génération complète)
  const { candidats } = await buildCandidates(userId, supabase, intention);
  if (candidats.length === 0) throw new UserError('Aucun plat disponible pour régénérer');

  const poolSize = Math.max(28, Math.floor(candidats.length * 0.3));
  const pool = candidats.slice(0, Math.min(poolSize, candidats.length));

  // 3. Pour chaque créneau : un nouveau plat, jamais déjà présent dans la semaine
  const usedMealIds = new Set<number>(
    (currentPlanMeals || []).map(pm => pm.meal_id).filter((id): id is number => id != null)
  );

  const chosen: { jour_semaine: number; repas_type: string; oldMealId: number | null; meal: RecetteMoteur }[] = [];
  // Pools dédiés : un slot dessert (soir ou midi) pioche uniquement dans les
  // desserts ; les desserts du midi sont en plus « express » (≤ 10 min) quand
  // le catalogue le permet.
  const dessertPool = candidats.filter(c => isDessert(c.meal));
  const dessertMidiPool = dessertPool.filter(c => isDessertExpress(c.meal));
  const platPool = pool.filter(c => !isDessert(c.meal));
  for (const slot of slots) {
    if (slot.jour_semaine < 0 || slot.jour_semaine > 6 || !['dejeuner', 'diner', 'dessert', 'dessert_midi'].includes(slot.repas_type)) {
      throw new UserError('Créneau invalide');
    }
    const current = (currentPlanMeals || []).find(
      pm => pm.jour_semaine === slot.jour_semaine && pm.repas_type === slot.repas_type
    );
    const poolDuSlot = slot.repas_type === 'dessert' ? dessertPool
      : slot.repas_type === 'dessert_midi' ? (dessertMidiPool.length > 0 ? dessertMidiPool : dessertPool)
      : platPool;
    const next = pickWeightedFromPool(poolDuSlot, usedMealIds, rng);
    if (!next) break; // pool épuisé
    usedMealIds.add(next.meal.id); // l'ancien plat reste exclu (il vient d'être refusé)
    chosen.push({ jour_semaine: slot.jour_semaine, repas_type: slot.repas_type, oldMealId: current?.meal_id ?? null, meal: next.meal });
  }

  if (!chosen.length) throw new UserError('Plus assez de plats disponibles pour régénérer');

  // 4. Mise à jour du planning + historique de rotation.
  // Créneaux indépendants → traités EN PARALLÈLE ; par créneau, 3 à 4 requêtes
  // au lieu de 6 à 7 (upsert sur la clé primaire au lieu de lire puis écrire,
  // une seule suppression d'historique pour l'ancien et le nouveau plat).
  await Promise.all(chosen.map(async c => {
    const { error: errSlot } = await supabase.from('plan_meals').upsert(
      { plan_id: plan.id, jour_semaine: c.jour_semaine, repas_type: c.repas_type, meal_id: c.meal.id, est_reste_de: null, texte_libre: null },
      { onConflict: 'plan_id,jour_semaine,repas_type' }
    );
    if (errSlot) throw new Error(`Mise à jour du créneau impossible : ${errSlot.message}`);

    await Promise.all([
      // Si l'ancien plat servait de source à un reste, re-pointer le lien
      c.oldMealId
        ? supabase.from('plan_meals')
            .update({ est_reste_de: c.meal.id })
            .eq('plan_id', plan.id).eq('est_reste_de', c.oldMealId)
        : null,
      // Historique : les lignes "planned" de la semaine pour l'ancien plat
      // (qui disparaît) et le nouveau (évite le doublon) sont remplacées par
      // une entrée pour le nouveau ; les retours cooked/liked/disliked restent.
      (async () => {
        await supabase.from('meal_history')
          .delete()
          .eq('user_id', userId)
          .in('meal_id', c.oldMealId ? [c.oldMealId, c.meal.id] : [c.meal.id])
          .eq('planned_date', semaineDebut).eq('status', 'planned');
        await supabase.from('meal_history').insert({
          user_id: userId, meal_id: c.meal.id, planned_date: semaineDebut, status: 'planned',
        });
      })(),
    ]);
  }));

  // 5. Liste de courses recalculée (les items cochés sont conservés)
  const shoppingListId = await recomputeShoppingList(userId, plan.id, supabase);

  // 6. Snapshot budget / économies de la semaine
  await snapshotBudget(userId, semaineDebut, plan.id, supabase);

  // 7. Le planning est à jour en base. On ne renvoie PAS les repas : le client
  // recharge la semaine par `useWeeklyPlan` dès la réponse reçue (il ne lit que
  // `error`), donc les sérialiser ici ne faisait que télécharger deux fois la
  // même semaine — la première version n'étant jamais affichée.
  return { planId: plan.id, shoppingListId };
}

// ─── Restes : "cuisiné le soir, mangé le lendemain midi" ────────────────────

/**
 * Bascule le mode restes sur le dîner de `jourDiner` : le dîner est cuisiné
 * en double et le déjeuner du lendemain devient son reste. La liste de
 * courses est recalculée (dîner ×2, ingrédients du déjeuner non achetés).
 * Rappel du lien : meal_id du déjeuner conserve son plat d'origine — un
 * nouveau toggle le restaure tel quel.
 */
export async function toggleRestes(
  userId: string,
  semaineDebut: string,
  jourDiner: number,
  supabase: Db
): Promise<{ resteActif: boolean }> {
  if (!Number.isInteger(jourDiner) || jourDiner < 0 || jourDiner > 5) {
    throw new UserError('Le mode restes nécessite un déjeuner le lendemain dans la même semaine');
  }
  const jourLendemain = jourDiner + 1;

  const { data: plan } = await supabase.from('weekly_plans')
    .select('id').eq('user_id', userId).eq('semaine_debut', semaineDebut).maybeSingle();
  if (!plan) throw new UserError("Aucun planning pour cette semaine — générez d'abord la semaine");

  // Le dîner source est obligatoire
  const { data: diner } = await supabase.from('plan_meals')
    .select('meal_id').eq('plan_id', plan.id).eq('jour_semaine', jourDiner).eq('repas_type', 'diner').maybeSingle();
  if (!diner?.meal_id) throw new UserError("Pas de dîner prévu ce jour-là");

  // Le déjeuner du lendemain peut être absent
  const { data: dejeuner } = await supabase.from('plan_meals')
    .select('est_reste_de').eq('plan_id', plan.id).eq('jour_semaine', jourLendemain).eq('repas_type', 'dejeuner').maybeSingle();

  const resteActifActuel = dejeuner?.est_reste_de != null;

  if (resteActifActuel) {
    // Désactiver : le déjeuner redevient un repas normal (son plat est conservé)
    await supabase.from('plan_meals')
      .update({ est_reste_de: null })
      .eq('plan_id', plan.id).eq('jour_semaine', jourLendemain).eq('repas_type', 'dejeuner');
  } else if (dejeuner) {
    // Activer : le déjeuner devient le reste du dîner
    await supabase.from('plan_meals')
      .update({ est_reste_de: diner.meal_id })
      .eq('plan_id', plan.id).eq('jour_semaine', jourLendemain).eq('repas_type', 'dejeuner');
  } else {
    // Pas de déjeuner ce jour-là : on le crée directement en tant que reste
    await supabase.from('plan_meals').insert({
      plan_id: plan.id, jour_semaine: jourLendemain,
      repas_type: 'dejeuner', meal_id: diner.meal_id, est_reste_de: diner.meal_id,
    });
  }

  // Liste de courses : dîner source ×2, ingrédients du déjeuner-reste non achetés
  await recomputeShoppingList(userId, plan.id, supabase);

  // Snapshot budget / économies mis à jour
  await snapshotBudget(userId, semaineDebut, plan.id, supabase);

  return { resteActif: !resteActifActuel };
}

// ─── Construction standard : 14 repas distincts, 2 par jour ──────────────

function buildStandardWeek(
  pool: Candidate[],
  JOURS_NOMS: string[],
  slots: (jourIndex: number, repasType: RepasSlot) => SlotContexte,
  rng: Rng
): DayPlan[] {
  const nbRequired = 14;
  const poolSize = Math.max(nbRequired * 2, Math.floor(pool.length * 0.3));
  const topPool = pool.slice(0, Math.min(poolSize, pool.length));

  // Créneau par créneau (et non 14 tirages d'un bloc) : c'est ce qui permet à la
  // contrainte « mercredi soir → rapide » d'être respectée là où elle s'applique.
  const days: DayPlan[] = JOURS_NOMS.map((jour, i) => ({
    jour,
    jourIndex: i,
    dejeuner: null,
    diner: null,
    dessert: null,
    dessertMidi: null,
  }));

  const used = new Set<number>();
  for (let i = 0; i < JOURS_NOMS.length; i++) {
    const dejeuner = pickPourSlot(topPool, used, slots(i, 'dejeuner'), rng);
    if (dejeuner) { used.add(dejeuner.meal.id); days[i].dejeuner = dejeuner.meal; }

    const diner = pickPourSlot(topPool, used, slots(i, 'diner'), rng);
    if (diner) { used.add(diner.meal.id); days[i].diner = diner.meal; }
  }
  optimiserRecoupement(days, topPool, slots);
  return days;
}

// ─── Construction batch cooking ─────────────────────────────────────────────
// Principe : le jour de batch (dimanche par défaut), on cuisine 3-4 recettes
// qui se conservent bien. Ces recettes servent pour le jour batch + les 3 jours
// suivants (lundi-mardi-mercredi). Les jours restants sont standards.

function buildBatchWeek(
  pool: Candidate[],
  JOURS_NOMS: string[],
  batchJour: number,
  slots: (jourIndex: number, repasType: RepasSlot) => SlotContexte,
  rng: Rng
): DayPlan[] {
  // Séparer les repas "batch-compatibles" (conservation >= 3 jours)
  // et les repas "frais" (conservation <= 1 jour ou non renseignée)
  const batchCompatible = pool.filter(c => c.meal.conservation_jours != null && c.meal.conservation_jours >= 3);
  const others = pool.filter(c => !batchCompatible.includes(c));

  // Mélanger : on priorise les batch-compatibles mais on garde de la variété
  const combined = [...batchCompatible, ...others];

  // Pool de batch : top 8 recettes batch-compatibles
  const batchPool = combined.slice(0, Math.min(combined.length, Math.max(8, pool.length)));

  // 4 batch recettes → 2 déjeuners + 2 dîners
  const nbBatchRecipes = 4;
  const batchRecipes: typeof batchPool = [];
  const used = new Set<number>();

  // Échantillonnage pondéré pour les batch recipes
  while (batchRecipes.length < nbBatchRecipes && batchRecipes.length < batchPool.length) {
    const total = batchPool.reduce((s, c, i) => used.has(i) ? s : s + c.score, 0);
    let r = rng() * total;
    let idx = 0;
    for (let i = 0; i < batchPool.length; i++) {
      if (used.has(i)) continue;
      r -= batchPool[i].score;
      if (r <= 0) { idx = i; break; }
    }
    if (used.has(idx)) {
      for (let i = 0; i < batchPool.length; i++) { if (!used.has(i)) { idx = i; break; } }
    }
    used.add(idx);
    batchRecipes.push(batchPool[idx]);
  }

  // Construire la semaine
  const days: DayPlan[] = [];
  const batchDays = [batchJour, (batchJour + 1) % 7, (batchJour + 2) % 7, (batchJour + 3) % 7];
  const batchSet = new Set(batchDays);

  // Pool de recettes restantes pour les jours non-batch
  const remainingPool = batchPool.filter((_, i) => !used.has(i));

  // Les jours hors batch suivent les mêmes contraintes de créneau que la
  // semaine standard (« mardi soir → 20 min »).
  const usedHorsBatch = new Set<number>();
  const joursNomsCourt = JOURS_NOMS;

  for (let i = 0; i < 7; i++) {
    if (batchSet.has(i)) {
      // Jour couvert par le batch cooking : mêmes recettes que le jour batch
      // Avec une légère variation : on permute déjeuner/dîner selon le jour
      const offset = (i - batchJour + 7) % 7;
      days.push({
        jour: joursNomsCourt[i],
        jourIndex: i,
        dejeuner: batchRecipes[(offset * 2) % batchRecipes.length]?.meal || null,
        diner: batchRecipes[(offset * 2 + 1) % batchRecipes.length]?.meal || null,
        dessert: null,
        dessertMidi: null,
      });
    } else {
      const dejeuner = pickPourSlot(remainingPool, usedHorsBatch, slots(i, 'dejeuner'), rng);
      if (dejeuner) usedHorsBatch.add(dejeuner.meal.id);
      const diner = pickPourSlot(remainingPool, usedHorsBatch, slots(i, 'diner'), rng);
      if (diner) usedHorsBatch.add(diner.meal.id);

      days.push({
        jour: joursNomsCourt[i],
        jourIndex: i,
        dejeuner: dejeuner?.meal || null,
        diner: diner?.meal || null,
        dessert: null,
        dessertMidi: null,
      });
    }
  }

  return days;
}

export async function saveWeeklyPlan(
  userId: string, semaineDebut: string, days: DayPlan[], supabase: Db,
  fallbackUtilise = false,
  cuisinesDiversifiees: string[] = []
): Promise<{ planId: number; shoppingListId: number }> {
  // ⭐ Transaction atomique côté Postgres (migration 00012) — l'ancienne
  // version JS supprimait l'ancienne semaine AVANT d'insérer la nouvelle :
  // un échec en milieu de route détruisait le planning existant (risque #2)
  // avec ~50 allers-retours séquentiels (risque #3, timeout Vercel).
  // Désormais : 1 appel RPC = 1 transaction (plan + plan_meals + historique
  // dédupliqué + cap 90j + liste de courses).
  const { data, error } = await supabase.rpc('save_weekly_plan', {
    p_user_id: userId,
    p_semaine_debut: semaineDebut,
    p_days: days.map(d => ({
      jourIndex: d.jourIndex,
      dejeuner: d.dejeuner ? { id: d.dejeuner.id } : null,
      diner: d.diner ? { id: d.diner.id } : null,
      dessert: d.dessert ? { id: d.dessert.id } : null,
      dessert_midi: d.dessertMidi ? { id: d.dessertMidi.id } : null,
      restesDe: d.restesDe ?? null,
    })),
    p_fallback_utilise: fallbackUtilise,
    p_cuisines_diversifiees: cuisinesDiversifiees,
  });
  if (error) throw new Error(error.message);

  const saved = (data ?? [])[0];
  if (!saved) throw new Error('Erreur création plan');

  // Snapshot budget / économies de la semaine (best-effort : ne fait jamais
  // échouer la sauvegarde ; le chiffrage € reste en JS, source de vérité UI)
  await snapshotBudget(userId, semaineDebut, saved.plan_id, supabase);

  return { planId: saved.plan_id, shoppingListId: saved.shopping_list_id };
}
