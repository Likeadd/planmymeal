import { describe, it, expect } from 'vitest';
import { chargerPlatsRapides, TEMPS_MAX } from '@/lib/vider-le-frigo';
import { PAGE } from '@/lib/catalogue';

// ============================================================================
// Pagination de « vider le frigo »
//
// Le test ne peut PAS passer par la vraie base : elle compte 979 plats rapides,
// donc sous le plafond de 1000 — une pagination retirée y renverrait le même
// nombre, et le test resterait vert. Un test qui ne sait pas échouer ne protège
// de rien.
//
// On sert donc un client factice qui découpe un tableau plus grand que le
// plafond. Il note les appels : on peut vérifier non seulement le résultat
// (toutes les lignes) mais la MÉCANIQUE (pages demandées, ordre total, filtres).
// ============================================================================

interface Journal {
  from?: string;
  select?: string;
  eq: [string, unknown][];
  lte?: [string, unknown];
  order: string[];
  range: [number, number][];
}

/** Client Supabase factice : `range` sert une tranche et se termine par un thenable. */
function fauxClient(total: number | 'erreur') {
  const journal: Journal = { eq: [], order: [], range: [] };
  const lignes = total === 'erreur' ? [] : Array.from({ length: total }, (_, i) => ({ id: i + 1 }));

  const builder = {
    from: (table: string) => { journal.from = table; return builder; },
    select: (colonnes: string) => { journal.select = colonnes; return builder; },
    eq: (col: string, valeur: unknown) => { journal.eq.push([col, valeur]); return builder; },
    lte: (col: string, valeur: unknown) => { journal.lte = [col, valeur]; return builder; },
    order: (col: string) => { journal.order.push(col); return builder; },
    range: (debut: number, fin: number) => {
      journal.range.push([debut, fin]);
      if (total === 'erreur') return Promise.resolve({ data: null, error: { message: 'boom' } });
      return Promise.resolve({ data: lignes.slice(debut, fin + 1), error: null });
    },
  };

  return { client: builder as never, journal };
}

const charger = (total: number | 'erreur') => {
  const { client, journal } = fauxClient(total);
  return { journal, promesse: chargerPlatsRapides(client) };
};

describe('chargerPlatsRapides — au-delà du plafond PostgREST', () => {
  it('aurait manqué 200 recettes sans pagination, et les ramène toutes', async () => {
    const { journal, promesse } = charger(PAGE + 200);
    const lignes = await promesse;

    expect(lignes).toHaveLength(PAGE + 200);
    expect(journal.range).toEqual([[0, PAGE - 1], [PAGE, 2 * PAGE - 1]]);
  });

  it('compte les identifiants une seule fois (aucun chevauchement de pages)', async () => {
    const { promesse } = charger(2500);
    const ids = (await promesse).map(l => l.id);

    expect(ids).toHaveLength(2500);
    expect(new Set(ids).size).toBe(2500);
  });

  it('redemande une page quand la précédente était PLEINE', async () => {
    // Une page pleine ne prouve pas l'épuisement : s'arrêter là perdrait tout
    // ce qui suit. C'est exactement l'erreur que la pagination doit éviter.
    const { journal, promesse } = charger(PAGE);
    expect(await promesse).toHaveLength(PAGE);
    expect(journal.range).toHaveLength(2);
  });

  it('s’arrête à la première page incomplète', async () => {
    const { journal, promesse } = charger(PAGE - 1);
    expect(await promesse).toHaveLength(PAGE - 1);
    expect(journal.range).toEqual([[0, PAGE - 1]]);
  });

  it('gère un catalogue vide sans boucler', async () => {
    const { journal, promesse } = charger(0);
    expect(await promesse).toEqual([]);
    expect(journal.range).toEqual([[0, PAGE - 1]]);
  });

  it('termine même quand le total est un multiple exact de la page', async () => {
    const { journal, promesse } = charger(2 * PAGE);
    expect(await promesse).toHaveLength(2 * PAGE);
    // 3 appels : les deux pages pleines, puis la page vide qui conclut.
    expect(journal.range).toHaveLength(3);
  });
});

describe('chargerPlatsRapides — la requête elle-même', () => {
  it('trie sur un ordre TOTAL (`id`) : sans lui, deux pages peuvent se chevaucher', async () => {
    const { journal, promesse } = charger(10);
    await promesse;
    expect(journal.order).toEqual(['id']);
  });

  it('ne retient que les plats publics et rapides', async () => {
    const { journal, promesse } = charger(10);
    await promesse;
    expect(journal.from).toBe('meals');
    expect(journal.eq).toEqual([['is_public', true], ['type_repas', 'plat']]);
    expect(journal.lte).toEqual(['temps_preparation', TEMPS_MAX]);
  });

  it('demande exactement les colonnes du type `RecetteFrigo`', async () => {
    const { journal, promesse } = charger(10);
    await promesse;
    expect(journal.select).toContain('meal_ingredients(ingredient_id,');
    expect(journal.select).not.toContain('instructions');
  });

  it('remonte l’erreur au lieu de renvoyer un catalogue tronqué', async () => {
    const { promesse } = charger('erreur');
    await expect(promesse).rejects.toThrow('boom');
  });
});
