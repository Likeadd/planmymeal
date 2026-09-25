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
// reste maître. Clé versionnée (`v1`) : changer la forme des lignes = changer
// la clé, jamais migrer des données dont on ne connaît pas le lecteur.
// ============================================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/../supabase/database.types';
import type { MealCatalogueEmbed } from '@/lib/db-rows';
import { chargerCatalogue } from '@/lib/catalogue';

const CACHE_KEY = 'pmm:catalogue:v1';
/** Au-delà, le cache est jugé périmé et revalidé en arrière-plan. */
const DUREE_FRAICHE = 60 * 60 * 1000; // 1 h

interface CatalogueCache {
  savedAt: number;
  rows: MealCatalogueEmbed[];
}

/** Requête en cours, partagée par tous les appelants (page, préchauffage). */
let enCours: Promise<MealCatalogueEmbed[]> | null = null;

function lireCache(): CatalogueCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CatalogueCache;
    if (typeof parsed.savedAt !== 'number' || !Array.isArray(parsed.rows)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function ecrireCache(rows: MealCatalogueEmbed[]): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), rows }));
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
