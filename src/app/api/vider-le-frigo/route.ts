// ============================================================================
// API Vider le frigo — anti-gaspillage
// POST { ingredient_ids: number[] } → top 3 recettes réalisables avec ce qu'on
// a déjà chez soi. Score : couverture des ingrédients (pondérée par le rôle :
// principal > assaisonnement), bonus usage d'un appareil possédé, bonus
// économie (recette déjà "payée" avec le frigo).
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { prixParPortion } from '@/lib/budget';
import { APPAREILS_CONNUES } from '@/lib/rotation-engine';
import { recetteServable } from '@/lib/regimes';
import { toRecetteFrigo } from '@/lib/db-rows';
import { chargerPlatsRapides } from '@/lib/vider-le-frigo';
import { publicErrorMessage } from '@/lib/utils';
import { enforceRateLimit, enforceUserRateLimit } from '@/lib/rate-limit';
import type { Regime } from '@/types';

/** Résultat scoré d'une recette « vider le frigo » */
interface FrigoCandidate {
  id: number;
  titre: string;
  image_url: string | null;
  temps_total: number;
  difficulte: string;
  cuisine: string | null;
  prix_portion: number | null;
  couverture: number;
  nb_manquants: number;
  manquants: (string | undefined)[];
  ustensiles: string[];
  score: number;
}


export async function POST(request: NextRequest) {
  // Anti-abus : score de tout le catalogue à chaque appel
  const limited = enforceRateLimit(request, { name: 'vider-le-frigo', limit: 15, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const { user } = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    const userLimited = enforceUserRateLimit(request, user.id, { name: 'vider-le-frigo', limit: 15, windowMs: 60_000 });
    if (userLimited) return userLimited;

    const body = await request.json().catch(() => ({}));
    const ingredientIds: number[] = Array.isArray(body.ingredient_ids)
      ? (body.ingredient_ids as unknown[]).map(x => Number(x)).filter(x => Number.isInteger(x))
      : [];
    if (ingredientIds.length === 0) {
      return NextResponse.json({ error: 'Sélectionnez au moins un ingrédient' }, { status: 400 });
    }
    if (ingredientIds.length > 15) {
      return NextResponse.json({ error: '15 ingrédients maximum' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    // 1. Recettes candidats (plats publics rapides) + leurs ingrédients
    // `select('*')` téléchargeait `instructions` (≈ 1 ko par recette, soit
    // ≈ 900 ko ici) pour un classement qui ne regarde que les temps, les
    // ustensiles, la cuisine et les ingrédients (voir `COLONNES_RECETTE_FRIGO`).
    // Le chargement pagine : voir `chargerPlatsRapides` (plafond PostgREST).
    const meals = await chargerPlatsRapides(admin);

    // 2. Allergies, dislikes & régimes du user (on n'empoisonne personne)
    const [{ data: allergies }, { data: dislikes }, { data: regimesData }, { data: profile }] = await Promise.all([
      admin.from('user_allergies').select('ingredient_id').eq('user_id', user.id),
      admin.from('user_dislikes').select('ingredient_id').eq('user_id', user.id),
      admin.from('user_diets').select('regime').eq('user_id', user.id),
      admin.from('profiles').select('equipements, nb_personnes, budget_hebdo').eq('id', user.id).single(),
    ]);
    const allergiesIds = new Set((allergies || []).map(a => a.ingredient_id));
    const dislikesIds = new Set((dislikes || []).map(d => d.ingredient_id));
    const regimes: Regime[] = (regimesData || []).map(r => r.regime as Regime);
    const frigo = new Set(ingredientIds);
    const equipements: string[] = profile?.equipements ?? [];
    const possede = (u: string) => equipements.some(e => u === e || u.startsWith(e));

    // 3. Scoring par couverture du frigo
    const candidats = meals
      .map((mRow): FrigoCandidate | null => {
        // Normaliser les ingrédients pour prixParPortion
        const meal = toRecetteFrigo(mRow);

        const obligatoires = (mRow.meal_ingredients || []).filter(mi => !mi.est_optionnel);
        if (obligatoires.length === 0) return null;

        // Exclusions dures : allergies, dislikes ET régimes
        const ids = obligatoires.map(mi => mi.ingredient_id);
        if (ids.some(id => allergiesIds.has(id))) return null;
        if (ids.filter(id => dislikesIds.has(id)).length > obligatoires.length * 0.5) return null;
        if (regimes.length > 0 && !recetteServable(
          obligatoires.map(mi => ({
            id: mi.ingredient_id,
            nom: mi.ingredients?.nom ?? '',
            rayon: mi.ingredients?.rayon ?? null,
            est_optionnel: false,
          })),
          regimes
        )) return null;

        // Couverture pondérée : un ingrédient "central" (viande, poisson…) pèse plus
        let couverts = 0, poidsTotale = 0;
        for (const mi of obligatoires) {
          const rayon: string = mi.ingredients?.rayon || 'epicerie_salee';
          const poids = rayon === 'viande_poisson' || rayon === 'frais' ? 2 : 1;
          poidsTotale += poids;
          if (frigo.has(mi.ingredient_id)) couverts += poids;
        }
        const couverture = couverts / poidsTotale;
        if (couverture === 0) return null;

        // Bonus équipement possédé, malus appareil manquant
        let bonusEquipement = 1;
        const specifiques: string[] = meal.ustensiles.filter(u =>
          APPAREILS_CONNUES.some(a => u === a || u.startsWith(a))
        );
        if (specifiques.length > 0 && equipements.length > 0) {
          const manquants = specifiques.filter((u: string) => !possede(u));
          if (manquants.length === 0) bonusEquipement = 1.2;
          else if (manquants.length === specifiques.length) bonusEquipement = 0.7;
        }

        const pp = prixParPortion(meal);
        const score = couverture * 100 * bonusEquipement;

        // Ingrédients manquants à acheter (affichage)
        const manquants = obligatoires
          .filter(mi => !frigo.has(mi.ingredient_id))
          .map(mi => mi.ingredients?.nom)
          .filter(Boolean);

        return {
          id: meal.id,
          titre: meal.titre,
          image_url: meal.image_url,
          temps_total: meal.temps_preparation + (meal.temps_cuisson || 0),
          difficulte: meal.difficulte,
          cuisine: meal.cuisine,
          prix_portion: pp,
          couverture: Math.round(couverture * 100),
          nb_manquants: manquants.length,
          manquants: manquants.slice(0, 4),
          ustensiles: meal.ustensiles.filter(u => specifiques.some(s => u === s || u.startsWith(s))),
          score,
        };
      })
      .filter((c): c is FrigoCandidate => c !== null)
      .sort((a, b) => b.score - a.score);

    // 4. Top 3 avec une variété de recettes (pas 3 fois la même base)
    const top3: FrigoCandidate[] = [];
    for (const c of candidats) {
      if (top3.length >= 3) break;
      top3.push(c);
    }

    return NextResponse.json({
      success: true,
      nb_analysees: candidats.length,
      recettes: top3,
    });
  } catch (error) {
    console.error('Erreur vider-le-frigo:', error);
    return NextResponse.json({ error: publicErrorMessage(error) }, { status: 500 });
  }
}
