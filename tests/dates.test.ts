// ============================================================================
// Helpers de dates — tests de régression sur le fuseau de référence
//
// Le bug corrigé : « aujourd'hui » et « cette semaine » étaient calculés dans
// le fuseau du runtime. Sur Vercel (UTC) et dans le navigateur (Europe/Paris),
// les deux valeurs divergent entre 23 h et minuit UTC → semaine affichée fausse
// et hydration mismatch.
//
// Ces tests passent quel que soit le fuseau de la machine qui exécute vitest :
// les helpers imposent Europe/Paris par Intl, ils ne dépendent donc pas de
// process.env.TZ.
// ============================================================================

import { describe, expect, it } from 'vitest';
import {
  anneeParis,
  dateParis,
  estAujourdhuiParis,
  formatDateHeureParis,
  formatDateLongueFr,
  getMondayParis,
  getMondayWithOffset,
  jourSemaineParis,
  offsetOfSemaine,
  TZ_APP,
} from '@/lib/dates';

describe('fuseau de référence', () => {
  it('est ancré sur Europe/Paris', () => {
    expect(TZ_APP).toBe('Europe/Paris');
  });

  // 2026-09-14 est un lundi ; 2026-09-15 un mardi (CEST = UTC+2 en septembre).
  it('basculent de jour à minuit PARIS, pas à minuit UTC', () => {
    const dimancheSoirUtc = new Date('2026-09-13T23:00:00Z'); // lundi 01:00 à Paris

    expect(dateParis(dimancheSoirUtc)).toBe('2026-09-14');
    expect(jourSemaineParis(dimancheSoirUtc)).toBe(0); // lundi
    expect((dimancheSoirUtc.getUTCDay() + 6) % 7).toBe(6); // dimanche en UTC

    // …et la semaine ne commence plus un jour trop tôt pour un visiteur français
    expect(getMondayParis(dimancheSoirUtc)).toBe('2026-09-14');
  });

  it('jourSemaineParis et dateParis restent cohérents de part et d’autre de minuit', () => {
    const justeAvant = new Date('2026-09-14T21:59:00Z'); // 23:59 à Paris
    const justeApres = new Date('2026-09-14T22:01:00Z'); // 00:01 à Paris (mardi)

    expect([dateParis(justeAvant), jourSemaineParis(justeAvant)]).toEqual(['2026-09-14', 0]);
    expect([dateParis(justeApres), jourSemaineParis(justeApres)]).toEqual(['2026-09-15', 1]);
    // même instant UTC absolu, deux jours civils différents : c'est voulu
    expect(getMondayParis(justeApres)).toBe('2026-09-14');
  });

  it('getMondayWithOffset décale de semaines entières de façon stable', () => {
    expect(getMondayWithOffset(0)).toBe(getMondayParis());
    const plus1 = getMondayWithOffset(1);
    const moins1 = getMondayWithOffset(-1);
    expect(offsetOfSemaine(plus1)).toBe(1);
    expect(offsetOfSemaine(moins1)).toBe(-1);
    expect(offsetOfSemaine(getMondayWithOffset(4))).toBe(4);
  });

  it('anneeParis suit l’année civile française (et non celle du runtime)', () => {
    expect(anneeParis(new Date('2026-12-31T23:30:00Z'))).toBe(2027); // 00:30 à Paris
    expect(anneeParis(new Date('2026-06-01T12:00:00Z'))).toBe(2026);
  });
});

describe('formatage', () => {
  it('formatDateHeureParis affiche l’heure de Paris, jamais celle du serveur', () => {
    const out = formatDateHeureParis('2026-09-15T13:04:00Z');
    expect(out).toContain('15:04'); // 13:04 UTC + 2 h (CEST)
    expect(out).not.toContain('13:04');
  });

  it('estAujourdhuiParis compare dans le fuseau de l’app', () => {
    const reference = new Date('2026-09-15T09:00:00Z');
    expect(estAujourdhuiParis('2026-09-15T07:30:00Z', reference)).toBe(true);
    expect(estAujourdhuiParis('2026-09-14T20:00:00Z', reference)).toBe(false);
    // 23:00 UTC le 14 = 01:00 à Paris le 15 → même journée parisienne
    expect(estAujourdhuiParis('2026-09-14T23:00:00Z', reference)).toBe(true);
    expect(estAujourdhuiParis('pas-une-date', reference)).toBe(false);
  });

  it('formatDateLongueFr n’est pas décalé (ancrage à midi)', () => {
    expect(formatDateLongueFr('2026-03-16')).toBe('16/03/2026');
    expect(formatDateLongueFr('2026-03-16', { day: 'numeric', month: 'long' })).toContain('16');
    expect(formatDateLongueFr('2026-03-16', { day: 'numeric', month: 'long' })).toContain('mars');
  });
});
