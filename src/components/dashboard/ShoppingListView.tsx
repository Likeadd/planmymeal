'use client';

// ============================================================================
// ShoppingListView — liste de courses cochable.
// Extrait de dashboard/page.tsx (audit P3) + roadmap animation n°2 :
// - cocher un item = le trait SVG du check se DESSINE (stroke-dashoffset)
//   — le « pop » satisfaisant du supermarché ;
// - barre de progression qui se remplit (par rayon + globale).
// Le CSS global (globals.css) neutralise tout si prefers-reduced-motion.
// ============================================================================

import { BoutonDebloquer } from '@/components/dashboard/Verrou';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ShoppingCart, RotateCcw, Route, ArrowDownAZ, ClipboardCopy, Store } from 'lucide-react';
import { BoutonPartager } from '@/components/BoutonPartager';
import { lienPublicListe, listeEnTexte, rangMagasin } from '@/lib/liste-courses';
import { copyToClipboard } from '@/lib/utils';
import { formatWeekRange } from '@/lib/dates';
import { track } from '@/lib/analytics';

export interface ShoppingSection {
  rayon: string;
  label: string;
  items: { nom: string; quantite: string; checked: boolean }[];
}

export function ShoppingListView({
  sections, onToggle, onUncheckAll, limite, semaineDebut,
}: {
  sections: ShoppingSection[];
  /** Plan gratuit : nombre d'articles visibles, le reste est verrouillé */
  limite?: number;
  onToggle: (label: string, nom: string) => void;
  /** Tout décocher la liste (nouveau passage magasin) — fourni par le dashboard */
  onUncheckAll?: () => void;
  /** Semaine affichée : active le partage public de la liste */
  semaineDebut?: string;
}) {
  // Tri des rayons : parcours magasin (défaut) ou alphabétique. État local :
  // une préférence de course ne vaut pas la complexité d'une persistance.
  const [triMagasin, setTriMagasin] = useState(true);
  // Mode « En magasin » : écran gardé allumé, articles cochés masqués (ce qui reste à prendre seulement)
  const [enMagasin, setEnMagasin] = useState(false);
  useEffect(() => {
    if (!enMagasin || !('wakeLock' in navigator)) return;
    let verrou: WakeLockSentinel | null = null;
    const demander = () => { navigator.wakeLock.request('screen').then(v => { verrou = v; }).catch(() => {}); };
    // Le verrou est relâché quand l'onglet passe en arrière-plan : on le redemande au retour
    const auRetour = () => { if (document.visibilityState === 'visible') demander(); };
    demander();
    document.addEventListener('visibilitychange', auRetour);
    return () => { document.removeEventListener('visibilitychange', auRetour); void verrou?.release(); };
  }, [enMagasin]);
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
            {/* Partage : texte à coller (WhatsApp, notes) + lien public imprimable */}
            <button type="button" title="Copier la liste en texte" onClick={async () => {
                const ok = await copyToClipboard(listeEnTexte(semaineDebut ? `Liste de courses — semaine du ${formatWeekRange(semaineDebut)}` : 'Liste de courses',
                  sectionsTriees.map(sec => ({ label: sec.label, items: sec.items.map(i => ({ nom: i.nom, quantite: i.quantite })) }))));
                if (ok) { toast.success('Liste copiée : collez-la dans un message 📋'); track('Partage', { type: 'liste', canal: 'texte' }); }
                else toast.error('Copie impossible dans ce navigateur.');
              }}
              className="flex items-center gap-1.5 text-[12.5px] font-semibold px-3 py-1.5 rounded-full bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100 active:scale-95 transition-all">
              <ClipboardCopy className="w-3.5 h-3.5" /> Copier
            </button>
            {semaineDebut && (
              <BoutonPartager type="liste" variante="icone" titre="Ma liste de courses de la semaine"
                texte="Ma liste de courses de la semaine :" resoudreUrl={() => lienPublicListe(semaineDebut)} />
            )}
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

        <button onClick={() => { setEnMagasin(v => !v); if (!enMagasin) track('Mode magasin'); }} aria-pressed={enMagasin}
          className={`mb-3 w-full flex items-center justify-center gap-2 min-h-[48px] rounded-2xl text-sm font-semibold transition-colors ${
            enMagasin ? 'bg-forest-500 text-white' : 'bg-brand-50 text-brand-700 border border-brand-200 hover:bg-brand-100'}`}>
          <Store className="w-4 h-4" aria-hidden />
          {enMagasin ? 'Mode magasin activé · Quitter' : 'Je suis au magasin'}
        </button>
        {enMagasin && (
          <p className="-mt-1 mb-3 text-xs text-gray-500 text-center">L’écran reste allumé et les articles cochés disparaissent.</p>
        )}

        {/* Tri des rayons : parcours magasin (défaut) ou alphabétique */}
        {sections.length >= 2 && (
          <div className="flex items-center gap-1 bg-gray-50 border border-gray-100 rounded-full w-fit p-1 mb-3">
            <button onClick={() => setTriMagasin(true)} aria-pressed={triMagasin}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                triMagasin ? 'bg-white text-brand-600 shadow-xs' : 'text-gray-500 hover:text-gray-700'}`}>
              <Route className="w-3.5 h-3.5" /> Parcours magasin
            </button>
            <button onClick={() => setTriMagasin(false)} aria-pressed={!triMagasin}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                !triMagasin ? 'bg-white text-brand-600 shadow-xs' : 'text-gray-500 hover:text-gray-700'}`}>
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

      {(limite != null ? tronquer(sectionsTriees, limite) : sectionsTriees).map(section => {
        const visibles = enMagasin ? section.items.filter(it => !it.checked) : section.items;
        if (visibles.length === 0) return null;
        const nbCoche = section.items.filter(it => it.checked).length;
        const tousCoche = nbCoche === section.items.length;
        const pct = section.items.length > 0 ? (nbCoche / section.items.length) * 100 : 0;
        return (
          <div key={section.label} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-4 sm:px-5 py-3.5 bg-gray-50 border-b">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-[15.5px] flex items-center gap-3">
                  <span className="w-9 h-9 rounded-full bg-white shadow-xs flex items-center justify-center text-lg" aria-hidden>
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
              {visibles.map(item => (
                // Ligne entière cliquable : cible tactile large, pratique avec un panier à la main
                <button key={`${section.label}-${item.nom}`} type="button" onClick={() => onToggle(section.label, item.nom)}
                  aria-pressed={item.checked}
                  aria-label={item.checked ? `Décocher ${item.nom}` : `Cocher ${item.nom}`}
                  className="w-full flex items-center gap-3.5 px-4 sm:px-5 py-4 text-left hover:bg-gray-50 transition-colors active:bg-gray-100">
                  {/* Case : cercle visuel 28 px */}
                  <span className={`w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-150 ${item.checked ? 'bg-forest-500 border-forest-500' : 'border-gray-300 scale-95'}`}>
                    {/* Check dessiné : le trait suit la coche (stroke-dashoffset) */}
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                      <path className={`check-path ${item.checked ? 'check-path-on' : ''}`}
                        strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                  <span className={`flex-1 text-[15px] transition-colors duration-200 ${item.checked ? 'text-gray-500 line-through' : 'text-gray-700'}`}>{item.nom}</span>
                  <span className="text-[15px] font-bold text-gray-900 whitespace-nowrap">{item.quantite}</span>
                </button>
              ))}
            </div>
          </div>
        );
      })}

      {limite != null && totalItems > limite && (
        <div className="relative rounded-2xl border border-gray-100 bg-white overflow-hidden">
          <div className="divide-y divide-gray-50 blur-[3px] select-none" aria-hidden>
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-3.5 px-5 py-4">
                <span className="w-7 h-7 rounded-full border-2 border-gray-200" />
                <span className="h-3 flex-1 max-w-[50%] rounded-full bg-gray-200" />
                <span className="h-3 w-12 rounded-full bg-gray-100" />
              </div>
            ))}
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/60 p-4 text-center">
            <p className="font-semibold text-gray-900">+ {totalItems - limite} articles dans votre liste complète</p>
            <BoutonDebloquer raison="courses" libelle="Débloquer ma liste complète" />
          </div>
        </div>
      )}
    </div>
  );
}

/** Garde les `limite` premiers articles, dans l'ordre des rayons. */
function tronquer(sections: ShoppingSection[], limite: number): ShoppingSection[] {
  const out: ShoppingSection[] = [];
  let reste = limite;
  for (const s of sections) {
    if (reste <= 0) break;
    out.push({ ...s, items: s.items.slice(0, reste) });
    reste -= s.items.length;
  }
  return out;
}
