// ============================================================================
// Moteur — créneaux et recoupement (extrait de rotation-engine.ts)
//
//  • Contraintes de créneau : score d'un candidat pour un jour/repas donné
//    (jour préféré, contexte « rapide »/« léger », intention « temps »),
//    contraintes dures (dessert ↔ créneau dessert, temps max) et tirage pondéré.
//  • Recoupement des ingrédients frais : recherche locale anti-gaspillage.
// ============================================================================

import type { ContexteJour, DayPlan, RecetteMoteur, RepasSlot } from '@/types';
import { tempsTotal } from '@/lib/memoire';
import { normaliserNom } from '@/lib/regimes';
import type { Candidate, IntentionOptimisation } from '@/lib/rotation-engine';

/** Score plancher d'un plat au tirage (un score nul ne doit pas l'exclure) */
export const SCORE_MIN_PLAT = 1;

/** true si la recette est un dessert (jamais en créneau déjeuner/dîner) */
export function isDessert(meal: { type_repas: string }): boolean {
  return meal.type_repas === 'dessert';
}

// ─── Contraintes de créneau : « mercredi soir → rapide » ────────────────────

export type Rng = () => number;

/** Contexte d'un créneau visé pendant la génération */
export interface SlotContexte {
  jourIndex: number;
  repasType: RepasSlot;
  /** Temps de cuisine disponible ce jour-là (contrainte dure si renseigné) */
  tempsMax: number | null;
  /** Intention culinaire du jour */
  contexte: ContexteJour;
  /** Curseur Confort (0) ↔ Découverte (100) */
  nouveaute: number;
  /** Inclinaison du clic « Optimiser » — « temps » agit ICI, par créneau */
  intention?: IntentionOptimisation;
}

/**
 * Score d'un candidat POUR UN CRÉNEAU donné : complète le score de pool par ce
 * qui dépend du jour — jour préféré de la recette, créneau préféré, contexte.
 * Le score de pool reste inchangé : on ne réécrit pas la mémoire du candidat.
 */
export function scorePourSlot(c: Candidate, slot: SlotContexte): number {
  let score = c.score;
  const pref = c.preference ?? null;
  const temps = tempsTotal(c.meal);

  // Jour / créneau préférés (« lasagnes plutôt le dimanche midi »)
  if (pref?.jour_prefere === slot.jourIndex) score *= 1.6;
  if (pref?.repas_prefere != null && pref.repas_prefere === slot.repasType) score *= 1.2;

  // ⭐ Intention « temps » : favorise les recettes rapides TOUS CRENEAUX,
  // sans jamais les imposer (multiplicatif doux, aucun candidat éliminé —
  // les contraintes dures et le contexte du jour restent prioritaires).
  if (slot.intention === 'temps') {
    score *= temps <= 20 ? 1.5 : temps <= 30 ? 1.25 : temps <= 45 ? 1.0 : 0.75;
  }

  // Intention culinaire du jour
  if (slot.contexte === 'rapide') {
    score *= temps <= 25 ? 1.2 : temps <= 40 ? 0.7 : 0.45;
  } else if (slot.contexte === 'leger') {
    // Sur un jour « léger », les calories décident — donc des calories fausses
    // décident à la place du cuisinier. L'erreur d'origine (une pièce comptée
    // pour un gramme) SOUS-ESTIMAIT les plats : un plat lourd sous-estimé
    // paraissait léger et recevait le bonus ×1,2, exactement l'inverse du but.
    //
    // Une recette non vérifiée garde donc un facteur NEUTRE : on ne l'avantage
    // pas sur une donnée qu'on ne peut pas vérifier, et on ne la pénalise pas
    // non plus — sa valeur pourrait être juste, on n'en sait simplement rien.
    // L'effet du drapeau est mesuré et petit de nos jours (3 recettes sur
    // 1 138) ; son intérêt est de tenir dans le temps : une recette créée dans
    // l'application ou importée demain naît non vérifiée, donc ne peut pas
    // entrer dans le tri par la porte de la sous-estimation.
    const kcal = c.meal.calories_par_portion;
    if (kcal != null && c.meal.macros_verifiables) {
      score *= kcal <= 550 ? 1.2 : kcal <= 750 ? 0.85 : 0.6;
    }
  } else if (slot.contexte === 'plaisir') {
    score *= 1.15;
  }

  return score;
}

/** Contraintes DURES d'un candidat pour un créneau (dessert + temps du jour) */
export function eligiblePourSlot(c: Candidate, slot: SlotContexte): boolean {
  const dessertSlot = slot.repasType === 'dessert' || slot.repasType === 'dessert_midi';
  if (dessertSlot !== isDessert(c.meal)) return false;
  if (slot.tempsMax != null && tempsTotal(c.meal) > slot.tempsMax) return false;
  return true;
}

/**
 * Tire un candidat pondéré par son score de créneau. Si les contraintes du jour
 * ne laissent rien (temps disponible plus court que toute recette disponible),
 * on les relâche plutôt que de laisser un créneau vide : un dîner manquant est
 * un pire échec produit qu'un repas un peu plus long que prévu.
 */
export function pickPourSlot(
  pool: Candidate[],
  usedMealIds: Set<number>,
  slot: SlotContexte,
  rng: Rng = Math.random
): Candidate | null {
  const disponible = pool.filter(c => !usedMealIds.has(c.meal.id));
  const eligibles = disponible.filter(c => eligiblePourSlot(c, slot));
  const tirage = eligibles.length > 0 ? eligibles : disponible;
  if (tirage.length === 0) return null;

  const scores = tirage.map(c => Math.max(scorePourSlot(c, slot), SCORE_MIN_PLAT));
  const total = scores.reduce((s, v) => s + v, 0);
  let r = rng() * total;
  for (let i = 0; i < tirage.length; i++) {
    r -= scores[i];
    if (r <= 0) return tirage[i];
  }
  return tirage[tirage.length - 1];
}

// ─── Recoupement des ingrédients frais (anti-gaspillage) ───────────────────
//
// Le tirage créneau par créneau choisit chaque plat isolément : une botte de
// coriandre achetée pour lundi finit souvent à la poubelle. Cette passe de
// recherche locale échange des plats de la semaine contre d'autres candidats
// du même vivier quand l'échange augmente le nombre d'ingrédients FRAIS
// partagés entre plusieurs repas (liste plus courte, moins de restes jetés).
//
// Garde-fous : un plat n'est remplacé que par un candidat éligible au créneau
// (temps du jour, type) dont le score de créneau vaut au moins
// TOLERANCE_RECOUPEMENT × celui du plat remplacé — le goût, la mémoire et le
// budget priment toujours ; seul le recoupement départage des plats proches.
// Diversité : le catalogue compte de nombreuses variantes d'un même plat
// (« Salade roquette au tofu… / au saumon… »). Sans garde, maximiser le
// recoupement empilait ces variantes (mesuré : 0,7 → 3,4 doublons par
// semaine). Un candidat dont la base de titre est déjà dans la semaine est
// donc refusé, et l'optimisation ne crée jamais de nouveau doublon.
// Déterministe et sans consommer le générateur aléatoire du moteur : la graine
// dérive des plats déjà tirés (les tirages suivants — desserts — sont intacts).

const RAYONS_PERISSABLES = new Set(['fruits_legumes', 'frais', 'viande_poisson']);
export const ITERATIONS_RECOUPEMENT = 300;
export const TOLERANCE_RECOUPEMENT = 0.85;

/** Ingrédients frais (obligatoires) d'une recette, sans doublon. */
export function ingredientsPerissables(meal: { ingredients?: { est_optionnel: boolean; ingredient: { id: number } }[] }): number[] {
  const ids = new Set<number>();
  for (const li of meal.ingredients ?? []) {
    const rayon = (li.ingredient as { rayon?: string | null }).rayon ?? '';
    if (!li.est_optionnel && RAYONS_PERISSABLES.has(rayon)) ids.add(li.ingredient.id);
  }
  return [...ids];
}

/** Réutilisations d'ingrédients frais dans la semaine : Σ (occurrences − 1). */
export function scoreRecoupement(meals: Parameters<typeof ingredientsPerissables>[0][]): number {
  const compte = new Map<number, number>();
  for (const m of meals) for (const id of ingredientsPerissables(m)) compte.set(id, (compte.get(id) ?? 0) + 1);
  let total = 0;
  for (const n of compte.values()) if (n > 1) total += n - 1;
  return total;
}

/** Base d'un titre (3 premiers mots normalisés) : identifie les variantes d'un même plat. */
export function baseTitre(titre: string): string {
  return normaliserNom(titre).split(/[\s,(]+/).filter(Boolean).slice(0, 3).join(' ');
}

/** Petit générateur déterministe (mulberry32). */
function genererAleatoire(graine: number): Rng {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function optimiserRecoupement(
  days: DayPlan[],
  pool: Candidate[],
  slots: (jourIndex: number, repasType: RepasSlot) => SlotContexte,
  iterations = ITERATIONS_RECOUPEMENT
): void {
  const creneaux: { i: number; repas: 'dejeuner' | 'diner' }[] = [];
  days.forEach((d, i) => {
    if (d.dejeuner) creneaux.push({ i, repas: 'dejeuner' });
    if (d.diner) creneaux.push({ i, repas: 'diner' });
  });
  if (creneaux.length < 2 || pool.length === 0) return;

  const candidatPar = new Map(pool.map(c => [c.meal.id, c]));
  const semaine = () => creneaux.map(k => days[k.i][k.repas] as RecetteMoteur);
  const utilises = new Set(semaine().map(m => m.id));
  const bases = new Map<string, number>();
  for (const m of semaine()) bases.set(baseTitre(m.titre), (bases.get(baseTitre(m.titre)) ?? 0) + 1);
  const rng = genererAleatoire([...utilises].reduce((h, id) => Math.imul(h ^ id, 2654435761), 17));
  let courant = scoreRecoupement(semaine());

  for (let it = 0; it < iterations; it++) {
    const k = creneaux[Math.floor(rng() * creneaux.length)];
    const candidat = pool[Math.floor(rng() * pool.length)];
    const actuel = days[k.i][k.repas] as RecetteMoteur;
    const cActuel = candidatPar.get(actuel.id);
    if (!cActuel || utilises.has(candidat.meal.id)) continue;
    const baseCandidat = baseTitre(candidat.meal.titre);
    const baseActuelle = baseTitre(actuel.titre);
    if (baseCandidat !== baseActuelle && (bases.get(baseCandidat) ?? 0) > 0) continue;

    const slot = slots(k.i, k.repas);
    if (!eligiblePourSlot(candidat, slot)) continue;
    if (scorePourSlot(candidat, slot) < scorePourSlot(cActuel, slot) * TOLERANCE_RECOUPEMENT) continue;

    days[k.i][k.repas] = candidat.meal;
    const nouveau = scoreRecoupement(semaine());
    if (nouveau > courant) {
      courant = nouveau;
      utilises.delete(actuel.id);
      utilises.add(candidat.meal.id);
      bases.set(baseActuelle, (bases.get(baseActuelle) ?? 1) - 1);
      bases.set(baseCandidat, (bases.get(baseCandidat) ?? 0) + 1);
    } else {
      days[k.i][k.repas] = actuel;
    }
  }
}

