'use client';

// ============================================================================
// ShoppingListView — liste de courses cochable.
// Extrait de dashboard/page.tsx (audit P3) + roadmap animation n°2 :
// - cocher un item = le trait SVG du check se DESSINE (stroke-dashoffset)
//   — le « pop » satisfaisant du supermarché ;
// - barre de progression qui se remplit (par rayon + globale).
// Le CSS global (globals.css) neutralise tout si prefers-reduced-motion.
// ============================================================================

import { useState } from 'react';
import { ShoppingCart, RotateCcw, Route, ArrowDownAZ } from 'lucide-react';

export interface ShoppingSection {
  rayon: string;
  label: string;
  items: { nom: string; quantite: string; checked: boolean }[];
}

/**
 * Ordre de parcours d'un supermarché (entrée → caisse) : frais d'abord pour
 * limiter le temps hors frigo, sec/sucré/boissons en fin de course.
 * Rayon inconnu → rangé à la fin (par ordre alphabétique).
 */
const ORDRE_MAGASIN = [
  'fruits_legumes', 'boulangerie', 'frais', 'viande_poisson', 'surgeles',
  'epicerie_salee', 'conserves', 'epices', 'epicerie_sucree', 'boissons',
];
const rangMagasin = (rayon: string) => {
  const i = ORDRE_MAGASIN.indexOf(rayon);
  return i === -1 ? ORDRE_MAGASIN.length : i;
};

export function ShoppingListView({
  sections, onToggle, onUncheckAll,
}: {
  sections: ShoppingSection[];
  onToggle: (label: string, nom: string) => void;
  /** Tout décocher la liste (nouveau passage magasin) — fourni par le dashboard */
  onUncheckAll?: () => void;
}) {
  // Tri des rayons : parcours magasin (défaut) ou alphabétique. État local :
  // une préférence de course ne vaut pas la complexité d'une persistance.
  const [triMagasin, setTriMagasin] = useState(true);
  const sectionsTriees = triMagasin
    ? [...sections].sort((a, b) =>
        rangMagasin(a.rayon || a.label) - rangMagasin(b.rayon || b.label)
        || a.label.localeCompare(b.label, 'fr'))
    : [...sections].sort((a, b) => a.label.localeCompare(b.label, 'fr'));
  if (sections.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p>Aucune liste de courses pour cette semaine.</p>
      </div>
    );
  }

  const totalItems = sections.reduce((s, sec) => s + sec.items.length, 0);
  const totalCoche = sections.reduce((s, sec) => s + sec.items.filter(it => it.checked).length, 0);
  const totalPct = totalItems > 0 ? Math.round((totalCoche / totalItems) * 100) : 0;
  const toutCoche = totalCoche === totalItems && totalItems > 0;

  return (
    <div className="space-y-6">
      {/* Barre de progression globale : la satisfaction du « presque fini » */}
      <div className="bg-white rounded-2xl border border-gray-100 px-5 py-4">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-2.5">
          <span className="text-[15px] font-bold text-gray-700">
            {totalCoche}/{totalItems} articles
          </span>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Tout décocher : nouveau passage magasin (visible seulement s'il y a des coches) */}
            {totalCoche > 0 && onUncheckAll && (
              <button onClick={onUncheckAll}
                className="flex items-center gap-1.5 text-[12.5px] font-semibold px-3 py-1.5 rounded-full bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100 hover:text-gray-700 active:scale-95 transition-all"
                title="Repartir de zéro pour un nouveau passage au magasin">
                <RotateCcw className="w-3.5 h-3.5" /> Tout décocher
              </button>
            )}
            <span className={`text-[13px] font-semibold px-3 py-1.5 rounded-full transition-colors ${toutCoche ? 'bg-forest-100 text-forest-700' : 'bg-gray-100 text-gray-500'}`}>
              {toutCoche ? 'Courses terminées ✅' : `${totalPct}%`}
            </span>
          </div>
        </div>

        {/* Tri des rayons : parcours magasin (défaut) ou alphabétique */}
        {sections.length >= 2 && (
          <div className="flex items-center gap-1 bg-gray-50 border border-gray-100 rounded-full w-fit p-1">
            <button onClick={() => setTriMagasin(true)} aria-pressed={triMagasin}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                triMagasin ? 'bg-white text-brand-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              <Route className="w-3.5 h-3.5" /> Parcours magasin
            </button>
            <button onClick={() => setTriMagasin(false)} aria-pressed={!triMagasin}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                !triMagasin ? 'bg-white text-brand-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              <ArrowDownAZ className="w-3.5 h-3.5" /> A → Z
            </button>
          </div>
        )}
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ease-out ${toutCoche ? 'bg-forest-500' : 'bg-brand-500'}`}
            style={{ width: `${totalPct}%` }}
            role="progressbar"
            aria-valuenow={totalCoche}
            aria-valuemin={0}
            aria-valuemax={totalItems}
            aria-label="Articles cochés"
          />
        </div>
      </div>

      {sectionsTriees.map(section => {
        const nbCoche = section.items.filter(it => it.checked).length;
        const tousCoche = nbCoche === section.items.length;
        const pct = section.items.length > 0 ? (nbCoche / section.items.length) * 100 : 0;
        return (
          <div key={section.label} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-4 sm:px-5 py-3.5 bg-gray-50 border-b">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-[15.5px] flex items-center gap-3">
                  <span className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center text-lg" aria-hidden>
                    {section.label.match(/^[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u)?.[0] ?? '🛒'}
                  </span>
                  {section.label.replace(/^[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]+\s*/u, '')}
                </h3>
                <span className={`text-[13px] font-semibold px-3 py-1.5 rounded-full transition-colors ${tousCoche ? 'bg-forest-100 text-forest-700' : 'bg-gray-100 text-gray-500'}`}>
                  {nbCoche}/{section.items.length}
                </span>
              </div>
              {/* Barre de progression du rayon */}
              <div className="mt-2.5 h-2 bg-gray-200/70 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ease-out ${tousCoche ? 'bg-forest-500' : 'bg-brand-400'}`}
                  style={{ width: `${pct}%` }}
                  aria-hidden
                />
              </div>
            </div>
            <div className="divide-y divide-gray-50">
              {section.items.map(item => (
                <div key={`${section.label}-${item.nom}`} className="flex items-center gap-3.5 px-4 sm:px-5 py-4 hover:bg-gray-50 transition-colors">
                  {/* Case : cercle visuel 28 px, zone de frappe 36 px (bouton) */}
                  <button onClick={() => onToggle(section.label, item.nom)}
                    aria-pressed={item.checked}
                    aria-label={item.checked ? `Décocher ${item.nom}` : `Cocher ${item.nom}`}
                    className="w-9 h-9 -m-1 rounded-full flex items-center justify-center flex-shrink-0 transition-transform duration-150 active:scale-90">
                    <span className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all duration-150 ${item.checked ? 'bg-forest-500 border-forest-500' : 'border-gray-300 hover:border-forest-400 scale-95'}`}>
                      {/* Check dessiné : le trait suit la coche (stroke-dashoffset) */}
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                        <path className={`check-path ${item.checked ? 'check-path-on' : ''}`}
                          strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                  </button>
                  <span className={`flex-1 text-[15px] transition-colors duration-200 ${item.checked ? 'text-gray-500 line-through' : 'text-gray-700'}`}>{item.nom}</span>
                  <span className="text-[15px] font-bold text-gray-900 whitespace-nowrap">{item.quantite}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
