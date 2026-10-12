'use client';

import { BoutonPartager } from '@/components/BoutonPartager';
import { lienPublicMenu } from '@/lib/partage-menu';
import { useState, useMemo, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Calendar, ChevronLeft, ChevronRight, RefreshCw,
  Clock, Flame, Loader2, AlertTriangle, Sparkles,
  UtensilsCrossed, Hash, Copy,
} from 'lucide-react';
import type { RecetteResume } from '@/types';
import { usePlanningHistory, type WeekSummary } from '@/lib/usePlanningHistory';
import { WEEK_OFFSET_MIN, WEEK_OFFSET_MAX } from '@/lib/useWeeklyPlan';
import {
  getMondayWithOffset, formatWeekRange, SEMAINE_MS, parseSemaineParam,
  estAujourdhuiParis, formatDateHeureParis,
} from '@/lib/dates';
import { pushSemaine, replaceSemaine, useSemainePopstate } from '@/lib/useSemaineHistory';
import { formatMinutes, formatCalories, copyToClipboard, titreRecette } from '@/lib/utils';
import { toast } from 'sonner';
import { recetteHref } from '@/lib/seo';
import { DashboardShell } from '@/components/dashboard/DashboardShell';

export default function PlanningPage() {
  return (
    <Suspense fallback={null}>
      <PlanningInner />
    </Suspense>
  );
}

function PlanningInner() {
  const params = useSearchParams();
  const { weeks, loading, regeneratingWeek, error, regenerateWeek, reload } = usePlanningHistory();
  const [confirmRegen, setConfirmRegen] = useState<string | null>(null);
  /** Semaine affichée (null = semaine courante) */
  const [selected, setSelected] = useState<string | null>(
    () => parseSemaineParam(params.get('semaine'))
  );

  const lundiCourant = getMondayWithOffset(0);

  // Timeline complète : toutes les semaines consultables, générées ou non.
  // Bornes par défaut identiques au dashboard (−12 → +4), étendues si
  // d'anciens plans dépassent la borne basse (jamais de perte d'historique)
  // ou si la semaine sélectionnée (deep-link, popstate) est hors bornes.
  const timeline = useMemo(() => {
    const currentMs = new Date(`${lundiCourant}T12:00:00`).getTime();
    const offsetOf = (sd: string) =>
      Math.round((new Date(`${sd}T12:00:00`).getTime() - currentMs) / SEMAINE_MS);
    const planOffsets = weeks.map(w => offsetOf(w.semaineDebut));
    const extra = selected ? [offsetOf(selected)] : [];
    const minOff = Math.min(WEEK_OFFSET_MIN, 0, ...planOffsets, ...extra);
    const maxOff = Math.max(WEEK_OFFSET_MAX, 0, ...planOffsets, ...extra);

    const bySemaine = new Map(weeks.map(w => [w.semaineDebut, w]));
    const slots: { semaineDebut: string; plan: WeekSummary | null }[] = [];
    for (let off = minOff; off <= maxOff; off++) {
      const sd = getMondayWithOffset(off);
      slots.push({ semaineDebut: sd, plan: bySemaine.get(sd) ?? null });
    }
    return slots;
  }, [weeks, lundiCourant, selected]);

  const currentIdx = timeline.findIndex(t => t.semaineDebut === lundiCourant);
  const pos = selected ? timeline.findIndex(t => t.semaineDebut === selected) : currentIdx;
  const displayed = pos >= 0 ? timeline[pos] : timeline[currentIdx] || null;
  const isCurrent = !!displayed && displayed.semaineDebut === lundiCourant;
  const isRegenerating = !!displayed && regeneratingWeek === displayed.semaineDebut;

  const canPrev = pos > 0;
  const canNext = pos >= 0 && pos < timeline.length - 1;

  // Sélection + historique : les clics poussent une entrée (← → utilisables) ;
  // ?semaine= suit la navigation (retiré = semaine courante).
  const selectWeek = (semaine: string | null) => {
    setSelected(semaine);
    if (semaine === null) replaceSemaine(null);
    else pushSemaine(semaine);
  };

  const goToCurrent = () => selectWeek(null);
  const goPrev = () => {
    if (canPrev) selectWeek(timeline[pos - 1].semaineDebut);
  };
  const goNext = () => {
    if (canNext) selectWeek(timeline[pos + 1].semaineDebut);
  };

  // ← → navigateur : resynchronise la semaine affichée sur l'URL (la timeline
  // s'étend automatiquement si la semaine popstate est hors bornes).
  useSemainePopstate(useCallback((semaine: string | null) => {
    setSelected(semaine);
  }, []));

  // Copie le deep-link de la semaine affichée (?semaine=...) — utile entre
  // membres d'un même foyer (compte requis pour l'ouvrir).
  const copyWeekLink = async () => {
    if (!displayed) return;
    const url = new URL(window.location.href);
    url.searchParams.set('semaine', displayed.semaineDebut);
    const ok = await copyToClipboard(url.toString());
    if (ok) toast.success('Lien copié — semaine partageable 📋');
    else toast.error('Copie impossible dans ce navigateur');
  };


  const handleRegenConfirm = async (semaineDebut: string) => {
    setConfirmRegen(null);
    await regenerateWeek(semaineDebut);
  };

  // ─── Loading ──────────────
  if (loading) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <Loader2 className="w-10 h-10 text-brand-500 animate-spin mx-auto mb-4" />
            <p className="text-gray-500">Chargement de l&apos;historique...</p>
          </div>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="container-app py-8">
        {/* ─── Titre + Navigation ─── */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            {/* Icône en pastille : alignement vertical du titre identique aux
                autres pages (texte sur la ligne de base, pas centré sur une
                grande icône). */}
            <div className="flex items-center gap-3">
              <span className="w-11 h-11 rounded-2xl bg-brand-50 flex items-center justify-center shrink-0" aria-hidden>
                <Calendar className="w-5 h-5 text-brand-500" />
              </span>
              <h1 className="text-3xl font-bold font-display text-gray-900">Historique des semaines</h1>
            </div>
            <p className="text-gray-500 mt-2">
              {weeks.length > 0
                ? `${weeks.length} semaine${weeks.length > 1 ? 's' : ''} planifiée${weeks.length > 1 ? 's' : ''} · ${weeks.reduce((sum, w) => sum + w.nbRepas, 0)} repas au total`
                : 'Aucune semaine planifiée pour le moment — choisissez une semaine et optimisez-la ici'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={goPrev} disabled={!canPrev}
              className="p-2 rounded-xl border border-gray-200 hover:border-brand-300 hover:bg-brand-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-gray-500"
              title="Semaine précédente" aria-label="Semaine précédente">
              <ChevronLeft className="w-5 h-5" />
            </button>

            <button onClick={goToCurrent}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                isCurrent ? 'bg-brand-500 text-white shadow-xs' : 'bg-white border border-gray-200 text-gray-600 hover:border-brand-300'
              }`}>
              {isCurrent ? 'Semaine courante' : 'Aujourd\'hui'}
            </button>

            <button onClick={goNext} disabled={!canNext}
              className="p-2 rounded-xl border border-gray-200 hover:border-brand-300 hover:bg-brand-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-gray-500"
              title="Semaine suivante" aria-label="Semaine suivante">
              <ChevronRight className="w-5 h-5" />
            </button>

            {/* Copier le lien de la semaine affichée (deep-link ?semaine=) */}
            <button onClick={() => void copyWeekLink()}
              className="p-2 rounded-xl border border-gray-200 hover:border-brand-300 hover:bg-brand-50 transition-all text-gray-500"
              title="Copier le lien de cette semaine" aria-label="Copier le lien de cette semaine">
              <Copy className="w-5 h-5" />
            </button>

            {/* Partage public (lecture seule, sans compte) : /menu/[token] */}
            {displayed?.plan && (
              <BoutonPartager type="menu" variante="icone" titre={`Mon menu de la semaine du ${formatWeekRange(displayed.semaineDebut)}`}
                texte="Voici mon menu de la semaine, composé avec PlanMyMeal :" resoudreUrl={() => lienPublicMenu(displayed.semaineDebut)} />
            )}
          </div>
        </div>

        {/* ─── Error ─── */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center mb-8">
            <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-3" />
            <p className="text-red-700 font-medium mb-4">{error}</p>
            <button onClick={reload} className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-xl hover:bg-red-700">Réessayer</button>
          </div>
        )}

        {/* ─── Première utilisation ─── */}
        {!error && weeks.length === 0 && (
          <div className="bg-brand-50 border border-brand-200 rounded-2xl p-5 mb-8 flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-brand-500 shrink-0" />
            <p className="text-sm text-brand-800">
              Optimisez votre première semaine directement depuis cette page : naviguez jusqu&apos;à la semaine voulue puis lancez l&apos;optimisation.
            </p>
          </div>
        )}

        {/* ─── Semaine affichée ─── */}
        {displayed && (
          <WeekDetailCard
            semaineDebut={displayed.semaineDebut}
            week={displayed.plan}
            isCurrent={isCurrent}
            isRegenerating={isRegenerating}
            onRegenRequest={() => setConfirmRegen(displayed.semaineDebut)}
            onGenerate={() => void regenerateWeek(displayed.semaineDebut)}
          />
        )}

        {/* ─── Toutes les semaines (générées + à venir) ─── */}
        {timeline.length > 1 && (
          <div className="mt-10">
            <h2 className="text-xl font-bold font-display text-gray-900 mb-6 flex items-center gap-2">
              <Hash className="w-5 h-5 text-brand-500" />
              Toutes les semaines
            </h2>
            <div className="space-y-3">
              {timeline.map((t, idx) => {
                const isThisCurrent = t.semaineDebut === lundiCourant;
                const isSelected = displayed?.semaineDebut === t.semaineDebut;
                const week = t.plan;
                const isRowRegenerating = regeneratingWeek === t.semaineDebut;

                return (
                  <div key={t.semaineDebut} data-reveal style={{ '--i': idx % 4 } as React.CSSProperties} onClick={() => selectWeek(t.semaineDebut)}
                    className={`bg-white rounded-2xl border p-4 transition-all cursor-pointer ${
                      isSelected ? 'border-brand-400 shadow-md ring-1 ring-brand-200' :
                      isThisCurrent ? 'border-sauge-300 bg-sauge-50/30' :
                      week ? 'border-gray-100 hover:border-gray-200 hover:shadow-xs' :
                      'border-dashed border-gray-200 hover:border-brand-300'
                    }`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          isThisCurrent ? 'bg-sauge-100 text-sauge-600' :
                          week ? 'bg-brand-50 text-brand-600' : 'bg-gray-100 text-gray-500'
                        }`}>
                          <Calendar className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-gray-900">{formatWeekRange(t.semaineDebut)}</span>
                            {isThisCurrent && <span className="text-xs bg-sauge-100 text-sauge-700 px-2 py-0.5 rounded-full font-medium">Cette semaine</span>}
                            {!week && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">Non planifiée</span>}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                            {week ? (<>
                              <span className="flex items-center gap-1 shrink-0"><UtensilsCrossed className="w-3 h-3" /> {week.nbRepas} repas</span>
                              <span className="text-gray-500 truncate">{week.recap}</span>
                            </>) : (
                              <span className="text-gray-500 truncate">Aucun planning — cliquez pour préparer cette semaine</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {week ? (<>
                          {/* Puce navigation */}
                          <button
                            onClick={e => { e.stopPropagation(); selectWeek(t.semaineDebut); }}
                            className="px-3 py-1.5 text-xs font-medium text-brand-600 bg-brand-50 rounded-lg hover:bg-brand-100 transition-colors">
                            Voir
                          </button>

                          <button
                            onClick={e => { e.stopPropagation(); setConfirmRegen(t.semaineDebut); }}
                            disabled={isRowRegenerating}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors text-gray-500 hover:text-brand-600 hover:bg-brand-50 disabled:opacity-50">
                            {isRowRegenerating
                              ? <><Loader2 className="w-3 h-3 animate-spin" /> Optimisation...</>
                              : <><RefreshCw className="w-3 h-3" /> Régénérer</>}
                          </button>
                        </>) : (
                          <button
                            onClick={e => { e.stopPropagation(); void regenerateWeek(t.semaineDebut); }}
                            disabled={isRowRegenerating}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors text-brand-600 bg-brand-50 hover:bg-brand-100 disabled:opacity-50">
                            {isRowRegenerating
                              ? <><Loader2 className="w-3 h-3 animate-spin" /> Optimisation...</>
                              : <><Sparkles className="w-3 h-3" /> Optimiser</>}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── Modal de confirmation régénération ─── */}
        {confirmRegen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/30 backdrop-blur-xs p-4" onClick={() => setConfirmRegen(null)}>
            <div className="bg-creme-50 rounded-3xl shadow-xl max-w-sm w-full p-6" onClick={e => e.stopPropagation()}>
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-sable-100 flex items-center justify-center mx-auto mb-4">
                  <RefreshCw className="w-6 h-6 text-sable-600" />
                </div>
                <h3 className="font-bold font-display text-gray-900 text-lg mb-2">Régénérer cette semaine ?</h3>
                <p className="text-sm text-gray-500 mb-6">
                  Le planning actuel sera remplacé par une nouvelle optimisation. La liste de courses sera recalculée.
                </p>
                <div className="flex gap-3">
                  <button onClick={() => setConfirmRegen(null)}
                    className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors">
                    Annuler
                  </button>
                  <button onClick={() => handleRegenConfirm(confirmRegen)}
                    className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-brand-500 rounded-full hover:bg-brand-600 transition-colors">
                    Régénérer
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

// ─── Carte détail d'une semaine (générée ou vide) ───────────────────────────

function WeekDetailCard({
  semaineDebut, week, isCurrent, isRegenerating,
  onRegenRequest, onGenerate,
}: {
  semaineDebut: string;
  week: WeekSummary | null;
  isCurrent: boolean;
  isRegenerating: boolean;
  onRegenRequest: () => void;
  onGenerate: () => void;
}) {
  const period = formatWeekRange(semaineDebut);

  // Semaine sans planning : placeholder + CTA de génération directe
  // (création sans confirmation — la régénération d'un plan existant, elle, demande confirmation)
  if (!week) {
    return (
      <div className="bg-white/50 rounded-2xl border-2 border-dashed border-gray-200 p-10 text-center">
        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
          <Calendar className="w-6 h-6 text-gray-500" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-1">Semaine du {period}</h2>
        <p className="text-sm text-gray-500 mb-6">
          Aucun planning pour cette semaine — optimisez-le en un clic{isCurrent ? ' ou depuis votre planning' : ''}.
        </p>
        <button onClick={onGenerate} disabled={isRegenerating}
          className="inline-flex items-center gap-2 px-6 py-3 bg-brand-500 text-white font-semibold rounded-full hover:bg-brand-600 disabled:opacity-60 transition-all shadow-cta">
          {isRegenerating
            ? <><Loader2 className="w-5 h-5 animate-spin" /> Optimisation en cours...</>
            : <><Sparkles className="w-5 h-5" /> Optimiser cette semaine</>}
        </button>
      </div>
    );
  }

  const stats = week.days.reduce((acc, d) => {
    [d.dejeuner, d.diner, d.dessert, d.dessertMidi].forEach(m => {
      if (m) {
        acc.totalPrep += m.temps_preparation + (m.temps_cuisson || 0);
        acc.totalCal += m.calories_par_portion || 0;
        acc.count++;
      }
    });
    return acc;
  }, { totalPrep: 0, totalCal: 0, count: 0 });

  return (
    <div className={`bg-white rounded-2xl border-2 overflow-hidden transition-all ${
      isCurrent ? 'border-sauge-400' : 'border-gray-100'
    }`}>
      {/* En-tête */}
      <div className="bg-brand-50 p-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1 flex-wrap">
            <h2 className="text-2xl font-bold font-display text-gray-900">{period}</h2>
            {isCurrent && (
              <span className="px-3 py-1 bg-sauge-100 text-sauge-700 text-sm font-medium rounded-full border border-sauge-200">
                🗓 Semaine courante
              </span>
            )}
            {/* Comparaison et formatage ancrés sur Europe/Paris : `toLocaleString()`
                sans timeZone affichait « 15:04 » côté serveur (UTC) et « 16:04 »
                côté navigateur → hydration mismatch sur l'onglet Planning. */}
            {!estAujourdhuiParis(week.generatedAt) && (
              <span className="text-xs text-gray-500">
                Dernière optimisation le {formatDateHeureParis(week.generatedAt)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-6 text-sm text-gray-500 mt-2">
            <span className="flex items-center gap-1"><UtensilsCrossed className="w-4 h-4" /> {week.nbRepas} repas</span>
            <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {formatMinutes(stats.totalPrep)} total</span>
            <span className="flex items-center gap-1"><Flame className="w-4 h-4" /> {stats.count ? Math.round(stats.totalCal / stats.count) : 0} kcal/repas moy.</span>
          </div>
        </div>
        <button onClick={onRegenRequest}
          disabled={isRegenerating}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-full bg-brand-50 border border-brand-200 text-brand-600 hover:bg-brand-100 hover:border-brand-300 transition-all disabled:opacity-50">
          {isRegenerating ? <><Loader2 className="w-4 h-4 animate-spin" /> Optimisation...</> : <><RefreshCw className="w-4 h-4" /> Régénérer</>}
        </button>
      </div>

      {/* Grille des jours */}
      <div className="p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {week.days.map(day => {
            const isWeekend = day.jourIndex >= 5;
            return (
              <div key={day.jour}
                className={`rounded-xl border p-3 ${
                  isWeekend ? 'bg-sable-50/30 border-sable-100' : 'bg-gray-50/50 border-gray-100'
                }`}>
                <div className="flex items-center gap-2 mb-3">
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    isWeekend ? 'bg-sable-100 text-sable-700' : 'bg-brand-100 text-brand-600'
                  }`}>{day.jour.slice(0, 1)}</span>
                  <span className="font-semibold text-sm text-gray-700">{day.jour}</span>
                </div>

                <div className="space-y-2">
                  <MealMini label="Déjeuner" meal={day.dejeuner} />
                  {day.dessertMidi && <MealMini label="Dessert midi" meal={day.dessertMidi} />}
                  <MealMini label="Dîner" meal={day.diner} />
                  {day.dessert && <MealMini label="Dessert" meal={day.dessert} />}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MealMini({ label, meal }: { label: string; meal: RecetteResume | null }) {
  if (!meal) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-500 py-1">
        <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
        <span className="text-gray-500">{label}</span>
      </div>
    );
  }
  return (
    <div className="group">
      <div className="flex items-center justify-between">
        <Link href={recetteHref(meal)}
          className="flex-1 text-xs font-medium text-gray-800 hover:text-brand-600 transition-colors truncate leading-snug"
          title={titreRecette(meal.titre)}>
          {titreRecette(meal.titre)}
        </Link>
      </div>
      <div className="flex items-center gap-3 text-[11px] text-gray-500 mt-1">
        <span>{formatMinutes(meal.temps_preparation + (meal.temps_cuisson || 0))}</span>
        <span>{formatCalories(meal.calories_par_portion)}</span>
      </div>
    </div>
  );
}
