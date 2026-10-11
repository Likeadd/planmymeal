'use client';

import { cn } from '@/lib/utils';
import { STRIPE_PLANS, prixPlan, type Periode, type PlanType } from '@/lib/stripe';

/** Remise annuelle la plus faible parmi les plans (affichée sur l'onglet « Annuel »). */
const REMISE_MIN = Math.min(...(Object.keys(STRIPE_PLANS) as PlanType[]).map(p => prixPlan(p, 'annuel').economie));

/**
 * Bascule Mensuel / Annuel — partagée par la page Tarifs, la page Compte et le
 * paywall (une seule présentation, un seul libellé de remise).
 */
export function SelecteurPeriode({
  valeur, onChange, surFondSombre = false, className,
}: { valeur: Periode; onChange: (p: Periode) => void; surFondSombre?: boolean; className?: string }) {
  const options: { id: Periode; label: string }[] = [
    { id: 'mensuel', label: 'Mensuel' },
    { id: 'annuel', label: 'Annuel' },
  ];
  return (
    <div role="radiogroup" aria-label="Périodicité de facturation"
      className={cn('inline-flex items-center rounded-full border p-1 gap-1', surFondSombre ? 'border-white/30' : 'border-gray-200 bg-white', className)}>
      {options.map(o => (
        <button key={o.id} type="button" role="radio" aria-checked={valeur === o.id} onClick={() => onChange(o.id)}
          className={cn('min-h-[36px] px-4 rounded-full text-sm font-semibold transition-colors inline-flex items-center gap-2',
            valeur === o.id ? 'bg-brand-500 text-white shadow-cta' : 'text-gray-600 hover:text-brand-600')}>
          {o.label}
          {o.id === 'annuel' && (
            <span className={cn('text-[11px] font-bold rounded-full px-2 py-0.5',
              valeur === 'annuel' ? 'bg-white/25 text-white' : 'bg-sauge-100 text-sauge-700')}>
              −{REMISE_MIN} %
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
