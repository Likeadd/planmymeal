// ============================================================================
// API Déplacement d'un repas (drag & drop du planning)
//
// POST /api/move-meal
// { semaine_debut, from: { jour, repas }, to: { jour, repas } }
//
// Serveur-side pour les mêmes raisons que /api/swap-meal :
//   1. la logique métier (permutation des deux créneaux, rupture du lien
//      « reste » du plat déplacé) vit dans le serveur — elle était dupliquée
//      côté navigateur (useWeeklyPlan.moveMeal), où toute divergence entre
//      deux implémentations aurait passé les listes de courses en eau trouble ;
//   2. la liste de courses est recalculée (RPC transactionnelle) et le
//      snapshot budget rafraîchi — un déplacement change les achats ;
//   3. le client ne peut pas déplacer un repas vers le planning d'un autre
//      utilisateur (le plan est résolu depuis la session, pas depuis le body).
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { semaineOuLundi } from '@/lib/dates';
import { publicErrorMessage } from '@/lib/utils';
import { enforceRateLimit, enforceUserRateLimit } from '@/lib/rate-limit';
import { recomputeShoppingList, snapshotBudget } from '@/lib/rotation-engine';
import type { RepasSlot } from '@/types';

const SLOTS_VALIDES = ['dejeuner', 'diner', 'dessert', 'dessert_midi'];

interface Creneau {
  jour: number;
  repas: RepasSlot;
}

/** Valide { jour, repas } venu du body. null si invalide. */
function parserCreneau(raw: unknown): Creneau | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const c = raw as { jour?: unknown; repas?: unknown };
  const jour = Number(c.jour);
  if (!Number.isInteger(jour) || jour < 0 || jour > 6) return null;
  if (typeof c.repas !== 'string' || !SLOTS_VALIDES.includes(c.repas)) return null;
  return { jour, repas: c.repas as RepasSlot };
}

export async function POST(request: NextRequest) {
  // Anti-abus : un drag & drop est un geste utilisateur, pas une boucle
  const limited = await enforceRateLimit(request, { name: 'move-meal', limit: 60, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const { user } = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    const userLimited = await enforceUserRateLimit(request, user.id, { name: 'move-meal', limit: 60, windowMs: 60_000 });
    if (userLimited) return userLimited;

    const body = await request.json().catch(() => ({}));
    const from = parserCreneau(body.from);
    const to = parserCreneau(body.to);
    if (!from || !to) {
      return NextResponse.json(
        { error: 'Créneau invalide (jour 0–6, repas dejeuner|diner|dessert|dessert_midi)' },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();
    const semaine_debut: string = semaineOuLundi(body.semaine_debut);

    // Le plan de la semaine doit exister — résolu depuis la SESSION
    const { data: plan } = await admin.from('weekly_plans')
      .select('id').eq('user_id', user.id).eq('semaine_debut', semaine_debut).maybeSingle();
    if (!plan) {
      return NextResponse.json(
        { error: "Aucun planning pour cette semaine — générez d'abord la semaine" },
        { status: 404 }
      );
    }

    // Même créneau → no-op explicite (l'UI ne le propose pas, mais un
    // drag raté ou un appel direct peut le produire)
    if (from.jour === to.jour && from.repas === to.repas) {
      return NextResponse.json({ success: true, inchangé: true, semaine_debut });
    }

    // Créneau source : doit contenir un repas (rien à déplacer sinon)
    const { data: source } = await admin.from('plan_meals')
      .select('meal_id, texte_libre')
      .eq('plan_id', plan.id)
      .eq('jour_semaine', from.jour).eq('repas_type', from.repas)
      .maybeSingle();
    if (!source?.meal_id && !source?.texte_libre) {
      return NextResponse.json({ error: 'Le créneau source est vide' }, { status: 400 });
    }

    // Créneau cible : son repas (s'il existe) part vers la source (permutation)
    const { data: cible } = await admin.from('plan_meals')
      .select('meal_id, texte_libre')
      .eq('plan_id', plan.id)
      .eq('jour_semaine', to.jour).eq('repas_type', to.repas)
      .maybeSingle();

    // 1. La cible reçoit le repas déplacé (insert si le créneau n'existait pas)
    if (cible) {
      const { error } = await admin.from('plan_meals')
        .update({ meal_id: source.meal_id, texte_libre: source.texte_libre, est_reste_de: null })
        .eq('plan_id', plan.id).eq('jour_semaine', to.jour).eq('repas_type', to.repas);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await admin.from('plan_meals').insert({
        plan_id: plan.id, jour_semaine: to.jour,
        repas_type: to.repas, meal_id: source.meal_id, texte_libre: source.texte_libre, est_reste_de: null,
      });
      if (error) throw new Error(error.message);
    }

    // 2. La source reçoit l'ancien repas de la cible (ou se vide)
    const { error: srcError } = await admin.from('plan_meals')
      .update({ meal_id: cible?.meal_id ?? null, texte_libre: cible?.texte_libre ?? null, est_reste_de: null })
      .eq('plan_id', plan.id)
      .eq('jour_semaine', from.jour).eq('repas_type', from.repas);
    if (srcError) throw new Error(srcError.message);

    // 3. Un déplacement casse la relation « veille » : si le plat déplacé
    //    servait de source à un reste, on désactive le lien (l'utilisateur
    //    peut re-basculer le mode restes)
    if (source.meal_id) {
      const { error: resteError } = await admin.from('plan_meals')
        .update({ est_reste_de: null })
        .eq('plan_id', plan.id).eq('est_reste_de', source.meal_id);
      if (resteError) throw new Error(resteError.message);
    }

    // 4. Liste de courses recalculée (best-effort : le planning est déjà à jour)
    let shoppingListId: number | null = null;
    try {
      shoppingListId = await recomputeShoppingList(user.id, plan.id, admin);
    } catch (e) {
      console.error('Erreur recompute liste de courses (move):', e);
    }

    // 5. Snapshot budget rafraîchi (best-effort, ne fait jamais échouer le move)
    try {
      await snapshotBudget(user.id, semaine_debut, plan.id, admin);
    } catch { /* ignoré */ }

    return NextResponse.json({ success: true, shopping_list_id: shoppingListId, semaine_debut });
  } catch (error) {
    console.error('Erreur move meal:', error);
    return NextResponse.json({ error: publicErrorMessage(error) }, { status: 500 });
  }
}
