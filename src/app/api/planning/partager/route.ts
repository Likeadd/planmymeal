// ============================================================================
// API Partage public d'un menu de la semaine
//
// POST /api/planning/partager { semaine_debut: 'YYYY-MM-DD' }
// Génère (ou renvoie) le `share_token` du planning actif de l'utilisateur
// pour cette semaine, et retourne l'URL publique /menu/[token] — lisible
// sans compte (voir src/app/menu/[token]).
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { publicErrorMessage } from '@/lib/utils';
import { enforceRateLimit, enforceUserRateLimit } from '@/lib/rate-limit';

const SEMAINE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(request: NextRequest) {
  const limited = await enforceRateLimit(request, { name: 'planning-partager', limit: 20, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const { user } = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    const userLimited = await enforceUserRateLimit(request, user.id, { name: 'planning-partager', limit: 20, windowMs: 60_000 });
    if (userLimited) return userLimited;

    const body = await request.json().catch(() => ({}));
    const semaineDebut = body?.semaine_debut;
    if (typeof semaineDebut !== 'string' || !SEMAINE_RE.test(semaineDebut)) {
      return NextResponse.json({ error: 'semaine_debut invalide' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const { data: plan, error: erreurPlan } = await admin
      .from('weekly_plans')
      .select('id, share_token')
      .eq('user_id', user.id)
      .eq('semaine_debut', semaineDebut)
      .eq('is_active', true)
      .maybeSingle();
    if (erreurPlan) throw erreurPlan;
    if (!plan) return NextResponse.json({ error: 'Aucun planning pour cette semaine' }, { status: 404 });

    let token = plan.share_token;
    if (!token) {
      const { data: updated, error: erreurUpdate } = await admin
        .from('weekly_plans')
        .update({ share_token: crypto.randomUUID() })
        .eq('id', plan.id)
        .select('share_token')
        .single();
      if (erreurUpdate) throw erreurUpdate;
      token = updated.share_token;
    }

    const base = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;
    return NextResponse.json({ success: true, url: `${base}/menu/${token}` });
  } catch (error) {
    console.error('Erreur POST /api/planning/partager:', error);
    return NextResponse.json({ error: publicErrorMessage(error) }, { status: 500 });
  }
}

/** DELETE : révoque tous les liens de partage de menu de l'utilisateur (les anciens liens renvoient « introuvable »). */
export async function DELETE(request: NextRequest) {
  const limited = await enforceRateLimit(request, { name: 'planning-partager', limit: 20, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const { user } = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    const userLimited = await enforceUserRateLimit(request, user.id, { name: 'planning-partager', limit: 20, windowMs: 60_000 });
    if (userLimited) return userLimited;

    const { error } = await getSupabaseAdmin()
      .from('weekly_plans')
      .update({ share_token: null })
      .eq('user_id', user.id)
      .not('share_token', 'is', null);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erreur DELETE /api/planning/partager:', error);
    return NextResponse.json({ error: publicErrorMessage(error) }, { status: 500 });
  }
}
