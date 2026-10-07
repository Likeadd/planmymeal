// ============================================================================
// API Foyer partagé — membres, invitations, réglage de rotation des recettes
// aimées (migrations 00021 + 00027).
//
// Toutes les mutations passent par les RPC SECURITY DEFINER de 00021 (déjà
// validées : rôle, unicité du code, atomicité de la consommation…) — cette
// route ne fait que les exposer avec auth + rate limit, RIEN de la logique
// métier n'est dupliqué ici. Elle utilise donc le client lié à la session
// (getAuthUserAndClient), PAS le client admin : ces fonctions lisent
// `auth.uid()`, qui vaudrait NULL sous le rôle service.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { reponsePaywall } from '@/lib/paywall-serveur';
import { getAuthUserAndClient } from '@/lib/api-auth';
import { publicErrorMessage, UserError } from '@/lib/utils';
import { enforceRateLimit, enforceUserRateLimit } from '@/lib/rate-limit';

/** GET : état complet du foyer de l'appelant (créé à la volée si absent). */
export async function GET(request: NextRequest) {
  const limited = await enforceRateLimit(request, { name: 'foyer-partage', limit: 30, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const { user, supabase } = await getAuthUserAndClient(request);
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    const userLimited = await enforceUserRateLimit(request, user.id, { name: 'foyer-partage', limit: 30, windowMs: 60_000 });
    if (userLimited) return userLimited;

    const { data: householdId, error: ensureError } = await supabase.rpc('ensure_household');
    if (ensureError || householdId == null) throw new UserError('Impossible de résoudre votre foyer');

    const [{ data: household, error: hError }, { data: membres, error: mError }] = await Promise.all([
      supabase.from('households').select('id, nom, delai_recettes_aimees_jours').eq('id', householdId).single(),
      supabase.rpc('household_list_members'),
    ]);
    if (hError || !household) throw new UserError('Foyer introuvable');
    if (mError) throw new Error(mError.message);

    const moi = (membres ?? []).find(m => m.user_id === user.id);
    const estProprietaire = moi?.role === 'owner';

    let invitation: { id: number; code: string; expires_at: string } | null = null;
    if (estProprietaire) {
      const { data } = await supabase
        .from('household_invitations')
        .select('id, code, expires_at')
        .eq('household_id', householdId)
        .is('revoked_at', null)
        .is('used_by', null)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();
      invitation = data ?? null;
    }

    return NextResponse.json({
      household,
      membres: membres ?? [],
      est_proprietaire: estProprietaire,
      invitation,
    });
  } catch (error) {
    console.error('Erreur GET /api/foyer-partage:', error);
    return NextResponse.json({ error: publicErrorMessage(error) }, { status: 500 });
  }
}

/** PATCH : réglages du foyer — délai des recettes aimées (créateur uniquement). */
export async function PATCH(request: NextRequest) {
  const limited = await enforceRateLimit(request, { name: 'foyer-partage', limit: 20, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const { user, supabase } = await getAuthUserAndClient(request);
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    const userLimited = await enforceUserRateLimit(request, user.id, { name: 'foyer-partage', limit: 20, windowMs: 60_000 });
    if (userLimited) return userLimited;

    const body = await request.json().catch(() => ({} as Record<string, unknown>));
    const delai = Number(body.delai_recettes_aimees_jours);
    if (!Number.isInteger(delai) || delai < 1 || delai > 180) {
      return NextResponse.json({ error: 'Délai invalide (1 à 180 jours)' }, { status: 400 });
    }

    const { data: householdId } = await supabase.rpc('ensure_household');
    if (householdId == null) throw new UserError('Impossible de résoudre votre foyer');

    // La policy RLS "Owner updates household" (00021) rejette silencieusement
    // (0 ligne) toute tentative venant d'un membre non-créateur.
    const { data, error } = await supabase
      .from('households')
      .update({ delai_recettes_aimees_jours: delai })
      .eq('id', householdId)
      .select('id, nom, delai_recettes_aimees_jours')
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return NextResponse.json({ error: 'Seul le créateur du foyer peut modifier ce réglage' }, { status: 403 });

    return NextResponse.json({ success: true, household: data });
  } catch (error) {
    console.error('Erreur PATCH /api/foyer-partage:', error);
    return NextResponse.json({ error: publicErrorMessage(error) }, { status: 500 });
  }
}

/** Message SQL conservé seulement pour les `raise exception` métier (P0001) ; le reste reste interne. */
function erreurRpc(e: { message: string; code?: string }): Error {
  return e.code === 'P0001' ? new UserError(e.message) : new Error(e.message);
}

type Action =
  | { action: 'inviter'; jours?: number }
  | { action: 'annuler_invitation'; invitation_id: number }
  | { action: 'rejoindre'; code: string }
  | { action: 'quitter' }
  | { action: 'retirer_membre'; user_id: string };

/** POST : actions du foyer (inviter, rejoindre, quitter, retirer un membre…). */
export async function POST(request: NextRequest) {
  const limited = await enforceRateLimit(request, { name: 'foyer-partage-action', limit: 15, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const { user, supabase } = await getAuthUserAndClient(request);
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    const userLimited = await enforceUserRateLimit(request, user.id, { name: 'foyer-partage-action', limit: 15, windowMs: 60_000 });
    if (userLimited) return userLimited;

    const body = (await request.json().catch(() => ({}))) as Partial<Action>;

    switch (body.action) {
      case 'inviter': {
        const { data: profil } = await supabase.from('profiles').select('plan').eq('id', user.id).maybeSingle();
        if (profil?.plan !== 'famille') {
          return reponsePaywall('foyer-partage', 'Partager votre foyer avec d’autres comptes est inclus dans le plan Famille.');
        }
        const jours = body.jours != null ? Number(body.jours) : 7;
        if (!Number.isInteger(jours) || jours < 1 || jours > 30) {
          return NextResponse.json({ error: 'Durée invalide (1 à 30 jours)' }, { status: 400 });
        }
        const { data: code, error } = await supabase.rpc('household_invite', { p_days: jours });
        if (error) throw erreurRpc(error);
        const { data: inv } = await supabase
          .from('household_invitations').select('id, code, expires_at').eq('code', code!).maybeSingle();
        return NextResponse.json({ success: true, invitation: inv ?? { code, expires_at: null } });
      }

      case 'annuler_invitation': {
        const id = Number(body.invitation_id);
        if (!Number.isInteger(id) || id <= 0) {
          return NextResponse.json({ error: 'Invitation invalide' }, { status: 400 });
        }
        const { error } = await supabase.rpc('household_annuler_invitation', { p_invitation_id: id });
        if (error) throw erreurRpc(error);
        return NextResponse.json({ success: true });
      }

      case 'rejoindre': {
        const code = typeof body.code === 'string' ? body.code.trim() : '';
        if (!code) return NextResponse.json({ error: 'Code manquant' }, { status: 400 });
        const { data: householdId, error } = await supabase.rpc('household_join', { p_code: code });
        if (error) throw erreurRpc(error);
        return NextResponse.json({ success: true, household_id: householdId });
      }

      case 'quitter': {
        const { error } = await supabase.rpc('household_leave');
        if (error) throw erreurRpc(error);
        return NextResponse.json({ success: true });
      }

      case 'retirer_membre': {
        const memberId = typeof body.user_id === 'string' ? body.user_id : '';
        if (!memberId) return NextResponse.json({ error: 'Membre manquant' }, { status: 400 });
        const { error } = await supabase.rpc('household_remove_member', { p_member_user_id: memberId });
        if (error) throw erreurRpc(error);
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ error: 'Action inconnue' }, { status: 400 });
    }
  } catch (error) {
    console.error('Erreur POST /api/foyer-partage:', error);
    return NextResponse.json({ error: publicErrorMessage(error) }, { status: 500 });
  }
}
