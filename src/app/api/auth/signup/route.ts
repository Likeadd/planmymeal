// ============================================================================
// POST /api/auth/signup — Inscription sécurisée
//
// 1. Rate-limit par IP puis par email.
// 2. Honeypot : champ caché `website` + durée de remplissage minimale. Un robot
//    reçoit une fausse réponse de succès (il n'apprend rien) et l'événement
//    est journalisé.
// 3. Supabase envoie UN email contenant le lien magique ({{ .ConfirmationURL }})
//    ET le code OTP ({{ .Token }}) — voir le modèle « Confirm signup ».
//    Le cookie PKCE est posé sur la réponse → le lien magique fonctionne
//    dans ce navigateur ; le code fonctionne partout.
// Réponse identique si l'email existe déjà (pas d'énumération de comptes).
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { enforceRateLimit, rateLimit } from '@/lib/rate-limit';
import { logRequestSecurityEvent } from '@/lib/security-log';
import {
  supabaseForResponse, magicLinkRedirect, normaliserEmail, normaliserPrenom,
  motDePasseValide, DUREE_MIN_FORMULAIRE_MS,
} from '@/lib/auth-server';

const ERREUR_GENERIQUE = 'Inscription impossible pour le moment. Réessayez dans un instant.';

export async function POST(request: NextRequest) {
  const limited = await enforceRateLimit(request, { name: 'signup', limit: 5, windowMs: 10 * 60_000 });
  if (limited) return limited;

  try {
    const body = await request.json().catch(() => ({} as Record<string, unknown>));

    // ── Honeypot ──
    const piege = typeof body.website === 'string' ? body.website.trim() : '';
    const duree = Number(body.elapsed_ms);
    if (piege !== '' || !Number.isFinite(duree) || duree < DUREE_MIN_FORMULAIRE_MS) {
      logRequestSecurityEvent(request, 'honeypot', {
        champRempli: piege !== '',
        dureeMs: Number.isFinite(duree) ? duree : null,
        userAgent: request.headers.get('user-agent'),
      });
      return NextResponse.json({ success: true, session: false }); // leurre
    }

    const prenom = normaliserPrenom(body.name);
    const email = normaliserEmail(body.email);
    if (!prenom || !email) {
      return NextResponse.json({ error: 'Prénom ou adresse email invalide.' }, { status: 400 });
    }
    if (!motDePasseValide(body.password)) {
      return NextResponse.json(
        { error: 'Le mot de passe doit contenir 8 à 72 caractères, dont une lettre et un chiffre.' },
        { status: 400 }
      );
    }

    // ── Limite par email (anti-bombardement d'une boîte) ──
    if (!(await rateLimit(`signup-email:${email}`, 3, 60 * 60_000)).ok) {
      logRequestSecurityEvent(request, 'signup_abuse', { email });
      return NextResponse.json({ error: 'Trop de tentatives pour cette adresse. Réessayez plus tard.' }, { status: 429 });
    }

    const response = NextResponse.json({ success: true, session: false });
    const supabase = supabaseForResponse(request, response);
    const { data, error } = await supabase.auth.signUp({
      email,
      password: body.password,
      options: {
        data: { full_name: prenom },
        emailRedirectTo: magicLinkRedirect(request),
      },
    });

    if (error) {
      if (error.code === 'user_already_exists' || error.message === 'User already registered') {
        return NextResponse.json({ success: true, session: false }); // pas d'énumération
      }
      if (error.code === 'weak_password') {
        return NextResponse.json({ error: 'Mot de passe trop faible ou trop courant.' }, { status: 400 });
      }
      if (error.status === 429) {
        return NextResponse.json({ error: 'Trop de demandes. Réessayez dans quelques minutes.' }, { status: 429 });
      }
      console.error('Erreur POST /api/auth/signup:', error.message);
      return NextResponse.json({ error: ERREUR_GENERIQUE }, { status: 500 });
    }

    // Confirmation email désactivée côté Supabase → session immédiate.
    if (data.session) {
      const withSession = NextResponse.json({ success: true, session: true });
      response.cookies.getAll().forEach(c => withSession.cookies.set(c));
      return withSession;
    }
    return response;
  } catch (error) {
    console.error('Erreur POST /api/auth/signup:', error);
    return NextResponse.json({ error: ERREUR_GENERIQUE }, { status: 500 });
  }
}
