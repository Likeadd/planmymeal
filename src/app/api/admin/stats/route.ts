// ============================================================================
// GET /api/admin/stats — statistiques INTERNES (comptes, activité, contenu) pour le tableau de
// bord /admin. Réservé aux adresses listées dans ADMIN_EMAILS (variable serveur, séparées par des
// virgules) ; toute autre personne reçoit un 404. Données agrégées uniquement : aucune donnée
// personnelle n'est renvoyée. La fréquentation du site (visiteurs, pages, sources) est dans Plausible.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { estAdmin } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { publicErrorMessage } from '@/lib/utils';
import { enforceRateLimit } from '@/lib/rate-limit';
import { dateParis } from '@/lib/dates';

const JOUR_MS = 86_400_000;
const JOURS = 30;

/** Série quotidienne sur les 30 derniers jours (jours sans valeur = 0) */
function serie(dates: string[]): { jour: string; n: number }[] {
  const compte = new Map<string, number>();
  for (const d of dates) { const j = dateParis(new Date(d)); compte.set(j, (compte.get(j) ?? 0) + 1); }
  return Array.from({ length: JOURS }, (_, i) => {
    const jour = dateParis(new Date(Date.now() - (JOURS - 1 - i) * JOUR_MS));
    return { jour, n: compte.get(jour) ?? 0 };
  });
}

export async function GET(request: NextRequest) {
  const limited = await enforceRateLimit(request, { name: 'admin-stats', limit: 30, windowMs: 60_000 });
  if (limited) return limited;

  try {
    if (!(await estAdmin(request))) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });

    const db = getSupabaseAdmin();
    const depuis = new Date(Date.now() - JOURS * JOUR_MS).toISOString();
    const compter = async (q: PromiseLike<{ count: number | null; error: { message: string } | null }>) => {
      const { count, error } = await q;
      if (error) throw new Error(error.message);
      return count ?? 0;
    };
    const tete = { count: 'exact' as const, head: true };

    const [total, onboarding, pro, famille, newsletterOk, newsletterAttente, favoris, demandes, recettes, indexables, inscrits, plans, comptes] = await Promise.all([
      compter(db.from('profiles').select('id', tete)),
      compter(db.from('profiles').select('id', tete).eq('onboarding_complete', true)),
      compter(db.from('profiles').select('id', tete).eq('plan', 'pro')),
      compter(db.from('profiles').select('id', tete).eq('plan', 'famille')),
      compter(db.from('newsletter_subscribers').select('id', tete).not('confirmed_at', 'is', null).is('unsubscribed_at', null)),
      compter(db.from('newsletter_subscribers').select('id', tete).is('confirmed_at', null)),
      compter(db.from('meal_history').select('id', tete).eq('status', 'liked')),
      // Table hors des types générés : client non typé pour cette lecture
      compter((db as unknown as SupabaseClient).from('recipe_requests').select('id', tete).gte('created_at', depuis)),
      compter(db.from('meals').select('id', tete).eq('is_public', true)),
      compter(db.from('meals').select('id', tete).eq('is_public', true).eq('indexable', true)),
      db.from('profiles').select('created_at').gte('created_at', depuis).limit(10000),
      db.from('weekly_plans').select('generated_at').gte('generated_at', depuis).limit(20000),
      // Activité : dernière connexion de chaque compte (10 000 comptes max lus)
      (async () => {
        const connexions: number[] = [];
        for (let page = 1; page <= 10; page++) {
          const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
          if (error) throw new Error(error.message);
          for (const u of data.users) { const t = Date.parse(u.last_sign_in_at ?? u.created_at); if (Number.isFinite(t)) connexions.push(t); }
          if (data.users.length < 1000) break;
        }
        return connexions;
      })(),
    ]);
    if (inscrits.error) throw new Error(inscrits.error.message);
    if (plans.error) throw new Error(plans.error.message);

    const actifs = (jours: number) => comptes.filter(t => t >= Date.now() - jours * JOUR_MS).length;
    const inscriptions = serie((inscrits.data ?? []).map(r => r.created_at));

    return NextResponse.json({
      genere_le: new Date().toISOString(),
      comptes: {
        total, onboarding, pro, famille, gratuit: total - pro - famille,
        inscrits_7j: inscriptions.slice(-7).reduce((s, j) => s + j.n, 0),
        inscrits_30j: inscriptions.reduce((s, j) => s + j.n, 0),
        actifs_1j: actifs(1), actifs_7j: actifs(7), actifs_30j: actifs(30),
      },
      inscriptions_par_jour: inscriptions,
      plans_generes_par_jour: serie((plans.data ?? []).map(r => r.generated_at)),
      newsletter: { confirmes: newsletterOk, en_attente: newsletterAttente },
      contenu: { recettes_publiques: recettes, indexables, avis_positifs: favoris, demandes_recettes_30j: demandes },
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Erreur GET /api/admin/stats:', error);
    return NextResponse.json({ error: publicErrorMessage(error) }, { status: 500 });
  }
}
