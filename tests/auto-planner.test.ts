import { describe, it, expect, vi } from 'vitest';
import {
  orchestrerAutoPlan,
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
  { id: 'u1', email: 'u1@test.fr', plan: 'gratuit', auto_generate: true },
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
