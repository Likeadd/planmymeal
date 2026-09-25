// ============================================================================
// Profils famille — le compromis alimentaire
//
// Le foyer n'est pas une personne. Ce module répond à une seule question, celle
// que pose toute famille : « qu'est-ce qu'on mange, sachant que l'un adore les
// lentilles, que l'autre ne supporte pas le poisson et que l'enfant refuse les
// champignons ? »
//
// Trois mécanismes, du plus dur au plus souple :
//   1. EXCLUSIONS DURES — un aliment 'interdit' par un membre (allergie,
//      intolérance, éthique) sort la recette du pool. Jamais négocié.
//   2. VETO COLLECTIF — « ne plus proposer » d'un membre ne bloque que si la
//      SOMME DES POIDS des membres qui refusent atteint la moitié du foyer.
//      Un seul avis ne dicte pas le menu ; le foyer qui refuse, si.
//   3. COMPROMIS — moyenne GÉOMÉTRIQUE pondérée des satisfactions, appliquée
//      comme facteur de score.
//
// Pourquoi géométrique et pas arithmétique : avec une moyenne simple, deux
// « 5/5 » compensent un « je déteste » — la recette sort en tête alors qu'un
// membre ne la mangera pas. La moyenne géométrique s'effondre dès qu'un membre
// est mécontent, sans lui donner pour autant un droit de veto. C'est ce qui
// distingue « le meilleur compromis » d'« une moyenne ».
// ============================================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/../supabase/database.types';
import type {
  MembreFamille, MembreFamilleComplet, PreferenceMembre, RelationIngredient,
} from '@/types';

export type Db = SupabaseClient<Database>;

/** Nombre maximum de membres d'un foyer (garde-fou d'affichage et de charge) */
export const NB_MEMBRES_MAX = 12;

/** Bornes de la satisfaction d'un membre pour une recette (1 = neutre) */
export const SATISFACTION_MIN = 0.15;
export const SATISFACTION_MAX = 1.4;

/** Part de la somme des poids du foyer qui suffit à bloquer une recette */
const SEUIL_VETO = 0.5;

/** Pondération par défaut d'un nouveau membre */
const POIDS_DEFAUT = 3;

/** Membre indexé : accès O(1) aux relations, sans parcours de tableau par recette */
export interface MembreIndexe extends MembreFamille {
  /** ingredient_id → relation */
  aliments: Map<number, RelationIngredient>;
  /** meal_id → note / veto */
  recettes: Map<number, PreferenceMembre>;
}

/** Mémoire familiale telle que lue par le moteur */
export interface Famille {
  membres: MembreIndexe[];
  /** Part du compromis familial dans le score (0 = mes goûts seuls, 100 = compromis maximal) */
  poidsFamille: number;
}

/** Famille vide : le moteur se comporte exactement comme avant 00017 */
export const FAMILLE_VIDE: Famille = { membres: [], poidsFamille: 70 };

/** Détail du compromis, membre par membre (sert aussi à l'explication) */
export interface Compromis {
  /** Moyenne géométrique pondérée des satisfactions (≈ 1 = neutre) */
  compromis: number;
  detail: { membre: MembreIndexe; satisfaction: number }[];
}

// ─── Normalisation ──────────────────────────────────────────────────────────

const RELATIONS: RelationIngredient[] = ['aime', 'n_aime_pas', 'interdit'];

export function estRelationIngredient(v: unknown): v is RelationIngredient {
  return typeof v === 'string' && (RELATIONS as string[]).includes(v);
}

/**
 * Borne la pondération d'un membre sur l'échelle 1-5.
 * `null` / `undefined` / `''` = non renseigné → valeur par défaut. On ne peut
 * pas se fier à `Number(v)` seul : `Number(null)` vaut 0, donc une case vidée
 * ferait passer le membre en « souple » (1) au lieu de « normal » (3).
 */
export function bornerPoids(v: unknown): number {
  if (v == null || v === '') return POIDS_DEFAUT;
  const n = Number(v);
  if (!Number.isFinite(n)) return POIDS_DEFAUT;
  return Math.min(5, Math.max(1, Math.round(n)));
}

/** Borne le poids global du compromis familial (0-100) — même garde que ci-dessus */
export function bornerPoidsFamille(v: unknown): number {
  if (v == null || v === '') return FAMILLE_VIDE.poidsFamille;
  const n = Number(v);
  if (!Number.isFinite(n)) return FAMILLE_VIDE.poidsFamille;
  return Math.min(100, Math.max(0, Math.round(n)));
}

/** Met une famille brute (API / DB) sous forme indexée */
export function indexerFamille(
  membres: MembreFamilleComplet[],
  poidsFamille: number
): Famille {
  return {
    membres: membres.map(m => ({
      id: m.id,
      nom: m.nom,
      emoji: m.emoji,
      poids: bornerPoids(m.poids),
      age: m.age ?? null,
      aliments: new Map(
        m.aliments
          .filter(a => estRelationIngredient(a.relation))
          .map(a => [a.ingredient_id, a.relation])
      ),
      recettes: new Map(
        m.recettes.map(r => [r.meal_id, {
          meal_id: r.meal_id,
          note: r.note ?? null,
          ne_plus_proposer: r.ne_plus_proposer === true,
        }])
      ),
    })),
    poidsFamille: bornerPoidsFamille(poidsFamille),
  };
}

/**
 * Charge la famille d'un foyer. Best-effort assumé : tant que la migration
 * 00017 n'est pas appliquée, on retombe sur une famille vide — le moteur
 * fonctionne exactement comme avant plutôt que d'échouer.
 */
export async function chargerFamille(
  userId: string,
  supabase: Db,
  /** `poids_famille` déjà lu par l'appelant (évite une requête sur le chemin chaud) */
  poidsFamilleConnu?: number | null
): Promise<Famille> {
  try {
    const [{ data: membresRaw }, poidsFamille] = await Promise.all([
      supabase
        .from('family_members')
        .select('id, nom, emoji, poids, age, family_member_ingredients(ingredient_id, relation), family_member_meal_preferences(meal_id, note, ne_plus_proposer)')
        .eq('user_id', userId)
        .order('id'),
      poidsFamilleConnu !== undefined
        ? Promise.resolve(poidsFamilleConnu ?? FAMILLE_VIDE.poidsFamille)
        : supabase
          .from('profiles')
          .select('poids_famille')
          .eq('id', userId)
          .maybeSingle()
          .then(({ data }) => data?.poids_famille ?? FAMILLE_VIDE.poidsFamille),
    ]);

    if (!membresRaw) return FAMILLE_VIDE;

    const membres: MembreFamilleComplet[] = (membresRaw as unknown as MembreRow[]).map(m => ({
      id: m.id,
      nom: m.nom,
      emoji: m.emoji,
      poids: m.poids,
      age: m.age,
      aliments: (m.family_member_ingredients ?? []).map(a => ({
        ingredient_id: a.ingredient_id,
        relation: a.relation as RelationIngredient,
      })),
      recettes: (m.family_member_meal_preferences ?? []).map(r => ({
        meal_id: r.meal_id,
        note: r.note,
        ne_plus_proposer: r.ne_plus_proposer,
      })),
    }));

    return indexerFamille(membres, poidsFamille);
  } catch {
    return FAMILLE_VIDE;
  }
}

interface MembreRow {
  id: number;
  nom: string;
  emoji: string;
  poids: number;
  age: number | null;
  family_member_ingredients: { ingredient_id: number; relation: string }[] | null;
  family_member_meal_preferences: {
    meal_id: number; note: number | null; ne_plus_proposer: boolean;
  }[] | null;
}

// ─── Filtres durs ───────────────────────────────────────────────────────────

/**
 * Aliments qu'au moins un membre a marqués « interdit ». Traités exactement
 * comme les allergies du compte : la recette est écartée, sans débat.
 */
export function alimentsInterdits(famille: Famille): Set<number> {
  const interdits = new Set<number>();
  for (const m of famille.membres) {
    for (const [ingredientId, relation] of m.aliments) {
      if (relation === 'interdit') interdits.add(ingredientId);
    }
  }
  return interdits;
}

/**
 * Recettes bloquées par un veto collectif : la somme des poids des membres qui
 * ont coché « ne plus proposer » doit atteindre le seuil (moitié du foyer).
 *
 * Un seul refus ne suffit donc pas — sauf si ce membre pèse autant que tout le
 * reste (foyer d'une seule personne, ou enfant « prioritaire » face à un seul
 * parent « normal »). Les aliments interdits, eux, ne passent jamais par ici.
 */
export function recettesVetees(famille: Famille): Set<number> {
  const poidsTotal = famille.membres.reduce((s, m) => s + m.poids, 0);
  const veto = new Set<number>();
  if (poidsTotal <= 0) return veto;

  const poidsParRecette = new Map<number, number>();
  for (const m of famille.membres) {
    for (const [mealId, pref] of m.recettes) {
      if (pref.ne_plus_proposer) {
        poidsParRecette.set(mealId, (poidsParRecette.get(mealId) ?? 0) + m.poids);
      }
    }
  }
  for (const [mealId, poids] of poidsParRecette) {
    if (poids / poidsTotal >= SEUIL_VETO) veto.add(mealId);
  }
  return veto;
}

// ─── Satisfaction & compromis ───────────────────────────────────────────────

/**
 * Satisfaction d'un membre pour une recette : 1 = neutre, bornée [0.15, 1.4].
 * Ne lit que des données saisies — aucune inférence, donc rien d'inventé dans
 * l'explication « Pourquoi ce repas ? ».
 */
export function satisfactionMembre(
  membre: MembreIndexe,
  mealId: number,
  ingredientIds: number[]
): number {
  let s = 1;

  const pref = membre.recettes.get(mealId);
  if (pref?.ne_plus_proposer) s *= 0.25;
  if (pref?.note != null) {
    if (pref.note >= 5) s *= 1.25;
    else if (pref.note === 4) s *= 1.1;
    else if (pref.note === 2) s *= 0.55;
    else if (pref.note <= 1) s *= 0.3;
  }

  for (const id of ingredientIds) {
    const relation = membre.aliments.get(id);
    if (relation === 'aime') s *= 1.12;
    else if (relation === 'n_aime_pas') s *= 0.8;
    // 'interdit' est filtré en amont ; on garde une trace si la recette passe
    else if (relation === 'interdit') s *= 0.25;
  }

  return Math.min(SATISFACTION_MAX, Math.max(SATISFACTION_MIN, s));
}

/** Compromis familial pour une recette (moyenne géométrique pondérée) */
export function compromisFamille(
  famille: Famille,
  mealId: number,
  ingredientIds: number[]
): Compromis {
  const actifs = famille.membres.filter(m => m.poids > 0);
  if (actifs.length === 0) return { compromis: 1, detail: [] };

  let sommePoids = 0;
  let sommeLog = 0;
  const detail: Compromis['detail'] = [];

  for (const m of actifs) {
    const satisfaction = satisfactionMembre(m, mealId, ingredientIds);
    sommePoids += m.poids;
    sommeLog += m.poids * Math.log(satisfaction);
    detail.push({ membre: m, satisfaction });
  }

  return { compromis: Math.exp(sommeLog / sommePoids), detail };
}

/**
 * Facteur de score du compromis familial, à partir du compromis DÉJÀ calculé
 * (l'appelant a besoin du détail pour l'explication : on ne calcule pas deux fois).
 *
 * `poidsFamille` (0-100) arbitre entre « je cuisine d'abord pour moi » et
 * « tout le monde doit s'y retrouver » : à 0 la famille n'influence rien
 * (facteur 1), à 100 le score du foyer EST le compromis.
 */
export function facteurFamille(famille: Famille, compromis: number): number {
  if (famille.membres.length === 0) return 1;
  const lambda = bornerPoidsFamille(famille.poidsFamille) / 100;
  if (lambda === 0) return 1;
  return (1 - lambda) + lambda * compromis;
}

// ─── Aide à l'explication ───────────────────────────────────────────────────

/**
 * Aliments de la recette qu'un membre a marqués « je n'aime pas ».
 * Sert à dire honnêtement « Léa n'aime pas les champignons » quand c'est le
 * cas, au lieu de laisser croire que la recette fait l'unanimité.
 */
export function alimentsRejetesParMembre(
  membre: MembreIndexe,
  ingredientIds: number[]
): number[] {
  return ingredientIds.filter(id => membre.aliments.get(id) === 'n_aime_pas');
}

/** Ton d'un membre pour une recette — pilote la couleur de sa pastille */
export type HumeurMembre = 'aime' | 'neutre' | 'peu';

/**
 * Traduit une satisfaction en ton lisible. Les bornes sont alignées sur ce que
 * produit `satisfactionMembre` : 1.1+ = une note 4/5 (ou des aliments aimés),
 * 1.0 = aucun avis, 0.8 = un seul « je n'aime pas ».
 */
export function humeurMembre(satisfaction: number): HumeurMembre {
  if (satisfaction >= 1.05) return 'aime';
  if (satisfaction >= 0.9) return 'neutre';
  return 'peu';
}

/**
 * Pourquoi ce membre en est là — texte construit UNIQUEMENT sur des données
 * saisies (note, aliment aimé ou non). C'est l'infobulle de la pastille du
 * dashboard : elle doit pouvoir être vérifiée dans les réglages, sinon elle
 * n'aurait pas sa place sur la carte d'un repas.
 */
export function raisonMembre(
  membre: MembreIndexe,
  mealId: number,
  ingredientIds: number[],
  /** ingredient_id → nom, pour nommer les aliments dans l'infobulle */
  nomsIngredient: Map<number, string> = new Map()
): string {
  const pref = membre.recettes.get(mealId);
  const nommer = (id: number) => nomsIngredient.get(id) ?? `l'ingrédient #${id}`;

  if (pref?.ne_plus_proposer) return `${membre.nom} ne veut plus de cette recette`;
  if (pref?.note != null && pref.note >= 4) return `${membre.nom} l'adore (${pref.note}/5)`;
  if (pref?.note != null && pref.note === 2) return `${membre.nom} l'aime peu (2/5)`;
  if (pref?.note === 1) return `${membre.nom} ne l'aime pas (1/5)`;

  const rejetes = alimentsRejetesParMembre(membre, ingredientIds);
  if (rejetes.length > 0) {
    const liste = rejetes.slice(0, 2).map(nommer).join(' ni ');
    return `${membre.nom} n'aime pas ${liste}`;
  }

  const aimes = ingredientIds.filter(id => membre.aliments.get(id) === 'aime');
  if (aimes.length > 0) return `${membre.nom} aime ${nommer(aimes[0])}`;
  if (pref?.note === 3) return `${membre.nom} : correct (3/5)`;

  return `${membre.nom} : aucun avis enregistré`;
}
