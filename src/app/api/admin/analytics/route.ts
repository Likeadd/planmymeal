// ============================================================================
// GET /api/admin/analytics?jours=7|30|90 — analytique INTERNE pour /admin :
//   « Audience » (type Google Analytics : visiteurs, pages, sources, pays, appareils, événements) et
//   « Rétention & parcours » (type Amplitude : entonnoir et cohortes de rétention des comptes).
// Réservé à ADMIN_EMAILS ; agrégats uniquement, aucune donnée personnelle renvoyée.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { estAdmin } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { publicErrorMessage } from '@/lib/utils';
import { enforceRateLimit } from '@/lib/rate-limit';
import { dateParis, getMondayParis } from '@/lib/dates';

const JOUR_MS = 86_400_000;
const SEMAINES_COHORTES = 8;

export async function GET(request: NextRequest) {
  const limited = await enforceRateLimit(request, { name: 'admin-analytics', limit: 30, windowMs: 60_000 });
  if (limited) return limited;

  try {
    if (!(await estAdmin(request))) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });

    const demande = Number(request.nextUrl.searchParams.get('jours'));
    const jours = [7, 30, 90].includes(demande) ? demande : 30;
    const db = getSupabaseAdmin();
    const brut = db as unknown as SupabaseClient;
    const depuisCohortes = new Date(Date.now() - (SEMAINES_COHORTES * 7 + 7) * JOUR_MS).toISOString();
    const debutPeriode = dateParis(new Date(Date.now() - (jours - 1) * JOUR_MS));

    const [resume, profils, plans, historique] = await Promise.all([
      brut.rpc('mesure_resume', { p_jours: jours }),
      db.from('profiles').select('id, created_at, plan, onboarding_complete').gte('created_at', depuisCohortes).limit(5000),
      db.from('weekly_plans').select('user_id, generated_at').gte('generated_at', depuisCohortes).limit(20000),
      db.from('meal_history').select('user_id, created_at').gte('created_at', depuisCohortes).limit(20000),
    ]);
    for (const r of [resume, profils, plans, historique]) if (r.error) throw new Error(r.error.message);

    // Activité de chaque compte : semaines (lundis) où il a généré un plan ou noté/planifié un repas
    const semainesActives = new Map<string, Set<string>>();
    const noter = (id: string, iso: string) => {
      const s = semainesActives.get(id) ?? semainesActives.set(id, new Set()).get(id)!;
      s.add(getMondayParis(new Date(iso)));
    };
    for (const p of plans.data ?? []) if (p.user_id) noter(p.user_id, p.generated_at);
    for (const h of historique.data ?? []) if (h.user_id) noter(h.user_id, h.created_at);

    const inscrits = (profils.data ?? []).map(p => ({ ...p, lundi: getMondayParis(new Date(p.created_at)), jour: dateParis(new Date(p.created_at)) }));

    // Entonnoir sur la période
    const dansPeriode = inscrits.filter(p => p.jour >= debutPeriode);
    const aGenere = dansPeriode.filter(p => (semainesActives.get(p.id)?.size ?? 0) > 0);
    const revenus = dansPeriode.filter(p => [...(semainesActives.get(p.id) ?? [])].some(s => s > p.lundi));
    const r = resume.data as { visiteurs: number; visiteurs_inscription: number };
    const entonnoir = [
      { etape: 'Visiteurs', n: r.visiteurs },
      { etape: 'Page d’inscription vue', n: r.visiteurs_inscription },
      { etape: 'Comptes créés', n: dansPeriode.length },
      { etape: 'Onboarding terminé', n: dansPeriode.filter(p => p.onboarding_complete).length },
      { etape: 'Première semaine générée', n: aGenere.length },
      { etape: 'Revenus une semaine suivante', n: revenus.length },
      { etape: 'Abonnés payants', n: dansPeriode.filter(p => p.plan !== 'gratuit').length },
    ];

    // Cohortes de rétention hebdomadaires (S0 = semaine d'inscription)
    const lundiCourant = getMondayParis();
    const cohortes = Array.from({ length: SEMAINES_COHORTES }, (_, i) => {
      const lundi = getMondayParis(new Date(Date.parse(`${lundiCourant}T12:00:00Z`) - (SEMAINES_COHORTES - 1 - i) * 7 * JOUR_MS));
      const membres = inscrits.filter(p => p.lundi === lundi);
      const ecoulees = Math.round((Date.parse(`${lundiCourant}T12:00:00Z`) - Date.parse(`${lundi}T12:00:00Z`)) / (7 * JOUR_MS));
      const retention = Array.from({ length: ecoulees + 1 }, (_, k) => {
        const cible = getMondayParis(new Date(Date.parse(`${lundi}T12:00:00Z`) + k * 7 * JOUR_MS));
        const actifs = membres.filter(p => semainesActives.get(p.id)?.has(cible)).length;
        return membres.length ? Math.round((actifs / membres.length) * 100) : null;
      });
      return { semaine: lundi, taille: membres.length, retention };
    });

    return NextResponse.json({ jours, genere_le: new Date().toISOString(), audience: resume.data, entonnoir, cohortes },
      { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Erreur GET /api/admin/analytics:', error);
    return NextResponse.json({ error: publicErrorMessage(error) }, { status: 500 });
  }
}
