// ============================================================================
// API Profils famille — PlanMyMeal
//
// GET    → membres du foyer (+ leurs aliments et recettes) et poids_famille
// PUT    → enregistre un membre ENTIER (création si pas d'id) ou le poids global
// DELETE → supprime un membre (?membre_id=)
//
// Le PUT est un « remplacement complet » : l'écran envoie l'état final du membre,
// la RPC save_family_member (migration 00017) réécrit ses aliments et ses
// recettes dans la MÊME transaction. Sans cela, un échec entre le delete et
// l'insert laissait un membre sans aucune préférence — et un membre sans
// préférences fait retomber le compromis sur du neutre : le réglage semblait
// enregistré alors qu'il avait disparu.
//
// Effet de bord voulu : ajouter un membre ajuste `nb_personnes` (le foyer
// compte au moins ses membres + moi) et recalcule la liste de courses de la
// semaine en cours. Le nombre de portions et le panier ne peuvent pas diverger
// du nombre de convives — même logique que /api/foyer.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { recomputeShoppingList, snapshotBudget } from '@/lib/rotation-engine';
import { getMonday } from '@/lib/dates';
import { publicErrorMessage } from '@/lib/utils';
import { enforceRateLimit, enforceUserRateLimit } from '@/lib/rate-limit';
import {
  NB_MEMBRES_MAX, bornerPoids, bornerPoidsFamille, estRelationIngredient,
} from '@/lib/famille';
import type { RelationIngredient } from '@/types';

/** Ligne renvoyée par PostgREST avec les embeds nécessaires à l'affichage */
interface MembreRow {
  id: number;
  nom: string;
  emoji: string;
  poids: number;
  age: number | null;
  family_member_ingredients: { ingredient_id: number; relation: string; ingredients: { nom: string } | null }[] | null;
  family_member_meal_preferences: { meal_id: number; note: number | null; ne_plus_proposer: boolean; meals: { titre: string } | null }[] | null;
}

export async function GET(request: NextRequest) {
  try {
    const { user } = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    const userLimited = enforceUserRateLimit(request, user.id, { name: 'famille-get', limit: 120, windowMs: 60_000 });
    if (userLimited) return userLimited;

    const admin = getSupabaseAdmin();
    const [{ data: membres, error }, { data: profil }] = await Promise.all([
      admin
        .from('family_members')
        .select('id, nom, emoji, poids, age, family_member_ingredients(ingredient_id, relation, ingredients(nom)), family_member_meal_preferences(meal_id, note, ne_plus_proposer, meals(titre))')
        .eq('user_id', user.id)
        .order('id'),
      admin.from('profiles').select('poids_famille, nb_personnes').eq('id', user.id).maybeSingle(),
    ]);

    if (error) throw new Error(error.message);

    // Normalisation : les noms d'ingrédients et les titres de recettes
    // accompagnent les relations, sinon l'écran n'afficherait que des ids.
    const liste = ((membres ?? []) as unknown as MembreRow[]).map(m => ({
      id: m.id,
      nom: m.nom,
      emoji: m.emoji,
      poids: m.poids,
      age: m.age,
      aliments: (m.family_member_ingredients ?? []).map(a => ({
        ingredient_id: a.ingredient_id,
        relation: a.relation,
        nom: a.ingredients?.nom ?? `Ingrédient #${a.ingredient_id}`,
      })),
      recettes: (m.family_member_meal_preferences ?? []).map(r => ({
        meal_id: r.meal_id,
        note: r.note,
        ne_plus_proposer: r.ne_plus_proposer,
        titre: r.meals?.titre ?? `Recette #${r.meal_id}`,
      })),
    }));

    return NextResponse.json({
      membres: liste,
      poids_famille: profil?.poids_famille ?? 70,
      nb_personnes: profil?.nb_personnes ?? 2,
      max_membres: NB_MEMBRES_MAX,
    });
  } catch (error) {
    console.error('Erreur GET /api/famille:', error);
    return NextResponse.json({ error: publicErrorMessage(error) }, { status: 500 });
  }
}

/** Corps attendu pour un membre (remplacement complet) */
interface MembrePayload {
  id?: number;
  nom?: string;
  emoji?: string;
  poids?: number;
  age?: number | null;
  aliments?: { ingredient_id: number; relation: string }[];
  recettes?: { meal_id: number; note?: number | null; ne_plus_proposer?: boolean }[];
}

export async function PUT(request: NextRequest) {
  const limited = enforceRateLimit(request, { name: 'famille', limit: 40, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const { user } = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    const userLimited = enforceUserRateLimit(request, user.id, { name: 'famille', limit: 40, windowMs: 60_000 });
    if (userLimited) return userLimited;

    const body = await request.json().catch(() => ({} as Record<string, unknown>));
    const admin = getSupabaseAdmin();

    // ── Poids global du compromis familial ──
    if ('poids_famille' in body && body.membre === undefined) {
      const { error } = await admin.from('profiles')
        .update({ poids_famille: bornerPoidsFamille(body.poids_famille) })
        .eq('id', user.id);
      if (error) throw new Error(error.message);
      return NextResponse.json({ success: true, poids_famille: bornerPoidsFamille(body.poids_famille) });
    }

    // ── Membre ──
    const payload = body.membre as MembrePayload | undefined;
    if (!payload) {
      return NextResponse.json({ error: 'Aucune modification fournie' }, { status: 400 });
    }

    const nom = String(payload.nom ?? '').trim();
    if (nom.length < 1 || nom.length > 40) {
      return NextResponse.json({ error: 'Le prénom du membre est requis (1 à 40 caractères)' }, { status: 400 });
    }

    const membresExistants = await compterMembres(user.id);
    if (payload.id == null && membresExistants >= NB_MEMBRES_MAX) {
      return NextResponse.json(
        { error: `Un foyer se limite à ${NB_MEMBRES_MAX} membres` },
        { status: 400 }
      );
    }

    // Les aliments : relation connue + identifiant entier (les ids inconnus sont
    // ignorés côté SQL plutôt que de faire échouer tout l'enregistrement).
    const aliments = (payload.aliments ?? [])
      .filter(a => Number.isInteger(a.ingredient_id) && estRelationIngredient(a.relation))
      .map(a => ({ ingredient_id: a.ingredient_id, relation: a.relation as RelationIngredient }));

    const recettes = (payload.recettes ?? [])
      .filter(r => Number.isInteger(r.meal_id))
      .map(r => ({
        meal_id: r.meal_id,
        note: typeof r.note === 'number' && r.note >= 1 && r.note <= 5 ? Math.round(r.note) : null,
        ne_plus_proposer: r.ne_plus_proposer === true,
      }))
      .filter(r => r.note != null || r.ne_plus_proposer);

    const { data: membreId, error: rpcError } = await admin.rpc('save_family_member', {
      p_user_id: user.id,
      p_nom: nom,
      p_membre_id: payload.id ?? null,
      p_emoji: String(payload.emoji ?? '👤').slice(0, 8),
      p_poids: bornerPoids(payload.poids),
      p_age: typeof payload.age === 'number' ? Math.round(payload.age) : null,
      p_ingredients: aliments,
      p_preferences: recettes,
    });
    if (rpcError) throw new Error(rpcError.message);

    // ── Cohérence du foyer : au moins « les membres + moi » ──
    // On ne baisse JAMAIS nb_personnes automatiquement (l'utilisateur peut
    // cuisiner pour plus de convives que les membres enregistrés), on le relève
    // seulement s'il ne couvre plus le foyer déclaré.
    const nbMembres = await compterMembres(user.id);
    const { data: profil } = await admin
      .from('profiles').select('nb_personnes').eq('id', user.id).maybeSingle();
    const nbActuel = profil?.nb_personnes ?? 1;
    const nbCible = Math.max(nbActuel, nbMembres + 1);

    let listeRecalculee = false;
    if (nbCible !== nbActuel) {
      const { error: nbError } = await admin.from('profiles')
        .update({ nb_personnes: nbCible }).eq('id', user.id);
      if (nbError) throw new Error(nbError.message);

      const { data: plan } = await admin.from('weekly_plans')
        .select('id').eq('user_id', user.id).eq('semaine_debut', getMonday()).maybeSingle();
      if (plan) {
        await recomputeShoppingList(user.id, plan.id, admin);
        await snapshotBudget(user.id, getMonday(), plan.id, admin);
        listeRecalculee = true;
      }
    }

    return NextResponse.json({
      success: true,
      membre_id: membreId,
      nb_personnes: nbCible,
      liste_recalculee: listeRecalculee,
    });
  } catch (error) {
    console.error('Erreur PUT /api/famille:', error);
    return NextResponse.json({ error: publicErrorMessage(error) }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { user } = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    const userLimited = enforceUserRateLimit(request, user.id, { name: 'famille-delete', limit: 120, windowMs: 60_000 });
    if (userLimited) return userLimited;

    const membreId = Number(request.nextUrl.searchParams.get('membre_id'));
    if (!Number.isInteger(membreId) || membreId <= 0) {
      return NextResponse.json({ error: 'membre_id invalide' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    // Double condition : un id volé ne peut pas supprimer le membre d'un autre.
    const { error } = await admin.from('family_members')
      .delete().eq('id', membreId).eq('user_id', user.id);
    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, nb_membres: await compterMembres(user.id) });
  } catch (error) {
    console.error('Erreur DELETE /api/famille:', error);
    return NextResponse.json({ error: publicErrorMessage(error) }, { status: 500 });
  }
}

/** Nombre de membres du foyer (0 si la migration 00017 n'est pas appliquée) */
async function compterMembres(userId: string): Promise<number> {
  const { count, error } = await getSupabaseAdmin()
    .from('family_members')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  return error ? 0 : count ?? 0;
}
