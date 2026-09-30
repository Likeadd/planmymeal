// ============================================================================
// API Newsletter — inscription au menu dominical (lead magnet public, sans
// compte). Formulaire dans LandingFooter. Envoi effectif : cron
// api/cron/newsletter-hebdo, chaque dimanche.
//
// Double opt-in (RGPD) : l'inscription envoie un lien de confirmation ; seuls
// les abonnés confirmés (confirmed_at) reçoivent la newsletter. Sans ça,
// n'importe qui pouvait inscrire l'adresse d'un tiers.
// Réponse identique que l'email soit nouveau, déjà inscrit ou déjà confirmé
// (pas d'énumération des abonnés).
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { publicErrorMessage } from '@/lib/utils';
import { enforceRateLimit, rateLimit } from '@/lib/rate-limit';
import { sendEmail } from '@/lib/email';
import { newsletterConfirmationHtml } from '@/lib/email-templates';
import { SITE_URL } from '@/lib/seo';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  // Anti-abus : endpoint public, sans authentification.
  const limited = await enforceRateLimit(request, { name: 'newsletter', limit: 5, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const body = await request.json().catch(() => ({}));
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
      return NextResponse.json({ error: 'Adresse email invalide' }, { status: 400 });
    }

    // Une même adresse ne reçoit pas plus de 2 emails de confirmation par jour.
    if (!(await rateLimit(`newsletter-email:${email}`, 2, 24 * 60 * 60_000)).ok) {
      return NextResponse.json({ success: true });
    }

    const supabase = getSupabaseAdmin();
    const { data: existant } = await supabase
      .from('newsletter_subscribers')
      .select('token, confirmed_at, unsubscribed_at')
      .eq('email', email)
      .maybeSingle();

    // Déjà abonné et confirmé : rien à faire.
    if (existant?.confirmed_at && !existant.unsubscribed_at) {
      return NextResponse.json({ success: true });
    }

    let token = existant?.token;
    if (existant) {
      // Réinscription après désinscription : nouvelle confirmation exigée.
      const { error } = await supabase.from('newsletter_subscribers')
        .update({ unsubscribed_at: null, confirmed_at: null })
        .eq('email', email);
      if (error) throw error;
    } else {
      const { data, error } = await supabase.from('newsletter_subscribers')
        .insert({ email })
        .select('token')
        .single();
      if (error) throw error;
      token = data.token;
    }

    await sendEmail({
      to: email,
      subject: 'Confirmez votre inscription au menu de la semaine',
      html: newsletterConfirmationHtml(`${SITE_URL}/api/newsletter/confirmer?token=${token}`, SITE_URL),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erreur POST /api/newsletter:', error);
    return NextResponse.json({ error: publicErrorMessage(error) }, { status: 500 });
  }
}
