// ============================================================================
// POST /api/auth/resend — Renvoie l'email d'inscription (lien magique + code)
// Réponse toujours identique (pas d'énumération de comptes).
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { enforceRateLimit, rateLimit } from '@/lib/rate-limit';
import { logRequestSecurityEvent } from '@/lib/security-log';
import { supabaseForResponse, magicLinkRedirect, normaliserEmail } from '@/lib/auth-server';

export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(request, { name: 'resend', limit: 5, windowMs: 10 * 60_000 });
  if (limited) return limited;

  try {
    const body = await request.json().catch(() => ({} as Record<string, unknown>));
    const email = normaliserEmail(body.email);
    if (!email) return NextResponse.json({ error: 'Adresse email invalide.' }, { status: 400 });

    if (!rateLimit(`resend-email:${email}`, 3, 10 * 60_000).ok) {
      logRequestSecurityEvent(request, 'signup_abuse', { email, action: 'resend' });
      return NextResponse.json({ error: 'Patientez quelques minutes avant un nouvel envoi.' }, { status: 429 });
    }

    const response = NextResponse.json({ success: true });
    const supabase = supabaseForResponse(request, response);
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: magicLinkRedirect(request) },
    });
    if (error && error.status === 429) {
      return NextResponse.json({ error: 'Patientez quelques minutes avant un nouvel envoi.' }, { status: 429 });
    }
    if (error) console.error('Erreur POST /api/auth/resend:', error.message);
    return response;
  } catch (error) {
    console.error('Erreur POST /api/auth/resend:', error);
    return NextResponse.json({ success: true });
  }
}
