'use client';

// ============================================================================
// WeekDayTabs — vue mobile (< lg) du planning : « un jour à la fois ».
// En-tête « Aujourd'hui · Lundi 28 septembre » avec flèches, deux grandes
// cartes « Ce midi » / « Ce soir » (dessert en ligne dessous), deux boutons
// en toutes lettres : « Voir la recette » et « Changer ». « Changer » ouvre un
// panneau à 4 choix (ChangerSheet). Pastilles L M M J V S D en bas ; balayage
// horizontal = jour précédent / suivant.
// ============================================================================

import { BoutonDebloquer, CarteVerrouillee } from '@/components/dashboard/Verrou';
import { useRef } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Loader2, Package, Check, Lock } from 'lucide-react';
import type { DayPlan, RepasSlot } from '@/types';
import { formatMinutes, cn, titreRecette, emojiRecette } from '@/lib/utils';
import { formatPrix, prixParPortion } from '@/lib/budget';
import { useAuth } from '@/components/AuthProvider';
import { useTodayIndex } from '@/lib/useTodayIndex';
import { recetteHref } from '@/lib/seo';
import { FamilleBadges } from '@/components/dashboard/FamilleBadges';
import { FamilleLegende } from '@/components/dashboard/FamilleLegende';
import { useChangerCreneau, repasDuCreneau } from '@/components/dashboard/useChangerCreneau';

export interface JourChoisi { semaine: string; jour: number }

export function WeekDayTabs({
  days, semaineDebut, estSemaineCourante, mealStatuses, regeneratingSlots,
  onMarkStatus, onSwap, onRegenerate, onCustom, onVider, onToggleRestes, restesToggling, verrouilles,
  jourChoisi, onChoisirJour,
}: {
  days: DayPlan[];
  /** Jour affiché choisi par l'utilisateur (null = aujourd'hui / lundi) */
  jourChoisi: JourChoisi | null;
  onChoisirJour: (j: JourChoisi) => void;
  /** Jours verrouillés (plan gratuit) : repas floutés */
  verrouilles?: Set<number>;
  /** Lundi de la semaine affichée (YYYY-MM-DD) */
  semaineDebut: string;
  estSemaineCourante: boolean;
  mealStatuses: Record<number, string>;
  regeneratingSlots: Record<string, boolean>;
  onMarkStatus: (mealId: number, status: 'cooked' | 'skipped') => void;
  /** Ouvre la liste des recettes (SwapModal) */
  onSwap: (dayIndex: number, repas: RepasSlot) => void;
  onRegenerate: (dayIndex: number, repas: RepasSlot) => Promise<void>;
  onCustom: (dayIndex: number, repas: RepasSlot, texte: string) => Promise<void>;
  onVider: (dayIndex: number, repas: RepasSlot) => Promise<void>;
  onToggleRestes: (jourDiner: number) => void;
  restesToggling: number | null;
}) {
  const todayIndex = useTodayIndex();
  // Jour choisi tenu par la page : un changement de repas recharge le planning et pouvait
  // remonter ce composant, ce qui le ramenait au lundi.
  const selectedOverride = jourChoisi?.semaine === semaineDebut ? jourChoisi.jour : null;
  const setSelectedOverride = (jour: number) => onChoisirJour({ semaine: semaineDebut, jour });
  const selectedIndex = selectedOverride ?? (estSemaineCourante && todayIndex >= 0 ? todayIndex : 0);
  const { profile } = useAuth();
  const { ouvrir, element: changerElement } = useChangerCreneau(days, {
    onMarkStatus, onSwap, onRegenerate, onCustom, onVider, onToggleRestes, restesToggling,
  });

  // Balayage horizontal → jour précédent / suivant (scroll vertical intact)
  const toucheDebut = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('input, textarea, select, [data-no-swipe]')) { toucheDebut.current = null; return; }
    toucheDebut.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const debut = toucheDebut.current;
    toucheDebut.current = null;
    if (!debut) return;
    const dx = e.changedTouches[0].clientX - debut.x;
    const dy = e.changedTouches[0].clientY - debut.y;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    aller(dx < 0 ? 1 : -1);
  };
  const aller = (delta: number) =>
    setSelectedOverride(Math.min(days.length - 1, Math.max(0, selectedIndex + delta)));

  const day = days[selectedIndex] ?? days[0];
  if (!day) return null;

  const estAujourdhui = estSemaineCourante && todayIndex === day.jourIndex;
  const batchActive = profile?.batch_cooking === true;
  const batchJour = profile?.batch_cooking_jour ?? 6;
  const batchCovered = batchActive ? [1, 2, 3].map(k => (batchJour + k) % 7) : [];
  const sourceDiner = day.restesDe != null ? days[day.jourIndex - 1]?.diner : null;

  const repasDe = (slot: RepasSlot) => repasDuCreneau(day, slot);

  return (
    <div className="lg:hidden" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {/* ── En-tête du jour ── */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <button onClick={() => aller(-1)} disabled={selectedIndex === 0} aria-label="Jour précédent"
          className="w-11 h-11 shrink-0 rounded-full bg-creme-100 border border-gray-200 flex items-center justify-center text-gray-700 disabled:opacity-30">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="text-center min-w-0">
          <p className={cn('text-sm font-semibold', estAujourdhui ? 'text-brand-600' : 'text-gray-500')}>
            {estAujourdhui ? "Aujourd'hui" : ' '}
          </p>
          <h3 className="font-display font-bold text-2xl text-gray-900 leading-tight">{dateLongue(semaineDebut, day.jourIndex)}</h3>
        </div>
        <button onClick={() => aller(1)} disabled={selectedIndex >= days.length - 1} aria-label="Jour suivant"
          className="w-11 h-11 shrink-0 rounded-full bg-creme-100 border border-gray-200 flex items-center justify-center text-gray-700 disabled:opacity-30">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {batchActive && day.jourIndex === batchJour && (
        <div className="mt-4 flex items-center gap-2 rounded-2xl bg-accent-100 border border-accent-200 px-4 py-3 text-sm font-semibold text-accent-700">
          <Package className="w-4 h-4" /> Session batch cooking — vous cuisinez pour 4 jours
        </div>
      )}
      {batchCovered.includes(day.jourIndex) && (
        <div className="mt-4 rounded-2xl bg-accent-50 border border-accent-200 px-4 py-3 text-sm font-semibold text-accent-600">
          🍱 Repas déjà cuisinés lors de la session batch
        </div>
      )}

      <FamilleLegende className="mt-4 mb-0" />

      {/* ── Ce midi / Ce soir ── (jour verrouillé : repas floutés + déblocage) */}
      {verrouilles?.has(day.jourIndex) ? (
        <div className="mt-5 relative">
          <div className="grid gap-5 sm:grid-cols-2"><CarteVerrouillee grande /><CarteVerrouillee grande /></div>
          <div className="mt-4 rounded-3xl border border-brand-200 bg-brand-50 p-4 text-center">
            <p className="font-semibold text-gray-900">Ce jour fait partie de votre semaine complète</p>
            <p className="mt-1 text-sm text-gray-600">Vous voyez {7 - verrouilles.size} jours sur 7.</p>
            <BoutonDebloquer raison="semaine" className="mt-3 w-full" />
          </div>
        </div>
      ) : (
      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        {(['dejeuner', 'diner'] as const).map(slot => {
          const meal = repasDe(slot);
          const dessertSlot: RepasSlot = slot === 'dejeuner' ? 'dessert_midi' : 'dessert';
          const dessert = repasDe(dessertSlot);
          const estReste = slot === 'dejeuner' && day.restesDe != null;
          const soir = slot === 'diner';
          const chargement = !!regeneratingSlots[`${day.jourIndex}-${slot}`];
          const status = meal && !meal.personnalise ? mealStatuses[meal.id] : undefined;
          const prix = meal && !meal.personnalise ? prixParPortion(meal) : null;
          const lien = meal ? (estReste && day.restesDe ? `/recette/${day.restesDe}` : recetteHref(meal)) : null;

          return (
            <section key={slot} className="relative rounded-3xl border border-gray-100 bg-white shadow-card overflow-hidden">
              <div className={cn('h-24 flex items-center justify-center text-5xl', soir ? 'bg-accent-100' : 'bg-brand-100')} aria-hidden>
                {!meal ? '🍽️' : meal.personnalise ? '✏️' : estReste ? '🍱' : emojiRecette(meal.titre)}
              </div>
              <div className="p-5">
                <p className={cn('text-xs font-bold uppercase tracking-[0.1em]', soir ? 'text-accent-700' : 'text-brand-600')}>
                  {soir ? '☾ Ce soir' : '☀ Ce midi'}
                </p>

                {!meal ? (
                  <>
                    <h4 className="mt-1.5 font-bold text-xl text-gray-400">Rien de prévu</h4>
                    <button onClick={() => ouvrir(day.jourIndex, slot)}
                      className="mt-4 w-full min-h-[52px] rounded-2xl bg-brand-500 text-white font-semibold text-base active:scale-[0.98] transition-transform">
                      Ajouter un repas
                    </button>
                  </>
                ) : (
                  <>
                    <h4 className="mt-1.5 font-bold text-xl text-gray-900 leading-snug">
                      {meal.personnalise ? meal.titre
                        : estReste ? `Restes de ${sourceDiner ? titreRecette(sourceDiner.titre) : 'la veille'}`
                        : titreRecette(meal.titre)}
                    </h4>
                    <p className="mt-1 text-sm text-gray-500">
                      {meal.personnalise ? 'Repas personnalisé'
                        : estReste ? 'Cuisiné la veille · à réchauffer'
                        : `${formatMinutes(meal.temps_preparation + (meal.temps_cuisson || 0))}${prix != null ? ` · ${formatPrix(prix)} par personne` : ''}`}
                    </p>
                    {!meal.personnalise && !estReste && <FamilleBadges meal={meal} className="mt-2" />}
                    {status === 'cooked' && (
                      <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-sauge-100 px-2.5 py-1 text-xs font-semibold text-sauge-700">
                        <Check className="w-3.5 h-3.5" /> C&apos;est fait
                      </p>
                    )}
                    <div className="mt-4 flex gap-3">
                      {!meal.personnalise && lien && (
                        <Link href={lien}
                          className={cn('flex-1 min-h-[52px] rounded-2xl text-white font-semibold text-base flex items-center justify-center active:scale-[0.98] transition-transform',
                            soir ? 'bg-accent-600' : 'bg-brand-500')}>
                          Voir la recette
                        </Link>
                      )}
                      <button onClick={() => ouvrir(day.jourIndex, slot)}
                        className="flex-1 min-h-[52px] rounded-2xl bg-creme-100 border border-gray-200 text-gray-800 font-semibold text-base active:scale-[0.98] transition-transform">
                        Changer
                      </button>
                    </div>
                  </>
                )}

                {/* Dessert : une ligne simple sous le repas */}
                <button onClick={() => ouvrir(day.jourIndex, dessertSlot)}
                  className="mt-4 w-full flex items-center justify-between gap-3 rounded-2xl bg-sauge-50 border border-sauge-100 px-4 min-h-[48px] text-left">
                  <span className="min-w-0 truncate text-sm text-sauge-800">
                    🍰 {dessert ? <>Dessert : <strong>{dessert.personnalise ? dessert.titre : titreRecette(dessert.titre)}</strong></> : 'Ajouter un dessert'}
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-sauge-700">{dessert ? 'Changer' : '+'}</span>
                </button>
              </div>

              {chargement && (
                <div className="absolute inset-0 bg-white/70 flex items-center justify-center" aria-live="polite">
                  <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
                </div>
              )}
            </section>
          );
        })}
      </div>
      )}

      {/* ── Pastilles des jours ── */}
      <div role="tablist" aria-label="Jours de la semaine" className="mt-6 flex justify-between gap-1" data-no-swipe>
        {days.map((d, i) => {
          const actif = i === selectedIndex;
          const auj = estSemaineCourante && todayIndex === d.jourIndex;
          return (
            <button key={d.jour} role="tab" aria-selected={actif} aria-label={d.jour}
              onClick={() => setSelectedOverride(i)}
              className={cn('w-11 h-11 rounded-full border text-sm font-bold transition-colors',
                actif ? 'bg-brand-500 border-brand-500 text-white shadow-cta'
                  : auj ? 'bg-brand-50 border-brand-300 text-brand-600'
                  : 'bg-white border-gray-200 text-gray-600')}>
              {verrouilles?.has(d.jourIndex) && !actif ? <Lock className="w-3.5 h-3.5 mx-auto text-gray-400" aria-hidden /> : d.jour.charAt(0)}
            </button>
          );
        })}
      </div>

      {changerElement}
    </div>
  );
}

/** « Lundi 28 septembre » depuis le lundi de la semaine + index du jour */
function dateLongue(semaineDebut: string, jourIndex: number): string {
  const d = new Date(`${semaineDebut}T12:00:00`);
  d.setDate(d.getDate() + jourIndex);
  const s = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}
