'use client';

// ============================================================================
// PlanCard — carte d'offre Pro / Famille (extraite de compte/page.tsx)
// CTA → redirectToCheckout géré par le parent (handleUpgrade).
// ============================================================================

import { ArrowRight, Check, Crown, Loader2, Users } from 'lucide-react';
import { STRIPE_ENABLED, STRIPE_PLANS, type PlanType } from '@/lib/stripe';

export function PlanCard({
  plan,
  currentPlan,
  upgrading,
  onUpgrade,
}: {
  plan: PlanType;
  currentPlan: string;
  upgrading: PlanType | null;
  onUpgrade: (plan: PlanType) => void;
}) {
  const p = STRIPE_PLANS[plan];
  const isCurrent = currentPlan === plan;
  const isLoading = upgrading === plan;

  return (
    <div className={`bg-white rounded-2xl p-6 border-2 transition-all ${
      plan === 'pro'
        ? 'border-brand-200 hover:border-brand-400'
        : 'border-accent-200 hover:border-accent-400'
    } shadow-xs`}>
      {/* Badge */}
      <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium mb-4 ${
        plan === 'pro' ? 'bg-brand-100 text-brand-700' : 'bg-accent-100 text-accent-700'
      }`}>
        {plan === 'pro' ? <Crown className="w-3.5 h-3.5" /> : <Users className="w-3.5 h-3.5" />}
        {p.name}
      </div>

      {/* Prix */}
      <div className="mb-4">
        <span className="text-3xl font-bold font-display text-gray-900">{p.price}€</span>
        <span className="text-gray-500 text-sm">/mois</span>
      </div>

      {/* Features */}
      <ul className="space-y-2 mb-6">
        {p.features.map((f, i) => (
          <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
            <Check className="w-4 h-4 text-sauge-500 shrink-0" />
            {f}
          </li>
        ))}
      </ul>

      {/* CTA */}
      {!STRIPE_ENABLED && !isCurrent ? (
        // Paiement pas encore ouvert : état honnête plutôt qu'un clic mort.
        <span className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-full font-semibold text-sm bg-gray-100 text-gray-500">
          Bientôt disponible
        </span>
      ) : (
        <button
          onClick={() => onUpgrade(plan)}
          disabled={isLoading || isCurrent}
          className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-full font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
            plan === 'pro'
              ? 'bg-brand-500 text-white hover:bg-brand-600 shadow-cta'
              : 'bg-accent-500 text-white hover:bg-accent-600 shadow-card'
          }`}
        >
          {isLoading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Redirection...</>
          ) : isCurrent ? (
            'Plan actuel'
          ) : (
            <>{p.cta} <ArrowRight className="w-4 h-4" /></>
          )}
        </button>
      )}
    </div>
  );
}
