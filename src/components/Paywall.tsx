'use client';

// ============================================================================
// Paywall — abonnement aux plans Pro et Famille.
//
// S'ouvre (événement `pmm:paywall`, voir lib/paywall.ts) :
//   • quand un compte gratuit lance l'optimisation de sa semaine : il peut
//     s'abonner, ou « continuer avec la version gratuite » ;
//   • quand une route payante répond 402 (limite atteinte, fonction réservée) ;
//   • depuis un bouton verrouillé (desserts, intentions, famille…).
// Le paiement passe par Stripe Checkout (abonnement mensuel, résiliable à
// tout moment depuis la page Compte).
// ============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Crown, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/components/AuthProvider';
import { EVENEMENT_PAYWALL, type DetailPaywall } from '@/lib/paywall';
import { estPayant, JOURS_VISIBLES_GRATUIT, OPTIMISATIONS_GRATUITES_PAR_SEMAINE, type RaisonPaywall } from '@/lib/limites';
import { STRIPE_PLANS, prixPlan, type Periode, type PlanType } from '@/lib/stripe';
import { SelecteurPeriode } from '@/components/SelecteurPeriode';
import { track } from '@/lib/analytics';
import { redirectToCheckout } from '@/lib/stripe-client';
import { cn } from '@/lib/utils';

const TITRES: Record<RaisonPaywall, { titre: string; texte: string }> = {
  semaine: { titre: 'Débloquez toute votre semaine', texte: `Votre semaine complète est prête : ${7 - JOURS_VISIBLES_GRATUIT} jours de plus, la liste de courses entière et les desserts, avec Pro.` },
  courses: { titre: 'Votre liste de courses complète', texte: 'Tous les ingrédients de la semaine, additionnés et triés par rayon, à cocher en magasin. Inclus dans Pro et Famille.' },
  generation: { titre: 'Votre semaine idéale, sans limite', texte: `Avec Pro, accédez à votre semaine complète et optimisez-la autant que vous voulez, desserts compris.` },
  optimisations: { titre: 'Vous avez utilisé votre optimisation de la semaine', texte: `Le plan gratuit inclut ${OPTIMISATIONS_GRATUITES_PAR_SEMAINE} optimisation tous les 7 jours. Passez à Pro pour optimiser sans limite.` },
  remplacements: { titre: 'Changez vos repas sans limite', texte: 'Vous avez utilisé vos remplacements automatiques de la semaine. Avec Pro, changez autant de repas que vous voulez.' },
  desserts: { titre: 'Les desserts sont inclus dans Pro', texte: 'Le moteur ajoute des desserts à vos semaines, du rythme léger au rythme gourmand, avec leurs ingrédients dans la liste de courses.' },
  intentions: { titre: 'Optimisez selon votre priorité', texte: 'Budget serré, peu de temps ou frigo à vider : les optimisations ciblées sont incluses dans Pro.' },
  frigo: { titre: 'Cuisinez votre frigo sans limite', texte: 'Vous avez utilisé vos recherches de la semaine. Avec Pro, trouvez des recettes avec vos restes à volonté.' },
  imports: { titre: 'Importez toutes vos recettes', texte: 'Le plan gratuit inclut un import par mois. Avec Pro, importez vos recettes préférées sans limite.' },
  'prix-max': { titre: 'Fixez un prix maximum par portion', texte: 'Le moteur écarte les recettes au-dessus de votre plafond. Inclus dans Pro.' },
  famille: { titre: 'Toute la famille à table', texte: 'Ajoutez jusqu’à 5 profils avec les allergies et les goûts de chacun : le moteur compose des menus qui conviennent à tous.' },
  'foyer-partage': { titre: 'Partagez votre foyer', texte: 'Planning et liste de courses partagés entre plusieurs comptes : inclus dans le plan Famille.' },
  decouvrir: { titre: 'Passez à la vitesse supérieure', texte: 'Débloquez toutes les fonctionnalités avec Pro ou Famille.' },
};

export function Paywall() {
  const { profile } = useAuth();
  const [detail, setDetail] = useState<DetailPaywall | null>(null);
  const [plan, setPlan] = useState<PlanType>('pro');
  const [periode, setPeriode] = useState<Periode>('annuel');
  const [chargement, setChargement] = useState(false);
  const bouton = useRef<HTMLButtonElement>(null);
  const payant = estPayant(profile?.plan);

  useEffect(() => {
    const ouvrir = (e: Event) => {
      const d = (e as CustomEvent<DetailPaywall>).detail;
      // Un compte déjà payant n'est jamais bloqué : on poursuit l'action.
      if (payant) { d.continuer?.(); return; }
      setPlan(d.raison === 'famille' || d.raison === 'foyer-partage' ? 'famille' : 'pro');
      setDetail(d);
    };
    window.addEventListener(EVENEMENT_PAYWALL, ouvrir);
    return () => window.removeEventListener(EVENEMENT_PAYWALL, ouvrir);
  }, [payant]);

  const fermer = useCallback(() => { setDetail(null); setChargement(false); }, []);

  useEffect(() => {
    if (!detail) return;
    bouton.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') fermer(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [detail, fermer]);

  if (!detail) return null;

  const { titre, texte } = TITRES[detail.raison];
  const offre = STRIPE_PLANS[plan];

  const essayer = async () => {
    track('Clic abonnement', { plan, periode, origine: detail.raison });
    setChargement(true);
    try {
      await redirectToCheckout(plan, periode);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Paiement momentanément indisponible.');
      setChargement(false);
    }
  };

  const continuerGratuit = () => {
    const suite = detail.continuer;
    fermer();
    suite?.();
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="paywall-titre">
      <div className="absolute inset-0 bg-gray-900/60" onClick={fermer} aria-hidden />
      <div className="relative w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] overflow-y-auto">
        <button onClick={fermer} aria-label="Fermer"
          className="absolute top-3 right-3 w-9 h-9 flex items-center justify-center rounded-full text-gray-500 hover:bg-gray-100">
          <X className="w-4 h-4" />
        </button>

        <div className="p-6 sm:p-7">
          <div className="w-12 h-12 rounded-2xl bg-brand-50 flex items-center justify-center mb-4">
            <Crown className="w-6 h-6 text-brand-500" aria-hidden />
          </div>
          <h2 id="paywall-titre" className="font-display text-2xl font-bold text-gray-900 pr-8 leading-snug">{titre}</h2>
          <p className="mt-2 text-sm text-gray-600 leading-relaxed">{texte}</p>

          <SelecteurPeriode valeur={periode} onChange={setPeriode} className="mt-5" />

          {/* Choix du plan */}
          <div role="radiogroup" aria-label="Choisir un plan" className="mt-5 grid grid-cols-2 gap-2">
            {(Object.keys(STRIPE_PLANS) as PlanType[]).map(p => (
              <button key={p} type="button" role="radio" aria-checked={plan === p} onClick={() => setPlan(p)}
                className={cn('text-left rounded-2xl border-2 px-4 py-3 transition-colors',
                  plan === p ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-brand-200')}>
                <span className="block text-sm font-bold text-gray-900">{STRIPE_PLANS[p].name}</span>
                <span className="block text-xs text-gray-600 mt-0.5">
                  {prixPlan(p, periode).montant} €/{prixPlan(p, periode).unite}
                </span>
              </button>
            ))}
          </div>

          <ul className="mt-5 space-y-2">
            {offre.features.map(f => (
              <li key={f} className="flex items-start gap-2.5 text-sm text-gray-700">
                <Check className="w-4 h-4 text-brand-500 shrink-0 mt-0.5" aria-hidden />{f}
              </li>
            ))}
          </ul>

          {(
            <>
              <button ref={bouton} onClick={essayer} disabled={chargement}
                className="mt-6 w-full inline-flex items-center justify-center gap-2 min-h-[48px] text-sm font-semibold text-white bg-brand-500 rounded-full hover:bg-brand-600 shadow-cta disabled:opacity-60 transition-colors">
                {chargement ? <><Loader2 className="w-4 h-4 animate-spin" /> Redirection…</> : `Débloquer avec ${offre.name} · ${prixPlan(plan, periode).montant} €/${prixPlan(plan, periode).unite}`}
              </button>
              <p className="mt-2.5 text-center text-xs text-gray-500 leading-relaxed">
                Paiement sécurisé par Stripe. Résiliable à tout moment depuis votre compte, en un clic.
              </p>
            </>
          )}

          <button onClick={continuerGratuit}
            className="mt-3 w-full min-h-[44px] text-sm font-medium text-gray-500 hover:text-gray-800 transition-colors">
            {detail.continuer ? 'Continuer avec la version gratuite' : 'Plus tard'}
          </button>
        </div>
      </div>
    </div>
  );
}
