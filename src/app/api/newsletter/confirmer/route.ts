// ============================================================================
// Confirmation newsletter (double opt-in) — lien à un clic reçu par email.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  const base = request.nextUrl.origin;
  if (!token || !UUID_RE.test(token)) return NextResponse.redirect(`${base}/`);

  const { data } = await getSupabaseAdmin()
    .from('newsletter_subscribers')
    .update({ confirmed_at: new Date().toISOString() })
    .eq('token', token)
    .is('unsubscribed_at', null)
    .select('id');

  return NextResponse.redirect(`${base}/?newsletter=${data && data.length > 0 ? 'confirmee' : 'invalide'}`);
}
