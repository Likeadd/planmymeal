// ============================================================================
// API Préférences & mémoire alimentaire — PlanMyMeal
//
// GET    → mémoire complète (temps par jour, contexte, nouveauté, préférences)
// PUT    → met à jour tout ou partie (le patch est partiel par construction)
// DELETE → supprime la mémoire d'une recette (?meal_id=)
//
// C'est ici que se règlent « mercredi soir → 15 min », « dimanche midi →
// élaboré » et le curseur Confort ↔ Découverte. Le moteur de rotation lit
// exactement ces colonnes (lib/memoire.ts) : le réglage a donc un effet réel,
// pas seulement décoratif.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { enforceRateLimit, enforceUserRateLimit } from '@/lib/rate-limit';
import { publicErrorMessage } from '@/lib/utils';
import {
  chargerMemoire,
  enregistrerPreference,
  parseContexteJours,
  parseTempsMaxParJour,
  supprimerPreference,
  type PreferenceInput,
} from '@/lib/memoire';

export async function GET(request: NextRequest) {
  try {
    const { user } = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    const userLimited = await enforceUserRateLimit(request, user.id, { name: 'preferences-get', limit: 120, windowMs: 60_000 });
    if (userLimited) return userLimited;

    const admin = getSupabaseAdmin();
    const [memoire, { data: prefs }] = await Promise.all([
      chargerMemoire(user.id, admin),
      admin
        .from('user_meal_preferences')
        .select('meal_id, note, frequence_jours, jour_prefere, repas_prefere, ne_plus_proposer, meals(titre)')
        .eq('user_id', user.id),
    ]);

    // Le titre accompagne la préférence : la page Réglages liste des recettes,
    // pas des identifiants.
    const preferences = (prefs ?? []).map(p => {
      const row = p as unknown as {
        meal_id: number; note: number | null; frequence_jours: number | null;
        jour_prefere: number | null; repas_prefere: string | null;
        ne_plus_proposer: boolean; meals: { titre: string } | null;
      };
      return { ...row, titre: row.meals?.titre ?? `Recette #${row.meal_id}` };
    });

    return NextResponse.json({
      temps_max_par_jour: memoire.tempsMaxParJour,
      contexte_jours: memoire.contexteJours,
      nouveaute: memoire.nouveaute,
      preferences,
    });
  } catch (error) {
    console.error('Erreur GET /api/preferences:', error);
    return NextResponse.json({ error: publicErrorMessage(error) }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const limited = await enforceRateLimit(request, { name: 'preferences', limit: 60, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const { user } = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    const userLimited = await enforceUserRateLimit(request, user.id, { name: 'preferences', limit: 60, windowMs: 60_000 });
    if (userLimited) return userLimited;

    const body = await request.json().catch(() => ({} as Record<string, unknown>));
    const admin = getSupabaseAdmin();

    // ── Rythme du foyer (profiles) ──
    // Type explicite (et non Record<string, unknown>) : l'objet doit rester
    // assignable au type Update généré par supabase gen types.
    const patch: {
      temps_max_par_jour?: ReturnType<typeof parseTempsMaxParJour>;
      contexte_jours?: ReturnType<typeof parseContexteJours>;
      nouveaute?: number;
    } = {};
    if ('temps_max_par_jour' in body) {
      patch.temps_max_par_jour = parseTempsMaxParJour(body.temps_max_par_jour);
    }
    if ('contexte_jours' in body) {
      patch.contexte_jours = parseContexteJours(body.contexte_jours);
    }
    if ('nouveaute' in body) {
      const n = Number(body.nouveaute);
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        return NextResponse.json({ error: 'Curseur de nouveauté invalide (0 – 100)' }, { status: 400 });
      }
      patch.nouveaute = Math.round(n);
    }

    if (Object.keys(patch).length > 0) {
      const { error } = await admin.from('profiles').update(patch).eq('id', user.id);
      if (error) throw new Error(error.message);
    }

    // ── Préférence d'une recette (« lasagnes tous les 20 jours, dimanche midi ») ──
    const pref = body.preference as (PreferenceInput & { meal_id?: number }) | undefined;
    if (pref && Number.isInteger(pref.meal_id)) {
      await enregistrerPreference(user.id, pref.meal_id as number, pref, admin);
    }

    if (Object.keys(patch).length === 0 && !pref) {
      return NextResponse.json({ error: 'Aucune modification fournie' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erreur PUT /api/preferences:', error);
    return NextResponse.json({ error: publicErrorMessage(error) }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { user } = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    const userLimited = await enforceUserRateLimit(request, user.id, { name: 'preferences-delete', limit: 120, windowMs: 60_000 });
    if (userLimited) return userLimited;

    const mealId = Number(request.nextUrl.searchParams.get('meal_id'));
    if (!Number.isInteger(mealId) || mealId <= 0) {
      return NextResponse.json({ error: 'meal_id invalide' }, { status: 400 });
    }

    await supprimerPreference(user.id, mealId, getSupabaseAdmin());
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erreur DELETE /api/preferences:', error);
    return NextResponse.json({ error: publicErrorMessage(error) }, { status: 500 });
  }
}
