// ============================================================================
// POST /api/auth/mot-de-passe-oublie { email } — envoie le lien de réinitialisation (audit VULN-009).
// Réponse TOUJOURS identique, que le compte existe ou non (pas d'énumération) ; limité par IP et par email.
// Le lien ramène sur /auth/callback (PKCE) puis /nouveau-mot-de-passe.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { enforceRateLimit, rateLimit } from '@/lib/rate-limit';
import { logRequestSecurityEvent } from '@/lib/security-log';
import { normaliserEmail, supabaseForResponse } from '@/lib/auth-server';

const REPONSE = { success: true };

export async function POST(request: NextRequest) {
  const limited = await enforceRateLimit(request, { name: 'mot-de-passe-oublie', limit: 5, windowMs: 15 * 60_000 });
  if (limited) return limited;

  try {
    const body = await request.json().catch(() => ({} as Record<string, unknown>));
    const email = normaliserEmail(body.email);
    if (!email) return NextResponse.json({ error: 'Adresse email invalide.' }, { status: 400 });

    // 3 envois par heure et par adresse : pas de bombardement d'une boîte mail
    if (!(await rateLimit(`mot-de-passe-oublie:${email}`, 3, 60 * 60_000)).ok) {
      logRequestSecurityEvent(request, 'signup_abuse', { action: 'mot_de_passe_oublie' });
      return NextResponse.json(REPONSE);
    }

    const base = (process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin).replace(/\/$/, '');
    const response = NextResponse.json(REPONSE);
    const supabase = supabaseForResponse(request, response); // pose le cookie PKCE sur la réponse
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${base}/auth/callback?next=/nouveau-mot-de-passe`,
    });
    if (error && error.status !== 429) console.error('Erreur POST /api/auth/mot-de-passe-oublie:', error.message);
    return response;
  } catch (error) {
    console.error('Erreur POST /api/auth/mot-de-passe-oublie:', error);
    return NextResponse.json(REPONSE);
  }
}
