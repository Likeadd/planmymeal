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

import { getMondayMenu } from '../src/lib/dates';
import { VARIANTES, varianteDeLaSemaine } from '../src/lib/menu-public';

describe('menu de la semaine : publication le lundi à 8 h (Paris)', () => {
  it('avant 8 h le lundi, c’est encore le menu de la semaine précédente', () => {
    expect(getMondayMenu(new Date('2026-10-19T05:59:00Z'))).toBe('2026-10-12'); // lundi 07:59 à Paris (CEST)
    expect(getMondayMenu(new Date('2026-10-19T06:00:00Z'))).toBe('2026-10-19'); // lundi 08:00 à Paris
    expect(getMondayMenu(new Date('2026-10-18T22:00:00Z'))).toBe('2026-10-12'); // dimanche soir
    expect(getMondayMenu(new Date('2026-10-23T10:00:00Z'))).toBe('2026-10-19'); // vendredi
  });
  it('heure d’hiver : 8 h Paris = 7 h UTC', () => {
    expect(getMondayMenu(new Date('2026-11-02T06:59:00Z'))).toBe('2026-10-26');
    expect(getMondayMenu(new Date('2026-11-02T07:00:00Z'))).toBe('2026-11-02');
  });
});

describe('varianteDeLaSemaine', () => {
  it('une variante par semaine, le budget change toujours d’une semaine à l’autre', () => {
    let lundi = Date.parse('2026-01-05T12:00:00Z');
    let precedent = varianteDeLaSemaine('2026-01-05');
    for (let i = 1; i <= 120; i++) {
      lundi += 7 * 86_400_000;
      const v = varianteDeLaSemaine(new Date(lundi).toISOString().slice(0, 10));
      expect(v.budget).not.toBe(precedent.budget);
      expect(VARIANTES).toContain(v);
      precedent = v;
    }
  });
  it('est stable pour une semaine donnée', () => {
    expect(varianteDeLaSemaine('2026-10-19')).toBe(varianteDeLaSemaine('2026-10-19'));
  });
});

import { cheminAnonyme, pagePublique } from '../src/lib/analytics';

describe('mesure d’audience anonyme', () => {
  it('retire tout identifiant des chemins mesurés', () => {
    expect(cheminAnonyme('/recette/2485-poele-de-poulet')).toBe('/recette/[id]');
    expect(cheminAnonyme('/menu/0b9f2c1e-1111-2222-3333-444455556666')).toBe('/menu/[jeton]');
    expect(cheminAnonyme('/liste/abc')).toBe('/liste/[jeton]');
    expect(cheminAnonyme('/menu-semaine/50-euros-2-personnes')).toBe('/menu-semaine/[slug]');
    expect(cheminAnonyme('/')).toBe('/');
    expect(cheminAnonyme('/faq')).toBe('/faq');
  });
  it('ne mesure jamais l’espace connecté', () => {
    for (const p of ['/aujourdhui', '/dashboard', '/compte', '/compte/x', '/admin', '/api/profil']) expect(pagePublique(p)).toBe(false);
    for (const p of ['/', '/recettes', '/recette/12', '/menu-de-la-semaine', '/signup']) expect(pagePublique(p)).toBe(true);
  });
});

import { DUREE_CHOIX_MS, enregistrerChoix, lireChoix, nomEvenementGa } from '../src/lib/consentement';

describe('consentement aux outils d’analyse', () => {
  const faux = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }; };
  it('pas de choix par défaut → rien n’est chargé', () => { expect(lireChoix(faux())).toBeNull(); });
  it('mémorise accepter / refuser', () => {
    const s = faux();
    enregistrerChoix('accepte', s, 1000); expect(lireChoix(s, 2000)).toBe('accepte');
    enregistrerChoix('refuse', s, 1000); expect(lireChoix(s, 2000)).toBe('refuse');
  });
  it('le choix expire au bout de 6 mois puis est redemandé', () => {
    const s = faux();
    enregistrerChoix('accepte', s, 0);
    expect(lireChoix(s, DUREE_CHOIX_MS - 1)).toBe('accepte');
    expect(lireChoix(s, DUREE_CHOIX_MS + 1)).toBeNull();
  });
  it('ignore une valeur corrompue ou falsifiée', () => {
    const s = faux();
    s.setItem('pmm_consentement', '{"choix":"oui","le":1}'); expect(lireChoix(s, 2)).toBeNull();
    s.setItem('pmm_consentement', 'pas du json'); expect(lireChoix(s, 2)).toBeNull();
    s.setItem('pmm_consentement', JSON.stringify({ choix: 'accepte', le: 5000 })); expect(lireChoix(s, 10)).toBeNull(); // date dans le futur
  });
  it('noms d’événements GA4 : ASCII, minuscules, « _ »', () => {
    expect(nomEvenementGa('Onboarding terminé')).toBe('onboarding_termine');
    expect(nomEvenementGa('CTA inscription')).toBe('cta_inscription');
    expect(nomEvenementGa('Défilement')).toBe('defilement');
    expect(nomEvenementGa('123 test')).toBe('e_123_test');
  });
});
