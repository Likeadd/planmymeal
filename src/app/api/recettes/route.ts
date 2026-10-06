// ============================================================================
// API Catalogue — GET /api/recettes
// Pagination, filtres et tris CÔTÉ SERVEUR (voir lib/catalogue-index.ts).
// Public (catalogue déjà lisible par tous) : limité en débit, cache court.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { enforceRateLimit } from '@/lib/rate-limit';
import {
  getIndex, interroger, REGIMES_FILTRES, TAILLE_PAGE_MAX,
  type FiltresCatalogue, type TriChamp,
} from '@/lib/catalogue-index';
import type { Regime, Saison, TypeRepas } from '@/types';

const TYPES = ['tous', 'plat', 'entree', 'dessert', 'petit_dejeuner', 'snack'];
const TRIS: TriChamp[] = ['idees', 'nom', 'temps', 'calories', 'prix', 'proteines'];
const SAISONS = ['toutes', 'printemps', 'ete', 'automne', 'hiver'];
const DIFFICULTES = ['toutes', 'facile', 'moyen', 'difficile'];

const entier = (v: string | null, max = 10_000): number | null => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), max) : null;
};

export async function GET(request: NextRequest) {
  const limited = await enforceRateLimit(request, { name: 'recettes', limit: 120, windowMs: 60_000 });
  if (limited) return limited;

  const p = request.nextUrl.searchParams;
  const dans = <T extends string>(v: string | null, liste: readonly string[], defaut: T): T =>
    (v && liste.includes(v) ? v : defaut) as T;

  const filtres: FiltresCatalogue = {
    type: dans<TypeRepas | 'tous'>(p.get('type'), TYPES, 'tous'),
    q: (p.get('q') ?? '').slice(0, 80),
    equipement: (p.get('equipement') ?? 'tous').slice(0, 40),
    difficulte: dans(p.get('difficulte'), DIFFICULTES, 'toutes'),
    cuisine: (p.get('cuisine') ?? 'toutes').slice(0, 40),
    saison: dans<Saison | 'toutes'>(p.get('saison'), SAISONS, 'toutes'),
    tempsMax: entier(p.get('tempsMax')),
    kcalMax: entier(p.get('kcalMax')),
    prixMax: entier(p.get('prixMax')),
    batch: p.get('batch') === '1',
    proteines: p.get('proteines') === '1',
    regimes: (p.get('regimes') ?? '').split(',').filter((r): r is Regime => (REGIMES_FILTRES as string[]).includes(r)),
    tri: dans<TriChamp>(p.get('tri'), TRIS, 'idees'),
  };
  const offset = entier(p.get('offset')) ?? 0;
  const limite = Math.min(entier(p.get('limite')) ?? 48, TAILLE_PAGE_MAX);

  try {
    const idx = await getIndex();
    const { total, items } = interroger(idx, filtres, offset, limite);
    // `facettes` (compteurs globaux des filtres) n'est utile qu'à la première page.
    return NextResponse.json(
      { total, items, ...(offset === 0 ? { facettes: idx.facettes } : {}) },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600' } },
    );
  } catch {
    return NextResponse.json({ error: 'Catalogue momentanément indisponible' }, { status: 503 });
  }
}
