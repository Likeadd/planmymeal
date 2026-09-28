// ============================================================================
// CRON Vercel — newsletter dominicale (lead magnet sans compte)
// vercel.json : dimanche matin. Un seul menu construit pour la semaine (même
// sélection pour tout le monde, cf. lib/newsletter.ts), envoyé à chaque
// abonné actif avec SON lien de désinscription propre.
//
// Vercel ajoute automatiquement l'en-tête
//   Authorization: Bearer $CRON_SECRET
// Test local :
//   curl -H "Authorization: Bearer $CRON_SECRET" \
//     "http://localhost:3000/api/cron/newsletter-hebdo?dry_run=1"
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { chargerCatalogue } from '@/lib/catalogue';
import { toMealCatalogue } from '@/lib/db-rows';
import { construireNewsletterHebdo } from '@/lib/newsletter';
import { newsletterEmailHtml, newsletterSubject } from '@/lib/email-templates';
import { sendEmail } from '@/lib/email';
import { publicErrorMessage } from '@/lib/utils';
import { logRequestSecurityEvent } from '@/lib/security-log';

export async function GET(request: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET;
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
    const supabase = getSupabaseAdmin();
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://planmymeal.app';

    const { data: abonnes, error: erreurAbonnes } = await supabase
      .from('newsletter_subscribers')
      .select('email, token')
      .is('unsubscribed_at', null);
    if (erreurAbonnes) throw erreurAbonnes;
    if (!abonnes || abonnes.length === 0) {
      return NextResponse.json({ success: true, envoyes: 0, reason: 'aucun abonné' });
    }

    const catalogue = (await chargerCatalogue(supabase)).map(toMealCatalogue);

    let envoyes = 0;
    let echecs = 0;
    for (const abonne of abonnes) {
      const data = construireNewsletterHebdo(catalogue, baseUrl, abonne.token);
      if (!data) continue;
      if (dryRun) { envoyes++; continue; }

      const res = await sendEmail({
        to: abonne.email,
        subject: newsletterSubject(data),
        html: newsletterEmailHtml(data, baseUrl),
      });
      if (res.ok) envoyes++; else echecs++;
    }

    return NextResponse.json({ success: true, envoyes, echecs, total: abonnes.length, dryRun });
  } catch (error) {
    console.error('Erreur GET /api/cron/newsletter-hebdo:', error);
    return NextResponse.json({ error: publicErrorMessage(error) }, { status: 500 });
  }
}
