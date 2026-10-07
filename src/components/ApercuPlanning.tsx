// ============================================================================
// Aperçu du planning (accueil, inscription) — reproduction fidèle de l'écran
// « Ma semaine » du dashboard : 7 jours × déjeuner/dîner, budget, calories et
// liste de courses. Exemple statique, rendu en HTML (net sur tous les écrans,
// aucun poids d'image). Mobile : 4 jours affichés, le reste résumé.
// ============================================================================

import { Check, ShoppingCart, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

const SEMAINE: { jour: string; dej: [string, string, string]; din: [string, string, string] }[] = [
  { jour: 'Lun', dej: ['🍗', 'Poulet rôti, légumes', '45 min'], din: ['🎃', 'Velouté de potimarron', '25 min'] },
  { jour: 'Mar', dej: ['🥗', 'Salade de lentilles, feta', '15 min'], din: ['🐟', 'Saumon, riz & brocoli', '30 min'] },
  { jour: 'Mer', dej: ['🍝', 'Penne au pesto maison', '20 min'], din: ['🍛', 'Curry de pois chiches', '35 min'] },
  { jour: 'Jeu', dej: ['🌯', 'Wrap poulet-crudités', '15 min'], din: ['🥘', 'Hachis parmentier', '50 min'] },
  { jour: 'Ven', dej: ['🍜', 'Bowl soba & dinde', '25 min'], din: ['🍕', 'Pizza maison légumes', '40 min'] },
  { jour: 'Sam', dej: ['🥙', 'Pitas garnies saumon', '30 min'], din: ['🍲', 'Blanquette de veau', '1h30'] },
  { jour: 'Dim', dej: ['🥞', 'Brunch crêpes & œufs', '25 min'], din: ['🥗', 'Buddha bowl quinoa', '20 min'] },
];

function Repas({ r, actif }: { r: [string, string, string]; actif?: boolean }) {
  return (
    <div className={cn('flex items-center gap-2 rounded-xl px-2 py-1.5 min-w-0', actif ? 'bg-brand-50 ring-1 ring-brand-200' : 'bg-gray-50')}>
      <span className="w-7 h-7 rounded-full bg-white shadow-xs flex items-center justify-center text-sm shrink-0" aria-hidden>{r[0]}</span>
      <span className="min-w-0">
        <span className="block text-[11px] sm:text-xs font-semibold text-gray-900 truncate">{r[1]}</span>
        <span className="block text-[10px] text-gray-500">{r[2]}</span>
      </span>
    </div>
  );
}

export function ApercuPlanning({ className }: { className?: string }) {
  return (
    <figure className={cn('relative md:mb-24', className)} aria-label="Exemple de planning de la semaine dans PlanMyMeal">
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl shadow-brand-900/20 ring-1 ring-black/5 overflow-hidden">
        {/* Barre de fenêtre */}
        <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-gray-100 bg-gray-50/80" aria-hidden>
          <span className="w-2.5 h-2.5 rounded-full bg-brand-300" />
          <span className="w-2.5 h-2.5 rounded-full bg-sable-300" />
          <span className="w-2.5 h-2.5 rounded-full bg-sauge-300" />
          <span className="ml-3 text-[10px] text-gray-400 truncate">planmymeal · Ma semaine</span>
        </div>

        <div className="p-3 sm:p-5">
          {/* En-tête de semaine */}
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div>
              <p className="text-[10px] tracking-[0.2em] uppercase text-brand-600 font-semibold">Ma semaine</p>
              <p className="font-display text-base sm:text-lg font-bold text-gray-900">Du 13 au 19 octobre</p>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] sm:text-[11px] font-semibold bg-sauge-100 text-sauge-700 px-2 py-1 rounded-full">62 € / 70 €</span>
              <span className="text-[10px] sm:text-[11px] font-semibold bg-accent-100 text-accent-700 px-2 py-1 rounded-full">1 950 kcal/j</span>
            </div>
          </div>

          {/* Colonnes Déjeuner / Dîner */}
          <div className="grid grid-cols-[2.25rem_1fr_1fr] gap-x-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5" aria-hidden>
            <span />
            <span>Déjeuner</span>
            <span>Dîner</span>
          </div>
          <ul className="space-y-1.5">
            {SEMAINE.map((j, i) => (
              <li key={j.jour} className={cn('grid grid-cols-[2.25rem_1fr_1fr] gap-x-2 items-center', i >= 4 && 'hidden sm:grid')}>
                <span className={cn('text-xs font-bold', i === 1 ? 'text-brand-600' : 'text-gray-700')}>{j.jour}</span>
                <Repas r={j.dej} actif={i === 1} />
                <Repas r={j.din} />
              </li>
            ))}
          </ul>
          <p className="sm:hidden mt-2 text-center text-[11px] text-gray-500">+ samedi et dimanche</p>

          {/* Pied : optimisation */}
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
            <span className="text-[11px] text-gray-500">14 repas · rotation 21 jours</span>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-brand-500 text-white px-2.5 py-1 rounded-full">
              <Sparkles className="w-3 h-3" aria-hidden /> Optimisée
            </span>
          </div>
        </div>
      </div>

      {/* Liste de courses flottante (écrans larges) */}
      <div className="hidden md:block absolute top-full -mt-14 -left-8 w-52 bg-white rounded-2xl shadow-xl ring-1 ring-black/5 p-3.5 rotate-[-3deg]" aria-hidden>
        <p className="flex items-center gap-1.5 text-xs font-bold text-gray-900">
          <ShoppingCart className="w-3.5 h-3.5 text-brand-500" /> Liste de courses
          <span className="ml-auto text-[10px] font-semibold text-gray-400">32</span>
        </p>
        <ul className="mt-2 space-y-1.5 text-[11px] text-gray-700">
          {[['Filets de poulet', true], ['Potimarron', true], ['Lentilles vertes', false], ['Saumon frais', false]].map(([n, ok]) => (
            <li key={n as string} className="flex items-center gap-2">
              <span className={cn('w-3.5 h-3.5 rounded flex items-center justify-center', ok ? 'bg-sauge-500 text-white' : 'border border-gray-300')}>
                {ok && <Check className="w-2.5 h-2.5" />}
              </span>
              <span className={ok ? 'line-through text-gray-400' : ''}>{n}</span>
            </li>
          ))}
        </ul>
      </div>
    </figure>
  );
}
