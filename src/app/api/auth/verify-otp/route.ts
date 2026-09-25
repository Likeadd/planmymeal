// ============================================================================
// POST /api/auth/verify-otp — Valide le code reçu par email à l'inscription
// Limité par IP ET par email (anti brute-force) ; échecs répétés journalisés.
// Les cookies de session sont posés sur la réponse.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { enforceRateLimit, rateLimit } from '@/lib/rate-limit';
import { logRequestSecurityEvent } from '@/lib/security-log';
import { supabaseForResponse, normaliserEmail } from '@/lib/auth-server';

const TENTATIVES_PAR_EMAIL = 5;
const FENETRE_MS = 15 * 60_000;

export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(request, { name: 'verify-otp', limit: 10, windowMs: FENETRE_MS });
  if (limited) return limited;

  try {
    const body = await request.json().catch(() => ({} as Record<string, unknown>));
    const email = normaliserEmail(body.email);
    const code = typeof body.code === 'string' ? body.code.replace(/\s/g, '') : '';
    if (!email || !/^\d{6,10}$/.test(code)) {
      return NextResponse.json({ error: 'Code invalide.' }, { status: 400 });
    }

    if (!rateLimit(`otp-email:${email}`, TENTATIVES_PAR_EMAIL, FENETRE_MS).ok) {
      logRequestSecurityEvent(request, 'otp_abuse', { email });
      return NextResponse.json(
        { error: 'Trop de tentatives. Demandez un nouveau code dans quelques minutes.' },
        { status: 429 }
      );
    }

    const response = NextResponse.json({ success: true });
    const supabase = supabaseForResponse(request, response);
    const { data, error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' });

    if (error || !data.session) {
      return NextResponse.json({ error: 'Code incorrect ou expiré.' }, { status: 400 });
    }
    return response;
  } catch (error) {
    console.error('Erreur POST /api/auth/verify-otp:', error);
    return NextResponse.json({ error: 'Vérification impossible pour le moment.' }, { status: 500 });
  }
}
