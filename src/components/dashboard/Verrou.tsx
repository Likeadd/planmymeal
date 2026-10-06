'use client';

// ============================================================================
// Verrou du plan gratuit sur le planning et la liste de courses.
//
// Un compte gratuit voit JOURS_VISIBLES_GRATUIT jours de sa semaine
// (aujourd'hui et demain ; lundi et mardi pour une autre semaine) et le début
// de sa liste de courses. Le reste est flouté, avec l'offre de débloquer la
// semaine complète (paywall d'abonnement).
// ============================================================================

import { Lock } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { useTodayIndex } from '@/lib/useTodayIndex';
import { ouvrirPaywall } from '@/lib/paywall';
import { estPayant, JOURS_VISIBLES_GRATUIT } from '@/lib/limites';
import { cn } from '@/lib/utils';

const AUCUN = new Set<number>();

/** Indices (0 = lundi) des jours verrouillés pour le compte connecté. */
export function useJoursVerrouilles(estSemaineCourante: boolean): Set<number> {
  const { profile } = useAuth();
  const aujourdhui = useTodayIndex();
  if (!profile || estPayant(profile.plan)) return AUCUN;
  const debut = estSemaineCourante && aujourdhui >= 0 ? Math.min(aujourdhui, 7 - JOURS_VISIBLES_GRATUIT) : 0;
  const verrouilles = new Set<number>();
  for (let j = 0; j < 7; j++) if (j < debut || j >= debut + JOURS_VISIBLES_GRATUIT) verrouilles.add(j);
  return verrouilles;
}

/** Bandeau au-dessus du planning : part de la semaine visible + déblocage. */
export function BandeauVerrou({ nbVerrouilles, className }: { nbVerrouilles: number; className?: string }) {
  const visibles = 7 - nbVerrouilles;
  const pct = Math.round((visibles / 7) * 100);
  return (
    <div className={cn('rounded-3xl border border-brand-200 bg-brand-50 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4', className)}>
      <div className="flex-1 min-w-0">
        <p className="font-display text-lg font-bold text-gray-900">Vous voyez {visibles} jours sur 7 de votre semaine</p>
        <div className="mt-2 h-2 rounded-full bg-white overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Part de la semaine visible">
          <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 text-sm text-gray-600">Les {nbVerrouilles} autres jours, la liste de courses complète et les desserts sont prêts.</p>
      </div>
      <BoutonDebloquer raison="semaine" />
    </div>
  );
}

export function BoutonDebloquer({ raison, libelle, className }: { raison: 'semaine' | 'courses'; libelle?: string; className?: string }) {
  return (
    <button onClick={() => ouvrirPaywall(raison)}
      className={cn('shrink-0 inline-flex items-center justify-center gap-2 min-h-[44px] px-5 rounded-full bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 shadow-cta transition-colors', className)}>
      <Lock className="w-4 h-4" aria-hidden />
      {libelle ?? 'Débloquer ma semaine'}
    </button>
  );
}

/** Repas verrouillé : carte factice floutée (aucune donnée réelle affichée). */
export function CarteVerrouillee({ grande = false }: { grande?: boolean }) {
  return (
    <button type="button" onClick={() => ouvrirPaywall('semaine')} aria-label="Repas verrouillé — débloquer la semaine"
      className={cn('relative w-full rounded-2xl border border-gray-100 bg-white overflow-hidden text-left', grande ? 'min-h-[200px]' : 'min-h-[88px]')}>
      <span className="absolute inset-0 flex items-stretch blur-[3px]" aria-hidden>
        <span className="w-16 shrink-0 bg-brand-100" />
        <span className="flex-1 px-4 py-4 space-y-2">
          <span className="block h-3 w-3/4 rounded-full bg-gray-200" />
          <span className="block h-3 w-1/2 rounded-full bg-gray-100" />
          <span className="block h-2.5 w-1/3 rounded-full bg-brand-100" />
        </span>
      </span>
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/95 border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-xs">
          <Lock className="w-3.5 h-3.5 text-brand-500" aria-hidden /> Débloquer
        </span>
      </span>
    </button>
  );
}
