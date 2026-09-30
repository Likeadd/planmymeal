// ============================================================================
// POST /api/auth/login — Connexion par mot de passe, limitée et journalisée
// Rate-limit par IP ET par email (anti brute-force / credential stuffing).
// Message d'erreur unique : on ne révèle jamais si l'email existe.
// Les cookies de session sont posés sur la réponse.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { enforceRateLimit, rateLimit } from '@/lib/rate-limit';
import { logRequestSecurityEvent } from '@/lib/security-log';
import { supabaseForResponse, normaliserEmail } from '@/lib/auth-server';

const MESSAGE_ECHEC = 'Email ou mot de passe incorrect.';
const FENETRE_MS = 15 * 60_000;

export async function POST(request: NextRequest) {
  const limited = await enforceRateLimit(request, { name: 'login', limit: 10, windowMs: FENETRE_MS });
  if (limited) return limited;

  try {
    const body = await request.json().catch(() => ({} as Record<string, unknown>));
    const email = normaliserEmail(body.email);
    const password = typeof body.password === 'string' ? body.password : '';
    if (!email || !password || password.length > 72) {
      return NextResponse.json({ error: MESSAGE_ECHEC }, { status: 400 });
    }

    if (!(await rateLimit(`login-email:${email}`, 5, FENETRE_MS)).ok) {
      logRequestSecurityEvent(request, 'login_abuse', { email });
      return NextResponse.json(
        { error: 'Trop de tentatives. Réessayez dans quelques minutes.' },
        { status: 429 }
      );
    }

    const response = NextResponse.json({ success: true });
    const supabase = supabaseForResponse(request, response);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.session) {
      if (error?.status === 429) {
        return NextResponse.json({ error: 'Trop de tentatives. Réessayez dans quelques minutes.' }, { status: 429 });
      }
      if (error?.code === 'email_not_confirmed') {
        return NextResponse.json(
          { error: 'Confirmez d’abord votre adresse email (lien ou code reçu à l’inscription).' },
          { status: 403 }
        );
      }
      return NextResponse.json({ error: MESSAGE_ECHEC }, { status: 401 });
    }
    // Onboarding lu ICI (session déjà active côté serveur) : le navigateur n'a
    // plus à refaire une requête avant de rediriger. `null` si la lecture
    // échoue → le client part vers /aujourdhui, le proxy corrige au besoin.
    const { data: profil } = await supabase
      .from('profiles')
      .select('onboarding_complete')
      .eq('id', data.session.user.id)
      .maybeSingle();
    const final = NextResponse.json({ success: true, onboardingComplete: profil?.onboarding_complete ?? null });
    response.cookies.getAll().forEach(c => final.cookies.set(c));
    return final;
  } catch (error) {
    console.error('Erreur POST /api/auth/login:', error);
    return NextResponse.json({ error: 'Connexion impossible pour le moment.' }, { status: 500 });
  }
}
