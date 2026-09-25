'use client';

// ============================================================================
// WeekColumns — vue semaine 7 colonnes (desktop ≥ md), maquette validée.
// Charte LANDING appliquée : puces repas aux couleurs de la landing —
// plats principaux = terracotta (brand), desserts/accompagnements = sauge
// pastel #E2F1E7, restes = sable, batch = lavande (accent).
//
// Lisibilité d'abord : chaque puce est une vraie carte — label du créneau,
// titre lisible (13,5 px), ligne méta (temps · kcal · prix/portion · foyer),
// bouton « cuisiné » toujours visible et barre d'actions flottante avec des
// zones de clic de 24 px. Les créneaux vides sont de vraies cibles de drop.
// ============================================================================

import { useRef, useState } from 'react';
import Link from 'next/link';
import { RefreshCw, Shuffle, Star, HelpCircle, Repeat, Loader2, CalendarDays, Plus, Check } from 'lucide-react';
import type { DayPlan, RecettePlanning, RepasSlot } from '@/types';
import { formatMinutes, cn, titreMajuscules } from '@/lib/utils';
import { formatPrix, prixParPortion } from '@/lib/budget';
import { useAuth } from '@/components/AuthProvider';
import { useTodayIndex } from '@/lib/useTodayIndex';
import { MealNotation } from '@/components/dashboard/MealNotation';
import { WhyModal } from '@/components/dashboard/WhyModal';
import { FamilleBadges } from '@/components/dashboard/FamilleBadges';
import { FamilleLegendeInline } from '@/components/dashboard/FamilleLegende';

export function WeekColumns({
  days, semaineDebut, dragOver, moving, mealStatuses, regeneratingSlots, onDragStart, onDragOver, onDragLeave, onDrop,
  onMarkStatus, onSwap, onRegenerate, onToggleRestes, restesToggling, estSemaineCourante, nbDesserts,
}: {
  days: DayPlan[];
  /** Nombre de desserts de la semaine (affiché dans la légende) — recalculé
      en interne si absent (rétro-compatibilité tests/usages légers) */
  nbDesserts?: number;
  /** Lundi de la semaine affichée (YYYY-MM-DD) → numéros de jours réels */
  semaineDebut: string;
  /** Créneau survolé pendant un drag : clé "jourIndex-repas" */
  dragOver: string | null;
  /** Un déplacement est en cours (pas de second drop simultané) */
  moving: boolean;
  mealStatuses: Record<number, string>;
  regeneratingSlots: Record<string, boolean>;
  onDragStart: (e: React.DragEvent, dayIndex: number, repas: RepasSlot) => void;
  onDragOver: (e: React.DragEvent, dayIndex: number, repas?: RepasSlot) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, toDay: number, toType: RepasSlot) => void;
  onMarkStatus: (mealId: number, status: 'cooked' | 'skipped') => void;
  onSwap: (dayIndex: number, repas: RepasSlot) => void;
  onRegenerate: (dayIndex: number, repas: RepasSlot) => void;
  onToggleRestes: (jourDiner: number) => void;
  restesToggling: number | null;
  estSemaineCourante: boolean;
}) {
  // Jour batch (source de la session) — même source de vérité que le profil.
  // La colonne du jour batch reçoit le traitement visuel spécial (fond lavande).
  const { profile } = useAuth();
  const batchActive = profile?.batch_cooking === true;
  const batchJour = profile?.batch_cooking_jour ?? 6;
  // Décompte desserts : prop si fournie, sinon recalcul local (mêmes règles
  // que le `recup` du hook — soir + midi).
  const dessertsComptes = nbDesserts ?? days.reduce(
    (s, d) => s + (d.dessert ? 1 : 0) + (d.dessertMidi ? 1 : 0), 0
  );

  return (
    <div>
      {/* Titre de section + légende (comme la maquette). La clé du foyer est
          FONDUE dans cette en-tête (FamilleLegendeInline) : une seule ligne de
          légende au lieu de deux barres empilées qui rivalisaient avec les
          cartes (audit UX). Le bandeau complet reste < md (mobile). */}
      <div className="hidden lg:flex items-center justify-between gap-4 mb-3">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold tracking-tight text-gray-900">
          <CalendarDays className="w-4 h-4 text-brand-500" aria-hidden />
          Planning de la semaine
        </h2>
        <div className="flex items-center gap-5 text-xs font-semibold text-gray-500">
          <FamilleLegendeInline />
          <LegendDot cls="bg-brand-500" label="Plat principal" />
          <LegendDot cls="bg-sauge-200" label="Dessert" />
          <LegendDot cls="bg-accent-200" label="Reste" />
          {/* Axe 1 de l'audit desserts : le rythme est une DÉCISION du moteur —
              l'énoncer ici répond « pourquoi tous les soirs n'ont pas de
              dessert ? » avant même que la question ne se pose. */}
          <span className="text-[11px] font-medium text-gray-500" title="Rythme équilibré par défaut — réglable dans Mon compte">
            🍰 {dessertsComptes} desserts cette semaine
          </span>
        </div>
      </div>

      <div className="hidden lg:grid grid-cols-7 gap-2.5">
        {days.map(day => (
          <DayColumn key={day.jour} day={day} semaineDebut={semaineDebut}
            dragOver={dragOver} moving={moving} mealStatuses={mealStatuses} regeneratingSlots={regeneratingSlots}
            onDragStart={onDragStart} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
            onMarkStatus={onMarkStatus} onSwap={onSwap} onRegenerate={onRegenerate}
            onToggleRestes={onToggleRestes} restesToggling={restesToggling}
            estSemaineCourante={estSemaineCourante}
            estJourBatch={batchActive && day.jourIndex === batchJour} />
        ))}
      </div>
    </div>
  );
}

function LegendDot({ cls, label }: { cls: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-3 h-3 rounded-[5px] ${cls}`} aria-hidden />{label}
    </span>
  );
}

// ─── Colonne d'un jour ──────────────────────────────────────────────────────

function DayColumn({
  day, semaineDebut, dragOver, moving, mealStatuses, regeneratingSlots, onDragStart, onDragOver, onDragLeave, onDrop,
  onMarkStatus, onSwap, onRegenerate, onToggleRestes, restesToggling, estSemaineCourante, estJourBatch,
}: {
  day: DayPlan;
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
  onMarkStatus: (mealId: number, status: 'cooked' | 'skipped') => void;
  onSwap: (dayIndex: number, repas: RepasSlot) => void;
  onRegenerate: (dayIndex: number, repas: RepasSlot) => void;
  onToggleRestes: (jourDiner: number) => void;
  restesToggling: number | null;
  estSemaineCourante: boolean;
  /** Colonne du jour de la session batch → fond lavande + pied spécial */
  estJourBatch: boolean;
}) {
  const repasDuJour = [day.dejeuner, day.diner, day.dessert, day.dessertMidi].filter(Boolean) as RecettePlanning[];
  const minutesDuJour = repasDuJour.reduce((s, m) => s + m.temps_preparation + (m.temps_cuisson || 0), 0);
  const kcalDuJour = repasDuJour.reduce((s, m) => s + (m.calories_par_portion || 0), 0);
  // Jour courant via useTodayIndex : fuseau Europe/Paris (identique serveur et
  // navigateur) et valeur sentinelle au SSR → aucun hydration mismatch.
  const todayIndex = useTodayIndex();
  const estAujourdhui = estSemaineCourante && todayIndex === day.jourIndex;
  // Un créneau PRÉCIS de cette colonne est survolé (cible fine du drag & drop)
  const creneauSurvolé = dragOver != null && dragOver.startsWith(`${day.jourIndex}-`);

  return (
    <div
      onDragOver={e => onDragOver(e, day.jourIndex)}
      onDragLeave={onDragLeave}
      onDrop={e => onDrop(e, day.jourIndex, 'diner')}
      className={`
        flex flex-col rounded-2xl border bg-white p-2.5 min-h-[400px] transition-all
        ${creneauSurvolé
          ? 'border-brand-400 ring-2 ring-brand-200 shadow-pop'
          : estAujourdhui
            ? 'border-brand-300 ring-1 ring-brand-200 shadow-card'
            : 'border-gray-200 shadow-card'}
        ${!creneauSurvolé && estJourBatch ? 'bg-linear-to-b from-accent-100 to-white border-accent-200' : ''}
      `}
    >
      {/* En-tête : jour + date réelle (ex : LUN 7) — aligné sur le bord des
          cartes (pas de px-1 : le texte ne « flotte » plus 4px à l'intérieur). */}
      <div className="flex items-center justify-between mb-2.5">
        <span className={`text-xs font-extrabold uppercase tracking-widest ${estAujourdhui ? 'text-brand-600' : 'text-gray-500'}`}>
          {day.jour.slice(0, 3)}
        </span>
        <span className={`text-[11px] font-bold ${estAujourdhui ? 'text-brand-400' : 'text-gray-300'}`}>
          {jourDuMois(semaineDebut, day.jourIndex)}
        </span>
      </div>

      {/* Puces repas : chaque créneau est une cible de drop PRÉCISE — on peut
          déposer une recette sur le déjeuner, le dîner ou un dessert de n'importe
          quel jour (permutation serveur, liste de courses recalculée). */}
      <div className="flex flex-col gap-2 flex-1"
        onDragOver={e => onDragOver(e, day.jourIndex)} onDragLeave={onDragLeave}>
        <MealChip type="dejeuner" meal={day.dejeuner} jour={day.jourIndex}
          status={day.dejeuner ? mealStatuses[day.dejeuner.id] : null}
          restesDe={day.restesDe}
          regenerating={!!regeneratingSlots[`${day.jourIndex}-dejeuner`]}
          dropSurvolé={dragOver === `${day.jourIndex}-dejeuner`}
          moving={moving}
          onDragStart={onDragStart} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
          onSwap={onSwap} onRegenerate={onRegenerate} onMarkStatus={onMarkStatus} />
        <MealChip type="dessert_midi" meal={day.dessertMidi} jour={day.jourIndex}
          status={day.dessertMidi ? mealStatuses[day.dessertMidi.id] : null}
          regenerating={!!regeneratingSlots[`${day.jourIndex}-dessert_midi`]}
          dropSurvolé={dragOver === `${day.jourIndex}-dessert_midi`}
          moving={moving}
          onDragStart={onDragStart} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
          onSwap={onSwap} onRegenerate={onRegenerate} onMarkStatus={onMarkStatus} />
        <MealChip type="diner" meal={day.diner} jour={day.jourIndex}
          status={day.diner ? mealStatuses[day.diner.id] : null}
          regenerating={!!regeneratingSlots[`${day.jourIndex}-diner`]}
          dropSurvolé={dragOver === `${day.jourIndex}-diner`}
          moving={moving}
          onDragStart={onDragStart} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
          onSwap={onSwap} onRegenerate={onRegenerate} onMarkStatus={onMarkStatus}
          onToggleRestes={day.jourIndex <= 5 ? onToggleRestes : undefined}
          restesToggling={restesToggling === day.jourIndex}
          resteActifPourDemain={day.restesDe != null} />
        <MealChip type="dessert" meal={day.dessert} jour={day.jourIndex}
          status={day.dessert ? mealStatuses[day.dessert.id] : null}
          regenerating={!!regeneratingSlots[`${day.jourIndex}-dessert`]}
          dropSurvolé={dragOver === `${day.jourIndex}-dessert`}
          moving={moving}
          onDragStart={onDragStart} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
          onSwap={onSwap} onRegenerate={onRegenerate} onMarkStatus={onMarkStatus} />
      </div>

      {/* Pied de colonne : temps · kcal — le jour batch affiche « session batch »
          (comme la maquette) : la durée seule est trompeuse, elle nourrit 4 jours */}
      {repasDuJour.length > 0 && (
        <div className="mt-2.5 pt-2 border-t border-dashed border-sable-200 flex items-center justify-between text-[11px] font-semibold text-gray-500">
          <span>{formatMinutes(minutesDuJour)}</span>
          {estJourBatch
            ? <span className="text-accent-500">✨ session batch</span>
            : kcalDuJour > 0 && <span>{kcalDuJour.toLocaleString('fr-FR')} kcal</span>}
        </div>
      )}
    </div>
  );
}

/** Numéro réel du jour dans le mois : lundi (semaineDebut) + jourIndex */
function jourDuMois(semaineDebut: string, jourIndex: number): string {
  const d = new Date(`${semaineDebut}T12:00:00`);
  d.setDate(d.getDate() + jourIndex);
  return String(d.getDate());
}

// ─── Carte repas colorée (clic = fiche, hover = actions) ────────────────────

type ChipType = 'dejeuner' | 'diner' | 'dessert' | 'dessert_midi';

/**
 * Charte LANDING :  * - plats principaux (déjeuner / dîner) → crème + accent terracotta : la
  *   couleur reste un SÉMANTIQUE fonctionnel (voir CISSE ci-dessous) ;
  * - desserts / accompagnements → crème légèrement différente (sauge pastel) ;
  * - restes → lavande très légère (ACCORDÉON : le fond lavande de la colonne
  *   batch, où naissent les restes — la couleur devient fonctionnelle, pas
  *   décorative) ; vert n'a PLUS la charge de « dessert » (il garde « cuisiné /
  *   validé »), et le vert sur un dessert se lisait « succès », sans sens.
 */
const CHIP_STYLES: Record<ChipType, { chip: string; label: string; emoji: string; labelCls: string; meta: string }> = {
  dejeuner: {
    // Plats : crème + accent terracotta (bordure + libellé), pas de bloc
    // plein : 7 colonnes × 4+ cartes pleines rendaient la grille oppressive,
    // et la couleur porte mieux sur un accent que sur un fond.
    chip: 'bg-white border-l-4 border-brand-500 rounded-2xl',
    label: 'Déjeuner', emoji: '☀️', labelCls: 'text-brand-600', meta: 'text-gray-500',
  },
  dessert: {
    chip: 'bg-sauge-50 border-l-4 border-sauge-300 rounded-2xl',
    label: 'Dessert', emoji: '🍰', labelCls: 'text-sauge-700', meta: 'text-sauge-700/90',
  },
  dessert_midi: {
    chip: 'bg-sauge-50 border-l-4 border-sauge-300 rounded-2xl',
    label: 'Dessert midi', emoji: '🍰', labelCls: 'text-sauge-700', meta: 'text-sauge-700/90',
  },
  diner: {
    chip: 'bg-white border-l-4 border-brand-500 rounded-2xl',
    label: 'Dîner', emoji: '🌙', labelCls: 'text-brand-600', meta: 'text-gray-500',
  },
};

function MealChip({ type, meal, jour, status, restesDe, regenerating, dropSurvolé, moving, onDragStart, onDragOver, onDragLeave, onDrop, onSwap, onRegenerate, onMarkStatus, onToggleRestes, restesToggling, resteActifPourDemain }: {
  type: ChipType;
  meal: RecettePlanning | null;
  jour: number;
  status: string | null;
  restesDe?: number | null;
  regenerating: boolean;
  /** Ce créneau précis est la cible du drag en cours (liseré + fond) */
  dropSurvolé?: boolean;
  moving?: boolean;
  onDragStart: (e: React.DragEvent, dayIndex: number, repas: RepasSlot) => void;
  onDragOver: (e: React.DragEvent, dayIndex: number, repas?: RepasSlot) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, toDay: number, toType: RepasSlot) => void;
  onSwap: (dayIndex: number, repas: RepasSlot) => void;
  onRegenerate: (dayIndex: number, repas: RepasSlot) => void;
  onMarkStatus: (mealId: number, status: 'cooked' | 'skipped') => void;
  onToggleRestes?: (jourDiner: number) => void;
  restesToggling?: boolean;
  resteActifPourDemain?: boolean;
}) {
  const style = CHIP_STYLES[type];
  const estReste = type === 'dejeuner' && restesDe != null;
  const [notation, setNotation] = useState(false);
  const [pourquoi, setPourquoi] = useState(false);
  // Bulle « titre complet » : affichée seulement si le clamp à 2 lignes
  // tronque réellement le titre (mesurée au survol, scrollHeight > clientHeight)
  const lienTitreRef = useRef<HTMLAnchorElement>(null);
  const [titreTronqué, setTitreTronqué] = useState(false);
  const mesurerTronqué = () => {
    const el = lienTitreRef.current;
    setTitreTronqué(!!el && el.scrollHeight > el.clientHeight + 2);
  };

  if (!meal) {
    // Créneau vide : vraie cible de drop (liseré terracotta au survol) + bouton d'ajout généreux.
    // Dessert vide : le libellé explique le RYTHME (axe 1 de l'audit desserts) —
    // un vide muet se lisait comme un oubli du moteur.
    const estDessertVide = type === 'dessert' || type === 'dessert_midi';
    return (
      <div
        onDragOver={e => onDragOver(e, jour, type)}
        onDragLeave={onDragLeave}
        onDrop={e => onDrop(e, jour, type)}
        title={estDessertVide && type === 'dessert'
          ? 'Pas de dessert ce soir — le rythme équilibré de la semaine est atteint (3-4 soirs). Ajoutez-en un si vous le souhaitez.'
          : undefined}
        className={`rounded-2xl border-2 border-dashed p-3 min-h-[56px] flex items-center justify-center gap-1.5 transition-colors ${
          dropSurvolé ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-brand-300 hover:bg-brand-50/40'}`}
      >
        <button onClick={() => onSwap(jour, type)}
          className={`flex items-center gap-1.5 text-xs font-semibold transition-colors ${dropSurvolé ? 'text-brand-600' : 'text-gray-300 hover:text-brand-500'}`}>
          {dropSurvolé ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {dropSurvolé ? 'Déposer ici' : estDessertVide ? 'Ajouter un dessert' : 'Ajouter'}
        </button>
      </div>
    );
  }

  const estDessert = type === 'dessert' || type === 'dessert_midi';
  const prix = prixParPortion(meal);

  return (
    <div
      className="relative group/chip"
      draggable={moving !== true}
      onMouseEnter={mesurerTronqué}
      onDragStart={e => onDragStart(e, jour, type)}
      onDragOver={e => onDragOver(e, jour, type)}
      onDragLeave={onDragLeave}
      onDrop={e => onDrop(e, jour, type)}
    >
      <div className={`relative p-3 transition-all ${
        dropSurvolé
          ? 'rounded-2xl ring-2 ring-brand-300 bg-brand-50 scale-[1.02]'
          : estReste
            ? 'rounded-2xl bg-accent-50 border border-dashed border-accent-200 text-accent-800'
            : cn(style.chip, 'hover:shadow-lg hover:-translate-y-0.5 hover:cursor-grab active:cursor-grabbing')}`}>
        {/* Bouton « cuisiné » : ancré au coin haut-droit (position IDENTIQUE
            sur toutes les cartes, même si le label passe sur 2 lignes) */}
        <button
          onClick={e => { e.preventDefault(); e.stopPropagation(); onMarkStatus(meal.id, 'cooked'); }}
          title={status === 'cooked' ? 'Cuisiné ✓' : 'Marquer comme cuisiné'}
          aria-label={status === 'cooked' ? 'Cuisiné' : 'Marquer comme cuisiné'}
          className={`absolute top-2 right-2 z-10 w-6 h-6 rounded-full flex items-center justify-center shadow-xs transition-colors ${
            status === 'cooked'
              ? 'bg-sauge-500 text-white'
              : estReste
                ? 'bg-white/80 text-gray-300 hover:text-sauge-600'
                : type === 'diner' || type === 'dejeuner'
                  ? 'bg-white/25 text-white/70 hover:bg-white hover:text-sauge-600'
                  : 'bg-white text-gray-300 border border-sauge-200 hover:text-sauge-600'
          }`}>
          <Check className="w-3.5 h-3.5" strokeWidth={3} />
        </button>

        {/* Label du créneau — l'espace à droite (pr-8) lui réserve la place
            du bouton ; le retour à la ligne est permis et sans conséquence */}
        <div className="mb-1.5 pr-8">
          <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.04em] leading-tight ${estReste ? 'text-accent-600' : style.labelCls}`}>
            <span aria-hidden className="text-sm leading-none">{estReste ? '♻️' : style.emoji}</span>
            {estReste ? 'Reste' : style.label}
          </span>
        </div>

        {/* Titre — 2 lignes max en base (les colonnes ne sautent pas), et
            titre COMPLET en bulle agrandie au survol (voir plus bas). Clamp
            écrit en propriétés explicites (webkits) pour ne pas dépendre de
            la génération de l'utilitaire line-clamp. */}
        <Link ref={lienTitreRef} href={`/recette/${estReste && restesDe ? restesDe : meal.id}`}
          className="block font-bold text-[13.5px] leading-snug [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical] overflow-hidden hover:underline underline-offset-2">
          {estReste ? 'Restes (de la veille)' : titreMajuscules(meal.titre)}
        </Link>

        {/* Titre complet au survol (seulement si tronqué) : bulle agrandie —
            SOUS la carte pour les créneaux du haut de colonne (déjeuner,
            dessert midi), AU-DESSUS pour ceux du bas (dîner, dessert) : elle
            reste toujours dans l'écran. pointer-events-none → ne bloque ni
            drag, ni actions. */}
        {titreTronqué && (
        <div aria-hidden
          className={`pointer-events-none absolute left-1/2 -translate-x-1/2 z-20 w-[calc(100%+16px)] max-w-[260px]
            ${type === 'dejeuner' || type === 'dessert_midi' ? 'top-full mt-1.5' : 'bottom-full mb-1.5'}
            opacity-0 translate-y-1 scale-95 group-hover/chip:opacity-100 group-hover/chip:translate-y-0 group-hover/chip:scale-100
            transition-all duration-150`}>
          <div className="rounded-xl bg-white border border-gray-200 shadow-xl px-3 py-2 text-[12.5px] font-bold text-gray-900 leading-snug text-center">
            {estReste ? 'Restes (de la veille)' : titreMajuscules(meal.titre)}
          </div>
        </div>
        )}

        {/* Méta : temps · prix/portion · foyer — pas de points de séparation
            (ils se retrouvaient orphelins en fin de ligne), chaque groupe
            insécable pour un retour à la ligne propre. SANS kcal : le pied de
            colonne donne déjà le total du jour — la redondance chargeait la
            lecture de la grille (audit UX : informations redondantes). */}
        <div className={`mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-semibold ${estReste ? 'text-accent-600' : style.meta}`}>
          <span className="whitespace-nowrap">{formatMinutes(meal.temps_preparation + (meal.temps_cuisson || 0))}</span>
          {!estDessert && !estReste && prix != null && <span className="whitespace-nowrap">{formatPrix(prix)}/p</span>}
          {!estReste && <FamilleBadges meal={meal} compacte className="ml-auto" />}
        </div>
      </div>

      {/* Barre d'actions flottante au survol : vraies zones de clic (24 px) */}
      <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 z-10 flex items-center gap-0.5 rounded-full bg-white p-1 border border-gray-200 shadow-lg
        opacity-0 group-hover/chip:opacity-100 focus-within:opacity-100 transition-opacity pointer-events-none
        group-hover/chip:pointer-events-auto">
        {!estReste && (
          <>
            <ChipAction title="Noter ce repas"
              icon={<Star className="w-3.5 h-3.5" />}
              className="hover:bg-accent-50 hover:text-accent-600"
              onClick={() => setNotation(true)} />
            <ChipAction title="Pourquoi ce repas ?"
              icon={<HelpCircle className="w-3.5 h-3.5" />}
              className="hover:bg-brand-50 hover:text-brand-600"
              onClick={() => setPourquoi(true)} />
            <ChipAction title="Régénérer ce repas" disabled={regenerating}
              icon={<RefreshCw className={cn('w-3.5 h-3.5', regenerating && 'animate-spin')} />}
              className="hover:bg-accent-50 hover:text-accent-600"
              onClick={() => onRegenerate(jour, type)} />
          </>
        )}
        {type === 'diner' && onToggleRestes && (
          <ChipAction title={resteActifPourDemain ? 'Annuler les restes de demain midi' : 'Cuisiner ×2 — restes demain midi'}
            disabled={restesToggling}
            icon={restesToggling
              ? <Loader2 className="w-3.5 h-3.5 animate-spin text-sable-600" />
              : <Repeat className={cn('w-3.5 h-3.5', resteActifPourDemain && 'text-sable-600')} />}
            className="hover:bg-sable-100 hover:text-sable-700"
            onClick={() => onToggleRestes(jour)} />
        )}
        <ChipAction title="Remplacer"
          icon={<Shuffle className="w-3.5 h-3.5" />}
          className="hover:bg-accent-50 hover:text-accent-600"
          onClick={() => onSwap(jour, type)} />
      </div>

      {/* Notation & explication (mêmes modales que la vue mobile) */}
      {notation && (
        <MealNotation mealId={meal.id} titre={meal.titre} onClose={() => setNotation(false)} />
      )}
      {pourquoi && (
        <WhyModal mealId={meal.id} titre={meal.titre} jour={jour} repas={type} onClose={() => setPourquoi(false)} />
      )}
    </div>
  );
}

function ChipAction({ icon, title, onClick, className = '', disabled }: {
  icon: React.ReactNode; title: string; onClick: () => void; className?: string; disabled?: boolean;
}) {
  return (
    <button onClick={e => { e.preventDefault(); e.stopPropagation(); onClick(); }}
      disabled={disabled} title={title} aria-label={title}
      className={`p-1.5 rounded-full bg-white border border-gray-100 shadow-xs text-gray-500 transition-colors hover:scale-105 disabled:opacity-40 disabled:hover:scale-100 ${className}`}>
      {icon}
    </button>
  );
}
