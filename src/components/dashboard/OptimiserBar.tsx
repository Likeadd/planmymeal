'use client';

// ============================================================================
// OptimiserBar — la fonctionnalité CENTRALE du produit (audit UX).
//
// « Régénérer » disait « refais le tirage » ; « Optimiser ma semaine » dit ce
// que le moteur fait VRAIMENT : il arbitre simultanément budget, goûts, temps,
// stock (frigo), restes, nutrition et gaspillage. Le CTA porte ce vocabulaire
// partout — desktop : bouton de topbar (DashboardShell) ; MOBILE : cette fiche
// discrète fixée au-dessus de la bottom-nav (semaine courante uniquement), là
// où l'action la plus fréquente n'avait aucune présence.
//
// Le clic direct optimise de façon ÉQUILIBRÉE (le geste primaire reste unique).
// Le caret ouvre le menu d'INTENTION : le moteur incline sa pondération vers
// le budget, le temps ou l'anti-gaspillage — sans jamais remplacer les autres
// dimensions ni les contraintes dures (voir IntentionOptimisation).
// ============================================================================

import { useState } from 'react';
import { ChevronDown, Check, Crown, Sparkles } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { estPayant } from '@/lib/limites';
import { cn } from '@/lib/utils';
import type { IntentionOptimisation } from '@/lib/rotation-engine';

export type { IntentionOptimisation };

/** Libellés du menu — vocabulaire bénéfice, pas mécanisme */
const INTENTIONS: { value: IntentionOptimisation | 'equilibre'; label: string; sous: string }[] = [
  { value: 'equilibre', label: 'Équilibrée', sous: 'le juste milieu entre toutes les dimensions' },
  { value: 'budget', label: 'Penser au budget', sous: 'favorise les recettes économiques' },
  { value: 'temps', label: 'Gain de temps', sous: 'favorise les recettes rapides' },
  { value: 'gaspillage', label: 'Anti-gaspi', sous: 'utilise en priorité votre frigo' },
];

export function OptimiserBar({
  onOptimiser, loading,
}: {
  onOptimiser: (intention?: IntentionOptimisation) => void | Promise<void>;
  loading: boolean;
}) {
  const [menuOuvert, setMenuOuvert] = useState(false);
  const payant = estPayant(useAuth().profile?.plan);

  const lancer = (v: IntentionOptimisation | 'equilibre') => {
    setMenuOuvert(false);
    void onOptimiser(v === 'equilibre' ? undefined : v);
  };

  return (
    <>
      {/* Desktop : le bouton de topbar (DashboardShell) porte déjà l'action —
          un seul bouton par écran, jamais deux qui rivalisent. */}

      {/* ── Mobile/tablette : fiche fixée au-dessus de la bottom-nav. Assez
          discrète pour ne pas rivaliser avec le contenu, assez présente pour
          que l'action centrale soit à portée de pouce en permanence. */}
      <div className="lg:hidden fixed bottom-[60px] inset-x-0 z-20 px-4 pb-[env(safe-area-inset-bottom)] pointer-events-none">
        {/* Menu d'intention : AU-DESSUS de la fiche (elle est en bas d'écran) */}
        {menuOuvert && (
          <>
            <button aria-hidden tabIndex={-1} onClick={() => setMenuOuvert(false)}
              className="pointer-events-auto fixed inset-0 z-10 cursor-default" />
            <div role="menu" aria-label="Choisir l'optimisation"
              className="pointer-events-auto relative z-20 mx-auto max-w-sm mb-2 rounded-2xl bg-white border border-gray-200 shadow-xl overflow-hidden">
              {INTENTIONS.map(it => (
                <button key={it.value} role="menuitem" onClick={() => lancer(it.value)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors">
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold text-gray-900">{it.label}</span>
                    <span className="block text-xs text-gray-500">{it.sous}</span>
                  </span>
                  {it.value === 'equilibre'
                    ? <Check className="w-4 h-4 text-brand-500 shrink-0" aria-label="défaut" />
                    : !payant && <Crown className="w-4 h-4 text-accent-500 shrink-0" aria-label="Pro" />}
                </button>
              ))}
            </div>
          </>
        )}
        <div data-tour="optimiser" className="pointer-events-auto flex items-stretch gap-1.5">
          <button onClick={() => lancer('equilibre')} disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-brand-500 rounded-full shadow-cta hover:bg-brand-600 disabled:opacity-60 transition-colors">
            {loading
              ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" aria-hidden />
              : <Sparkles className="w-4 h-4" aria-hidden />}
            Optimiser ma semaine
          </button>
          <button onClick={() => setMenuOuvert(v => !v)} disabled={loading}
            aria-label="Choisir le type d'optimisation" aria-expanded={menuOuvert}
            className="w-11 flex items-center justify-center rounded-full bg-brand-500 text-white shadow-cta hover:bg-brand-600 disabled:opacity-60 transition-colors">
            <ChevronDown className={cn('w-4 h-4 transition-transform', menuOuvert && 'rotate-180')} aria-hidden />
          </button>
        </div>
      </div>
    </>
  );
}

/**
 * Bouton desktop AVEC menu d'intention — utilisé par la topbar (DashboardShell).
 * Clic principal = équilibré ; caret = menu (même choix que la fiche mobile).
 */
export function OptimiserButton({
  onOptimiser, loading,
}: {
  onOptimiser: (intention?: IntentionOptimisation) => void | Promise<void>;
  loading: boolean;
}) {
  const [menuOuvert, setMenuOuvert] = useState(false);
  const payant = estPayant(useAuth().profile?.plan);

  const lancer = (v: IntentionOptimisation | 'equilibre') => {
    setMenuOuvert(false);
    void onOptimiser(v === 'equilibre' ? undefined : v);
  };

  return (
    <div className="relative">
      <div data-tour="optimiser" className="flex items-stretch">
        <button onClick={() => lancer('equilibre')} disabled={loading}
          className="inline-flex items-center gap-1.5 px-5 py-2.5 text-[11px] font-semibold tracking-[0.14em] uppercase text-white bg-brand-500 rounded-l-full hover:bg-brand-600 disabled:opacity-60 transition-colors shadow-cta">
          {loading
            ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" aria-hidden />
            : <Sparkles className="w-4 h-4" aria-hidden />}
          Optimiser ma semaine
        </button>
        <button onClick={() => setMenuOuvert(v => !v)} disabled={loading}
          aria-label="Choisir le type d'optimisation" aria-expanded={menuOuvert}
          className="inline-flex items-center px-2 text-white bg-brand-500 rounded-r-full border-l border-white/25 hover:bg-brand-600 disabled:opacity-60 transition-colors shadow-cta">
          <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', menuOuvert && 'rotate-180')} aria-hidden />
        </button>
      </div>

      {menuOuvert && (
        <>
          <button aria-hidden tabIndex={-1} onClick={() => setMenuOuvert(false)}
            className="fixed inset-0 z-30 cursor-default" />
          <div role="menu" aria-label="Choisir l'optimisation"
            className="absolute right-0 top-full mt-2 z-40 w-64 rounded-2xl bg-white border border-gray-200 shadow-xl overflow-hidden">
            {INTENTIONS.map(it => (
              <button key={it.value} role="menuitem" onClick={() => lancer(it.value)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors">
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-gray-900">{it.label}</span>
                  <span className="block text-xs text-gray-500">{it.sous}</span>
                </span>
                {it.value === 'equilibre'
                    ? <Check className="w-4 h-4 text-brand-500 shrink-0" aria-label="défaut" />
                    : !payant && <Crown className="w-4 h-4 text-accent-500 shrink-0" aria-label="Pro" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Bandeau de PROMESSE : une seule ligne discrète sous le titre (desktop) ou
 * repliée derrière une pastille (mobile) — l'interface fait progressivement
 * comprendre que le produit optimise plusieurs dimensions à la fois, sans
 * transformer le dashboard en dashboard.
 */
export function PromesseOptimisation({ className }: { className?: string }) {
  return (
    <p className={cn('hidden md:flex items-center gap-1.5 text-xs text-gray-500', className)}
      title="Ce que le moteur arbitre à chaque génération">
      <Sparkles className="w-3.5 h-3.5 text-brand-400" aria-hidden />
      Une semaine optimisée&nbsp;:
      <span className="font-semibold text-gray-600">budget · goûts · temps · stock · restes · nutrition · gaspillage</span>
    </p>
  );
}
