'use client';

import { useState, useEffect, useCallback } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { toRecetteFavori, COLONNES_RECETTE_FAVORI, type RecetteFavoriEmbed } from '@/lib/db-rows';
import { getMonday } from '@/lib/dates';
import { errorMessage } from '@/lib/utils';
import type { RecetteFavori } from '@/types';

interface UseFavoritesResult {
  favorites: RecetteFavori[];
  loading: boolean;
  error: string;
  /** Ajoute un repas à un jour/repas du planning courant */
  addToPlanning: (mealId: number, jourSemaine: number, repasType: 'dejeuner' | 'diner') => Promise<void>;
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

  /** Ajouter un repas aux favoris à un créneau du planning courant */
  const addToPlanning = async (mealId: number, jourSemaine: number, repasType: 'dejeuner' | 'diner') => {
    setAdding(mealId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non authentifié');

      const semaineDebut = getMonday();

      // Chercher ou créer le plan de la semaine courante
      let { data: plan } = await supabase
        .from('weekly_plans')
        .select('id')
        .eq('user_id', user.id)
        .eq('semaine_debut', semaineDebut)
        .eq('is_active', true)
        .single();

      if (!plan) {
        const { data: newPlan } = await supabase
          .from('weekly_plans')
          .insert({ user_id: user.id, semaine_debut: semaineDebut, is_active: true })
          .select('id')
          .single();
        plan = newPlan;
      }

      if (!plan) throw new Error('Impossible de créer/trouver le planning');

      // Upsert le repas dans le créneau (PK composite explicite)
      await supabase
        .from('plan_meals')
        .upsert(
          { plan_id: plan.id, jour_semaine: jourSemaine, repas_type: repasType, meal_id: mealId },
          { onConflict: 'plan_id,jour_semaine,repas_type' }
        );

    } catch (err) {
      throw new Error(errorMessage(err, 'Erreur lors de l\'ajout'));
    } finally {
      setAdding(null);
    }
  };

  return { favorites, loading, error, addToPlanning, adding };
}