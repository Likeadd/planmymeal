'use client';

// ============================================================================
// Cache local du catalogue de recettes — PlanMyMeal
//
// /recettes télécharge ~900 ko (1 138 recettes + ingrédients) à chaque visite.
// Le catalogue public change rarement : on le stocke dans localStorage et la
// page s'affiche INSTANTANÉMENT sur le cache, puis se rafraîchit en arrière-
// plan si le cache a plus d'une heure (stale-while-revalidate).
//
// Même philosophie que `offline-cache.ts` : le cache est un filet UX, la DB
// reste maître. Clé versionnée : changer la forme des lignes = changer la
// clé, jamais migrer des données dont on ne connaît pas le lecteur.
//
// Forme COMPACTE (v4) : à 5 000 recettes, les lignes brutes pèsent ~10 Mo
// (chaque ingrédient répété dans chaque recette) et dépassaient le quota de
// localStorage — le cache échouait en silence. On stocke chaque ingrédient
// une seule fois, et les recettes n'en gardent que l'id (≈ 2 Mo).
// ============================================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/../supabase/database.types';
import type { MealCatalogueEmbed, IngredientCarteRayon } from '@/lib/db-rows';
import { chargerCatalogue } from '@/lib/catalogue';

const CACHE_KEY = 'pmm:catalogue:v4'; // v4 : forme compacte (ingrédients dédoublonnés)
/** Anciennes clés : libérées pour rendre leur place au quota. */
const ANCIENNES_CLES = ['pmm:catalogue:v1', 'pmm:catalogue:v2', 'pmm:catalogue:v3'];
/** Au-delà, le cache est jugé périmé et revalidé en arrière-plan. */
const DUREE_FRAICHE = 60 * 60 * 1000; // 1 h

interface CatalogueCache {
  savedAt: number;
  rows: MealCatalogueEmbed[];
}

/** Ligne d'ingrédient compacte : [id ingrédient, quantité, unité, optionnel 0/1] */
type LigneCompacte = [number, number, string, 0 | 1];
type RecetteCompacte = Omit<MealCatalogueEmbed, 'meal_ingredients'> & { mi: LigneCompacte[] };
interface CacheCompact { savedAt: number; ing: IngredientCarteRayon[]; rows: RecetteCompacte[] }

function compacter(rows: MealCatalogueEmbed[]): CacheCompact {
  const ing = new Map<number, IngredientCarteRayon>();
  const compactes = rows.map(({ meal_ingredients, ...meal }) => ({
    ...meal,
    mi: (meal_ingredients ?? []).flatMap((l): LigneCompacte[] => {
      if (!l.ingredients) return [];
      ing.set(l.ingredients.id, l.ingredients);
      return [[l.ingredients.id, l.quantite, l.unite, l.est_optionnel ? 1 : 0]];
    }),
  }));
  return { savedAt: Date.now(), ing: [...ing.values()], rows: compactes };
}

function decompacter(c: CacheCompact): MealCatalogueEmbed[] {
  const ing = new Map(c.ing.map(i => [i.id, i]));
  return c.rows.map(({ mi, ...meal }) => ({
    ...meal,
    meal_ingredients: mi.map(([id, quantite, unite, opt]) => ({
      quantite, unite, est_optionnel: opt === 1, ingredients: ing.get(id) ?? null,
    })),
  }));
}

/** Requête en cours, partagée par tous les appelants (page, préchauffage). */
let enCours: Promise<MealCatalogueEmbed[]> | null = null;

function lireCache(): CatalogueCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheCompact;
    if (typeof parsed.savedAt !== 'number' || !Array.isArray(parsed.rows) || !Array.isArray(parsed.ing)) return null;
    return { savedAt: parsed.savedAt, rows: decompacter(parsed) };
  } catch {
    return null;
  }
}

function ecrireCache(rows: MealCatalogueEmbed[]): void {
  try {
    for (const cle of ANCIENNES_CLES) localStorage.removeItem(cle);
    localStorage.setItem(CACHE_KEY, JSON.stringify(compacter(rows)));
  } catch {
    // quota dépassé / mode privé → le mode réseau reste fonctionnel
  }
}

/**
 * Démarre le chargement si nécessaire et renvoie la promesse partagée.
 * Idempotent : appelé depuis le dashboard ET depuis /recettes, une seule
 * requête part. Cache frais (moins d'une heure) → ne part pas du tout.
 */
function prefetchCatalogue(
  supabase: SupabaseClient<Database>
): Promise<MealCatalogueEmbed[]> {
  if (enCours) return enCours;
  const cache = lireCache();
  if (cache && Date.now() - cache.savedAt < DUREE_FRAICHE) return Promise.resolve(cache.rows);

  enCours = chargerCatalogue(supabase)
    .then(rows => {
      ecrireCache(rows);
      return rows;
    })
    .finally(() => {
      enCours = null;
    });
  return enCours;
}

export interface CatalogueCharge {
  rows: MealCatalogueEmbed[];
  /** true = rendu depuis le cache local (réseau pas encore consulté) */
  depuisCache: boolean;
  /**
   * Revalidation en arrière-plan (cache périmé seulement) : la page peut
   * rendre tout de suite puis remplacer ses données quand elle aboutit.
   */
  revalidation: Promise<MealCatalogueEmbed[]> | null;
}

/**
 * Charge le catalogue : cache d'abord (rendu instantané), réseau ensuite
 * si le cache a plus d'une heure. Cache périmé + réseau en échec → repli
 * silencieux sur le cache (mode hors ligne). Pas de cache + réseau en échec
 * → l'erreur remonte à la page.
 */
export async function chargerCatalogueCached(
  supabase: SupabaseClient<Database>
): Promise<CatalogueCharge> {
  const cache = lireCache();
  if (cache && Date.now() - cache.savedAt < DUREE_FRAICHE) {
    return { rows: cache.rows, depuisCache: true, revalidation: null };
  }

  const revalidation = prefetchCatalogue(supabase);
  if (cache) {
    // Stale-while-revalidate : rendu immédiat sur le cache périmé, mise à
    // jour silencieuse ensuite (un échec réseau ne doit rien casser).
    return { rows: cache.rows, depuisCache: true, revalidation: revalidation.catch(() => cache.rows) };
  }
  return { rows: await revalidation, depuisCache: false, revalidation: null };
}

/**
 * Préchauffage silencieux : ne part QUE si aucun cache n'existe encore (jamais
 * de double téléchargement pour un cache simplement périmé — la page le
 * revalidera elle-même). À appeler au repos depuis les pages hubs.
 */
export function prechaufferCatalogue(supabase: SupabaseClient<Database>): void {
  if (lireCache() || enCours) return;
  prefetchCatalogue(supabase).catch(() => {
    // préchauffage best effort : /recettes retentera à la navigation
  });
}
