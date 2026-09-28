// ============================================================================
// Besoins caloriques — PlanMyMeal
//
// Formule de Mifflin-St Jeor (métabolisme de base), × un facteur d'activité
// « légèrement actif » (1,4), puis ajustée selon l'objectif choisi.
// Chaque donnée du profil (sexe, âge, taille, poids) est FACULTATIVE : une
// donnée absente est remplacée par une valeur de référence (adulte moyen),
// et un sexe inconnu prend la moyenne des deux formules.
// La valeur calculée n'est qu'une proposition : l'utilisateur peut la modifier.
// ============================================================================

import type { Objectif } from '@/types';

export type Sexe = 'homme' | 'femme';

export interface ProfilCorporel {
  sexe?: Sexe | null;
  age?: number | null;
  taille_cm?: number | null;
  poids_kg?: number | null;
}

/** Bornes de saisie acceptées (au-delà : valeur ignorée → référence). */
export const BORNES = {
  age: { min: 14, max: 100 },
  taille_cm: { min: 120, max: 230 },
  poids_kg: { min: 30, max: 250 },
  kcal: { min: 1000, max: 5000 },
} as const;

/** Valeurs de référence quand l'utilisateur ne renseigne pas son profil. */
const REFERENCE = {
  age: 35,
  taille_cm: { homme: 176, femme: 164, inconnu: 170 },
  poids_kg: { homme: 78, femme: 64, inconnu: 71 },
};

/** Activité « légèrement active » : sport léger 1 à 3 fois par semaine. */
const FACTEUR_ACTIVITE = 1.4;

/** Ajustement de l'apport selon l'objectif. */
const AJUSTEMENT_OBJECTIF: Record<Objectif, number> = {
  perte_poids: 0.8,   // déficit modéré de 20 %
  maintien: 1,
  prise_masse: 1.12,  // surplus de 12 %
  sans_regime: 1,
};

/** Plancher de sécurité : on ne propose jamais moins que ces apports. */
const PLANCHER = { homme: 1500, femme: 1200, inconnu: 1350 };

function dansBornes(v: number | null | undefined, b: { min: number; max: number }): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v >= b.min && v <= b.max ? v : null;
}

/** Profil complété par les valeurs de référence (et quelles valeurs ont été supposées). */
export function profilEffectif(p: ProfilCorporel) {
  const cle: Sexe | 'inconnu' = p.sexe === 'homme' || p.sexe === 'femme' ? p.sexe : 'inconnu';
  const age = dansBornes(p.age, BORNES.age);
  const taille = dansBornes(p.taille_cm, BORNES.taille_cm);
  const poids = dansBornes(p.poids_kg, BORNES.poids_kg);
  return {
    cle,
    age: age ?? REFERENCE.age,
    taille_cm: taille ?? REFERENCE.taille_cm[cle],
    poids_kg: poids ?? REFERENCE.poids_kg[cle],
    /** true si au moins une donnée vient des valeurs de référence */
    estimation: !p.sexe || age == null || taille == null || poids == null,
  };
}

/** Métabolisme de base (kcal/jour), Mifflin-St Jeor. */
export function metabolismeDeBase(p: ProfilCorporel): number {
  const { cle, age, taille_cm, poids_kg } = profilEffectif(p);
  const base = 10 * poids_kg + 6.25 * taille_cm - 5 * age;
  const constante = cle === 'homme' ? 5 : cle === 'femme' ? -161 : -78;
  return base + constante;
}

/** Apport calorique journalier proposé pour l'objectif, arrondi à 50 kcal. */
export function caloriesRecommandees(objectif: Objectif, p: ProfilCorporel): number {
  const { cle } = profilEffectif(p);
  const brut = metabolismeDeBase(p) * FACTEUR_ACTIVITE * AJUSTEMENT_OBJECTIF[objectif];
  const arrondi = Math.round(brut / 50) * 50;
  return Math.min(BORNES.kcal.max, Math.max(PLANCHER[cle], arrondi));
}

/** Valide une saisie manuelle de kcal (null si hors bornes). */
export function kcalValide(v: number | null | undefined): number | null {
  return dansBornes(v, BORNES.kcal);
}

// ─── Cible calorique dans le moteur de planning ────────────────────────────

/** Part de l'apport journalier portée par un repas principal (déjeuner ou dîner). */
export const PART_REPAS_PRINCIPAL = 0.36;

/**
 * Cible calorique journalière utilisée par le moteur :
 * - « Sans objectif » → aucune cible (le moteur reste neutre) ;
 * - sinon la valeur choisie par l'utilisateur (`calories_par_jour`) ;
 * - à défaut, la valeur calculée à partir de son objectif et de son profil
 *   (références de base pour les données manquantes).
 */
export function cibleCaloriqueJour(profile: {
  objectif: Objectif;
  calories_par_jour: number | null;
} & ProfilCorporel): number | null {
  if (profile.objectif === 'sans_regime') return null;
  return kcalValide(profile.calories_par_jour) ?? caloriesRecommandees(profile.objectif, profile);
}

/**
 * Facteur de score d'un plat selon l'écart entre ses calories par portion et
 * la part de la cible journalière attendue d'un repas principal.
 * Volontairement doux et jamais éliminatoire : un plat hors cible reste
 * proposable, il est simplement moins favorisé (les contraintes dures —
 * allergies, régime, budget — restent seules à exclure).
 */
export function facteurCalories(kcalPortion: number | null, cibleJour: number | null): number {
  if (kcalPortion == null || cibleJour == null) return 1;
  const ratio = kcalPortion / (cibleJour * PART_REPAS_PRINCIPAL);
  if (ratio >= 0.75 && ratio <= 1.25) return 1.25; // dans la cible
  if (ratio >= 0.55 && ratio <= 1.5) return 1;     // acceptable
  return ratio < 0.55 ? 0.8 : 0.65;                // trop léger / trop copieux
}
