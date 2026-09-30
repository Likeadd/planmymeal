'use client';

import { useState, useEffect, useCallback } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { toRecetteFavori, COLONNES_RECETTE_FAVORI, type RecetteFavoriEmbed } from '@/lib/db-rows';
import { getMonday } from '@/lib/dates';
import { errorMessage } from '@/lib/utils';
import type { RecetteFavori, RepasSlot } from '@/types';

interface UseFavoritesResult {
  favorites: RecetteFavori[];
  loading: boolean;
  error: string;
  /** Ajoute un repas à un jour/créneau du planning (via le serveur) */
  addToPlanning: (mealId: number, jourSemaine: number, repasType: RepasSlot, semaineDebut?: string) => Promise<void>;
  /** Retire la recette des favoris */
  removeFavorite: (mealId: number) => Promise<void>;
  adding: number | null; // meal_id en cours d'ajout
}

export function useFavorites(): UseFavoritesResult {
  const [favorites, setFavorites] = useState<RecetteFavori[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState<number | null>(null);

  const supabase = createBrowserClient();

  const loadFavorites = useCallback(async () => {
    // NB : le premier setState est après le premier await (pas de setState
    // synchrone dans l'effet de chargement initial)
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data: history, error: histError } = await supabase
      .from('meal_history')
      .select('meal_id')
      .eq('user_id', user.id)
      .eq('status', 'liked');

    if (histError) {
      setError(histError.message);
      setLoading(false);
      return;
    }

    const mealIds = [...new Set((history || []).map(h => h.meal_id))].filter((id): id is number => id != null);

    if (mealIds.length === 0) {
      setFavorites([]);
      setLoading(false);
      return;
    }

    // `COLONNES_RECETTE_FAVORI` et non `*` : la carte des favoris affiche le
    // titre, le type, la cuisine, les temps, les calories, la difficulté et la
    // conservation — ni `instructions`, ni l'image, ni les macros détaillées.
    // `meal_ingredients` reste indispensable : les pastilles du foyer lisent
    // `meal.ingredients` (sans l'embed, elles ignoreraient ce qu'un membre
    // n'aime pas et afficheraient une couleur différente de celle du planning).
    const { data: meals, error: mealsError } = await supabase
      .from('meals')
      .select(COLONNES_RECETTE_FAVORI)
      .in('id', mealIds);

    if (mealsError) {
      setError(mealsError.message);
    } else {
      setFavorites(((meals || []) as unknown as RecetteFavoriEmbed[]).map(toRecetteFavori));
    }

    setLoading(false);
  }, [supabase]);

  // Chargement initial (IIFE async : setState tous après le premier await)
  useEffect(() => {
    void (async () => { await loadFavorites(); })();
  }, [loadFavorites]);

  /** Placer un favori sur un créneau via l'API serveur (/api/swap-meal) : la
   *  liste de courses et le budget sont recalculés, les règles de créneau
   *  (dessert ↔ créneau dessert) appliquées côté serveur. */
  const addToPlanning = async (mealId: number, jourSemaine: number, repasType: RepasSlot, semaineDebut = getMonday()) => {
    setAdding(mealId);
    try {
      const res = await fetch('/api/swap-meal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ semaine_debut: semaineDebut, jour_semaine: jourSemaine, repas_type: repasType, meal_id: mealId }),
      });
      if (!res.ok) {
        const { error: apiError } = await res.json().catch(() => ({ error: `Erreur ${res.status}` }));
        throw new Error(apiError || `Erreur ${res.status}`);
      }
    } catch (err) {
      throw new Error(errorMessage(err, 'Erreur lors de l\'ajout'));
    } finally {
      setAdding(null);
    }
  };

  /** Retirer une recette des favoris (efface l'avis côté serveur) */
  const removeFavorite = async (mealId: number) => {
    const res = await fetch('/api/favori', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meal_id: mealId, avis: null }),
    });
    if (!res.ok) throw new Error("Impossible de retirer ce favori");
    setFavorites(prev => prev.filter(f => f.id !== mealId));
  };

  return { favorites, loading, error, addToPlanning, removeFavorite, adding };
}