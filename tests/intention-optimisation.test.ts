// ============================================================================
// Intention d'optimisation — l'inclinaison du clic « Optimiser ma semaine ».
//
// Le clic direct reste ÉQUILIBRÉ (poids standard) ; les intentions inclinent
// la pondération du moteur sans jamais remplacer les contraintes dures. Ces
// tests verrouillent l'API pure : validation réseau (aucune valeur inconnue
// ne traverse) et table des poids (chaque intention ne touche que SA dimension).
// ============================================================================

import { describe, it, expect } from 'vitest';
import {
  validerIntention,
  POIDS_INTENTION,
  validerRythmeDesserts,
  RYTHME_DESSERTS,
  type IntentionOptimisation,
  type RythmeDesserts,
} from '@/lib/rotation-engine';

describe("validerIntention — garde d'entrée réseau", () => {
  it('accepte les trois intentions valides', () => {
    expect(validerIntention('budget')).toBe('budget');
    expect(validerIntention('temps')).toBe('temps');
    expect(validerIntention('gaspillage')).toBe('gaspillage');
  });

  it('retombe sur équilibré (undefined) pour les valeurs bénignes', () => {
    // 'equilibre' est un alias d'absence d'intention (UI)
    expect(validerIntention('equilibre')).toBeUndefined();
    expect(validerIntention(null)).toBeUndefined();
    expect(validerIntention(undefined)).toBeUndefined();
    expect(validerIntention('')).toBeUndefined();
  });

  it('neutralise toute valeur inconnue venue du réseau (jamais de rejet)', () => {
    expect(validerIntention('hacker')).toBeUndefined();
    expect(validerIntention('BUDGET')).toBeUndefined(); // sensible à la casse
    expect(validerIntention(42)).toBeUndefined();
    expect(validerIntention({ intention: 'budget' })).toBeUndefined();
    expect(validerIntention(['budget'])).toBeUndefined();
    expect(validerIntention(true)).toBeUndefined();
  });
});

describe('POIDS_INTENTION — chaque intention ne touche que sa dimension', () => {
  const intentions = Object.keys(POIDS_INTENTION) as Array<
    keyof typeof POIDS_INTENTION
  >;

  it('expose exactement les 4 choix du menu (equilibre + 3 intentions)', () => {
    expect(intentions.sort()).toEqual(['budget', 'equilibre', 'gaspillage', 'temps']);
  });

  it('équilibré = poids neutres (le défaut ne déforme rien)', () => {
    const e = POIDS_INTENTION.equilibre;
    expect(e.budget).toBe(1.0);
    expect(e.frigoFraicheur).toBeGreaterThan(1); // l'anti-gaspi reste encadré
    expect(e.frigoFraicheur).toBeLessThan(1.5);  // …mais JAMAIS agressif
  });

  it("« budget » amplifie le facteur budget, et rien d'autre", () => {
    expect(POIDS_INTENTION.budget.budget).toBeGreaterThan(1.0);
    expect(POIDS_INTENTION.budget.frigoFraicheur).toBe(POIDS_INTENTION.equilibre.frigoFraicheur);
  });

  it('« temps » ne touche AUCUN poids de pool (il agit au niveau des créneaux)', () => {
    // L'intention temps est appliquée dans scorePourSlot (bonus par créneau),
    // pas dans la pondération du pool : ici elle doit rester neutre.
    expect(POIDS_INTENTION.temps.budget).toBe(1.0);
    expect(POIDS_INTENTION.temps.frigoFraicheur).toBe(POIDS_INTENTION.equilibre.frigoFraicheur);
  });

  it('« gaspillage » survalorise le frigo, sans toucher au budget', () => {
    expect(POIDS_INTENTION.gaspillage.frigoFraicheur).toBeGreaterThan(
      POIDS_INTENTION.equilibre.frigoFraicheur
    );
    expect(POIDS_INTENTION.gaspillage.budget).toBe(1.0);
  });

  it('couvre toutes les intentions déclarées (pas de poids manquant)', () => {
    const toutes: IntentionOptimisation[] = ['budget', 'temps', 'gaspillage'];
    for (const i of toutes) {
      expect(POIDS_INTENTION[i]).toBeDefined();
      expect(POIDS_INTENTION[i].budget).toBeGreaterThan(0);
      expect(POIDS_INTENTION[i].frigoFraicheur).toBeGreaterThan(0);
    }
  });
});

describe('Rythme desserts — paliers et validation (migration 00022)', () => {
  it('valide les 4 paliers, neutralise toute valeur inconnue vers équilibré', () => {
    expect(validerRythmeDesserts('aucun')).toBe('aucun');
    expect(validerRythmeDesserts('leger')).toBe('leger');
    expect(validerRythmeDesserts('equilibre')).toBe('equilibre');
    expect(validerRythmeDesserts('gourmand')).toBe('gourmand');
    // Valeurs réseau inconnues → défaut sûr (jamais de rejet)
    expect(validerRythmeDesserts('hacker')).toBe('equilibre');
    expect(validerRythmeDesserts(null)).toBe('equilibre');
    expect(validerRythmeDesserts(undefined)).toBe('equilibre');
    expect(validerRythmeDesserts(42)).toBe('equilibre');
  });

  it('équilibré reproduit EXACTEMENT le comportement historique', () => {
    // Le défaut ne doit pas changer les semaines existantes :
    // 4 soirs max (DESSERTS_PAR_SEMAINE) et 3 midis max.
    expect(RYTHME_DESSERTS.equilibre.soirs).toBe(4);
    expect(RYTHME_DESSERTS.equilibre.midis).toBe(3);
  });

  it('les paliers s encadrent : aucun < léger < équilibré < gourmand', () => {
    const soirs = (r: RythmeDesserts) => RYTHME_DESSERTS[r].soirs ?? 0;
    expect(soirs('aucun')).toBe(0);
    expect(soirs('leger')).toBeLessThan(soirs('equilibre'));
    expect(soirs('equilibre')).toBeLessThan(soirs('gourmand'));
    expect(soirs('gourmand')).toBeLessThanOrEqual(7); // jamais plus d'un par soir
    const midis = (r: RythmeDesserts) => RYTHME_DESSERTS[r].midis ?? 0;
    expect(midis('leger')).toBeLessThan(midis('equilibre'));
    expect(midis('equilibre')).toBeLessThanOrEqual(midis('gourmand'));
  });

  it('« aucun » ne planifie strictement rien', () => {
    expect(RYTHME_DESSERTS.aucun.soirs).toBeNull();
    expect(RYTHME_DESSERTS.aucun.midis).toBeNull();
  });
});
