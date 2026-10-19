// ============================================================================
// POST /api/compte/mot-de-passe { actuel, nouveau } — changement de mot de passe CÔTÉ SERVEUR
// (audit VULN-004) : le mot de passe actuel est vérifié ici, et non plus seulement dans le navigateur.
// Complément indispensable : activer « Secure password change » dans Supabase Auth, pour que l'API
// Supabase refuse aussi un changement direct avec un simple jeton de session volé.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthUser } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { motDePasseValide } from '@/lib/auth-server';
import { enforceRateLimit, enforceUserRateLimit } from '@/lib/rate-limit';
import { logRequestSecurityEvent } from '@/lib/security-log';

const FENETRE_MS = 15 * 60_000;

export async function POST(request: NextRequest) {
  const limited = await enforceRateLimit(request, { name: 'mot-de-passe', limit: 10, windowMs: FENETRE_MS });
  if (limited) return limited;

  try {
    const { user } = await getAuthUser(request);
    if (!user?.email) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    const userLimited = await enforceUserRateLimit(request, user.id, { name: 'mot-de-passe', limit: 5, windowMs: FENETRE_MS });
    if (userLimited) return userLimited;

    const body = await request.json().catch(() => ({} as Record<string, unknown>));
    const actuel = typeof body.actuel === 'string' ? body.actuel : '';
    const nouveau = body.nouveau;
    if (!actuel || actuel.length > 72) return NextResponse.json({ error: 'Le mot de passe actuel est incorrect.' }, { status: 400 });
    if (!motDePasseValide(nouveau)) {
      return NextResponse.json({ error: 'Le nouveau mot de passe doit contenir 8 à 72 caractères, dont une lettre et un chiffre.' }, { status: 400 });
    }
    if (nouveau === actuel) return NextResponse.json({ error: 'Le nouveau mot de passe doit être différent de l’actuel.' }, { status: 400 });

    // Vérification du mot de passe actuel avec un client éphémère (aucun cookie touché), puis fermeture
    // de cette session de vérification.
    const verif = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await verif.auth.signInWithPassword({ email: user.email, password: actuel });
    if (error || data.user?.id !== user.id) {
      logRequestSecurityEvent(request, 'login_abuse', { action: 'changement_mot_de_passe' }, user.id);
      return NextResponse.json({ error: 'Le mot de passe actuel est incorrect.' }, { status: 400 });
    }
    await verif.auth.signOut({ scope: 'local' }).catch(() => {});

    const { error: majError } = await getSupabaseAdmin().auth.admin.updateUserById(user.id, { password: nouveau });
    if (majError) {
      if (majError.code === 'weak_password') return NextResponse.json({ error: 'Mot de passe trop faible ou trop courant.' }, { status: 400 });
      throw new Error(majError.message);
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erreur POST /api/compte/mot-de-passe:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Erreur lors de la mise à jour du mot de passe.' }, { status: 500 });
  }
}
