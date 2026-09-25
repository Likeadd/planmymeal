'use client';

// ============================================================================
// MealCard — carte de repas du planning (vue mobile, < md).
// Charte LANDING : brand terracotta (plats principaux), sauge #E2F1E7
// (accompagnements/desserts), sable (restes), accent lavande (interactions).
// Aucun noir/charcoal : les textes forts passent en brun chaud (gray-900 de la
// palette crème). Animations framer-motion conservées (swap / drag & drop),
// désactivées si prefers-reduced-motion.
// ============================================================================

import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import Link from 'next/link';
import {
  Check, X, GripVertical, Shuffle, Star, Plus,
  RefreshCw, Clock, Flame, Repeat, ChefHat as ChefIcon,
  MoreHorizontal, Info, ShoppingCart,
} from 'lucide-react';
import type { RecettePlanning, RepasSlot } from '@/types';
import { formatMinutes, formatCalories, familleDessert, cn, titreMajuscules } from '@/lib/utils';
import { formatPrix, prixParPortion } from '@/lib/budget';
import { ustensileEmoji } from '@/lib/ustensiles';
import { MealNotation } from '@/components/dashboard/MealNotation';
import { WhyModal } from '@/components/dashboard/WhyModal';
import { FamilleBadges } from '@/components/dashboard/FamilleBadges';

export function MealCard({
  repas, meal, status, regenerating, onDragStart, onDrop, onMarkStatus, onSwap, onRegenerate,
  restesDe, sourceTitre, onToggleRestes, restesToggling, resteActifPourDemain,
  slot, jourIndex,
}: {
  repas: string; meal: RecettePlanning | null;
  status: string | null;
  regenerating: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onMarkStatus: (mealId: number, status: 'cooked' | 'skipped') => void;
  onSwap: () => void;
  onRegenerate: () => void;
  /** Ce déjeuner est le reste du dîner de la veille (meal_id source) */
  restesDe?: number | null;
  /** Titre du dîner source (affichage "Restes de …") */
  sourceTitre?: string | null;
  /** Toggle restes (uniquement sur les dîners lundi → samedi) */
  onToggleRestes?: () => void;
  restesToggling?: boolean;
  /** true = le déjeuner de demain est les restes de ce dîner */
  resteActifPourDemain?: boolean;
  /** Créneau du planning (« Pourquoi ce repas ? » a besoin du jour + du créneau) */
  slot?: RepasSlot;
  /** Index du jour 0=lundi..6=dimanche */
  jourIndex?: number;
}) {
  const reduceMotion = useReducedMotion();
  const [notationOuverte, setNotationOuverte] = useState(false);
  const [pourquoiOuvert, setPourquoiOuvert] = useState(false);
  /** Dernière note posée dans cette session → pastille pleine sur l'étoile */
  const [note, setNote] = useState<number | null>(null);
  const pourquoiDisponible = slot != null && jourIndex != null;
  /** Menu « ⋯ » : les actions secondaires sortent de la carte (audit mobile #10) */
  const [menuOuvert, setMenuOuvert] = useState(false);
  /** Statut replié : une seule ligne discrète « À faire » → ouvre les 2 actions */
  const [statutOuvert, setStatutOuvert] = useState(false);

  // ── Bulle « titre complet » (mobile) : appui long ≈ 500 ms ────────────────
  // Le clamp à 2 lignes tronque les titres longs ; sans survol sur tactile,
  // un appui long affiche le titre intégral (comme un tooltip natif).
  // Annulé au moindre défilement (touchmove) — c'est un press, pas un scroll.
  const titreRef = useRef<HTMLHeadingElement>(null);
  const [titreTronqué, setTitreTronqué] = useState(false);
  const [bulleVisible, setBulleVisible] = useState(false);
  const tronquéRef = useRef(false);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cacheTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const annulerPress = () => {
    if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null; }
  };

  const handleTouchStart = () => {
    const el = titreRef.current;
    tronquéRef.current = !!el && el.scrollHeight > el.clientHeight + 2;
    setTitreTronqué(tronquéRef.current);
    annulerPress();
    pressTimer.current = setTimeout(() => {
      if (!tronquéRef.current) return;
      setBulleVisible(true);
      // Retour haptique léger (non supporté partout, silencieux sinon)
      navigator.vibrate?.(10);
    }, 500);
  };

  const handleTouchEnd = () => {
    annulerPress();
    if (bulleVisible) {
      if (cacheTimer.current) clearTimeout(cacheTimer.current);
      // La bulle reste lisible ~1,5 s après le relâchement
      cacheTimer.current = setTimeout(() => setBulleVisible(false), 1_500);
    }
  };

  // Nettoyage des minuteries au démontage (navigation entre jours)
  useEffect(() => () => {
    annulerPress();
    if (cacheTimer.current) clearTimeout(cacheTimer.current);
  }, []);

  if (!meal) {
    // Créneau vide : ligne fine et discrète (audit mobile #14) — le gros bloc
    // en pointillés de 96 px créait beaucoup de vide entre les repas.
    // Dessert vide : le libellé nomme le créneau ET explique le rythme (axe 1
    // de l'audit desserts) — un vide muet se lisait comme un oubli du moteur.
    const estDessertVide = slot === 'dessert' || slot === 'dessert_midi';
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/60"
        onDragOver={e => { e.preventDefault(); }} onDrop={onDrop}>
        <button onClick={onSwap}
          className="w-full flex flex-col items-center justify-center gap-0.5 px-4 min-h-[44px] py-2 text-[13px] font-semibold text-gray-500 hover:text-brand-600 hover:border-brand-200 transition-colors">
          {estDessertVide ? (
            <>
              <span className="flex items-center gap-2">
                <Plus className="w-4 h-4" /> Ajouter un dessert
              </span>
              <span className="text-[11px] font-normal text-gray-500">
                {slot === 'dessert'
                  ? 'Rythme équilibré : 3-4 desserts par semaine'
                  : 'Desserts du midi : légers et occasionnels'}
              </span>
            </>
          ) : (
            <span className="flex items-center gap-2">
              <Plus className="w-4 h-4" /> Ajouter un repas
            </span>
          )}
        </button>
      </div>
    );
  }

  // Ustensiles "clés" : on exclut les basiques toujours nécessaires
  // (couteau, planche, saladier...) pour ne montrer que le matériel notable.
  const USTENSILES_BASIQUES = new Set([
    'Couteau de chef', 'Économe', 'Saladier', 'Passoire', 'Plan de travail',
    'Cuillère en bois', 'Spatule', 'Râpe', 'Papier cuisson', 'Presse-ail',
    'Ciseaux', 'Pinceau de cuisine', 'Thermomètre',
  ]);
  const ustensilesCles = (meal.ustensiles || []).filter(u => !USTENSILES_BASIQUES.has(u)).slice(0, 4);
  const prixPortion = prixParPortion(meal);
  const estReste = restesDe != null;
  // Famille de dessert (yaourt, compote, pâtisserie...) : emoji adapté sur la
  // pastille + chip de famille sur la carte, au lieu du 🍰 générique.
  const estSlotDessert = repas === 'Dessert' || repas === 'Dessert midi';
  const famille = estSlotDessert && !estReste ? familleDessert(meal) : null;
  // Étiquette de type (cf. charte landing) : plat principal → terracotta,
  // accompagnement/dessert → sauge pastel, reste → sable.
  const etiquette = estReste
    ? 'bg-accent-100 text-accent-700'
    : estSlotDessert
      ? 'bg-sauge-100 text-sauge-700'
      : 'bg-brand-500 text-white';

  return (
    <div className="relative group select-none [-webkit-touch-callout:none]"
      draggable onDragStart={onDragStart}
      onTouchStart={handleTouchStart}
      onTouchMove={annulerPress}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={annulerPress}
      // Le long-press sur un lien ouvre le menu contextuel natif — on le
      // neutralise seulement quand la bulle va s'afficher (titre tronqué).
      onContextMenu={e => { if (titreTronqué) e.preventDefault(); }}>
      {/* Poignée drag */}
      <div className="absolute left-0 top-1/2 -translate-y-1/2 -ml-3 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing z-10">
        <GripVertical className="w-5 h-5 text-gray-300 hover:text-brand-400" />
      </div>

      {/* Contenu animé : quand le repas change (swap / drag & drop), fade-slide
          au lieu d'un re-render sec. key={meal.id} → remontage animé. */}
      <motion.div
        key={meal.id}
        // Toujours le même `initial` serveur/client : `useReducedMotion()` vaut
        // null au SSR, un `initial={reduceMotion ? false : …}` provoquerait un
        // hydration mismatch. Seule la durée change (non rendue dans le DOM).
        initial={{ opacity: 0, y: 6, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: reduceMotion ? 0 : 0.25, ease: 'easeOut' }}
      >
      <Link href={`/recette/${estReste && restesDe ? restesDe : meal.id}`}
        className={cn(
          'block rounded-2xl border p-5 transition-all group/link cursor-pointer shadow-card hover:shadow-pop hover:-translate-y-0.5',
          estReste ? 'border-accent-200 bg-accent-50 hover:border-accent-300'
            : status === 'cooked' ? 'border-sauge-300 bg-sauge-100/60'
            : status === 'skipped' ? 'border-gray-200 opacity-50'
            : estSlotDessert
              ? 'border-sauge-200 bg-sauge-100/50 hover:border-sauge-300'
              : 'border-gray-100 bg-white hover:border-brand-200',
        )}>
        <div className="flex items-start justify-between mb-2 gap-3">
          <div className="flex items-start gap-4 min-w-0">
            {/* Pastille repas : dégradés doux de la charte, soleil/lune/dessert */}
            <div className={cn(
              'w-14 h-14 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 border',
              estReste ? 'bg-accent-100 border-accent-200'
                : estSlotDessert ? 'bg-sauge-100 border-sauge-200'
                : 'bg-gradient-to-br from-brand-100 to-accent-100 border-brand-200/60',
            )}>
              {estReste ? '🍱' : famille ? famille.emoji : repas === 'Dîner' ? '🌙' : '☀️'}
            </div>
            <div className="min-w-0">
              {/* Étiquette de type, aux couleurs de la landing (plus de noir) */}
              <span className={cn('inline-block text-xs font-bold uppercase tracking-[0.08em] px-2.5 py-1 rounded-full', etiquette)}>
                {repas}
              </span>
              {              estReste ? (
                <>
                  <h4 ref={titreRef} className="font-bold text-sable-800 text-[15px] mt-1.5 truncate">🍱 Restes de {sourceTitre || 'la veille'}</h4>
                  <p className="text-xs text-gray-500 mt-1 truncate">Plat d&apos;origine prévu : {meal.titre}</p>
                </>
              ) : (
                <h4 ref={titreRef} className="font-bold text-gray-900 text-[15.5px] leading-snug mt-1.5 group-hover/link:text-brand-600 transition-colors [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical] overflow-hidden">{titreMajuscules(meal.titre)}</h4>
              )}
            </div>
          </div>
          {/* Audit mobile #10 : une seule action visible — « Remplacer ». Toutes
              les autres (noter, pourquoi, régénérer, restes) vivent dans le menu
              « ⋯ » ; quatre pictos simultanés attiraient l'œil sur chaque carte. */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {/* Cibles tactiles 44×44 (audit mobile : p-2 = 34px, trop petit) */}
            <button onClick={e => { e.preventDefault(); e.stopPropagation(); onSwap(); }}
              className="flex items-center justify-center w-11 h-11 rounded-xl text-accent-600 hover:bg-accent-50 transition-colors"
              title={estReste ? 'Remplacer (désactive le mode restes)' : 'Remplacer ce repas'}>
              <Shuffle className="w-[18px] h-[18px]" />
              <span className="sr-only">Remplacer</span>
            </button>
            <button onClick={e => { e.preventDefault(); e.stopPropagation(); setMenuOuvert(v => !v); }}
              aria-expanded={menuOuvert} aria-haspopup="menu" aria-label="Plus d'actions"
              className={cn('flex items-center justify-center w-11 h-11 rounded-xl transition-colors', menuOuvert ? 'bg-gray-100 text-gray-700' : 'text-gray-300 hover:text-gray-600 hover:bg-gray-50')}>
              <MoreHorizontal className="w-[18px] h-[18px]" />
            </button>
          </div>
        </div>

        {estReste ? (
          <>
            {/* Méta compacte conservée : réchauffage ≈ 10 min, mêmes calories et prix que le dîner source */}
            <div className="flex items-center gap-3.5 text-[13px] text-gray-600 flex-wrap">
              <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> ~10 min</span>
              <span className="flex items-center gap-1"><Flame className="w-3.5 h-3.5" /> {formatCalories(meal.calories_par_portion)}</span>
              {prixPortion != null && (
                <span className="flex items-center gap-0.5 font-semibold text-sauge-700 bg-sauge-100 px-2 py-0.5 rounded-full">{formatPrix(prixPortion)} · même prix que le dîner</span>
              )}
            </div>
            <div className="flex items-center gap-2 text-[13px] text-sable-700 font-medium mt-2">
              <Repeat className="w-3.5 h-3.5" /> Réchauffage demain midi — le dîner de la veille est cuisiné ×2, rien à ajouter aux courses
            </div>
          </>
        ) : (
          <div className="flex items-center gap-3.5 text-[13px] text-gray-600 flex-wrap">
            {famille && (
              <span className="flex items-center gap-1 font-semibold text-sauge-700 bg-sauge-100 px-2 py-0.5 rounded-full">{famille.label}</span>
            )}
            <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {formatMinutes(meal.temps_preparation + (meal.temps_cuisson || 0))}</span>
            <span className="flex items-center gap-1"><Flame className="w-3.5 h-3.5" /> {formatCalories(meal.calories_par_portion)}</span>
            <span className="flex items-center gap-1"><ChefIcon className="w-3.5 h-3.5" /> {meal.difficulte}</span>
            {prixPortion != null && (
              <span className="flex items-center gap-0.5 font-semibold text-sauge-700 bg-sauge-100 px-2 py-0.5 rounded-full">{formatPrix(prixPortion)}</span>
            )}
            {/* Avis de chaque membre du foyer sur cette recette (rien si foyer seul).
                Une carte « restes » ne les répète pas : c'est le même plat que le
                dîner de la veille, déjà annoté au-dessus. */}
            <FamilleBadges meal={meal} />
          </div>
        )}

        {onToggleRestes && resteActifPourDemain && (
          <div className="mt-2.5 flex items-center gap-2 text-xs font-medium text-sable-700 bg-sable-100 border border-sable-200 rounded-lg px-2 py-1 w-fit">
            <Repeat className="w-3.5 h-3.5" /> Cuisiner ×2 — demain midi, c&apos;est les restes
          </div>
        )}

        {/* Ustensiles principaux (matériel spécifique uniquement) */}
        {ustensilesCles.length > 0 && (
          <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
            {ustensilesCles.map(u => (
              <span key={u} className="inline-flex items-center gap-1.5 px-2 py-1 bg-creme-50 border border-sable-200 text-gray-500 text-xs rounded-lg"
                title={`Ustensile : ${u}`}>
                <span>{ustensileEmoji(u) ?? '🔧'}</span>{u}
              </span>
            ))}
          </div>
        )}

        {/* Badge statut */}
        {status === 'cooked' && (
          <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 bg-sauge-500 text-white text-[13px] font-semibold rounded-full">
            <Check className="w-3.5 h-3.5" /> Cuit
          </div>
        )}
        {status === 'skipped' && (
          <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 text-gray-500 text-[13px] font-semibold rounded-full">
            <X className="w-3.5 h-3.5" /> Sauté
          </div>
        )}
      </Link>
      </motion.div>

      {/* ── Menu « ⋯ » : actions secondaires hors du lien de la carte ─────── */}
      {menuOuvert && (
        <>
          <div className="fixed inset-0 z-20" aria-hidden
            onClick={e => { e.preventDefault(); e.stopPropagation(); setMenuOuvert(false); }} />
          <div role="menu" aria-label="Actions du repas"
            className="absolute right-2 top-14 z-30 w-56 rounded-2xl border border-gray-200 bg-white shadow-xl py-1.5">
            <button role="menuitem" onClick={e => { e.preventDefault(); e.stopPropagation(); setMenuOuvert(false); setNotationOuverte(true); }}
              disabled={estReste} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-medium text-gray-700 hover:bg-brand-50 disabled:opacity-40 disabled:pointer-events-none text-left transition-colors">
              <Star className={cn('w-4 h-4 text-accent-500', note != null && 'fill-accent-500')} />
              {note != null ? `Noter ce repas · ${note}/5` : 'Noter ce repas'}
            </button>
            {pourquoiDisponible && (
              <button role="menuitem" onClick={e => { e.preventDefault(); e.stopPropagation(); setMenuOuvert(false); setPourquoiOuvert(true); }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-medium text-gray-700 hover:bg-brand-50 text-left transition-colors">
                <Info className="w-4 h-4 text-brand-500" /> Pourquoi ce repas&nbsp;?
              </button>
            )}
            {!estReste && (
              <button role="menuitem" onClick={e => { e.preventDefault(); e.stopPropagation(); setMenuOuvert(false); onRegenerate(); }}
                disabled={regenerating}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-medium text-gray-700 hover:bg-brand-50 disabled:opacity-40 text-left transition-colors">
                <RefreshCw className={cn('w-4 h-4 text-brand-500', regenerating && 'animate-spin')} /> Une autre idée
              </button>
            )}
            {onToggleRestes && !estReste && (
              <button role="menuitem" onClick={e => { e.preventDefault(); e.stopPropagation(); setMenuOuvert(false); onToggleRestes(); }}
                disabled={restesToggling}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-medium text-gray-700 hover:bg-brand-50 disabled:opacity-40 text-left transition-colors">
                <Repeat className="w-4 h-4 text-sable-600" /> {resteActifPourDemain ? 'Annuler les restes de demain' : 'Cuisiner ×2 (restes demain)'}
              </button>
            )}
            <div className="my-1 h-px bg-gray-100" />
            <Link role="menuitem" href={`/recette/${estReste && restesDe ? restesDe : meal.id}`}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-medium text-gray-700 hover:bg-brand-50 transition-colors">
              <ChefIcon className="w-4 h-4 text-sauge-600" /> Voir la recette
            </Link>
            {estSlotDessert && (
              <Link role="menuitem" href="/recettes?rayon=desserts"
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-medium text-gray-700 hover:bg-brand-50 transition-colors">
                <ShoppingCart className="w-4 h-4 text-sauge-600" /> Voir les desserts
              </Link>
            )}
          </div>
        </>
      )}

      {/* ── Statut : une seule ligne discrète au repos (audit mobile #13) ──
          « C'est fait » / « Sauté » toujours visibles allongeaient la page :
          repliés derrière « À faire », ouverts au clic (ou déjà tranchés). */}
      {status == null && !statutOuvert ? (
        <button onClick={() => setStatutOuvert(true)}
          className="mt-1.5 mx-auto flex items-center gap-1.5 px-4 min-h-[44px] text-[12px] font-semibold rounded-full text-gray-500 hover:text-gray-600 hover:bg-gray-50 active:scale-95 transition-all"
          title="Marquer comme cuisiné ou sauté">
          <Plus className="w-3.5 h-3.5" /> À faire
        </button>
      ) : (
        <div className="flex items-center justify-center gap-2.5 mt-2">
          <button onClick={() => onMarkStatus(meal.id, 'cooked')}
            className="flex items-center gap-1.5 px-4 min-h-[44px] text-[13px] font-semibold rounded-full bg-sauge-100 text-sauge-700 hover:bg-sauge-200 active:scale-95 transition-all shadow-sm"
            title="Marquer comme cuisiné">
            <Check className="w-4 h-4" strokeWidth={2.5} /> C&apos;est fait
          </button>
          <button onClick={() => onMarkStatus(meal.id, 'skipped')}
            className="flex items-center gap-1.5 px-4 min-h-[44px] text-[13px] font-semibold rounded-full bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-700 active:scale-95 transition-all"
            title="On a sauté ce repas">
            <X className="w-4 h-4" strokeWidth={2.5} /> Sauté
          </button>
        </div>
      )}

      {/* Bulle « titre complet » : superposée à la carte pendant un appui long
          (+ ~1,5 s après le relâchement). pointer-events-none → ne bloque rien. */}
      {bulleVisible && titreTronqué && (
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: reduceMotion ? 0 : 0.18, ease: 'easeOut' }}
          aria-hidden
          className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center p-3"
        >
          <div className="rounded-xl bg-gray-900/90 text-white px-3.5 py-2.5 text-sm font-bold leading-snug text-center shadow-xl">
            {estReste ? <>🍱 Restes de {sourceTitre ? titreMajuscules(sourceTitre) : 'la veille'}</> : titreMajuscules(meal.titre)}
          </div>
        </motion.div>
      )}

      {/* Notation & explication : en modales, hors du <Link> de la carte pour ne
          pas imbriquer d'éléments interactifs dans le lien vers la recette. */}
      {notationOuverte && (
        <MealNotation mealId={meal.id} titre={meal.titre}
          onClose={() => setNotationOuverte(false)} onNoted={setNote} />
      )}
      {pourquoiOuvert && slot != null && jourIndex != null && (
        <WhyModal mealId={meal.id} titre={meal.titre} jour={jourIndex} repas={slot}
          onClose={() => setPourquoiOuvert(false)} />
      )}
    </div>
  );
}
