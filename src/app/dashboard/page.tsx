'use client';

import { useState, useMemo, useEffect, useCallback, useRef, Suspense } from 'react';
import Link from 'next/link';
import {
  ShoppingCart, ChefHat as ChefIcon,
  Sparkles, AlertTriangle,
  Package, Calendar,
  ChevronLeft, ChevronRight, Copy, ChevronDown, Refrigerator,
} from 'lucide-react';
import { copyToClipboard, cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAuth } from '@/components/AuthProvider';
import { useWeeklyPlan, WEEK_OFFSET_MIN, WEEK_OFFSET_MAX } from '@/lib/useWeeklyPlan';
import type { RepasSlot } from '@/types';
import { useSearchParams } from 'next/navigation';
import { formatWeekRange, formatDateLongueFr, parseSemaineParam, offsetOfSemaine, getMondayWithOffset, JOURS_NOMS } from '@/lib/dates';
import { useTodayIndex } from '@/lib/useTodayIndex';
import { WeekSkeleton } from '@/components/AppSkeleton';
import { pushSemaine, replaceSemaine, useSemainePopstate } from '@/lib/useSemaineHistory';
import { useWakeLock } from '@/lib/useWakeLock';
import { WeekColumns } from '@/components/dashboard/WeekColumns';
import { WeekDayTabs } from '@/components/dashboard/WeekDayTabs';
import { FamilleLegende } from '@/components/dashboard/FamilleLegende';
import { ShoppingListView } from '@/components/dashboard/ShoppingListView';
import { SwapModal } from '@/components/dashboard/SwapModal';
import { LoadingButton } from '@/components/LoadingButton';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { SummaryBar } from '@/components/dashboard/SummaryBar';
import { PromesseOptimisation, OptimiserBar } from '@/components/dashboard/OptimiserBar';
import type { IntentionOptimisation } from '@/lib/rotation-engine';
import { Underlined } from '@/components/WavyUnderline';

// MealCard, SwapModal et ShoppingListView vivent dans src/components/dashboard/
// (extraits pour testabilité — audit P3).

export default function DashboardPage() {
  return (
    // useSearchParams() exige une limite Suspense : le squelette sert de repli
    // pendant le rendu client du dashboard (sinon l'écran resterait vide).
    <Suspense fallback={<WeekSkeleton />}>
      <DashboardInner />
    </Suspense>
  );
}

function DashboardInner() {
  // Deep-link ?semaine=YYYY-MM-DD : lu une seule fois au premier rendu (état
  // initial de weekOffset). Les navigations internes re-synchronisent l'URL
  // via replaceState (pas de navigation Next, pas de re-fetch inutile).
  //
  // ⚠️ useSearchParams() (fourni par Next des deux côtés) et non
  // `window.location.search` : lire `window` dans un initialiseur de useState
  // donnait 0 au serveur et le vrai offset au premier rendu client → hydration
  // mismatch à CHAQUE ouverture d'un lien profond (partage de planning, refresh
  // avec ?tab=courses).
  const searchParams = useSearchParams();
  const [initialOffset] = useState(() => {
    const parsed = parseSemaineParam(searchParams.get('semaine'));
    return parsed ? offsetOfSemaine(parsed) : 0;
  });
  const {
    days, shoppingSections, loading, regenerating, error, empty,
    semaineDebut, fallbackUtilise, cuisinesDiversifiees, recup, regenerate, regenerateMeal, regeneratingSlots, toggleShoppingItem, uncheckAllShoppingItems,
    swapMeal, setRepasLibre, viderCreneau, moveMeal, markMealStatus, fetchSwapSuggestions, toggleRestes, restesToggling,
    weekOffset, estSemaineCourante, goToWeek, goToCurrentWeek,
    fromCache, estEnLigne,
  } = useWeeklyPlan(initialOffset);
  // Onglet actif : sync avec ?tab=courses (deep-link de la nav « Courses »).
  // Lu une seule fois au montage (comme weekOffset) puis piloté par l'UI.
  const [activeTab, setActiveTab] = useState<'planning' | 'courses'>(
    searchParams.get('tab') === 'courses' ? 'courses' : 'planning'
  );

  // Le lien nav « Courses » (?tab=courses) doit basculer l'onglet même quand
  // on est déjà sur /dashboard → on écoute les changements d'URL.
  useEffect(() => {
    const onPop = () => {
      setActiveTab(new URLSearchParams(window.location.search).get('tab') === 'courses' ? 'courses' : 'planning');
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // En magasin : l'écran reste allumé tant que la liste est affichée
  useWakeLock(activeTab === 'courses');

  // Confirmation d'optimisation avec décompte (axe 2 de l'audit desserts) :
  // « pourquoi certains soirs n'ont pas de dessert ? » trouve sa réponse ICI —
  // le décompte montre que le rythme est une DÉCISION du moteur, pas un oubli.
  // `recup` change quand les jours sont rechargés ; on toast alors si une
  // optimisation vient de se terminer (flag posé au clic, consommé ici).
  const optimisationEnCours = useRef(false);
  useEffect(() => {
    if (!optimisationEnCours.current || regenerating || loading) return;
    optimisationEnCours.current = false;
    const fragments = [
      `${recup.repas} repas`,
      `dont ${recup.desserts} dessert${recup.desserts > 1 ? 's' : ''}`,
      recup.restes > 0 ? `${recup.restes} reste${recup.restes > 1 ? 's' : ''}` : null,
    ].filter(Boolean);
    toast.success(`✨ Semaine optimisée — ${fragments.join(', ')}`, {
      description: fallbackUtilise
        ? 'Rotation élargie : des recettes récentes ont été réutilisées.'
        : 'Ajustez un repas au besoin — la semaine reste entièrement modifiable.',
    });
  }, [regenerating, loading, recup, fallbackUtilise]);

  const [swapModal, setSwapModal] = useState<{
    dayIndex: number; repas: RepasSlot;
  } | null>(null);
  const [swapping, setSwapping] = useState(false);
  /** Créneau survolé pendant un drag : clé "jourIndex-repas" (bordure + fond) */
  const [dragOver, setDragOver] = useState<string | null>(null);

  /** Lance une optimisation ET arme le toast de confirmation (décompte) —
      tous les déclencheurs de la page passent par ici. */
  const regenererAvecRecap = useCallback((intention?: IntentionOptimisation) => {
    optimisationEnCours.current = true;
    void regenerate(intention);
  }, [regenerate]);
  /** Déplacement en cours (évite les doubles drops + feedback bouton) */
  const [moving, setMoving] = useState(false);

  const stats = useMemo(() => {
    let count = 0;
    days.forEach(d => {
      [d.dejeuner, d.diner, d.dessert, d.dessertMidi].forEach(m => {
        if (m) count++;
      });
    });
    return { totalMeals: count };
  }, [days]);

  // Salutation personnalisée (« Bonjour Camille 👋 »)
  const { profile } = useAuth();
  const prenom = (profile?.full_name || '').split(' ')[0] || '';



  // Accordion batch cooking : replié par défaut (libère ~150px d'écran).
  // Auto-ouvert uniquement si la session batch a lieu aujourd'hui.
  const batchJour = profile?.batch_cooking_jour ?? 6;
  const todayIndex = useTodayIndex();
  const batchAujourdhui = profile?.batch_cooking === true
    && estSemaineCourante && todayIndex === batchJour;
  // Ouvert par défaut le jour du batch, mais le clic de l'utilisateur prime.
  // Un useState(batchAujourdhui) figerait « fermé » : pendant l'hydratation,
  // todayIndex vaut -1 (le serveur ne connaît pas le fuseau du visiteur).
  const [batchOpenOverride, setBatchOpenOverride] = useState<boolean | null>(null);
  const batchOpen = batchOpenOverride ?? batchAujourdhui;

  // Affichage du statut cooked/skipped par meal_id
  const [mealStatuses, setMealStatuses] = useState<Record<number, string>>({});

  const handleMarkStatus = async (mealId: number, status: 'cooked' | 'skipped') => {
    setMealStatuses(prev => ({ ...prev, [mealId]: status }));
    await markMealStatus(mealId, status);
  };

  const handleOpenSwap = (dayIndex: number, repas: RepasSlot) => {
    setSwapModal({ dayIndex, repas });
  };

  const handleConfirmSwap = async (newMealId: number) => {
    if (!swapModal) return;
    setSwapping(true);
    try {
      await swapMeal(swapModal.dayIndex, swapModal.repas, newMealId);
      // La semaine est rechargée (planning + liste de courses recalculée) :
      // feedback léger pour confirmer, la carte s'anime via sa clé React.
      toast.success('Repas remplacé ✓');
      setSwapModal(null);
    } catch (err) {
      // Le modal reste ouvert : l'utilisateur peut choisir une autre recette
      toast.error(err instanceof Error ? err.message : "Impossible d'appliquer ce repas. Réessayez.");
    } finally {
      setSwapping(false);
    }
  };

  const handleCustomMeal = async (texte: string) => {
    if (!swapModal) return;
    setSwapping(true);
    try {
      await setRepasLibre(swapModal.dayIndex, swapModal.repas, texte);
      toast.success('Repas enregistré ✓');
      setSwapModal(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible d'enregistrer ce repas. Réessayez.");
    } finally {
      setSwapping(false);
    }
  };

  // ─── Drag & drop : cliquer-glisser une recette vers n'importe quel créneau
  // (même jour ou un autre, déjeuner ↔ dîner ↔ desserts). L'API /api/move-meal
  // permute les deux créneaux et recalcule la liste de courses côté serveur.
  const handleDragStart = (e: React.DragEvent, dayIndex: number, repas: RepasSlot) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ dayIndex, repas }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, dayIndex: number, repas?: RepasSlot) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    // Survol d'un créneau précis (MealChip) sinon de la colonne entière (dîner)
    setDragOver(repas != null ? `${dayIndex}-${repas}` : `${dayIndex}-diner`);
  };

  const handleDragLeave = () => setDragOver(null);

  const handleDrop = async (e: React.DragEvent, toDay: number, toType: RepasSlot) => {
    e.preventDefault();
    // Un seul handleDrop par geste : sans stopPropagation, le drop sur un
    // créneau remonte au conteneur de colonne (onDrop → dîner) et déclenche
    // un second déplacement parasite.
    e.stopPropagation();
    setDragOver(null);
    if (moving) return;
    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain')) as {
        dayIndex: number; repas: RepasSlot;
      };
      // Même créneau → rien à faire
      if (data.dayIndex === toDay && data.repas === toType) return;
      setMoving(true);
      await moveMeal(data.dayIndex, data.repas as RepasSlot, toDay, toType);
      toast.success('Repas déplacé ✓ — liste de courses mise à jour');
    } catch (err) {
      // L'erreur métier (créneau source vide…) est déjà dans error du hook :
      // on affiche le message ici pour un feedback immédiat au geste.
      toast.error(err instanceof Error ? err.message : "Impossible de déplacer ce repas.");
    } finally {
      setMoving(false);
    }
  };

  // URL sync : ?semaine= reflète la semaine affichée (retiré = semaine courante).
  // L'URL est corrigée silencieusement (replaceState) quand elle diverge de
  // l'état — ex : lien ?semaine= hors bornes clampé par le hook. Les clics de
  // navigation, eux, poussent une entrée historique via pushSemaine() dans
  // handleGo (← → du navigateur changent alors de semaine).
  useEffect(() => {
    if (loading) return;
    const cur = new URLSearchParams(window.location.search).get('semaine');
    const next = estSemaineCourante ? null : semaineDebut;
    if ((cur ? parseSemaineParam(cur) : null) === next) return;
    replaceSemaine(next);
  }, [loading, estSemaineCourante, semaineDebut]);

  // Clic de navigation : pushState (pas replace) pour créer une entrée historique
  const handleGo = useCallback((offset: number) => {
    const clamped = Math.min(WEEK_OFFSET_MAX, Math.max(WEEK_OFFSET_MIN, offset));
    goToWeek(offset);
    if (clamped !== 0) pushSemaine(getMondayWithOffset(clamped));
    else replaceSemaine(null);
  }, [goToWeek]);

  // ← → navigateur : resynchronise la semaine affichée sur l'URL
  useSemainePopstate(useCallback((semaine: string | null) => {
    goToWeek(semaine === null ? 0 : offsetOfSemaine(semaine));
  }, [goToWeek]));

  // ─── Loading : squelette shimmer (mêmes formes que la page réelle) ─────
  if (loading) {
    return (
      <DashboardShell>
        <div className="container-app py-6">
          <div className="h-9 w-60 rounded-xl animate-shimmer mb-6" />
          <div className="h-16 rounded-2xl animate-shimmer mb-8" />
          <div className="grid gap-4">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full animate-shimmer" />
                  <div className="h-4 w-24 rounded-full animate-shimmer" />
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="h-28 rounded-xl animate-shimmer" />
                  <div className="h-28 rounded-xl animate-shimmer" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      showRegenerate={!empty && estSemaineCourante}
      regenerating={regenerating}
      onRegenerate={regenererAvecRecap}
    >

      {error && (
        <div className="container-app py-6">
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
            <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-3" />
            <p className="text-red-700 font-medium mb-2">Une erreur est survenue</p>
            <p className="text-red-500 text-sm mb-4">{error}</p>
            <button onClick={() => regenererAvecRecap()} className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-xl hover:bg-red-700">Réessayer</button>
          </div>
        </div>
      )}

      {empty && !error && (
        <div className="container-app py-20">
          <div className="max-w-md mx-auto text-center">
            <div className="text-6xl mb-6">📅</div>
            <h2 className="font-display text-2xl font-bold text-gray-900 mb-3">Aucun planning cette semaine</h2>
            <p className="text-gray-500 mb-2">Semaine du <strong>{formatDateLongueFr(semaineDebut, { weekday: 'long', day: 'numeric', month: 'long' })}</strong></p>
            <p className="text-gray-500 text-sm mb-6">Optimisez votre semaine complète de déjeuners et dîners en un clic.</p>
            <div className="mb-8 flex justify-center">
              <WeekNav semaineDebut={semaineDebut} weekOffset={weekOffset} estSemaineCourante={estSemaineCourante} onGo={handleGo} />
            </div>
            <LoadingButton onClick={() => regenererAvecRecap()} loading={regenerating}
              className="inline-flex items-center gap-2 px-8 py-4 bg-brand-500 text-white font-semibold rounded-full hover:bg-brand-600 disabled:opacity-60 text-lg transition-all shadow-cta">
              <Sparkles className="w-5 h-5" /> {estSemaineCourante ? 'Optimiser ma semaine' : 'Optimiser cette semaine'}
            </LoadingButton>
          </div>
        </div>
      )}

      {!empty && !error && (<>
        {/* ── En-tête façon landing : fond pastel (blobs) + salutation serif soulignée ── */}
        <div className="relative overflow-hidden">
          {/* Halos décoratifs : desktop seulement — sur mobile ils formaient des
              ombres colorées sur les bords de l'écran. */}
          <div aria-hidden className="hidden lg:block pointer-events-none absolute -top-24 right-0 h-72 w-72 rounded-full bg-brand-100/50 blur-3xl" />
          <div aria-hidden className="hidden lg:block pointer-events-none absolute -bottom-32 left-0 h-64 w-64 rounded-full bg-accent-100/50 blur-3xl" />
          <div className="container-app pt-4 sm:pt-6">
          <div className="flex items-center justify-between gap-4 flex-wrap mb-3 sm:mb-4">
            <div className="min-w-0">
              {/* Audit mobile #11 : « Bonjour Maxime » passe de 30px à 26px et le
                  sous-titre « Semaine du … · N repas » est masqué < sm — la
                  semaine est déjà lisible dans la nav compacte à droite, le
                  décompte de repas rejoint la barre de jours mobile. */}
              {/* pb-2 : le soulignement de <Underlined> est peint via un padding-bottom
                  sur un span inline, qui n'agrandit pas la boîte de ligne — sans cette
                  marge sur le h1 (bloc), le trait passait par-dessus le sous-titre. */}
              <h1 className="font-display font-bold text-2xl sm:text-4xl text-gray-900 tracking-tight leading-[1.1] pb-2">
                <Underlined color="#7C5FBF">{prenom ? `Bonjour ${prenom}` : 'Bonjour'}</Underlined>{' '}👋
              </h1>
              <p className="hidden sm:block text-sm text-gray-500 mt-1">
                Semaine du {formatWeekRange(semaineDebut)} · {stats.totalMeals} repas planifiés
              </p>
            </div>
            <div className="flex items-center gap-2.5 flex-wrap">
              {/* Le sous-titre affiche déjà « Semaine du … » → nav compacte sans doublon */}
              <WeekNav semaineDebut={semaineDebut} weekOffset={weekOffset} estSemaineCourante={estSemaineCourante} onGo={goToWeek} compact />
              {/* Accent lavande : action secondaire. Mesure mobile réelle (390px) :
                  le libellé complet faisait passer la rangée sur DEUX lignes
                  (+42px avant le 1er repas) → icône seule < sm, texte ≥ sm. */}
              <Link href="/vider-le-frigo" title="Cuisiner avec mon frigo"
                className="flex items-center gap-1.5 w-11 h-11 justify-center sm:w-auto sm:h-auto sm:px-4 sm:py-2.5 text-[11px] font-semibold tracking-[0.14em] uppercase text-accent-700 bg-accent-100 rounded-full hover:bg-accent-200 transition-colors shrink-0 shadow-card">
                <Refrigerator className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Cuisiner avec mon frigo</span>
              </Link>
            </div>
          </div>

          {/* ── Barre de résumé fine : Économies · Budget · Temps · Anti-gaspi ── */}
          <SummaryBar days={days} />
          {/* L'action CENTRALE (audit UX) : le libellé et la promesse disent ce
              que le moteur fait — arbitrer budget, goûts, temps, stock, restes,
              nutrition et gaspillage — au lieu d'un simple « régénérer ».
              Desktop : une ligne discrète ; mobile : repliée (hiérarchie). */}
          <PromesseOptimisation className="mt-2" />
          </div>
        </div>

        {/* pb supplémentaire < lg : réserver la place de la fiche « Optimiser
            ma semaine » fixée au-dessus de la bottom-nav (sinon elle masque le
            pied des cartes de la dernière ligne). */}
        <div className="container-app py-4 sm:py-6 pb-24 lg:pb-6">
          {fallbackUtilise && <FallbackBanner cuisines={cuisinesDiversifiees} />}
          <BatchCookingAccordion days={days} open={batchOpen} onToggle={() => setBatchOpenOverride(!batchOpen)} />
          {/* Onglets (Planning / Liste de courses) — pilotés aussi par la nav */}
          <div className="flex gap-1 bg-gray-100 p-1 rounded-full w-fit mb-4 sm:mb-6">
            {[{ key: 'planning' as const, icon: <ChefIcon className="w-4 h-4" />, label: 'Planning' },
              { key: 'courses' as const, icon: <ShoppingCart className="w-4 h-4" />, label: 'Liste de courses' }]
              .map(t => (
                <button key={t.key} onClick={() => setActiveTab(t.key)}
                  className={`flex items-center gap-2 px-4 min-h-[40px] rounded-full text-sm font-medium transition-all ${activeTab === t.key ? 'bg-white text-brand-600 shadow-xs' : 'text-gray-500 hover:text-gray-700'}`}>
                  {t.icon}{t.label}
                </button>
              ))}
          </div>

          {activeTab === 'planning' && (<>
            {/* Clé de lecture des pastilles du foyer — bandeau complet sur
                mobile seulement : en desktop la version inline est fondue dans
                l'en-tête du planning (WeekColumns), pas deux légendes empilées. */}
            <div className="lg:hidden">
              <FamilleLegende />
            </div>
            {/* Desktop ≥ md : grille 7 colonnes ; mobile < md : onglets de
                jours (LUN 7…) + liste verticale fluide du jour sélectionné */}
            <WeekColumns days={days} semaineDebut={semaineDebut} dragOver={dragOver} moving={moving} mealStatuses={mealStatuses} regeneratingSlots={regeneratingSlots} nbDesserts={recup.desserts}
              onDragStart={handleDragStart} onDragOver={handleDragOver} onDragLeave={handleDragLeave}
              onDrop={handleDrop} onMarkStatus={handleMarkStatus} onSwap={handleOpenSwap} onRegenerate={regenerateMeal}
              onCustom={setRepasLibre} onVider={viderCreneau}
              onToggleRestes={toggleRestes} restesToggling={restesToggling} estSemaineCourante={estSemaineCourante} />
            <WeekDayTabs days={days} semaineDebut={semaineDebut} estSemaineCourante={estSemaineCourante} mealStatuses={mealStatuses} regeneratingSlots={regeneratingSlots}
              onMarkStatus={handleMarkStatus} onSwap={handleOpenSwap} onRegenerate={regenerateMeal}
              onCustom={setRepasLibre} onVider={viderCreneau}
              onToggleRestes={toggleRestes} restesToggling={restesToggling} />
          </>)}

          {activeTab === 'courses' && (
            <>
              {(!estEnLigne || fromCache) && (
                <div className="mb-4 flex items-center gap-3 bg-sable-50 border border-sable-200 rounded-2xl px-4 py-3">
                  <span className="text-xl">📴</span>
                  <p className="text-sm text-sable-800">
                    <strong>Mode hors ligne.</strong> Votre liste est servie depuis votre téléphone.
                    Vos coches seront synchronisées au retour du réseau.
                  </p>
                </div>
              )}
              <ShoppingListView sections={shoppingSections} onToggle={toggleShoppingItem} onUncheckAll={uncheckAllShoppingItems} />
            </>
          )}          {weekOffset !== 0 && (
            <p className="mt-8 text-center text-sm">
              <button onClick={goToCurrentWeek} className="text-brand-600 font-medium hover:text-brand-700 transition-colors">
                ← Revenir à la semaine en cours
              </button>
            </p>
          )}
        </div>
      </>)}

      {/* L'action CENTRALE, à portée de pouce sur mobile : fiche fixée au-dessus
          de la bottom-nav, sur toute semaine déjà planifiée (courante ou non —
          sinon plus aucun moyen de relancer l'optimisation après avoir généré
          une semaine future en mobile). Le vide a son propre CTA, pas de doublon. */}
      {!empty && (
        <OptimiserBar onOptimiser={intention => regenererAvecRecap(intention)} loading={regenerating} />
      )}

      {/* Modal swap */}
      {swapModal && (
        <SwapModal
          dayIndex={swapModal.dayIndex}
          repas={swapModal.repas}
          fetchSuggestions={fetchSwapSuggestions}
          swapping={swapping}
          onSelect={handleConfirmSwap}
          onCustom={handleCustomMeal}
          onClose={() => setSwapModal(null)}
        />
      )}
    </DashboardShell>
  );
}

// ─── Navigation semaine (← →, bornée) ──────────────────────────────────────

function WeekNav({ semaineDebut, weekOffset, estSemaineCourante, onGo, compact }: {
  semaineDebut: string;
  weekOffset: number;
  estSemaineCourante: boolean;
  onGo: (offset: number) => void;
  /** true = sans le libellé « Semaine du … » (déjà affiché au-dessus) */
  compact?: boolean;
}) {
  const handleCopy = async () => {
    const url = new URL(window.location.href);
    url.searchParams.set('semaine', semaineDebut);
    const ok = await copyToClipboard(url.toString());
    if (ok) toast.success('Lien copié — semaine partageable 📋');
    else toast.error('Copie impossible dans ce navigateur');
  };

  return (
    <div className="flex items-center justify-between gap-2 bg-white border border-gray-200 rounded-pill pl-1.5 pr-3 py-1.5 shadow-card">
      <div className="flex items-center">
        <button onClick={() => onGo(weekOffset - 1)} disabled={weekOffset <= WEEK_OFFSET_MIN}
          className="w-10 h-10 flex items-center justify-center rounded-full text-gray-500 hover:bg-brand-50 hover:text-brand-600 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400 transition-colors"
          title="Semaine précédente" aria-label="Semaine précédente">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button onClick={() => onGo(weekOffset + 1)} disabled={weekOffset >= WEEK_OFFSET_MAX}
          className="w-10 h-10 flex items-center justify-center rounded-full text-gray-500 hover:bg-brand-50 hover:text-brand-600 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400 transition-colors"
          title="Semaine suivante" aria-label="Semaine suivante">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      <div className="flex items-center gap-1.5 min-w-0">
        {!compact && <Calendar className="w-4 h-4 text-brand-400 shrink-0" />}
        <span className={cn('tabular-nums whitespace-nowrap', compact
          ? 'text-[11px] font-semibold tracking-[0.08em] uppercase text-gray-800'
          : 'font-semibold text-gray-900 text-sm truncate')}
        >
          {compact ? formatWeekRange(semaineDebut) : `Semaine du ${formatWeekRange(semaineDebut)}`}
        </span>
        {/* Cible tactile 40px (audit mobile : p-1 = 22px, trop petit) */}
        <button onClick={handleCopy}
          className="w-10 h-10 flex items-center justify-center rounded-full text-gray-300 hover:text-brand-500 hover:bg-brand-50 transition-colors shrink-0"
          title="Copier le lien de cette semaine" aria-label="Copier le lien de cette semaine">
          <Copy className="w-3.5 h-3.5" />
        </button>
      </div>
      {!estSemaineCourante ? (
        <button onClick={() => onGo(0)}
          className="shrink-0 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-brand-600 bg-brand-50 rounded-full hover:bg-brand-100 transition-colors">
          Aujourd&apos;hui
        </button>
      ) : <span className="w-1" />}
    </div>
  );
}

// ─── Bannière filet de sécurité rotation (recettes récentes réutilisées) ───

function FallbackBanner({ cuisines = [] }: { cuisines?: string[] }) {
  return (
    <div className="mb-6 bg-sable-50 border border-sable-200 rounded-2xl p-5">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-sable-100 flex items-center justify-center shrink-0">
          <AlertTriangle className="w-5 h-5 text-sable-600" />
        </div>
        <div>
          <h3 className="font-semibold font-display text-sable-800">Rotation en pause cette semaine</h3>
          <p className="text-sm text-sable-700 mt-1">
            Toutes vos recettes ont été servies récemment — la rotation mémoire de 21 jours
            étant saturée, cette semaine réutilise quelques plats récents. Les prochaines
            semaines retrouveront une rotation complète.
          </p>
          {cuisines.length > 0 && (
            <p className="text-sm text-sable-700 mt-2">
              Pour varier les plaisirs, cette semaine met en avant vos cuisines les moins
              servies récemment :{' '}
              <span className="flex flex-wrap gap-1.5 mt-1.5">
                {cuisines.map((c) => (
                  <span key={c} className="inline-flex items-center gap-1 bg-white/80 border border-sable-200 rounded-full px-2.5 py-0.5 text-xs font-medium text-sable-800">
                    {CUISINE_EMOJIS[c] || '🌍'} {c}
                  </span>
                ))}
              </span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

const CUISINE_EMOJIS: Record<string, string> = {
  Française: '🇫🇷',
  Italienne: '🍝',
  Américaine: '🍔',
  Asiatique: '🥢',
  Indienne: '🍛',
  Orientale: '🧆',
  Méditerranéenne: '🫒',
  Mexicaine: '🌮',
  Britannique: '🫖',
  Japonaise: '🍣',
};

// ─── Batch cooking : accordion repliable (libère l'écran au quotidien) ─────
//
// Replié par défaut : une ligne fine « badge cliquable ». Déplié : le détail
// de la session (recettes couvertes). Auto-ouvert uniquement le jour de la
// session (batchAujourdhui) — l'utilisateur voit l'info au bon moment.

function BatchCookingAccordion({ days, open, onToggle }: {
  days: import('@/types').DayPlan[];
  open: boolean;
  onToggle: () => void;
}) {
  const { profile } = useAuth();
  if (!profile?.batch_cooking) return null;
  const batchJour = profile.batch_cooking_jour ?? 6;
  const batchCoveredDays = [batchJour, (batchJour + 1) % 7, (batchJour + 2) % 7, (batchJour + 3) % 7];
  const batchRecipes = new Map<number, { titre: string; days: string[] }>();
  for (const d of days) {
    if (!batchCoveredDays.includes(d.jourIndex)) continue;
    for (const meal of [d.dejeuner, d.diner]) {
      if (!meal || meal.personnalise) continue;
      if (!batchRecipes.has(meal.id)) batchRecipes.set(meal.id, { titre: meal.titre, days: [] });
      batchRecipes.get(meal.id)!.days.push(d.jour);
    }
  }

  return (
    <div className="mb-6 rounded-2xl border border-accent-200 bg-accent-50 overflow-hidden">
      {/* Ligne repliable : badge lavande cliquable (charte landing) */}
      <button onClick={onToggle} aria-expanded={open}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent-100/60 transition-colors">
        <span className="w-8 h-8 rounded-lg bg-accent-500 flex items-center justify-center shrink-0">
          <Package className="w-4 h-4 text-white" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-2 flex-wrap">
            <span className="font-display font-bold text-gray-900">Batch cooking</span>
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] px-2 py-0.5 rounded-full bg-accent-100 text-accent-700">
              {JOURS_NOMS[batchJour]}
            </span>
          </span>
          <span className="block text-xs text-gray-500 mt-0.5 truncate">
            {batchRecipes.size} recettes couvrent vos repas jusqu&apos;à {JOURS_NOMS[(batchJour + 3) % 7]}
          </span>
        </span>
        <span className="text-xs font-semibold text-accent-600 shrink-0 hidden sm:inline">
          {open ? 'Masquer' : 'Voir la session'}
        </span>
        <ChevronDown className={cn('w-4 h-4 text-accent-600 shrink-0 transition-transform', open && 'rotate-180')} />
      </button>

      {/* Détail de la session (déplié) */}
      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-accent-200/70">
          <p className="text-sm text-gray-600 mt-3">
            Ce {JOURS_NOMS[batchJour].toLowerCase()}, cuisinez <strong>{batchRecipes.size} recettes</strong> qui couvrent
            vos repas jusqu&apos;au {JOURS_NOMS[(batchJour + 3) % 7].toLowerCase()} — le reste de la semaine, c&apos;est du réchauffage.
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {Array.from(batchRecipes.values()).map((r, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-white rounded-lg text-xs text-gray-600 border border-gray-200">
                {r.titre}<span className="text-gray-500">({r.days.join(', ')})</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
