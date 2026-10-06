'use client';

import { gererPaywall } from '@/lib/paywall';
import { useState, useEffect, useCallback } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import {
  toRecetteResume, COLONNES_RECETTE_RESUME,
  type RecetteResumeEmbed, type WeeklyPlanEmbed,
} from '@/lib/db-rows';
import type { DayPlanResume } from '@/types';
import { JOURS_NOMS } from '@/lib/dates';

export interface WeekSummary {
  planId: number;
  semaineDebut: string;
  generatedAt: string;
  days: DayPlanResume[];
  recap: string;
  nbRepas: number;
  nbNonPlanifies: number;
  hasShoppingList: boolean;
}

/** Liste toutes les semaines (passées + futures) avec leurs repas */
export function usePlanningHistory() {
  const [weeks, setWeeks] = useState<WeekSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [regeneratingWeek, setRegeneratingWeek] = useState<string | null>(null);
  const [error, setError] = useState('');

  const supabase = createBrowserClient();

  const loadWeeks = useCallback(async () => {
    setLoading(true);
    setError('');

    const { data: plans, error: plansError } = await supabase
      .from('weekly_plans')
      // `COLONNES_RECETTE_RESUME` et non `*` : cette requête charge TOUTES les
      // semaines enregistrées, et la vue n'affiche qu'une ligne par repas
      // (titre, temps, calories). Les instructions de chaque repas de chaque
      // semaine étaient donc téléchargées pour rien.
      .select(`id, semaine_debut, generated_at, plan_meals(jour_semaine, repas_type, meal_id, meals!plan_meals_meal_id_fkey(${COLONNES_RECETTE_RESUME}))`)
      .order('semaine_debut', { ascending: true });

    if (plansError) {
      setError(plansError.message);
      setLoading(false);
      return;
    }


    const summaries: WeekSummary[] = ((plans || []) as unknown as WeeklyPlanEmbed[]).map(plan => {
      const builtDays: DayPlanResume[] = JOURS_NOMS.map((jour, idx) => ({
        jour,
        jourIndex: idx,
        dejeuner: null,
        diner: null,
        dessert: null,
        dessertMidi: null,
      }));

      const pmList = plan.plan_meals || [];
      for (const pm of pmList) {
        const meal = pm.meals ? toRecetteResume(pm.meals as unknown as RecetteResumeEmbed) : null;
        if (pm.jour_semaine >= 0 && pm.jour_semaine <= 6) {
          if (pm.repas_type === 'dejeuner') builtDays[pm.jour_semaine].dejeuner = meal;
          else if (pm.repas_type === 'diner') builtDays[pm.jour_semaine].diner = meal;
          else if (pm.repas_type === 'dessert') builtDays[pm.jour_semaine].dessert = meal;
          else if (pm.repas_type === 'dessert_midi') builtDays[pm.jour_semaine].dessertMidi = meal;
        }
      }

      // Desserts comptés à part : nbRepas = repas principaux + desserts (midi + soir)
      const nbRepas = builtDays.reduce((sum, d) =>
        sum + (d.dejeuner ? 1 : 0) + (d.diner ? 1 : 0) + (d.dessert ? 1 : 0) + (d.dessertMidi ? 1 : 0), 0);
      const nbNonPlanifies = 14 - builtDays.reduce((sum, d) => sum + (d.dejeuner ? 1 : 0) + (d.diner ? 1 : 0), 0);

      // Mini récap : 3 premiers repas
      const mealNames: string[] = [];
      for (const d of builtDays) {
        if (d.dejeuner) mealNames.push(d.dejeuner.titre);
        if (d.diner) mealNames.push(d.diner.titre);
      }
      const recap = mealNames.length === 0
        ? 'Aucun repas'
        : mealNames.slice(0, 4).join(', ') + (mealNames.length > 4 ? ` +${mealNames.length - 4} repas` : '');

      return {
        planId: plan.id,
        semaineDebut: plan.semaine_debut,
        generatedAt: plan.generated_at,
        days: builtDays,
        recap,
        nbRepas,
        nbNonPlanifies,
        hasShoppingList: false, // sera vérifié plus bas
      };
    });

    setWeeks(summaries);
    setLoading(false);
  }, [supabase]);

  // Chargement initial (IIFE async : setState tous après le premier await)
  useEffect(() => {
    void (async () => { await loadWeeks(); })();
  }, [loadWeeks]);

  /** Régénérer une semaine spécifique */
  const regenerateWeek = async (semaineDebut: string) => {
    setRegeneratingWeek(semaineDebut);
    setError('');

    try {
      const res = await fetch('/api/generate-week', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ semaine_debut: semaineDebut }),
      });

      if (await gererPaywall(res)) return;
      if (!res.ok) {
        const { error: apiError } = await res.json();
        throw new Error(apiError || `Erreur ${res.status}`);
      }

      await loadWeeks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la régénération');
    } finally {
      setRegeneratingWeek(null);
    }
  };

  return { weeks, loading, regeneratingWeek, error, regenerateWeek, reload: loadWeeks };
}