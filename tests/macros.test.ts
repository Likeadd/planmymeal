// ============================================================================
// unites — la conversion unité → grammes, et les macros qui en dépendent
//
// Ces tests portent sur la règle qui a rendu tout le catalogue faux : une
// quantité non massique multipliée par un coefficient « pour 100 g » sans
// conversion. Ils sont écrits pour ÉCHOUER si on revient à l'ancien calcul.
// ============================================================================

import { describe, it, expect } from 'vitest';
import { grammes, uniteEstMasse, poidsUnitesDe } from '@/lib/unites';
import { calculerMacros, type LigneMacros } from '@/lib/macros';

describe('grammes — unités de masse', () => {
  it('rend la quantité telle quelle en g', () => {
    expect(grammes(250, 'g')).toBe(250);
  });

  it('assimile ml à 1 g/ml, comme le fait le budget', () => {
    expect(grammes(200, 'ml')).toBe(200);
  });

  it('n’a besoin d’aucun poids déclaré pour une masse', () => {
    expect(grammes(250, 'g', null)).toBe(250);
    expect(grammes(250, 'g', {})).toBe(250);
  });

  it('classe g et ml comme masses', () => {
    expect(uniteEstMasse('g')).toBe(true);
    expect(uniteEstMasse('ml')).toBe(true);
    expect(uniteEstMasse('pcs')).toBe(false);
    expect(uniteEstMasse('cas')).toBe(false);
  });
});

describe('grammes — unités non massiques', () => {
  it('multiplie par le poids de l’unité', () => {
    expect(grammes(4, 'pcs', { pcs: 180 })).toBe(720);
    expect(grammes(2, 'cas', { cas: 10 })).toBe(20);
  });

  it('distingue deux unités du même ingrédient', () => {
    // Un « cas » de miel (20 g) et un « cac » de cannelle (3 g) ne pèsent pas pareil
    expect(grammes(1, 'cas', { cas: 20 })).toBe(20);
    expect(grammes(1, 'cac', { cas: 20, cac: 3 })).toBe(3);
  });

  it('gère les quantités fractionnaires', () => {
    expect(grammes(0.5, 'pcs', { pcs: 1000 })).toBe(500);
    expect(grammes(0.5, 'sachet', { sachet: 11 })).toBe(5.5);
  });

  it('refuse une unité absente du barème plutôt que de l’estimer', () => {
    expect(grammes(4, 'pcs', { cas: 10 })).toBeNull();
    expect(grammes(4, 'pcs', null)).toBeNull();
    expect(grammes(4, 'pcs')).toBeNull();
    expect(grammes(1, 'botte', { botte: 0 })).toBeNull();
  });

  it('refuse un poids absurde', () => {
    expect(grammes(1, 'pcs', { pcs: -5 })).toBeNull();
    expect(grammes(1, 'pcs', { pcs: Number.NaN })).toBeNull();
    expect(grammes(1, 'pcs', { pcs: Number.POSITIVE_INFINITY })).toBeNull();
  });

  it('refuse une quantité inutilisable', () => {
    expect(grammes(0, 'g')).toBeNull();
    expect(grammes(-2, 'g')).toBeNull();
    expect(grammes(Number.NaN, 'g')).toBeNull();
  });
});

describe('calculerMacros — le bug qui a motivé tout ça', () => {
  // Clafoutis aux poires, composition réelle de la base :
  //   Beurre 30 g + Farine 90 g + Lait 250 ml + Œuf 3 pcs + Poire 4 pcs + Sucre 90 g
  const POIDS = {
    'Œuf': { pcs: 60 },
    'Poire': { pcs: 170 },
  };
  const COEF = {
    'Beurre': { cal: 750, proteines: 0.7, glucides: 0.6, lipides: 83 },
    'Farine': { cal: 364, proteines: 10, glucides: 76, lipides: 1 },
    'Lait': { cal: 64, proteines: 3.3, glucides: 4.8, lipides: 3.6 },
    'Œuf': { cal: 140, proteines: 12.5, glucides: 0.5, lipides: 10 },
    'Poire': { cal: 57, proteines: 0.4, glucides: 15, lipides: 0.1 },
    'Sucre': { cal: 400, proteines: 0, glucides: 100, lipides: 0 },
  };
  const L = (nom: string, quantite: number, unite: string): LigneMacros => ({
    quantite, unite,
    poidsUnites: POIDS[nom as keyof typeof POIDS] ?? null,
    coefficients: COEF[nom as keyof typeof COEF],
  });
  const clafoutis = () => [
    L('Beurre', 30, 'g'), L('Farine', 90, 'g'), L('Lait', 250, 'ml'),
    L('Œuf', 3, 'pcs'), L('Poire', 4, 'pcs'), L('Sucre', 90, 'g'),
  ];

  it('compte 3 œufs pour 180 g, pas pour 3 g', () => {
    const r = calculerMacros([L('Œuf', 3, 'pcs')], 1);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // 140 kcal/100 g × 180 g = 252 kcal
    expect(r.macros.cal).toBe(252);
  });

  it('donne un clafoutis autour de 400 kcal/portion, pas 255', () => {
    const r = calculerMacros(clafoutis(), 4);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // 30 g beurre 225 + 90 g farine 328 + 250 ml lait 160 + 180 g œufs 252
    // + 680 g poires 388 + 90 g sucre 360 = 1713 kcal → 428/portion
    expect(r.macros.cal).toBe(428);
    // L'ancien calcul (pièces comptées en grammes) donnait ~255 : c'est
    // exactement l'écart que ce module doit empêcher de revenir.
    expect(r.macros.cal).toBeGreaterThan(255);
  });

  it('laisse 100 % des calories du sucre en glucides', () => {
    const r = calculerMacros([L('Sucre', 90, 'g')], 1);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.macros.g).toBe(90);
    expect(r.macros.cal).toBe(360);
  });

  it('divise par le nombre de portions', () => {
    const un = calculerMacros([L('Sucre', 100, 'g')], 1);
    const deux = calculerMacros([L('Sucre', 100, 'g')], 2);
    if (!un.ok || !deux.ok) throw new Error('calcul refusé');
    expect(deux.macros.cal).toBe(un.macros.cal / 2);
  });
});

describe('poidsUnitesDe — rétrécir une colonne jsonb libre', () => {
  it('lit un barème valide', () => {
    expect(poidsUnitesDe({ pcs: 180, cas: 10 })).toEqual({ pcs: 180, cas: 10 });
  });

  it('écarte les entrées inexploitables sans jeter le reste', () => {
    expect(poidsUnitesDe({ pcs: 180, cas: 'beaucoup', cac: -1, sachet: null }))
      .toEqual({ pcs: 180 });
  });

  it('traite une forme inattendue comme absente', () => {
    expect(poidsUnitesDe(null)).toBeNull();
    expect(poidsUnitesDe(undefined)).toBeNull();
    expect(poidsUnitesDe('180')).toBeNull();
    expect(poidsUnitesDe([180])).toBeNull();
    expect(poidsUnitesDe({})).toBeNull();
    expect(poidsUnitesDe({ pcs: Number.NaN })).toBeNull();
  });
});

describe('calculerMacros — refus explicites', () => {
  const coeff = { cal: 100, proteines: 1, glucides: 1, lipides: 1 };
  const ligne = (o: Partial<LigneMacros> = {}): LigneMacros => ({
    quantite: 100, unite: 'g', coefficients: coeff, poidsUnites: null, ...o,
  });

  it('refuse une unité sans poids déclaré au lieu de la prendre pour des grammes', () => {
    const r = calculerMacros([ligne({ quantite: 3, unite: 'pcs' })], 1);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.raison).toBe('unite_non_convertible');
  });

  it('refuse un total partiel : une seule ligne non convertible suffit', () => {
    const r = calculerMacros([ligne(), ligne({ quantite: 2, unite: 'cas' })], 1);
    expect(r.ok).toBe(false);
  });

  it('refuse des coefficients manquants', () => {
    const r = calculerMacros([ligne({ coefficients: null })], 1);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.raison).toBe('coefficients_manquants');
  });

  it('refuse une composition vide ou des portions invalides', () => {
    expect(calculerMacros([], 2).ok).toBe(false);
    expect(calculerMacros([ligne()], 0).ok).toBe(false);
    expect(calculerMacros([ligne()], -1).ok).toBe(false);
    const r = calculerMacros([], 2);
    if (!r.ok) expect(r.raison).toBe('composition_vide');
  });
});
