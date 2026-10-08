// ============================================================================
// Variété de la semaine — protéines et féculents.
//
// Sans garde-fou, le tirage pondéré servait « pâtes » ou « wraps » presque
// chaque semaine : le catalogue en compte beaucoup, et ils sont rapides et peu
// chers (donc très bien notés). Ce module classe chaque plat par PROTÉINE
// principale (poulet, dinde, bœuf, porc, poisson, œufs, végétal) et par
// FÉCULENT (pâtes, wraps/pitas, riz, pommes de terre) puis mesure à quel point
// une semaine s'écarte d'un bon équilibre : plafonds par groupe + groupes
// attendus (poisson, viande rouge, œufs, volaille). Le moteur s'en sert au
// tirage, dans une passe de correction, et pour ne pas défaire cette variété
// quand il remplace un plat pour tenir le budget.
// ============================================================================

import { normaliserNom } from '@/lib/regimes';
import { tempsTotal } from '@/lib/memoire';
import type { DayPlan, RecetteMoteur, RepasSlot } from '@/types';
import { eligiblePourSlot, scorePourSlot, baseTitre, type SlotContexte } from '@/lib/moteur-creneaux';
import type { Candidate } from '@/lib/rotation-engine';

export type Proteine = 'poulet' | 'dinde' | 'boeuf' | 'porc' | 'poisson' | 'oeuf' | 'vegetal';
export type Feculent = 'pates' | 'wrap' | 'riz' | 'pdt' | 'autre';

// Le titre prime (« Poulet rôti » est du poulet même si la liste cite du beurre),
// l'ordre compte : « haché de dinde » doit être vu comme dinde avant « haché ».
const TITRE_PROTEINE: [Proteine, RegExp][] = [
  ['dinde', /\bdinde/],
  ['poulet', /\b(poulet|volaille|supreme|blanc de|cuisses?|pilons?|nuggets|tikka|yakitori|teriyaki de poulet)/],
  ['poisson', /\b(saumon|cabillaud|thon|merlu|colin|dorade|bar|truite|sardines?|maquereau|crevettes?|gambas|moules?|calamars?|poulpe|sole|merlan|tilapia|surimi|saint-jacques|anchois|poisson|lotte|haddock|morue|fruits de mer|brandade|ceviche|lieu)/],
  ['boeuf', /\b(boeuf|steak|rumsteck|bavette|veau|agneau|hache|hachis|bourguignon|bolognaise|bolognese|entrecote|faux-filet|kefta|burger|carbonnade|chili con carne|blanquette|osso|gigot|tartare)/],
  ['porc', /\b(porc|jambon|lardons?|saucisses?|chorizo|bacon|merguez|pancetta|boudin|andouillette|cassoulet|choucroute|rillettes|filet mignon|carbonara|croque|saucisson|tartiflette)/],
  ['oeuf', /\b(oeufs?|omelette|frittata|shakshuka|quiche|souffle|mimosa|brouilles?|cocotte)/],
];

// Repli sur les ingrédients quand le titre ne dit rien (« Poêlée du chef »)
const INGREDIENT_PROTEINE: [Proteine, RegExp][] = [
  ['dinde', /dinde/], ['poulet', /poulet|volaille/], ['poisson', /saumon|cabillaud|thon|merlu|colin|dorade|truite|sardine|maquereau|crevette|gambas|moule|calamar|merlan|tilapia|anchois|lotte|surimi/],
  ['boeuf', /boeuf|veau|agneau|steak|rumsteck|faux-filet|viande hachee/], ['porc', /porc|jambon|lardon|saucisse|chorizo|bacon|merguez|pancetta/],
];

const TITRE_FECULENT: [Feculent, RegExp][] = [
  ['pates', /\b(pates?|spaghetti|penne|tagliatelles?|fusilli|macaroni|coquillettes?|lasagnes?|orzo|nouilles?|crozets|gnocchis?|ravioli|cannelloni|raviolis|vermicelles?|soba|udon|ramen|pad thai|carbonara|bolognaise|bolognese)/],
  ['wrap', /\b(wraps?|pitas?|tortillas?|burritos?|tacos?|fajitas?|quesadillas?|galettes?|burgers?|sandwichs?|sandwiches|kebabs?|paninis?|croques?|bagels?|naans?|pizzas?|focaccias?)/],
  ['riz', /\b(riz|risotto|paella|biryani|pilaf|sushis?|poke|jambalaya)/],
  ['pdt', /\b(pommes? de terre|patates?|gratin|parmentier|frites|rosti|purees?|dauphinois|tartiflette|gnocchis?|boulangere)/],
];

const INGREDIENT_FECULENT: [Feculent, RegExp][] = [
  ['pates', /^(pates?|spaghetti|penne|tagliatelles?|fusilli|macaroni|coquillettes?|feuilles de lasagne|orzo|nouilles|crozets|gnocchis)/],
  ['wrap', /^(tortilla|pains? pita|pains? burger|galette|naan)/],
  ['riz', /^riz\b/], ['pdt', /^(pommes? de terre|patate)/],
];

interface Profil { proteine: Proteine; feculent: Feculent }
const memo = new WeakMap<object, Profil>();

/** Classe un plat par protéine principale et féculent (mémoïsé par objet recette). */
export function profilPlat(meal: RecetteMoteur): Profil {
  const connu = memo.get(meal);
  if (connu) return connu;
  const titre = normaliserNom(meal.titre);
  const noms = ((meal as unknown as { ingredients?: { est_optionnel: boolean; ingredient: { nom: string } }[] }).ingredients ?? [])
    .filter(i => !i.est_optionnel).map(i => normaliserNom(i.ingredient.nom));

  const proteine: Proteine =
    TITRE_PROTEINE.find(([, re]) => re.test(titre))?.[0]
    ?? INGREDIENT_PROTEINE.find(([, re]) => noms.some(n => re.test(n)))?.[0]
    ?? (noms.some(n => /^oeuf/.test(n)) ? 'oeuf' : 'vegetal');
  const feculent: Feculent =
    TITRE_FECULENT.find(([, re]) => re.test(titre))?.[0]
    ?? INGREDIENT_FECULENT.find(([, re]) => noms.some(n => re.test(n)))?.[0]
    ?? 'autre';
  const p = { proteine, feculent };
  memo.set(meal, p);
  return p;
}

/** Plafonds pour 14 plats distincts ; proportionnels quand il y en a moins (restes : 8). */
const PLAFOND_PROTEINE: Record<Proteine, number> = { poulet: 2, dinde: 1, boeuf: 2, porc: 2, poisson: 3, oeuf: 2, vegetal: 3 };
const PLAFOND_FECULENT: Partial<Record<Feculent, number>> = { pates: 2, wrap: 1, riz: 3, pdt: 3 };
const plafond = (base: number, n: number, arrondi: (x: number) => number = Math.ceil) => Math.max(1, arrondi((base * n) / 14));

/** Groupes attendus dans une semaine (un seul plat suffit ; le poisson en veut 2 sur 14 plats). */
const ATTENDUS: { nom: string; groupes: Proteine[]; min: (n: number) => number }[] = [
  { nom: 'poisson', groupes: ['poisson'], min: n => (n >= 12 ? 2 : 1) },
  { nom: 'boeuf', groupes: ['boeuf'], min: () => 1 },
  { nom: 'oeuf', groupes: ['oeuf'], min: () => 1 },
  { nom: 'volaille', groupes: ['poulet', 'dinde'], min: n => (n >= 7 ? 2 : 1) },
];

/** Rythme de la semaine : des plats simples et rapides, et quelques plats plus élaborés. */
export const SEUIL_SIMPLE_MIN = 25;
export const SEUIL_ELABORE_MIN = 40;

/** Parts minimales de plats simples et de plats élaborés dans la semaine. */
export interface Rythme { simples: number; elabores: number }
export const RYTHME_STANDARD: Rythme = { simples: 0.35, elabores: 0.2 };

/**
 * Rythme selon l'aisance du budget (par personne et par semaine) : budget serré
 * → surtout des plats simples et économiques, un seul plat plus élaboré ;
 * budget standard → le mélange habituel ; budget confortable → davantage de
 * plats élaborés (mijotés, gratins, plats du week-end).
 */
export function rythmeBudget(budget: number, nbPersonnes: number): Rythme {
  const parPersonne = budget / Math.max(1, nbPersonnes);
  if (parPersonne < 35) return { simples: 0.5, elabores: 0.1 };
  if (parPersonne <= 55) return RYTHME_STANDARD;
  return { simples: 0.25, elabores: 0.35 };
}
const minPlats = (part: number, n: number) => (n >= 7 ? Math.round(part * n) : 0);

/**
 * Écart d'une liste de plats à un bon équilibre (0 = parfait) : excès sur les
 * plafonds de protéine et de féculent (poids 3 et 2) + groupes attendus absents (poids 2).
 */
export function penaliteDiversite(plats: RecetteMoteur[], rythme: Rythme = RYTHME_STANDARD): number {
  const n = plats.length;
  if (n < 5) return 0;
  const parProteine = new Map<Proteine, number>();
  const parFeculent = new Map<Feculent, number>();
  for (const m of plats) {
    const { proteine, feculent } = profilPlat(m);
    parProteine.set(proteine, (parProteine.get(proteine) ?? 0) + 1);
    parFeculent.set(feculent, (parFeculent.get(feculent) ?? 0) + 1);
  }
  let pen = 0;
  for (const [p, c] of parProteine) pen += Math.max(0, c - plafond(PLAFOND_PROTEINE[p], n)) * 3;
  for (const [f, c] of parFeculent) { const base = PLAFOND_FECULENT[f]; if (base) pen += Math.max(0, c - plafond(base, n, Math.floor)) * 2; }
  for (const a of ATTENDUS) {
    const present = a.groupes.reduce((s, g) => s + (parProteine.get(g) ?? 0), 0);
    pen += Math.max(0, a.min(n) - present) * 2;
  }
  // Alternance : ni une semaine 100 % express, ni 100 % longue (poids plus faible)
  const temps = plats.map(m => tempsTotal(m));
  pen += Math.max(0, minPlats(rythme.simples, n) - temps.filter(t => t <= SEUIL_SIMPLE_MIN).length) * 1.5;
  pen += Math.max(0, minPlats(rythme.elabores, n) - temps.filter(t => t >= SEUIL_ELABORE_MIN).length) * 1.5;
  return pen;
}

/** Plats réellement cuisinés : le déjeuner « reste » du lendemain n'est pas un nouveau plat. */
export function platsDeLaSemaine(days: DayPlan[]): RecetteMoteur[] {
  const plats: RecetteMoteur[] = [];
  for (const d of days) {
    if (d.dejeuner && !d.restesDe) plats.push(d.dejeuner as unknown as RecetteMoteur);
    if (d.diner) plats.push(d.diner as unknown as RecetteMoteur);
  }
  return plats;
}

/**
 * Facteur de score d'un candidat selon ce qui est déjà dans la semaine : on
 * décourage le groupe déjà bien servi et on favorise un groupe attendu encore
 * absent. Multiplicatif et doux : jamais d'exclusion, le goût et le budget restent.
 */
export function facteurDiversite(candidat: RecetteMoteur, dejaChoisis: RecetteMoteur[]): number {
  const { proteine, feculent } = profilPlat(candidat);
  let nProt = 0, nFec = 0;
  for (const m of dejaChoisis) {
    const p = profilPlat(m);
    if (p.proteine === proteine) nProt++;
    if (feculent !== 'autre' && p.feculent === feculent) nFec++;
  }
  let f = 1 / (1 + 0.9 * nProt) / (1 + 0.8 * nFec);
  const attendu = ATTENDUS.find(a => a.groupes.includes(proteine));
  if (attendu && nProt === 0 && dejaChoisis.length >= 3) f *= 1.8;
  return f;
}

/**
 * Passe de correction : remplace des plats pour corriger les plafonds dépassés
 * (« 4 plats de pâtes ») et les groupes absents (« aucun poisson »). À chaque
 * tour, le remplacement qui réduit le plus l'écart est appliqué, parmi les
 * candidats éligibles au créneau, jamais déjà servis dans la semaine et dont le
 * score de créneau reste au moins la moitié de celui du plat remplacé : la
 * variété ne sacrifie ni le goût, ni les contraintes du jour. Le dîner source
 * d'un reste entraîne son reste. Ne touche pas aux déjeuners « restes ».
 */
export function diversifierSemaine(
  days: DayPlan[],
  pool: Candidate[],
  slots: (jourIndex: number, repasType: RepasSlot) => SlotContexte,
  tours = 10,
  rythme: Rythme = RYTHME_STANDARD,
): DayPlan[] {
  let semaine = days.map(d => ({ ...d }));
  let pen = penaliteDiversite(platsDeLaSemaine(semaine), rythme);
  const parId = new Map(pool.map(c => [c.meal.id, c]));

  for (let t = 0; t < tours && pen > 0; t++) {
    const servis = new Set(semaine.flatMap(d => [d.dejeuner?.id, d.diner?.id]).filter((id): id is number => id != null));
    const bases = new Set(semaine.flatMap(d => [d.dejeuner, d.diner]).filter(Boolean).map(m => baseTitre(m!.titre)));
    let meilleur: { jour: number; type: 'dejeuner' | 'diner'; cand: Candidate; pen: number; ratio: number } | null = null;

    semaine.forEach((d, i) => {
      for (const type of ['dejeuner', 'diner'] as const) {
        const actuel = d[type];
        if (!actuel || (type === 'dejeuner' && d.restesDe)) continue;
        const cActuel = parId.get(actuel.id);
        const slot = slots(d.jourIndex, type);
        const refScore = cActuel ? Math.max(scorePourSlot(cActuel, slot), 1) : 1;
        for (const c of pool) {
          if (servis.has(c.meal.id) || bases.has(baseTitre(c.meal.titre)) || !eligiblePourSlot(c, slot)) continue;
          const ratio = scorePourSlot(c, slot) / refScore;
          if (ratio < 0.5) continue;
          const essai = semaine.map((j, k) => (k === i ? { ...j, [type]: c.meal } : j)) as DayPlan[];
          const penEssai = penaliteDiversite(platsDeLaSemaine(essai), rythme);
          if (penEssai >= pen) continue;
          if (!meilleur || penEssai < meilleur.pen || (penEssai === meilleur.pen && ratio > meilleur.ratio)) {
            meilleur = { jour: i, type, cand: c, pen: penEssai, ratio };
          }
        }
      }
    });
    if (!meilleur) break;
    const m = meilleur as { jour: number; type: 'dejeuner' | 'diner'; cand: Candidate; pen: number };
    const ancienId = semaine[m.jour][m.type]?.id;
    semaine = semaine.map((d, i) => {
      if (i === m.jour) return { ...d, [m.type]: m.cand.meal as unknown as DayPlan['dejeuner'] };
      if (m.type === 'diner' && i === m.jour + 1 && d.restesDe != null && d.restesDe === ancienId) return { ...d, restesDe: m.cand.meal.id };
      return d;
    });
    pen = m.pen;
  }
  return semaine;
}
