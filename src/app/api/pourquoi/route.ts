// ============================================================================
// API « Pourquoi ce repas ? » — PlanMyMeal
//
// GET ?meal_id=&jour=&repas=
//
// Renvoie les raisons RÉELLES du choix d'un créneau : note de l'utilisateur,
// fréquence souhaitée, ancienneté, frigo, temps disponible du jour, budget,
// saison… Le calcul vit dans lib/memoire.ts (expliquerChoix) et réutilise les
// mêmes fonctions que le moteur — impossible d'afficher une justification que
// la génération n'a pas utilisée.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { publicErrorMessage } from '@/lib/utils';
import { toRecetteMoteur, COLONNES_RECETTE_MOTEUR, type RecetteMoteurEmbed } from '@/lib/db-rows';
import { chargerContexteExplication, expliquerChoix } from '@/lib/memoire';
import type { RepasSlot } from '@/types';
import { enforceUserRateLimit } from '@/lib/rate-limit';

const REPAS_VALIDES: RepasSlot[] = ['dejeuner', 'diner', 'dessert', 'dessert_midi'];

export async function GET(request: NextRequest) {
  try {
    const { user } = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    const userLimited = enforceUserRateLimit(request, user.id, { name: 'pourquoi-get', limit: 120, windowMs: 60_000 });
    if (userLimited) return userLimited;

    const params = request.nextUrl.searchParams;
    const mealId = Number(params.get('meal_id'));
    const jour = Number(params.get('jour'));
    const repas = params.get('repas') as RepasSlot | null;

    if (!Number.isInteger(mealId) || mealId <= 0) {
      return NextResponse.json({ error: 'meal_id invalide' }, { status: 400 });
    }
    if (!Number.isInteger(jour) || jour < 0 || jour > 6) {
      return NextResponse.json({ error: 'jour invalide' }, { status: 400 });
    }
    if (!repas || !REPAS_VALIDES.includes(repas)) {
      return NextResponse.json({ error: 'Créneau invalide' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    // Exactement les colonnes que le moteur a lues pour choisir ce repas :
    // l'explication ne peut donc pas s'appuyer sur une donnée que la décision
    // n'a pas utilisée (voir `RecetteMoteur`).
    const { data: mealRow } = await admin
      .from('meals')
      .select(COLONNES_RECETTE_MOTEUR)
      .eq('id', mealId)
      .maybeSingle();

    if (!mealRow) return NextResponse.json({ error: 'Recette introuvable' }, { status: 404 });

    const meal = toRecetteMoteur(mealRow as unknown as RecetteMoteurEmbed);
    const contexte = await chargerContexteExplication(user.id, meal, jour, repas, admin);
    const explication = expliquerChoix(meal, contexte);

    return NextResponse.json({
      meal_id: meal.id,
      titre: meal.titre,
      ...explication,
    });
  } catch (error) {
    console.error('Erreur GET /api/pourquoi:', error);
    return NextResponse.json({ error: publicErrorMessage(error) }, { status: 500 });
  }
}
