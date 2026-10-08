// ============================================================================
// Mémoire alimentaire — PlanMyMeal
//
// C'est ce qui transforme le générateur de menus en assistant : le moteur lit
// ici les goûts et contraintes appris, et c'est d'ici que vient l'explication
// « Pourquoi ce repas ? » — construite à partir des données RÉELLEMENT
// utilisées, jamais d'une justification inventée.
//
// Deux responsabilités, volontairement séparées du moteur de scoring :
//   1. charger/lire la mémoire (profil + user_meal_preferences)
//   2. expliquer un choix déjà fait
// ============================================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/../supabase/database.types';
import { prixParPortion } from '@/lib/budget';
import { getSaisonActuelle, JOURS_NOMS } from '@/lib/dates';
import {
  alimentsRejetesParMembre, chargerFamille, compromisFamille, type Famille,
} from '@/lib/famille';
import {
  CONTEXTES_JOUR,
  type ContexteJour,
  type Explication,
  type ExplicationLigne,
  type Meal,
  type MealPreference,
  type RecetteMoteur,
  type MealStatus,
  type Profile,
  type RaisonNote,
  type RepasSlot,
  type Saison,
} from '@/types';

export type Db = SupabaseClient<Database>;

const NB_JOURS = 7;

/** Temps total d'une recette (préparation + cuisson) */
export function tempsTotal(meal: Pick<Meal, 'temps_preparation' | 'temps_cuisson'>): number {
  return meal.temps_preparation + (meal.temps_cuisson ?? 0);
}

// ─── Normalisation des colonnes jsonb ───────────────────────────────────────

/** `temps_max_par_jour` (jsonb) → tableau de 7 entrées (number | null) */
export function parseTempsMaxParJour(raw: unknown): (number | null)[] {
  const arr = Array.isArray(raw) ? raw : [];
  return Array.from({ length: NB_JOURS }, (_, i) => {
    const v = arr[i];
    if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) return null;
    // Le champ est en minutes ; une valeur < 5 est une saisie en heures (« 1 », « 3 ») :
    // la lire en minutes excluait toutes les recettes de la journée.
    return Math.min(240, Math.round(v < 5 ? v * 60 : v));
  });
}

/** `contexte_jours` (jsonb) → tableau de 7 entrées (ContexteJour | null) */
export function parseContexteJours(raw: unknown): (ContexteJour | null)[] {
  const valides = new Set<string>(CONTEXTES_JOUR.map(c => c.value));
  const arr = Array.isArray(raw) ? raw : [];
  return Array.from({ length: NB_JOURS }, (_, i) => {
    const v = arr[i];
    return typeof v === 'string' && valides.has(v) ? (v as ContexteJour) : null;
  });
}

// ─── Structure lue par le moteur ────────────────────────────────────────────

export interface MemoireAlimentaire {
  /** Préférences explicites, indexées par meal_id */
  preferences: Map<number, MealPreference>;
  tempsMaxParJour: (number | null)[];
  contexteJours: (ContexteJour | null)[];
  /** Curseur Confort (0) ↔ Découverte (100) */
  nouveaute: number;
}

export const MEMOIRE_VIDE: MemoireAlimentaire = {
  preferences: new Map(),
  tempsMaxParJour: Array.from({ length: NB_JOURS }, () => null),
  contexteJours: Array.from({ length: NB_JOURS }, () => null),
  nouveaute: 20,
};

function toMealPreference(row: {
  meal_id: number;
  note: number | null;
  frequence_jours: number | null;
  jour_prefere: number | null;
  repas_prefere: string | null;
  ne_plus_proposer: boolean;
}): MealPreference {
  return {
    meal_id: row.meal_id,
    note: row.note,
    frequence_jours: row.frequence_jours,
    jour_prefere: row.jour_prefere,
    repas_prefere: (row.repas_prefere as RepasSlot | null) ?? null,
    ne_plus_proposer: row.ne_plus_proposer,
  };
}

/**
 * Charge la mémoire d'un foyer. Best-effort : une table absente (migration
 * 00016 non appliquée) dégrade la mémoire à vide sans faire échouer la
 * génération — même philosophie que les autres `if not exists` du projet.
 */
export async function chargerMemoire(userId: string, supabase: Db): Promise<MemoireAlimentaire> {
  const [{ data: profil }, { data: prefs }] = await Promise.all([
    supabase
      .from('profiles')
      .select('temps_max_par_jour, contexte_jours, nouveaute')
      .eq('id', userId)
      .maybeSingle(),
    supabase
      .from('user_meal_preferences')
      .select('meal_id, note, frequence_jours, jour_prefere, repas_prefere, ne_plus_proposer')
      .eq('user_id', userId),
  ]);

  const preferences = new Map<number, MealPreference>();
  for (const row of prefs ?? []) preferences.set(row.meal_id, toMealPreference(row));

  const p = profil as
    | { temps_max_par_jour: unknown; contexte_jours: unknown; nouveaute: number | null }
    | null;

  return {
    preferences,
    tempsMaxParJour: parseTempsMaxParJour(p?.temps_max_par_jour),
    contexteJours: parseContexteJours(p?.contexte_jours),
    nouveaute: typeof p?.nouveaute === 'number' ? p.nouveaute : MEMOIRE_VIDE.nouveaute,
  };
}

/** Temps de cuisine réellement disponible un jour (repli semaine/weekend). */
export function tempsMaxJour(
  memoire: MemoireAlimentaire,
  jourIndex: number,
  profile: Pick<Profile, 'temps_max_semaine' | 'temps_max_weekend'> | null
): number | null {
  const direct = memoire.tempsMaxParJour[jourIndex];
  if (direct != null) return direct;
  if (!profile) return null;

  const repli = jourIndex >= 5 ? profile.temps_max_weekend : profile.temps_max_semaine;
  // 0 (ou négatif) = contrainte non renseignée, pas « aucune minute de cuisine »
  return repli > 0 ? repli : null;
}

/** Contexte culinaire d'un jour ('normal' par défaut). */
export function contexteJour(memoire: MemoireAlimentaire, jourIndex: number): ContexteJour {
  return memoire.contexteJours[jourIndex] ?? 'normal';
}

// ─── « Pourquoi ce repas ? » ────────────────────────────────────────────────

export interface HistoriqueRecette {
  joursDepuisDerniere: number | null;
  likes: number;
  dislikes: number;
  total: number;
}

export interface ContexteExplication {
  jourIndex: number;
  repasType: RepasSlot;
  profile: Profile;
  memoire: MemoireAlimentaire;
  historique: HistoriqueRecette;
  /** Ids des ingrédients présents au frigo */
  frigoIngredientIds: Set<number>;
  budgetHebdo: number | null;
  prixPortion: number | null;
  saisonActuelle: Saison | string;
  batchCooking?: boolean;
  /** Foyer (compromis familial). Vide = on ne cuisine que pour soi. */
  famille?: Famille;
}

const SAISONS_OPPOSEES: Record<string, string> = {
  ete: 'hiver', hiver: 'ete', printemps: 'automne', automne: 'printemps',
};

/**
 * Construit l'explication d'un repas à partir des données réellement prises en
 * compte. Chaque ligne est vérifiable dans les tables ; on n'ajoute une ligne
 * que si la donnée existe, et on ne prétend jamais qu'un facteur a joué s'il
 * n'est pas renseigné.
 */
export function expliquerChoix(meal: RecetteMoteur, ctx: ContexteExplication): Explication {
  const lignes: ExplicationLigne[] = [];
  const { jourIndex, repasType, profile, memoire, historique, frigoIngredientIds } = ctx;
  const jour = JOURS_NOMS[jourIndex] ?? 'ce jour';
  const creneau = repasType === 'dejeuner' ? 'midi' : repasType === 'diner' ? 'soir' : 'dessert';
  const pref = memoire.preferences.get(meal.id) ?? null;

  // 1. Préférence explicite / mémoire par recette
  if (pref?.ne_plus_proposer) {
    lignes.push({ emoji: '🚫', texte: "Tu as demandé à ne plus la voir — le moteur l'écarte normalement." });
  }
  if (pref?.note != null) {
    if (pref.note >= 4) {
      lignes.push({ emoji: pref.note === 5 ? '❤️' : '👍', texte: `Tu l'as notée ${pref.note}/5.` });
    } else if (pref.note <= 2) {
      lignes.push({ emoji: '👎', texte: `Tu l'as notée ${pref.note}/5 — la rotation l'espace volontairement.` });
    } else {
      lignes.push({ emoji: '😐', texte: `Tu l'as notée ${pref.note}/5.` });
    }
  }

  // 2. Fréquence souhaitée
  if (pref?.frequence_jours != null) {
    const cible = pref.frequence_jours;
    const jours = historique.joursDepuisDerniere;
    const suffixe = jours != null
      ? (jours >= cible
        ? ` et ça fait ${jours} jours — c'est le bon moment.`
        : ` — ${jours} j depuis la dernière fois.`)
      : '.';
    lignes.push({ emoji: '🗓️', texte: `Tu veux la manger environ tous les ${cible} jours${suffixe}` });
  }

  // 3. Ancienneté (la règle de rotation du moteur)
  if (pref?.frequence_jours == null) {
    if (historique.joursDepuisDerniere == null) {
      lignes.push({ emoji: '✨', texte: "Tu ne l'as encore jamais eue au planning." });
    } else {
      lignes.push({
        emoji: '📅',
        texte: `Tu ne l'as pas mangée depuis ${historique.joursDepuisDerniere} jours (rotation minimale : 21 j).`,
      });
    }
  }

  // 4. Historique des retours
  if (historique.likes > 0) {
    lignes.push({ emoji: '⭐', texte: `Tu l'as aimée ${historique.likes} fois.` });
  }
  if (historique.dislikes > 0) {
    lignes.push({ emoji: '🔁', texte: `Tu l'as écartée ${historique.dislikes} fois — elle revient prudemment.` });
  }

  // 5. Jour / créneau préféré
  if (pref?.jour_prefere != null) {
    if (pref.jour_prefere === jourIndex) {
      lignes.push({ emoji: '📌', texte: `Tu préfères cette recette le ${JOURS_NOMS[pref.jour_prefere].toLowerCase()}.` });
    } else {
      lignes.push({
        emoji: '📌',
        texte: `Ton créneau habituel est le ${JOURS_NOMS[pref.jour_prefere].toLowerCase()} — ici placée le ${jour.toLowerCase()}.`,
      });
    }
  }
  if (pref?.repas_prefere != null && pref.repas_prefere !== repasType) {
    lignes.push({ emoji: '🕐', texte: `Tu la préfères plutôt au ${pref.repas_prefere === 'dejeuner' ? 'midi' : 'soir'}.` });
  }

  // 6. Temps disponible du jour
  const temps = tempsTotal(meal);
  const tempsMax = tempsMaxJour(memoire, jourIndex, profile);
  if (tempsMax != null) {
    if (temps <= tempsMax) {
      lignes.push({ emoji: '⏱️', texte: `${temps} min de cuisine — tu as ${tempsMax} min le ${jour.toLowerCase()} ${creneau}.` });
    } else {
      lignes.push({ emoji: '⚠️', texte: `${temps} min de cuisine pour ${tempsMax} min disponibles le ${jour.toLowerCase()}.` });
    }
  }

  // 7. Contexte culinaire du jour
  const contexte = contexteJour(memoire, jourIndex);
  if (contexte === 'rapide') {
    lignes.push({
      emoji: '⚡',
      texte: temps <= 25
        ? `Journée express : recette en ${temps} min.`
        : `Journée express prévue — cette recette demande ${temps} min.`,
    });
  } else if (contexte === 'leger') {
    const kcal = meal.calories_par_portion;
    // Le chiffre n'est cité que s'il a SERVI. Sur une recette non vérifiée, le
    // score de légèreté est resté neutre : annoncer « 420 kcal/portion »
    // justifierait la décision par une donnée que le moteur a écartée — et
    // c'est précisément la fausse justification qu'on s'interdit.
    lignes.push({
      emoji: '🥗',
      texte: kcal != null && kcal <= 700 && meal.macros_verifiables
        ? `Repas léger demandé ce jour-là (${kcal} kcal/portion pour ${profile.nb_personnes} pers.).`
        : 'Repas léger demandé ce jour-là.',
    });
  } else if (contexte === 'plaisir') {
    lignes.push({ emoji: '🎉', texte: `Repas plaisir du ${jour.toLowerCase()} ${creneau}.` });
  }

  // 8. Frigo
  const dispo = (meal.ingredients ?? []).filter(i => frigoIngredientIds.has(i.ingredient.id)).length;
  if (dispo > 0) {
    lignes.push({
      emoji: '🥕',
      texte: `Elle utilise ${dispo} ingrédient${dispo > 1 ? 's' : ''} déjà dans ton frigo.`,
    });
  }

  // 9. Cuisine préférée
  if (meal.cuisine && profile.cuisines_preferees?.some(c => c.toLowerCase() === meal.cuisine?.toLowerCase())) {
    lignes.push({ emoji: '🌍', texte: `La cuisine ${meal.cuisine} fait partie de tes préférées.` });
  }

  // 10. Budget
  if (ctx.prixPortion != null && ctx.budgetHebdo != null && ctx.budgetHebdo > 0) {
    lignes.push({
      emoji: '💰',
      texte: `${ctx.prixPortion.toFixed(2)} € la portion, dans ton budget de ${ctx.budgetHebdo} € / semaine.`,
    });
  }

  // 11. Saison
  if (meal.saison !== 'toutes' && meal.saison === ctx.saisonActuelle) {
    lignes.push({ emoji: '🌿', texte: 'Elle est de saison.' });
  } else if (meal.saison !== 'toutes' && SAISONS_OPPOSEES[meal.saison] === ctx.saisonActuelle) {
    lignes.push({ emoji: '❄️', texte: `Hors saison (${meal.saison}) — pénalisée par le moteur, gardée faute de mieux.` });
  }

  // 12. Batch cooking
  if (ctx.batchCooking && (meal.conservation_jours ?? 0) >= 3) {
    lignes.push({ emoji: '🍱', texte: `Se conserve ${meal.conservation_jours} jours : parfaite pour ton batch cooking.` });
  }

  // 13. Curseur de nouveauté
  const nouveaute = memoire.nouveaute;
  if (historique.total === 0 && nouveaute >= 60) {
    lignes.push({ emoji: '🎲', texte: `Mode découverte (${nouveaute} %) : une recette que tu n'as jamais eue.` });
  } else if (historique.total > 0 && nouveaute <= 25) {
    lignes.push({ emoji: '🛋️', texte: `Mode confort (${100 - nouveaute} %) : une valeur sûre de ton historique.` });
  }

  // 14. Compromis familial — uniquement si le foyer compte des membres.
  // On nomme le membre le mieux servi et, s'il existe, le mécontent : c'est
  // exactement ce que le moteur a pondéré, rien de plus.
  const famille = ctx.famille;
  if (famille && famille.membres.length > 0) {
    const ingredientIds = (meal.ingredients ?? []).map(i => i.ingredient.id);
    const { detail } = compromisFamille(famille, meal.id, ingredientIds);

    const meilleur = [...detail].sort(
      (a, b) => (b.satisfaction * b.membre.poids) - (a.satisfaction * a.membre.poids)
    )[0];
    const pire = [...detail].sort((a, b) => a.satisfaction - b.satisfaction)[0];

    if (meilleur && meilleur.satisfaction >= 1.05) {
      const noteMembre = meilleur.membre.recettes.get(meal.id)?.note ?? null;
      lignes.push({
        emoji: meilleur.membre.emoji,
        texte: noteMembre != null && noteMembre >= 4
          ? `${meilleur.membre.nom} l'adore (${noteMembre}/5).`
          : `Elle sert bien les goûts de ${meilleur.membre.nom}.`,
      });
    }

    // Seuil 0.85 : un seul aliment « je n'aime pas » vaut 0.8 — c'est déjà une
    // information utile à donner. À 1.0 on ne dirait rien d'un membre mécontent.
    if (pire && pire.satisfaction <= 0.85 && pire.membre.id !== meilleur?.membre.id) {
      const rejetes = alimentsRejetesParMembre(pire.membre, ingredientIds);
      const nomRejete = rejetes.length > 0
        ? (meal.ingredients ?? []).find(i => i.ingredient.id === rejetes[0])?.ingredient.nom ?? null
        : null;
      lignes.push({
        emoji: '⚖️',
        texte: nomRejete
          ? `${pire.membre.nom} n'aime pas les ${nomRejete.toLowerCase()} — la recette est proposée moins souvent pour cette raison.`
          : `${pire.membre.nom} l'apprécie peu — la recette est proposée moins souvent pour cette raison.`,
      });
    } else if (detail.length >= 2 && detail.every(d => d.satisfaction >= 1)) {
      lignes.push({
        emoji: '👨‍👩‍👧',
        texte: `Elle convient à tout le foyer (${detail.length} membres, compromis pondéré).`,
      });
    }
  }

  // Repli honnête : aucun facteur nommable → on décrit la règle générale
  if (lignes.length === 0) {
    lignes.push({
      emoji: '🤖',
      texte: 'Elle respecte tes allergies, tes exclusions et la rotation de 21 jours du moteur.',
    });
  }

  return { lignes, ingredientsFrigo: dispo };
}

// ─── Écriture de la mémoire : notation + préférences ───────────────────────

/** Niveaux de notation d'un repas (😍 → 🚫) */
export type NoteRepas = 1 | 2 | 3 | 4 | 5;

export const NOTES_REPAS: { value: NoteRepas; emoji: string; label: string }[] = [
  { value: 5, emoji: '😍', label: "J'ai adoré" },
  { value: 4, emoji: '🙂', label: "C'était bien" },
  { value: 3, emoji: '😐', label: 'Correct' },
  { value: 2, emoji: '🙁', label: "Je n'ai pas aimé" },
  { value: 1, emoji: '🚫', label: 'Ne plus jamais proposer' },
];

/**
 * Note → statut meal_history. On reste sur les statuts existants ('liked' /
 * 'disliked' / 'cooked') pour que le moteur déjà en place continue de compter
 * les likes et les dislikes exactement comme avant : aucune régression.
 */
export function statutDepuisNote(note: NoteRepas): MealStatus {
  if (note >= 4) return 'liked';
  if (note <= 2) return 'disliked';
  return 'cooked';
}

export interface PreferenceInput {
  note?: number | null;
  frequence_jours?: number | null;
  jour_prefere?: number | null;
  repas_prefere?: RepasSlot | null;
  ne_plus_proposer?: boolean;
}

function clampOuNull(v: unknown, min: number, max: number): number | null {
  if (v == null) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/**
 * Normalise une saisie de préférence. Seules les clés PRÉSENTES dans l'entrée
 * sont renvoyées : un upsert partiel PostgREST ne touche alors que ces colonnes
 * (« je change juste le jour préféré » ne doit pas effacer la fréquence).
 */
export function normaliserPreference(input: PreferenceInput): PreferenceInput {
  const out: PreferenceInput = {};
  if ('note' in input) out.note = clampOuNull(input.note, 1, 5);
  if ('frequence_jours' in input) out.frequence_jours = clampOuNull(input.frequence_jours, 1, 365);
  if ('jour_prefere' in input) out.jour_prefere = clampOuNull(input.jour_prefere, 0, 6);
  if ('repas_prefere' in input) {
    const r = input.repas_prefere;
    out.repas_prefere = (r === 'dejeuner' || r === 'diner' || r === 'dessert' || r === 'dessert_midi') ? r : null;
  }
  if ('ne_plus_proposer' in input) out.ne_plus_proposer = input.ne_plus_proposer === true;
  return out;
}

/** Enregistre (ou met à jour partiellement) la mémoire d'une recette. */
export async function enregistrerPreference(
  userId: string,
  mealId: number,
  input: PreferenceInput,
  supabase: Db
): Promise<void> {
  const patch = normaliserPreference(input);
  const { error } = await supabase.from('user_meal_preferences').upsert(
    { user_id: userId, meal_id: mealId, ...patch, updated_at: new Date().toISOString() },
    { onConflict: 'user_id,meal_id' }
  );
  if (error) throw new Error(error.message);
}

export async function supprimerPreference(userId: string, mealId: number, supabase: Db): Promise<void> {
  const { error } = await supabase
    .from('user_meal_preferences')
    .delete()
    .eq('user_id', userId)
    .eq('meal_id', mealId);
  if (error) throw new Error(error.message);
}

/**
 * Note un repas : écrit le retour d'expérience (meal_history) ET la mémoire
 * (user_meal_preferences). C'est ce couplage qui fait qu'une note change
 * réellement les générations suivantes.
 */
export async function noterRepas(
  userId: string,
  mealId: number,
  note: NoteRepas,
  raison: RaisonNote | null,
  supabase: Db,
  plannedDate?: string
): Promise<void> {
  const { error: histErr } = await supabase.from('meal_history').insert({
    user_id: userId,
    meal_id: mealId,
    planned_date: plannedDate ?? new Date().toISOString().split('T')[0],
    status: statutDepuisNote(note),
    rating: note,
    raison,
  });
  if (histErr) throw new Error(histErr.message);

  await enregistrerPreference(userId, mealId, {
    note,
    // « Ne plus jamais proposer » = bannissement explicite de la pioche
    ne_plus_proposer: note === 1,
  }, supabase);
}

// ─── Chargement serveur du contexte d'explication ───────────────────────────

/**
 * Rassemble tout ce qu'il faut pour expliquer un créneau déjà planifié.
 * Utilisé par /api/pourquoi pour rester cohérent avec le moteur.
 */
export async function chargerContexteExplication(
  userId: string,
  meal: RecetteMoteur,
  jourIndex: number,
  repasType: RepasSlot,
  supabase: Db
): Promise<ContexteExplication> {
  const [{ data: profilRow }, { data: historique }, { data: frigo }, memoire, famille] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
    supabase.from('meal_history').select('planned_date, status').eq('user_id', userId).eq('meal_id', meal.id),
    supabase.from('fridge_items').select('ingredient_id').eq('user_id', userId),
    chargerMemoire(userId, supabase),
    chargerFamille(userId, supabase),
  ]);

  const profile = profilRow as unknown as Profile;
  const rows = historique ?? [];

  const dates = rows.map(r => new Date(r.planned_date).getTime());
  const derniere = dates.length ? Math.max(...dates) : null;
  const joursDepuisDerniere = derniere == null
    ? null
    : Math.floor((Date.now() - derniere) / (1000 * 60 * 60 * 24));

  const stats: HistoriqueRecette = {
    joursDepuisDerniere,
    likes: rows.filter(r => r.status === 'liked').length,
    dislikes: rows.filter(r => r.status === 'disliked').length,
    total: rows.length,
  };

  return {
    jourIndex,
    repasType,
    profile,
    memoire,
    historique: stats,
    frigoIngredientIds: new Set((frigo ?? []).map(f => f.ingredient_id)),
    budgetHebdo: profile.budget_hebdo ?? null,
    prixPortion: prixParPortion(meal),
    saisonActuelle: getSaisonActuelle(),
    batchCooking: profile.batch_cooking,
    famille,
  };
}
