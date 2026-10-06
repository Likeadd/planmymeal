import { describe, it, expect, vi } from 'vitest';
import {
  orchestrerAutoPlan,
  orchestrerAutoPlanGlissant,
  genererSemaineUtilisateur,
  TAILLE_PAGE,
  type AutoPlanDb,
  type AutoPlanRequete,
  type AutoPlanReponse,
} from '@/lib/auto-planner';
import { getMondayWithOffset } from '@/lib/dates';

// ─── Mock Supabase — chaînage PostgREST utilisé par l'orchestrateur ─────────

interface RequeteRecue {
  table: string;
  select?: string;
  eqs: [string, unknown][];
  range?: [number, number];
}

/** Requête thenable : chaque .eq() s'empile, l'await (avec ou sans range) exécute */
function creerRequete(req: RequeteRecue, repondre: (req: RequeteRecue) => unknown): AutoPlanRequete {
  const executer = (): AutoPlanReponse => repondre(req) as AutoPlanReponse;
  const requeteObj = {
    eq(column: string, value: unknown) {
      req.eqs.push([column, value]);
      return creerRequete(req, repondre);
    },
    range(from: number, to: number) {
      req.range = [from, to];
      return { then: creerThen(executer) };
    },
    then: creerThen(executer),
  };
  return requeteObj as unknown as AutoPlanRequete;
}

function creerThen(executer: () => AutoPlanReponse) {
  return (
    onFulfilled?: (value: AutoPlanReponse) => unknown,
    onRejected?: (reason: unknown) => unknown
  ) => {
    try {
      return Promise.resolve(onFulfilled!(executer()));
    } catch (e) {
      return onRejected ? Promise.resolve(onRejected(e)) : Promise.reject(e);
    }
  };
}

function creerDb(repondre: (req: RequeteRecue) => unknown): AutoPlanDb & { requetes: RequeteRecue[] } {
  const requetes: RequeteRecue[] = [];
  const db = {
    requetes,
    from(table: string) {
      const req: RequeteRecue = { table, eqs: [] };
      requetes.push(req);
      return {
        select(columns: string) {
          req.select = columns;
          return creerRequete(req, repondre);
        },
      };
    },
  };
  return db as AutoPlanDb & { requetes: RequeteRecue[] };
}

// ─── Fixtures ───────────────────────────────────────────────────────────────

const PROFILS = [
  { id: 'u1', email: 'u1@test.fr', plan: 'famille', auto_generate: true },
  { id: 'u2', email: 'u2@test.fr', plan: 'pro', auto_generate: true },
  { id: 'u3', email: 'u3@test.fr', plan: 'pro', auto_generate: false },
];

function dbStandard(plansExistants: string[] = []) {
  return creerDb(req => {
    if (req.table === 'profiles') {
      const from = req.range?.[0] ?? 0;
      return { data: PROFILS.slice(from, from + TAILLE_PAGE), error: null };
    }
    if (req.table === 'weekly_plans') {
      const userId = req.eqs.find(([c]) => c === 'user_id')?.[1];
      return {
        data: plansExistants.includes(userId as string) ? [{ id: 1 }] : [],
        error: null,
      };
    }
    return { data: [], error: null };
  });
}

// Signé comme la vraie délégation : mock.calls reste typé [userId, semaine, db]
const genererOk: typeof genererSemaineUtilisateur = async () => ({
  planId: 1,
  shoppingListId: 2,
});

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('orchestrerAutoPlan — semaine cible', () => {
  it('prépare la semaine qui ARRIVE, jamais la semaine en cours (bug du fork)', () => {
    const db = dbStandard();
    return orchestrerAutoPlan(db, { generer: genererOk }).then(result => {
      expect(result.semaineDebut).toBe(getMondayWithOffset(1));
      expect(result.semaineDebut).not.toBe(getMondayWithOffset(0));
    });
  });
});

describe('orchestrerAutoPlan — plan gratuit', () => {
  it('ne planifie pas automatiquement les comptes gratuits (avantage payant)', async () => {
    const db = creerDb(req => req.table === 'profiles'
      ? { data: [{ id: 'g1', email: 'g1@test.fr', plan: 'gratuit', auto_generate: true }], error: null }
      : { data: [], error: null });
    const generer = vi.fn(genererOk);
    const result = await orchestrerAutoPlan(db, { generer });
    expect(generer).not.toHaveBeenCalled();
    expect(result.generes).toBe(0);
  });
});

describe('orchestrerAutoPlan — idempotence', () => {
  it('ne régénère jamais une semaine déjà planifiée', async () => {
    const db = dbStandard(['u1']);
    const generer = vi.fn(genererOk);
    const result = await orchestrerAutoPlan(db, { generer });

    expect(result.conserves).toBe(1);
    expect(result.generes).toBe(1);
    expect(generer).toHaveBeenCalledTimes(1);
    expect(generer.mock.calls[0][0]).toBe('u2');
  });

  it('les écritures passent exclusivement par le moteur : lecture seule sur profiles et weekly_plans', async () => {
    const db = dbStandard();
    await orchestrerAutoPlan(db, { generer: genererOk });

    const tables = db.requetes.map(r => r.table);
    expect(tables.every(t => ['profiles', 'weekly_plans'].includes(t))).toBe(true);
    expect(db.requetes.every(r => typeof r.select === 'string')).toBe(true);
  });
});

describe('orchestrerAutoPlan — opt-out', () => {
  it('saute les foyers qui ont désactivé l\'auto-génération', async () => {
    const db = dbStandard();
    const generer = vi.fn(genererOk);
    const result = await orchestrerAutoPlan(db, { generer });

    const ids = generer.mock.calls.map(c => c[0]);
    expect(ids).toEqual(['u1', 'u2']);
    expect(result.results.find(r => r.userId === 'u3')?.message).toContain('désactivée');
  });
});

describe('orchestrerAutoPlan — délégation au vrai moteur', () => {
  it('appelle le moteur avec (userId, semaineDebut, client) pour chaque éligible', async () => {
    const db = dbStandard();
    const generer = vi.fn(genererOk);
    const result = await orchestrerAutoPlan(db, { generer });

    expect(result.generes).toBe(2);
    expect(generer).toHaveBeenCalledTimes(2);
    for (const call of generer.mock.calls) {
      expect(call[1]).toBe(getMondayWithOffset(1));
      expect(call[2]).toBeDefined();
    }
  });

  it('l\'erreur d\'un utilisateur n\'arrête pas les autres', async () => {
    const db = dbStandard();
    const generer = vi.fn(async (userId: string) => {
      if (userId === 'u1') throw new Error('moteur en panne');
      return { planId: 1, shoppingListId: 2 };
    });
    const result = await orchestrerAutoPlan(db, { generer });

    expect(result.erreurs).toBe(1);
    expect(result.generes).toBe(1);
    expect(result.results.find(r => r.userId === 'u2')?.status).toBe('genere');
    expect(result.results.find(r => r.userId === 'u1')?.message).toBe('moteur en panne');
  });
});

describe('orchestrerAutoPlan — dry run', () => {
  it('décompte sans rien écrire', async () => {
    const db = dbStandard();
    const generer = vi.fn(genererOk);
    const result = await orchestrerAutoPlan(db, { dryRun: true, generer });

    expect(generer).not.toHaveBeenCalled();
    expect(result.generes).toBe(2); // u1 + u2 (u3 en opt-out)
    expect(result.erreurs).toBe(0);
  });
});

describe('orchestrerAutoPlan — limit et cursor', () => {
  it('borne le nombre de générations du run et signale les suivantes', async () => {
    const db = dbStandard();
    const generer = vi.fn(genererOk);
    const result = await orchestrerAutoPlan(db, { limit: 1, generer });

    expect(result.generes).toBe(1);
    expect(result.results.find(r => r.userId === 'u2')?.message).toContain('limite');
  });

  it('reprend après le curseur sans régénérer les précédents', async () => {
    const db = dbStandard();
    const generer = vi.fn(genererOk);
    const result = await orchestrerAutoPlan(db, { cursor: 'u2', generer });

    const ids = generer.mock.calls.map(c => c[0]);
    expect(ids).toEqual(['u2']);
    expect(result.generes).toBe(1);
  });
});

describe('orchestrerAutoPlan — pagination', () => {
  it('demande les profils par pages de TAILLE_PAGE et s\'arrête à la page incomplète', async () => {
    const db = dbStandard();
    await orchestrerAutoPlan(db, { generer: genererOk });

    const pages = db.requetes
      .filter(r => r.table === 'profiles')
      .map(r => r.range);
    expect(pages).toEqual([[0, TAILLE_PAGE - 1]]); // 3 profils < 100 → une seule page
  });
});

describe('orchestrerAutoPlanGlissant — fenêtre de 4 semaines', () => {
  it('prépare les 4 semaines à venir (offsets 1 à 4), jamais la courante', async () => {
    const db = dbStandard();
    const generer = vi.fn(genererOk);
    const resultats = await orchestrerAutoPlanGlissant(db, { generer });

    expect(resultats.map(r => r.semaineDebut)).toEqual([
      getMondayWithOffset(1), getMondayWithOffset(2), getMondayWithOffset(3), getMondayWithOffset(4),
    ]);
    // 2 éligibles (u1, u2) × 4 semaines
    expect(generer).toHaveBeenCalledTimes(8);
  });

  it('respecte nbSemaines pour ne générer qu\'une fenêtre réduite', async () => {
    const db = dbStandard();
    const generer = vi.fn(genererOk);
    const resultats = await orchestrerAutoPlanGlissant(db, { generer, nbSemaines: 2 });

    expect(resultats).toHaveLength(2);
    expect(resultats.map(r => r.semaineDebut)).toEqual([getMondayWithOffset(1), getMondayWithOffset(2)]);
  });

  it('le curseur de reprise ne s\'applique qu\'à la semaine la plus urgente (offset 1)', async () => {
    const db = dbStandard();
    const generer = vi.fn(genererOk);
    const resultats = await orchestrerAutoPlanGlissant(db, { generer, cursor: 'u2', nbSemaines: 2 });

    // Semaine 1 : reprend après u2 → u1 est sauté (avant le curseur), u2 est
    // régénéré, u3 (opt-out) reste listé normalement une fois le curseur
    // atteint. Semaine 2 : curseur non réappliqué → les 3 profils repassent.
    expect(resultats[0].results.map(r => r.userId)).toEqual(['u2', 'u3']);
    expect(resultats[1].results.map(r => r.userId)).toEqual(['u1', 'u2', 'u3']);
  });
});

describe('orchestrerAutoPlanGlissant — sobriété (comptes inactifs)', () => {
  const JOUR = 86_400_000;
  const maintenant = Date.parse('2026-09-27T19:00:00Z');

  it('compte actif récemment : 4 semaines ; inactif depuis 60 j : semaine suivante seulement ; depuis 120 j : rien', async () => {
    const db = dbStandard();
    const generer = vi.fn(genererOk);
    const activite = new Map<string, number>([
      ['u1', maintenant - 2 * JOUR],   // actif
      ['u2', maintenant - 60 * JOUR],  // peu actif
    ]);
    const resultats = await orchestrerAutoPlanGlissant(db, { generer, activite, maintenant });

    const genereePour = (i: number) => resultats[i].results.filter(r => r.status === 'genere').map(r => r.userId);
    expect(genereePour(0)).toEqual(['u1', 'u2']);
    expect(genereePour(1)).toEqual(['u1']);
    expect(resultats[1].results.find(r => r.userId === 'u2')?.message).toContain('inactif');

    activite.set('u2', maintenant - 120 * JOUR);
    const resultats2 = await orchestrerAutoPlanGlissant(dbStandard(), { generer: vi.fn(genererOk), activite, maintenant });
    expect(resultats2[0].results.filter(r => r.status === 'genere').map(r => r.userId)).toEqual(['u1']);
  });

  it('sans carte d\'activité (listUsers indisponible) : aucun filtre', async () => {
    const generer = vi.fn(genererOk);
    await orchestrerAutoPlanGlissant(dbStandard(), { generer, activite: null });
    expect(generer).toHaveBeenCalledTimes(8);
  });
});
