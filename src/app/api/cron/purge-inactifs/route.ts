// ============================================================================
// CRON Vercel — purge des comptes GRATUITS inactifs depuis 24 mois (RGPD :
// limitation de la durée de conservation, promesse de la politique de
// confidentialité). Ne touche jamais un compte ayant (eu) un abonnement Stripe.
// Mensuel (vercel.json). Test : ?dry_run=1 liste sans supprimer.
// ============================================================================

import { bearerValide } from '@/lib/api-auth';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { publicErrorMessage } from '@/lib/utils';
import { logRequestSecurityEvent } from '@/lib/security-log';

export const maxDuration = 300;

const MOIS_INACTIVITE = 24;
/** Garde-fou : jamais plus de 200 suppressions par exécution */
const LIMITE = 200;

export async function GET(request: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret) {
      logRequestSecurityEvent(request, 'cron_secret', { reason: 'CRON_SECRET absent' });
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }
    if (!bearerValide(request.headers.get('authorization'), secret)) {
      logRequestSecurityEvent(request, 'cron_secret', { reason: 'secret invalide' });
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const dryRun = request.nextUrl.searchParams.get('dry_run') === '1';
    const limite = new Date();
    limite.setMonth(limite.getMonth() - MOIS_INACTIVITE);
    const admin = getSupabaseAdmin();

    // Comptes protégés : plan payant, ou identifiant Stripe déjà posé (historique de facturation)
    const { data: proteges } = await admin.from('profiles').select('id')
      .or('plan.neq.gratuit,stripe_customer_id.not.is.null');
    const exclus = new Set((proteges ?? []).map(p => p.id));

    const aSupprimer: string[] = [];
    for (let page = 1; aSupprimer.length < LIMITE; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw error;
      for (const u of data.users) {
        if (exclus.has(u.id)) continue;
        const derniere = Date.parse(u.last_sign_in_at ?? u.created_at);
        if (Number.isFinite(derniere) && derniere < limite.getTime() && aSupprimer.length < LIMITE) aSupprimer.push(u.id);
      }
      if (data.users.length < 1000) break;
    }

    let supprimes = 0;
    if (!dryRun) {
      for (const id of aSupprimer) {
        // Cascade SQL (migration 00040) : profil, plannings, historique, favoris, recettes privées…
        const { error } = await admin.auth.admin.deleteUser(id);
        if (error) console.error('Purge inactifs — échec suppression:', error.message);
        else supprimes++;
      }
    }
    return NextResponse.json({ dryRun, candidats: aSupprimer.length, supprimes });
  } catch (error) {
    console.error('Erreur cron purge-inactifs:', error);
    return NextResponse.json({ error: publicErrorMessage(error) }, { status: 500 });
  }
}
