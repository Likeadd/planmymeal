// ============================================================================
// Tests — la branche « léger » ne juge que des calories vérifiées
//
// Le score d'un jour léger multiplie par 1,2 un plat sous 550 kcal et par 0,6
// au-delà de 750. Cette branche fait donc décider les calories à la place du
// cuisinier : si elles sont SOUS-ESTIMÉES, un plat lourd passe pour léger et le
// moteur le FAVORISE — l'inverse du but. C'était le cas de tout le catalogue
// avant le calcul conscient de l'unité (une pièce comptée pour un gramme).
//
// Depuis, une recette dont les macros n'ont pas été calculées et jugées
// croyables (`macros_verifiables`) est notée NEUTRE : ni bonus, ni malus.
//
// Ces tests portent sur `scorePourSlot`, la fonction réelle du moteur — pas sur
// une réécriture du raisonnement. Le dernier cas est celui qui doit ÉCHOUER si
// quelqu'un retire le garde-fou.
// ============================================================================

import { describe, expect, it } from 'vitest';
import type { RecetteMoteur } from '@/types';
import { scorePourSlot, type Candidate, type SlotContexte } from '@/lib/rotation-engine';
import { PLAFOND_KCAL_PAR_PORTION, verifierPlausibilite } from '@/lib/macros';

function recette(over: Partial<RecetteMoteur> = {}): RecetteMoteur {
  return {
    id: 1,
    titre: 'Poulet curry',
    type_repas: 'plat',
    saison: 'toutes',
    cuisine: 'indienne',
    conservation_jours: 3,
    difficulte: 'facile',
    temps_preparation: 20,
    temps_cuisson: 5,
    calories_par_portion: 400,
    macros_verifiables: true,
    ustensiles: [],
    portions_par_defaut: 4,
    ingredients: [],
    ...over,
  };
}

/** Un créneau « mercredi soir léger » — le seul contexte qui lit les calories. */
const JOUR_LEGER: SlotContexte = {
  jourIndex: 2,
  repasType: 'diner',
  tempsMax: null,
  contexte: 'leger',
  nouveaute: 50,
};

const candidat = (over: Partial<RecetteMoteur> = {}, score = 100): Candidate => ({
  meal: recette(over),
  score,
});

/** Score obtenu, rapporté au score de pool : 1,2 = bonus, 1 = neutre. */
const facteur = (over: Partial<RecetteMoteur> = {}) =>
  scorePourSlot(candidat(over), JOUR_LEGER) / 100;

describe('scorePourSlot — contexte « léger »', () => {
  it('bonifie un plat léger et PENALISE un plat lourd, quand les macros sont verifiées', () => {
    expect(facteur({ calories_par_portion: 400, macros_verifiables: true })).toBeCloseTo(1.2, 5);
    expect(facteur({ calories_par_portion: 800, macros_verifiables: true })).toBeCloseTo(0.6, 5);
  });

  it('reste NEUTRE sur une recette non verifiée, quelle que soit la valeur stockée', () => {
    // Le point du garde-fou : la valeur de la colonne ne sert plus de juge.
    expect(facteur({ calories_par_portion: 400, macros_verifiables: false })).toBeCloseTo(1, 5);
    expect(facteur({ calories_par_portion: 800, macros_verifiables: false })).toBeCloseTo(1, 5);
  });

  it('reste neutre quand les calories sont absentes', () => {
    expect(facteur({ calories_par_portion: null, macros_verifiables: true })).toBeCloseTo(1, 5);
  });

  it('un plat lourd sous-estimé et non vérifié ne reçoit plus le bonus de légèreté', () => {
    // C'est le scénario d'origine, reproduit : « Clafoutis » stocké à 400 kcal
    // alors que sa vraie valeur dépasse 550. Avant le garde-fou, la branche lui
    // donnait ×1,2 ; il doit maintenant rester à ×1.
    const sousEstime = { calories_par_portion: 400, macros_verifiables: false };
    expect(facteur(sousEstime)).toBeCloseTo(1, 5);
    // Et la même recette, vérifiée avec sa vraie valeur, est pénalisée.
    expect(facteur({ calories_par_portion: 800, macros_verifiables: true })).toBeCloseTo(0.6, 5);
  });

  it('ne touche à aucun autre contexte', () => {
    const rapide: SlotContexte = { ...JOUR_LEGER, contexte: 'rapide' };
    const plaisir: SlotContexte = { ...JOUR_LEGER, contexte: 'plaisir' };
    const nonVerifie = candidat({ calories_par_portion: 400, macros_verifiables: false });
    // Contexte rapide : décidé par le temps (25 min de cuisine ici), pas par
    // l'absence de vérification.
    expect(scorePourSlot(nonVerifie, rapide) / 100).toBeCloseTo(1.2, 5);
    expect(scorePourSlot(nonVerifie, plaisir) / 100).toBeCloseTo(1.15, 5);
  });
});

describe('verifierPlausibilite — un total calculable peut être incroyable', () => {
  it('accepte un plat réel, refuse un zéro et un artefact', () => {
    expect(verifierPlausibilite({ cal: 383, p: 20, g: 40, l: 12 })).toEqual({ ok: true });
    expect(verifierPlausibilite({ cal: 0, p: 0, g: 0, l: 0 }).ok).toBe(false);
    expect(verifierPlausibilite({ cal: PLAFOND_KCAL_PAR_PORTION + 1, p: 0, g: 0, l: 0 }).ok).toBe(false);
  });

  it('refuse le cas réel « Fish & chips maison » et dit pourquoi', () => {
    // 500 ml d'huile de friture pour 2 portions = 4 500 kcal d'huile, dont
    // 2 250 par portion : on achète cette huile sans la manger. Le total est
    // exact et le plat est faux — d'où le refus plutôt que l'écriture.
    const r = verifierPlausibilite({ cal: 2825, p: 60, g: 240, l: 130 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.detail).toContain('2825');
  });
});
