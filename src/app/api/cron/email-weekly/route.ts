// ============================================================================
// CRON Vercel — digest hebdomadaire
// vercel.json : vendredi 17h00 UTC (19h en France) → avant les courses du
// week-end. Vercel ajoute automatiquement l'en-tête
//   Authorization: Bearer $CRON_SECRET
// quand la variable CRON_SECRET est définie sur le projet.
// Test local : curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/email-weekly
// (Dry run sans envoi : /api/cron/email-weekly?dry_run=1)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { envoyerDigestsHebdomadaires } from '@/lib/email-service';
import { publicErrorMessage } from '@/lib/utils';
import { logRequestSecurityEvent } from '@/lib/security-log';

export async function GET(request: NextRequest) {
  try {
    // Protection : en production, seul Vercel Cron (avec CRON_SECRET) doit
    // pouvoir déclencher l'envoi massif. En dev (pas de secret configuré),
    // on laisse passer pour tester le dry run.
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

    const dryRun = request.nextUrl.searchParams.get('dry_run') === '1';
    const result = await envoyerDigestsHebdomadaires(getSupabaseAdmin(), { send: !dryRun });

    return NextResponse.json({
      success: true,
      dry_run: dryRun,
      envoyes: result.envoyes,
      echecs: result.echecs,
      destinataires: result.cibles.length,
      ignores: result.ignores.length,
    });
  } catch (error) {
    console.error('Erreur cron email-weekly:', error);
    return NextResponse.json({ error: publicErrorMessage(error) }, { status: 500 });
  }
}
