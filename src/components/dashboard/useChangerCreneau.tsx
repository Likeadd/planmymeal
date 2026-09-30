'use client';

// ============================================================================
// useChangerCreneau — logique commune mobile / desktop du bouton « Changer » :
// ouvre ChangerSheet pour un créneau (jour + repas) et gère les modales
// secondaires (noter, pourquoi). Renvoie `ouvrir(jour, slot)` et l'élément à
// rendre une seule fois dans la vue.
// ============================================================================

import { useState } from 'react';
import { toast } from 'sonner';
import type { DayPlan, RecettePlanning, RepasSlot } from '@/types';
import { titreMajuscules, errorMessage } from '@/lib/utils';
import { useAuth } from '@/components/AuthProvider';
import { createBrowserClient } from '@/lib/supabase';
import { noterRepas } from '@/lib/memoire';
import { ChangerSheet } from '@/components/dashboard/ChangerSheet';
import { MealNotation } from '@/components/dashboard/MealNotation';
import { WhyModal } from '@/components/dashboard/WhyModal';

const LIBELLES: Record<RepasSlot, string> = {
  dejeuner: 'ce midi', diner: 'ce soir', dessert_midi: 'dessert du midi', dessert: 'dessert du soir',
};

export interface ActionsCreneau {
  onMarkStatus: (mealId: number, status: 'cooked' | 'skipped') => void;
  /** Ouvre la liste des recettes (SwapModal) */
  onSwap: (dayIndex: number, repas: RepasSlot) => void;
  onRegenerate: (dayIndex: number, repas: RepasSlot) => Promise<void>;
  onCustom: (dayIndex: number, repas: RepasSlot, texte: string) => Promise<void>;
  onVider: (dayIndex: number, repas: RepasSlot) => Promise<void>;
  onToggleRestes: (jourDiner: number) => void;
  restesToggling: number | null;
}

export function repasDuCreneau(day: DayPlan, slot: RepasSlot): RecettePlanning | null {
  return slot === 'dejeuner' ? day.dejeuner : slot === 'diner' ? day.diner : slot === 'dessert' ? day.dessert : day.dessertMidi;
}

export function useChangerCreneau(days: DayPlan[], a: ActionsCreneau) {
  const { user } = useAuth();
  const supabase = createBrowserClient();
  const [cible, setCible] = useState<{ jour: number; slot: RepasSlot } | null>(null);
  const [notation, setNotation] = useState<RecettePlanning | null>(null);
  const [pourquoi, setPourquoi] = useState<{ meal: RecettePlanning; jour: number; slot: RepasSlot } | null>(null);

  const ajouterFavori = async (meal: RecettePlanning) => {
    if (!user) return;
    try {
      await noterRepas(user.id, meal.id, 5, null, supabase);
      toast.success('Ajouté à vos favoris ❤️');
    } catch (e) {
      toast.error(errorMessage(e, "Impossible d'ajouter aux favoris"));
    }
  };

  const avecToast = (action: () => Promise<void>, ok: string) => async () => {
    try { await action(); toast.success(ok); } catch (e) { toast.error(errorMessage(e, 'Une erreur est survenue')); throw e; }
  };

  let sheet: React.ReactNode = null;
  const day = cible ? days[cible.jour] : null;
  if (cible && day) {
    const { jour, slot } = cible;
    const meal = repasDuCreneau(day, slot);
    const estReste = slot === 'dejeuner' && day.restesDe != null;
    const recette = meal && !meal.personnalise && !estReste;
    sheet = (
      <ChangerSheet
        libelleCreneau={LIBELLES[slot]}
        titreActuel={meal ? (estReste ? 'Restes de la veille' : meal.personnalise ? meal.titre : titreMajuscules(meal.titre)) : null}
        onClose={() => setCible(null)}
        onHasard={avecToast(() => a.onRegenerate(jour, slot), 'Nouveau repas ✓')}
        onChoisir={() => a.onSwap(jour, slot)}
        onEcrire={texte => avecToast(() => a.onCustom(jour, slot, texte), 'Repas enregistré ✓')()}
        onVider={meal ? avecToast(() => a.onVider(jour, slot), 'Créneau vidé') : undefined}
        secondaires={recette && meal ? [
          { emoji: '✅', label: "C'est fait", onClick: () => a.onMarkStatus(meal.id, 'cooked') },
          { emoji: '❤️', label: 'Favori', onClick: () => void ajouterFavori(meal) },
          { emoji: '⭐', label: 'Noter', onClick: () => setNotation(meal) },
          { emoji: '❓', label: 'Pourquoi ce repas ?', onClick: () => setPourquoi({ meal, jour, slot }) },
          ...(slot === 'diner' && jour <= 5 ? [{
            emoji: '🔁',
            label: days[jour + 1]?.restesDe != null ? 'Annuler les restes' : 'Cuisiner ×2 (restes demain)',
            onClick: () => a.onToggleRestes(jour),
          }] : []),
        ] : []}
      />
    );
  }

  const element = (
    <>
      {sheet}
      {notation && <MealNotation mealId={notation.id} titre={notation.titre} onClose={() => setNotation(null)} />}
      {pourquoi && (
        <WhyModal mealId={pourquoi.meal.id} titre={pourquoi.meal.titre} jour={pourquoi.jour} repas={pourquoi.slot}
          onClose={() => setPourquoi(null)} />
      )}
    </>
  );

  return { ouvrir: (jour: number, slot: RepasSlot) => setCible({ jour, slot }), element };
}
