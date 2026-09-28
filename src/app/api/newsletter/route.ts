// ============================================================================
// API Newsletter — inscription au menu dominical (lead magnet public, sans
// compte). Formulaire dans LandingFooter. Envoi effectif : cron
// api/cron/newsletter-hebdo, chaque dimanche.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { publicErrorMessage } from '@/lib/utils';
import { enforceRateLimit } from '@/lib/rate-limit';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  // Anti-abus : endpoint public, sans authentification.
  const limited = enforceRateLimit(request, { name: 'newsletter', limit: 5, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const body = await request.json().catch(() => ({}));
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
      return NextResponse.json({ error: 'Adresse email invalide' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    // Upsert : un email qui s'était désinscrit et revient est réactivé.
    const { error } = await supabase
      .from('newsletter_subscribers')
      .upsert({ email, unsubscribed_at: null }, { onConflict: 'email' });
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erreur POST /api/newsletter:', error);
    return NextResponse.json({ error: publicErrorMessage(error) }, { status: 500 });
  }
}
