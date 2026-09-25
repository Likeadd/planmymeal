'use client';

// ============================================================================
// Cache offline de la liste de courses — PlanMyMeal
// La donnée vient de Supabase ; hors ligne, on rejoue le dernier état connu
// depuis localStorage (clé par semaine). Les toggles cochés hors ligne sont
// mis en file et rejoués au retour du réseau.
// NB : ce cache est un filet de sécurité UX (consultation + coche), pas une
// source de vérité — la DB reste maître en cas de divergence.
// ============================================================================

export interface CachedWeek {
  /** jours du planning (Meal allégés) — JSON-sérialisables */
  days: unknown;
  sections: unknown;
  planId: number | null;
  shoppingListId: number | null;
  fallbackUtilise: boolean;
  cuisinesDiversifiees: string[];
  savedAt: number;
}

const weekKey = (semaineDebut: string) => `pmm:week:${semaineDebut}`;
const PENDING_KEY = 'pmm:pendingToggles';

export function saveCachedWeek(semaineDebut: string, data: Omit<CachedWeek, 'savedAt'>): void {
  try {
    localStorage.setItem(weekKey(semaineDebut), JSON.stringify({ ...data, savedAt: Date.now() }));
  } catch {
    // quota dépassé / mode privé → on ignore, le mode online reste fonctionnel
  }
}

export function loadCachedWeek(semaineDebut: string): CachedWeek | null {
  try {
    const raw = localStorage.getItem(weekKey(semaineDebut));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedWeek;
    // Pérémption : 30 jours (le planning d'il y a un mois n'a plus d'intérêt)
    if (Date.now() - parsed.savedAt > 30 * 24 * 3600 * 1000) {
      localStorage.removeItem(weekKey(semaineDebut));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export interface PendingToggle {
  listId: number;
  ingredientId: number;
  checked: boolean;
}

export function queuePendingToggle(t: PendingToggle): void {
  try {
    const pending = loadPendingToggles();
    // Dernier état gagne : on remplace un toggle identique (même item)
    const filtered = pending.filter(p => !(p.listId === t.listId && p.ingredientId === t.ingredientId));
    filtered.push(t);
    localStorage.setItem(PENDING_KEY, JSON.stringify(filtered));
  } catch { /* ignore */ }
}

export function loadPendingToggles(): PendingToggle[] {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    return raw ? (JSON.parse(raw) as PendingToggle[]) : [];
  } catch {
    return [];
  }
}

/** Remplace la file (après flush partiel : on ne garde que les échecs) */
export function replacePendingToggles(list: PendingToggle[]): void {
  try {
    if (list.length === 0) localStorage.removeItem(PENDING_KEY);
    else localStorage.setItem(PENDING_KEY, JSON.stringify(list));
  } catch { /* ignore */ }
}
