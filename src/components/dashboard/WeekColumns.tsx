'use client';

// ============================================================================
// WeekColumns — vue semaine desktop (≥ lg) « la semaine en lignes » :
// une ligne par jour, midi à gauche, soir à droite. Chaque repas : titre
// (lien recette), temps · prix, « Voir la recette › » et UN bouton « Changer »
// (panneau à 4 choix, commun avec le mobile). Le dessert est une ligne simple
// sous le repas. Glisser-déposer conservé entre créneaux.
// ============================================================================

import Link from 'next/link';
import { CalendarDays, Loader2, Check } from 'lucide-react';
import type { DayPlan, RepasSlot } from '@/types';
import { formatMinutes, cn, titreRecette, emojiRecette } from '@/lib/utils';
import { formatPrix, prixParPortion } from '@/lib/budget';
import { recetteHref } from '@/lib/seo';
import { useTodayIndex } from '@/lib/useTodayIndex';
import { useAuth } from '@/components/AuthProvider';
import { FamilleBadges } from '@/components/dashboard/FamilleBadges';
import { FamilleLegendeInline } from '@/components/dashboard/FamilleLegende';
import { useChangerCreneau, repasDuCreneau, type ActionsCreneau } from '@/components/dashboard/useChangerCreneau';

export function WeekColumns({
  days, semaineDebut, dragOver, moving, mealStatuses, regeneratingSlots, onDragStart, onDragOver, onDragLeave, onDrop,
  estSemaineCourante, nbDesserts, ...actions
}: ActionsCreneau & {
  days: DayPlan[];
  nbDesserts?: number;
  /** Lundi de la semaine affichée (YYYY-MM-DD) */
  semaineDebut: string;
  /** Créneau survolé pendant un drag : clé "jourIndex-repas" */
  dragOver: string | null;
  moving: boolean;
  mealStatuses: Record<number, string>;
  regeneratingSlots: Record<string, boolean>;
  onDragStart: (e: React.DragEvent, dayIndex: number, repas: RepasSlot) => void;
  onDragOver: (e: React.DragEvent, dayIndex: number, repas?: RepasSlot) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, toDay: number, toType: RepasSlot) => void;
  estSemaineCourante: boolean;
}) {
  const todayIndex = useTodayIndex();
  const { profile } = useAuth();
  const batchJour = profile?.batch_cooking === true ? (profile?.batch_cooking_jour ?? 6) : null;
  const { ouvrir, element } = useChangerCreneau(days, actions);
  const desserts = nbDesserts ?? days.reduce((s, d) => s + (d.dessert ? 1 : 0) + (d.dessertMidi ? 1 : 0), 0);

  const cellule = (day: DayPlan, slot: 'dejeuner' | 'diner') => {
    const meal = repasDuCreneau(day, slot);
    const dessertSlot: RepasSlot = slot === 'dejeuner' ? 'dessert_midi' : 'dessert';
    const dessert = repasDuCreneau(day, dessertSlot);
    const soir = slot === 'diner';
    const estReste = slot === 'dejeuner' && day.restesDe != null;
    const sourceDiner = estReste ? days[day.jourIndex - 1]?.diner : null;
    const cle = `${day.jourIndex}-${slot}`;
    const chargement = !!regeneratingSlots[cle];
    const survol = dragOver === cle;
    const status = meal && !meal.personnalise ? mealStatuses[meal.id] : undefined;
    const prix = meal && !meal.personnalise && !estReste ? prixParPortion(meal) : null;
    const lien = meal && !meal.personnalise ? (estReste && day.restesDe ? `/recette/${day.restesDe}` : recetteHref(meal)) : null;
    const fond = !meal ? '' : meal.personnalise ? 'bg-accent-50' : estReste ? 'bg-sable-100' : soir ? 'bg-accent-100' : 'bg-brand-100';
    const couleurLien = soir ? 'text-accent-700' : 'text-brand-600';

    return (
      <div className="flex flex-col gap-2 min-w-0"
        onDragOver={e => onDragOver(e, day.jourIndex, slot)} onDragLeave={onDragLeave} onDrop={e => onDrop(e, day.jourIndex, slot)}>
        {!meal ? (
          <div className={cn('min-h-[88px] rounded-2xl border-2 border-dashed flex items-center justify-center transition-colors',
            survol ? 'border-brand-400 bg-brand-50' : 'border-gray-200')}>
            <button onClick={() => ouvrir(day.jourIndex, slot)}
              className="rounded-full border border-brand-200 bg-white px-5 py-2 text-sm font-semibold text-brand-600 hover:bg-brand-50 transition-colors">
              {survol ? 'Déposer ici' : '+ Ajouter un repas'}
            </button>
          </div>
        ) : (
          <div draggable={!moving} onDragStart={e => onDragStart(e, day.jourIndex, slot)}
            className={cn('relative min-h-[88px] flex items-stretch rounded-2xl border bg-white overflow-hidden transition-all',
              survol ? 'border-brand-400 ring-2 ring-brand-200' : 'border-gray-100 shadow-card hover:shadow-pop',
              status === 'cooked' && 'opacity-80')}>
            <div className={cn('w-16 shrink-0 flex items-center justify-center text-2xl', fond)} aria-hidden>
              {meal.personnalise ? '✏️' : estReste ? '🍱' : emojiRecette(meal.titre)}
            </div>
            <div className="flex-1 min-w-0 px-4 py-3 flex flex-col justify-center">
              {lien ? (
                <Link href={lien} className="font-bold text-[15px] text-gray-900 leading-snug line-clamp-2 hover:underline underline-offset-2">
                  {estReste ? `Restes de ${sourceDiner ? titreRecette(sourceDiner.titre) : 'la veille'}` : titreRecette(meal.titre)}
                </Link>
              ) : (
                <p className="font-bold text-[15px] text-gray-900 leading-snug line-clamp-2 break-words">{meal.titre}</p>
              )}
              <p className="mt-0.5 text-[13px] text-gray-500 truncate">
                {meal.personnalise ? 'Repas personnalisé'
                  : estReste ? 'À réchauffer'
                  : `${formatMinutes(meal.temps_preparation + (meal.temps_cuisson || 0))}${prix != null ? ` · ${formatPrix(prix)}` : ''}`}
                {status === 'cooked' && <span className="ml-2 inline-flex items-center gap-0.5 text-sauge-700 font-semibold"><Check className="w-3.5 h-3.5" /> fait</span>}
              </p>
              {lien && (
                <div className="mt-1 flex items-center gap-3 min-w-0">
                  <Link href={lien} className={cn('text-[12.5px] font-semibold hover:underline shrink-0', couleurLien)}>
                    Voir la recette ›
                  </Link>
                  {!estReste && <FamilleBadges meal={meal} compacte />}
                </div>
              )}
            </div>
            <div className="shrink-0 flex items-center pr-4">
              <button onClick={() => ouvrir(day.jourIndex, slot)}
                className="rounded-full bg-creme-100 border border-gray-200 px-5 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-100 transition-colors">
                Changer
              </button>
            </div>
            {chargement && (
              <div className="absolute inset-0 bg-white/70 flex items-center justify-center" aria-live="polite">
                <Loader2 className="w-6 h-6 text-brand-500 animate-spin" />
              </div>
            )}
          </div>
        )}

        {/* Dessert : ligne simple sous le repas */}
        <button onClick={() => ouvrir(day.jourIndex, dessertSlot)}
          onDragOver={e => { e.stopPropagation(); onDragOver(e, day.jourIndex, dessertSlot); }}
          onDrop={e => { e.stopPropagation(); onDrop(e, day.jourIndex, dessertSlot); }}
          className={cn('flex items-center justify-between gap-3 rounded-xl px-3.5 py-1.5 text-left text-[12.5px] transition-colors',
            dessert ? 'bg-sauge-50 text-sauge-800 hover:bg-sauge-100' : 'text-gray-400 hover:text-sauge-700 hover:bg-sauge-50',
            dragOver === `${day.jourIndex}-${dessertSlot}` && 'ring-2 ring-sauge-300')}>
          <span className="min-w-0 truncate">
            🍰 {dessert ? <>Dessert : <strong>{dessert.personnalise ? dessert.titre : titreRecette(dessert.titre)}</strong></> : 'Ajouter un dessert'}
          </span>
          {dessert && <span className="shrink-0 font-semibold">Changer</span>}
        </button>
      </div>
    );
  };

  return (
    <div className="hidden lg:block">
      <div className="flex items-center justify-between gap-4 mb-3">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold tracking-tight text-gray-900">
          <CalendarDays className="w-4 h-4 text-brand-500" aria-hidden /> Mes repas de la semaine
        </h2>
        <div className="flex items-center gap-5">
          <FamilleLegendeInline />
          <span className="text-xs font-medium text-gray-500">🍰 {desserts} desserts cette semaine</span>
        </div>
      </div>

      <div className="grid grid-cols-[140px_minmax(0,1fr)_minmax(0,1fr)] gap-x-4 gap-y-3 items-start">
        <div />
        <p className="text-xs font-bold uppercase tracking-[0.1em] text-brand-600">☀ Ce midi</p>
        <p className="text-xs font-bold uppercase tracking-[0.1em] text-accent-700">☾ Ce soir</p>

        {days.map(day => {
          const auj = estSemaineCourante && todayIndex === day.jourIndex;
          return (
            <div key={day.jour} className="contents">
              <div className={cn('min-h-[88px] rounded-2xl flex flex-col items-center justify-center text-center px-2',
                auj ? 'bg-brand-500 text-white shadow-cta' : 'bg-white border border-gray-100')}>
                <span className={cn('text-[13px] font-semibold', auj ? 'text-white/85' : 'text-gray-500')}>
                  {auj ? "Aujourd'hui" : day.jour}
                </span>
                <span className={cn('font-bold leading-tight', auj ? 'text-lg' : 'text-2xl text-gray-900')}>
                  {auj ? `${day.jour} ${jourDuMois(semaineDebut, day.jourIndex)}` : jourDuMois(semaineDebut, day.jourIndex)}
                </span>
                {batchJour === day.jourIndex && <span className="mt-1 text-[11px] font-semibold">🍳 Batch</span>}
              </div>
              {cellule(day, 'dejeuner')}
              {cellule(day, 'diner')}
            </div>
          );
        })}
      </div>
      {element}
    </div>
  );
}

/** Numéro réel du jour dans le mois : lundi (semaineDebut) + jourIndex */
function jourDuMois(semaineDebut: string, jourIndex: number): string {
  const d = new Date(`${semaineDebut}T12:00:00`);
  d.setDate(d.getDate() + jourIndex);
  return String(d.getDate());
}
