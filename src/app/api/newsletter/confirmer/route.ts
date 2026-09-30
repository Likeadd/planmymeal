// ============================================================================
// Confirmation newsletter (double opt-in).
// GET  : lien de l'email → page /newsletter avec un bouton (aucun effet :
//        les antivirus de messagerie ouvrent les liens automatiquement).
// POST : clic sur le bouton → confirmation.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { enforceRateLimit } from '@/lib/rate-limit';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token') ?? '';
  const base = request.nextUrl.origin;
  if (!UUID_RE.test(token)) return NextResponse.redirect(`${base}/`);
  return NextResponse.redirect(`${base}/newsletter?action=confirmer&token=${token}`);
}

export async function POST(request: NextRequest) {
  const limited = await enforceRateLimit(request, { name: 'newsletter-confirmer', limit: 10, windowMs: 60_000 });
  if (limited) return limited;

  const base = request.nextUrl.origin;
  const form = await request.formData().catch(() => null);
  const token = String(form?.get('token') ?? '');
  if (!UUID_RE.test(token)) return NextResponse.redirect(`${base}/?newsletter=invalide`, 303);

  const { data } = await getSupabaseAdmin()
    .from('newsletter_subscribers')
    .update({ confirmed_at: new Date().toISOString() })
    .eq('token', token)
    .is('unsubscribed_at', null)
    .select('id');

  return NextResponse.redirect(`${base}/?newsletter=${data && data.length > 0 ? 'confirmee' : 'invalide'}`, 303);
}
