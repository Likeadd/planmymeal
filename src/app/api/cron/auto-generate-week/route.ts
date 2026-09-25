// ============================================================================
// CRON Vercel — auto-génération des plannings de la semaine qui arrive
// vercel.json : dimanche 19h00 UTC (20h en hiver, 21h en été à Paris) → les
// foyers découvrent leur semaine prête avant le lundi matin.
//
// ⭐ Délègue au VRAI moteur de rotation (rotation-engine.ts) — même chemin que
// le bouton « Générer ma semaine » : mémoire alimentaire, frigo, profils
// famille, budget, équipement, restes, desserts, RPC transactionnel.
// Le fork Edge Function auto-generate-week (logique périmée, écritures non
// transactionnelles) est retiré ; le cron Supabase qui l'appelait est
// désactivé par la migration 00020.
//
// Vercel ajoute automatiquement l'en-tête
//   Authorization: Bearer $CRON_SECRET
// quand la variable CRON_SECRET est définie sur le projet.
// Test local :
//   curl -H "Authorization: Bearer $CRON_SECRET" \
//     "http://localhost:3000/api/cron/auto-generate-week?dry_run=1"
// Paramètres : ?dry_run=1 (aucune écriture) · ?limit=50 · ?cursor=<user_id>
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { orchestrerAutoPlan, type AutoPlanDb } from '@/lib/auto-planner';
import { publicErrorMessage } from '@/lib/utils';
import { logRequestSecurityEvent } from '@/lib/security-log';

/** Plafond dur : un run ne génère jamais plus de 500 plannings (timeout Vercel) */
const LIMIT_MAX = 500;

export async function GET(request: NextRequest) {
  try {
    // Protection : en production, seul Vercel Cron (avec CRON_SECRET) doit
    // pouvoir déclencher la génération massive. En dev (pas de secret
    // configuré), on laisse passer pour tester le dry run.
    const secret = process.env.CRON_SECRET;
    // En production, un secret absent ne doit JAMAIS ouvrir la route.
    if (!secret && process.env.NODE_ENV === 'production') {
      logRequestSecurityEvent(request, 'cron_secret', { reason: 'CRON_SECRET absent' });
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }
    if (secret) {
      const auth = request.headers.get('authorization');
      if (auth !== `Bearer ${secret}`) {
        logRequestSecurityEvent(request, 'cron_secret', { reason: 'secret invalide' });
        return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
      }
    }

    const params = request.nextUrl.searchParams;
    const dryRun = params.get('dry_run') === '1';
    const rawLimit = Number(params.get('limit'));
    const limit = Number.isInteger(rawLimit) && rawLimit > 0
      ? Math.min(rawLimit, LIMIT_MAX)
      : undefined;
    const cursor = params.get('cursor');

    const result = await orchestrerAutoPlan(
      getSupabaseAdmin() as unknown as AutoPlanDb,
      { dryRun, limit, cursor, offsetWeeks: 1, logger: m => console.log(`[auto-generate-week] ${m}`) }
    );

    return NextResponse.json({
      success: true,
      dry_run: dryRun,
      semaine_debut: result.semaineDebut,
      total: result.total,
      generes: result.generes,
      conserves: result.conserves,
      erreurs: result.erreurs,
      // Détail par utilisateur : utile en support, ~50 o/utilisateur
      results: result.results,
    });
  } catch (error) {
    console.error('Erreur cron auto-generate-week:', error);
    return NextResponse.json({ error: publicErrorMessage(error) }, { status: 500 });
  }
}
