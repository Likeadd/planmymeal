// ============================================================================
// Désinscription newsletter — lien à un clic (token dans l'email, pas de
// compte requis). GET pour que le lien fonctionne directement depuis un
// client mail, sans page intermédiaire.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  const base = request.nextUrl.origin;
  if (!token) return NextResponse.redirect(`${base}/`);

  const supabase = getSupabaseAdmin();
  await supabase
    .from('newsletter_subscribers')
    .update({ unsubscribed_at: new Date().toISOString() })
    .eq('token', token);

  return NextResponse.redirect(`${base}/?desinscrit=1`);
}
