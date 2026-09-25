// ============================================================================
// GET /auth/callback — Confirmation d'email / lien magique Supabase
// Deux formats acceptés :
//   ?code=…                    (PKCE — même navigateur que l'inscription)
//   ?token_hash=…&type=email   (lien magique ouvert sur un autre appareil)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { logRequestSecurityEvent } from '@/lib/security-log';
import { supabaseForResponse } from '@/lib/auth-server';

const TYPES_OTP: EmailOtpType[] = ['signup', 'email', 'magiclink', 'invite', 'recovery', 'email_change'];

/** Chemin interne uniquement : bloque les redirections ouvertes (//evil.com, @evil.com…). */
function cheminSur(next: string | null): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) {
    return '/aujourdhui';
  }
  return next;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  // Défaut : /aujourdhui, la page d'accueil quotidienne (comme le login).
  const next = cheminSur(searchParams.get('next'));

  if (code || (tokenHash && type && TYPES_OTP.includes(type))) {
    const response = NextResponse.redirect(new URL(next, origin));

    // Les cookies de session sont posés SUR LA RÉPONSE de redirection, sinon
    // la session n'est jamais persistée et l'utilisateur retombe sur /login.
    const supabase = supabaseForResponse(request, response);

    const { error } = code
      ? await supabase.auth.exchangeCodeForSession(code)
      : await supabase.auth.verifyOtp({ token_hash: tokenHash!, type: type! });

    if (!error) {
      return response;
    }
    logRequestSecurityEvent(request, 'auth_callback', { flow: code ? 'pkce' : 'token_hash' });
  }

  // Erreur ou pas de code → login
  return NextResponse.redirect(new URL('/login?error=confirmation', origin));
}
