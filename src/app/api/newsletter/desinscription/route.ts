// ============================================================================
// Désinscription newsletter.
// GET  : lien de l'email → page /newsletter avec un bouton (aucun effet :
//        les antivirus de messagerie ouvrent les liens automatiquement).
// POST : clic sur le bouton (token dans le formulaire) OU désinscription en
//        un clic RFC 8058 envoyée par Gmail/Outlook (token dans l'URL,
//        corps « List-Unsubscribe=One-Click »).
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { enforceRateLimit } from '@/lib/rate-limit';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token') ?? '';
  const base = request.nextUrl.origin;
  if (!UUID_RE.test(token)) return NextResponse.redirect(`${base}/`);
  return NextResponse.redirect(`${base}/newsletter?action=desinscription&token=${token}`);
}

export async function POST(request: NextRequest) {
  const limited = await enforceRateLimit(request, { name: 'newsletter-desinscription', limit: 10, windowMs: 60_000 });
  if (limited) return limited;

  const base = request.nextUrl.origin;
  const form = await request.formData().catch(() => null);
  const token = String(form?.get('token') ?? request.nextUrl.searchParams.get('token') ?? '');
  if (!UUID_RE.test(token)) return NextResponse.redirect(`${base}/`, 303);

  await getSupabaseAdmin()
    .from('newsletter_subscribers')
    .update({ unsubscribed_at: new Date().toISOString() })
    .eq('token', token);

  // Désinscription en un clic (client mail) : pas de redirection attendue
  if (form?.get('List-Unsubscribe') === 'One-Click') return new NextResponse(null, { status: 200 });
  return NextResponse.redirect(`${base}/?desinscrit=1`, 303);
}
