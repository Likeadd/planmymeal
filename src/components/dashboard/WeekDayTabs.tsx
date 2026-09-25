'use client';

// ============================================================================
// WeekDayTabs — vue mobile (< md) du planning : onglets de jours « LUN 7 »,
// « MAR 8 »… et liste verticale fluide des repas du jour sélectionné.
// Remplace la grille horizontale (WeekColumns est réservée au ≥ md).
// Les cartes du jour réutilisent MealCard → toutes les actions restent
// accessibles sur mobile (swap, régénérer, cuisiné/sauté, restes).
// Charte : jour actif = terracotta, aujourd'hui = pastille terracotta,
// batch = lavande, restes = sable. Barre de jours : grille 7 colonnes qui tient
// dans l'écran (dès 320px) — aucun jour coupé, aucun défilement horizontal.
// ============================================================================

import { useRef, useState } from 'react';
import Link from 'next/link';
import { Package } from 'lucide-react';
import type { DayPlan, RecettePlanning, RepasSlot } from '@/types';
import { formatMinutes, cn, titreMajuscules } from '@/lib/utils';
import { useAuth } from '@/components/AuthProvider';
import { useTodayIndex } from '@/lib/useTodayIndex';
import { MealCard } from '@/components/dashboard/MealCard';

export function WeekDayTabs({
  days, semaineDebut, estSemaineCourante, mealStatuses, regeneratingSlots,
  onDragStart, onDrop, onMarkStatus, onSwap, onRegenerate, onToggleRestes, restesToggling,
}: {
  days: DayPlan[];
  /** Lundi de la semaine affichée (YYYY-MM-DD) → numéros de jours réels */
  semaineDebut: string;
  /** true = la semaine affichée est la semaine en cours (badge « Aujourd'hui ») */
  estSemaineCourante: boolean;
  mealStatuses: Record<number, string>;
  regeneratingSlots: Record<string, boolean>;
  onDragStart: (e: React.DragEvent, dayIndex: number, repas: RepasSlot) => void;
  onDrop: (e: React.DragEvent, toDay: number, toType: RepasSlot) => void;
  onMarkStatus: (mealId: number, status: 'cooked' | 'skipped') => void;
  onSwap: (dayIndex: number, repas: RepasSlot) => void;
  onRegenerate: (dayIndex: number, repas: RepasSlot) => void;
  onToggleRestes: (jourDiner: number) => void;
  restesToggling: number | null;
}) {
  // Jour sélectionné : aujourd'hui si la semaine courante, sinon lundi.
  // Sélection pilotée par index (0-6) : stable d'une semaine à l'autre.
  //
  // Le jour courant vient de useTodayIndex (fuseau Paris, sentinelle -1 au SSR).
  // On ne fige donc PAS le jour dans un useState : pendant l'hydratation la
  // valeur vaut -1 et l'initialisation retomberait sur lundi pour de bon.
  // `selectedOverride` mémorise le clic de l'utilisateur, sinon on suit le jour.
  const todayIndex = useTodayIndex();
  const [selectedOverride, setSelectedOverride] = useState<number | null>(null);
  const selectedIndex = selectedOverride ?? (estSemaineCourante && todayIndex >= 0 ? todayIndex : 0);
  // État batch (même source de vérité que WeekColumns : le profil)
  // — appelé AVANT tout return conditionnel (règle des hooks).
  const { profile } = useAuth();

  // Balayage horizontal sur la liste du jour → jour précédent / suivant.
  // Geste retenu seulement s'il est franchement horizontal (le scroll
  // vertical de la page reste intact) et hors champs de saisie / zones
  // qui défilent elles-mêmes horizontalement.
  const toucheDebut = useRef<{ x: number; y: number } | null>(null);
  const SEUIL_BALAYAGE_PX = 60;
  const onTouchStart = (e: React.TouchEvent) => {
    const cible = e.target as HTMLElement;
    if (cible.closest('input, textarea, select, [data-no-swipe], .overflow-x-auto')) {
      toucheDebut.current = null;
      return;
    }
    toucheDebut.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const debut = toucheDebut.current;
    toucheDebut.current = null;
    if (!debut) return;
    const dx = e.changedTouches[0].clientX - debut.x;
    const dy = e.changedTouches[0].clientY - debut.y;
    if (Math.abs(dx) < SEUIL_BALAYAGE_PX || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    setSelectedOverride(i => {
      const courant = i ?? selectedIndex;
      return dx < 0 ? Math.min(days.length - 1, courant + 1) : Math.max(0, courant - 1);
    });
  };

  // Bornage : la semaine change (nav ← →) → l'index reste valide (0-6).
  const day = days[selectedIndex] ?? days[0];
  if (!day) return null;

  const repasDuJour = [day.dejeuner, day.diner, day.dessert, day.dessertMidi].filter(Boolean) as RecettePlanning[];
  const minutesDuJour = repasDuJour.reduce((s, m) => s + m.temps_preparation + (m.temps_cuisson || 0), 0);

  const batchActive = profile?.batch_cooking === true;
  const batchJour = profile?.batch_cooking_jour ?? 6;
  const batchCovered = batchActive ? [batchJour, (batchJour + 1) % 7, (batchJour + 2) % 7, (batchJour + 3) % 7] : [];
  const isBatchSource = batchActive && day.jourIndex === batchJour;
  const isBatchDay = batchActive && batchCovered.includes(day.jourIndex) && !isBatchSource;
  const sourceDiner = day.restesDe != null ? days[day.jourIndex - 1]?.diner : null;

  return (
    <div className="lg:hidden">
      {/* ── Barre de jours : 7 colonnes égales, toujours entièrement visibles ── */}
      <div role="tablist" aria-label="Jours de la semaine" className="grid grid-cols-7 gap-1 min-[400px]:gap-1.5 sm:gap-2 py-1.5">
        {days.map((d, i) => {
          const estAujourdhui = estSemaineCourante && todayIndex === d.jourIndex;
          const selected = i === selectedIndex;
          const estJourBatchTab = batchActive && d.jourIndex === batchJour;
          return (
            <button key={d.jour} role="tab" aria-selected={selected}
              onClick={() => setSelectedOverride(i)}
              className={cn(
                'flex flex-col items-center gap-1 px-0.5 py-2.5 sm:py-3 rounded-2xl border min-w-0 transition-all',
                selected
                  ? 'bg-brand-500 border-brand-500 text-white shadow-cta'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-brand-200',
              )}>
              <span className={cn('text-[11px] font-bold uppercase tracking-[0.08em]', selected ? 'text-white/85' : 'text-gray-500')}>
                {d.jour.slice(0, 3)}
              </span>
              {/* Chiffre du jour en sans-serif (audit #21 : données lisibles) */}
              <span className="font-bold text-lg min-[400px]:text-xl leading-none tabular-nums">
                {jourDuMois(semaineDebut, d.jourIndex)}
              </span>
              {estJourBatchTab && <span aria-hidden>🍳</span>}
              {estAujourdhui && (
                <span className={cn('text-[11px] font-bold uppercase tracking-wide rounded-full px-1.5',
                  selected ? 'bg-white/25 text-white' : 'bg-brand-100 text-brand-600')}>
                  Auj.
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Liste verticale fluide du jour sélectionné ───────────────── */}
      <div role="tabpanel" className="mt-5 touch-pan-y" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div className="flex items-center justify-between mb-3 gap-3">
          <h3 className="font-display font-bold text-2xl text-gray-900 truncate">{day.jour}</h3>
          <span className="text-xs font-semibold tracking-[0.14em] uppercase text-gray-500 flex-shrink-0">
            {repasDuJour.length} repas · {formatMinutes(minutesDuJour)}
          </span>
        </div>

        {/* Bandeaux contexte du jour : batch (lavande) / restes (sable) */}
        {isBatchSource && (
          <div className="mb-3 flex items-center gap-2 rounded-xl bg-accent-100 border border-accent-200 px-3.5 py-2.5 text-[13px] font-semibold text-accent-700">
            <Package className="w-3.5 h-3.5" /> Session batch cooking — vous cuisinez pour 4 jours
          </div>
        )}
        {isBatchDay && (
          <div className="mb-3 flex items-center gap-2 rounded-xl bg-accent-50 border border-accent-200 px-3.5 py-2.5 text-[13px] font-semibold text-accent-600">
            🍱 Repas déjà cuisinés lors de la session batch
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {([
            { repas: 'Déjeuner', slot: 'dejeuner' as RepasSlot, meal: day.dejeuner, restesDe: day.restesDe ?? null },
            { repas: 'Dessert midi', slot: 'dessert_midi' as RepasSlot, meal: day.dessertMidi, restesDe: null },
            { repas: 'Dîner', slot: 'diner' as RepasSlot, meal: day.diner, restesDe: null },
            { repas: 'Dessert', slot: 'dessert' as RepasSlot, meal: day.dessert, restesDe: null },
          ]).map(({ repas, slot, meal, restesDe }) => (
            <MealCard key={slot} repas={repas} meal={meal} status={meal ? mealStatuses[meal.id] : null}
              slot={slot} jourIndex={day.jourIndex}
              restesDe={restesDe} sourceTitre={sourceDiner ? titreMajuscules(sourceDiner.titre) : null}
              regenerating={!!regeneratingSlots[`${day.jourIndex}-${slot}`]}
              onDragStart={e => onDragStart(e, day.jourIndex, slot)}
              onDrop={e => onDrop(e, day.jourIndex, slot)}
              onMarkStatus={onMarkStatus}
              onSwap={() => onSwap(day.jourIndex, slot)}
              onRegenerate={() => onRegenerate(day.jourIndex, slot)}
              onToggleRestes={slot === 'diner' && day.jourIndex <= 5 ? () => onToggleRestes(day.jourIndex) : undefined}
              restesToggling={restesToggling === day.jourIndex}
              resteActifPourDemain={day.restesDe != null} />
          ))}
        </div>

        {/* Rappel discret : les créneaux vides du jour sont gérables via « + Ajouter » */}
        {repasDuJour.length === 0 && (
          <p className="mt-4 text-center text-sm text-gray-500">
            Aucun repas planifié ce jour — utilisez <Link href="/dashboard" className="text-brand-600 underline underline-offset-2">le bouton Ajouter</Link> d&apos;un créneau.
          </p>
        )}
      </div>
    </div>
  );
}

/** Numéro réel du jour dans le mois : lundi (semaineDebut) + jourIndex */
function jourDuMois(semaineDebut: string, jourIndex: number): string {
  const d = new Date(`${semaineDebut}T12:00:00`);
  d.setDate(d.getDate() + jourIndex);
  return String(d.getDate());
}
