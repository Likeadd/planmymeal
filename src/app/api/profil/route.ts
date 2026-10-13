import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { publicErrorMessage } from '@/lib/utils';
import { enforceRateLimit, enforceUserRateLimit } from '@/lib/rate-limit';
import { enregistrerExclusions } from '@/lib/exclusions-alimentaires';
import { validerRythmeDesserts } from '@/lib/rotation-engine';
import { BORNES } from '@/lib/nutrition';
import { REGIMES_CHOIX } from '@/lib/regimes';
import type { Database } from '@/../supabase/database.types';

type ProfilUpdate = Database['public']['Tables']['profiles']['Update'];

/**
 * POST /api/profil — TOUTES les écritures du profil passent ici (onboarding,
 * Mon compte) au lieu d'écrire depuis le navigateur. Chaque champ est
 * validé et borné ; les champs inconnus sont ignorés (liste blanche).
 *
 * Corps : {
 *   profil?:     champs de `profiles` (liste blanche ci-dessous),
 *   corps?:      { sexe, age, taille_cm, poids_kg } (hors bornes → null),
 *   exclusions?: { allergies: string[], detestes: string[] } (familles),
 *   regimes?:    { liste: Regime[], mode: 'remplacer' | 'ajouter' },
 * }
 */

const OBJECTIFS = ['perte_poids', 'maintien', 'prise_masse', 'sans_regime'];
const NIVEAUX = ['debutant', 'intermediaire', 'expert'];
const REGIMES = new Set<string>(REGIMES_CHOIX.map(r => r.value));

const entier = (v: unknown, min: number, max: number): number | undefined => {
  const n = Number(v);
  return v != null && Number.isInteger(n) && n >= min && n <= max ? n : undefined;
};
const booleen = (v: unknown): boolean | undefined => (typeof v === 'boolean' ? v : undefined);
const texteListe = (v: unknown, max = 40): string[] | undefined =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.length <= 60).slice(0, max) : undefined;
const borne = (v: unknown, b: { min: number; max: number }): number | null => {
  const n = Number(v);
  return v != null && v !== '' && Number.isFinite(n) && n >= b.min && n <= b.max ? Math.round(n) : null;
};

/** Construit la mise à jour autorisée de `profiles` à partir de l'entrée brute. */
function patchProfil(p: Record<string, unknown>): ProfilUpdate {
  const out: ProfilUpdate = {};
  if (typeof p.full_name === 'string') out.full_name = p.full_name.trim().slice(0, 80) || null;
  const nb = entier(p.nb_personnes, 1, 12); if (nb !== undefined) out.nb_personnes = nb;
  if (typeof p.objectif === 'string' && OBJECTIFS.includes(p.objectif)) out.objectif = p.objectif;
  if (typeof p.niveau_cuisine === 'string' && NIVEAUX.includes(p.niveau_cuisine)) out.niveau_cuisine = p.niveau_cuisine;
  const tms = entier(p.temps_max_semaine, 5, 600); if (tms !== undefined) out.temps_max_semaine = tms;
  const tmw = entier(p.temps_max_weekend, 5, 600); if (tmw !== undefined) out.temps_max_weekend = tmw;
  const cuis = texteListe(p.cuisines_preferees); if (cuis) out.cuisines_preferees = cuis;
  const bc = booleen(p.batch_cooking); if (bc !== undefined) out.batch_cooking = bc;
  const bcj = entier(p.batch_cooking_jour, 0, 6); if (bcj !== undefined) out.batch_cooking_jour = bcj;
  const eq = texteListe(p.equipements, 20); if (eq) out.equipements = eq;
  const ar = booleen(p.auto_restes); if (ar !== undefined) out.auto_restes = ar;
  if ('rythme_desserts' in p) out.rythme_desserts = validerRythmeDesserts(p.rythme_desserts);
  const et = booleen(p.emails_transactionnels); if (et !== undefined) out.emails_transactionnels = et;
  const us = booleen(p.utiliser_saison); if (us !== undefined) out.utiliser_saison = us;
  if ('calories_par_jour' in p) out.calories_par_jour = borne(p.calories_par_jour, BORNES.kcal);
  if (p.onboarding_complete === true) out.onboarding_complete = true;
  return out;
}

export async function POST(request: NextRequest) {
  const limited = await enforceRateLimit(request, { name: 'profil', limit: 30, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const { user } = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    const userLimited = await enforceUserRateLimit(request, user.id, { name: 'profil', limit: 30, windowMs: 60_000 });
    if (userLimited) return userLimited;

    const body = await request.json().catch(() => ({}));
    const admin = getSupabaseAdmin();

    // 1. Profil (liste blanche)
    if (body.profil && typeof body.profil === 'object') {
      const patch = patchProfil(body.profil);
      if (Object.keys(patch).length > 0) {
        const { error } = await admin.from('profiles').update(patch).eq('id', user.id);
        if (error) throw new Error(error.message);
      }
    }

    // 2. Profil corporel — non bloquant (colonnes 00030 éventuellement absentes)
    if (body.corps && typeof body.corps === 'object') {
      const c = body.corps as Record<string, unknown>;
      const { error } = await admin.from('profiles').update({
        sexe: c.sexe === 'homme' || c.sexe === 'femme' ? c.sexe : null,
        age: borne(c.age, BORNES.age),
        taille_cm: borne(c.taille_cm, BORNES.taille_cm),
        poids_kg: borne(c.poids_kg, BORNES.poids_kg),
      }).eq('id', user.id);
      if (error) console.warn('Profil corporel non enregistré :', error.message);
    }

    // 3. Allergies / détestés (familles d'aliments)
    if (body.exclusions && typeof body.exclusions === 'object') {
      await enregistrerExclusions(admin, user.id,
        texteListe(body.exclusions.allergies, 60) ?? [], texteListe(body.exclusions.detestes, 60) ?? []);
    }

    // 4. Régimes
    if (body.regimes && typeof body.regimes === 'object') {
      const liste = (texteListe(body.regimes.liste, 20) ?? []).filter(r => REGIMES.has(r));
      if (body.regimes.mode !== 'ajouter') {
        const { error } = await admin.from('user_diets').delete().eq('user_id', user.id);
        if (error) throw new Error(error.message);
      }
      if (liste.length > 0) {
        const { error } = await admin.from('user_diets').upsert(
          liste.map(regime => ({ user_id: user.id, regime })), { onConflict: 'user_id,regime' });
        if (error) throw new Error(error.message);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erreur profil:', error);
    return NextResponse.json({ error: publicErrorMessage(error) }, { status: 500 });
  }
}
