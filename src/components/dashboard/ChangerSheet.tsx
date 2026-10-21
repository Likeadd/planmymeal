'use client';

// ============================================================================
// ChangerSheet — panneau « Changer ce repas » (mobile) : 4 choix en clair
// (au hasard, choisir, écrire, vider) + actions secondaires discrètes
// (c'est fait, noter, pourquoi, restes). Ancré en bas de l'écran.
// ============================================================================

import { useEffect, useState } from 'react';
import { Loader2, X, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  /** « ce midi », « ce soir », « le dessert du midi »… */
  libelleCreneau: string;
  titreActuel: string | null;
  onClose: () => void;
  onHasard: () => Promise<void> | void;
  onChoisir: () => void;
  onEcrire: (texte: string) => Promise<void>;
  onVider?: () => Promise<void>;
  /** Actions secondaires (absentes pour un créneau vide / repas libre) */
  secondaires?: { label: string; emoji: string; onClick: () => void }[];
}

export function ChangerSheet({
  libelleCreneau, titreActuel, onClose, onHasard, onChoisir, onEcrire, onVider, secondaires = [],
}: Props) {
  const [ecriture, setEcriture] = useState(false);
  const [texte, setTexte] = useState('');
  const [enCours, setEnCours] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const lancer = async (cle: string, action: () => Promise<void> | void) => {
    setEnCours(cle);
    try { await action(); onClose(); } catch { /* toast géré par l'appelant */ } finally { setEnCours(null); }
  };

  const choix = [
    { cle: 'hasard', emoji: '🎲', titre: 'Une autre idée au hasard', sous: 'On choisit pour vous', action: () => lancer('hasard', onHasard), mis: true },
    { cle: 'choisir', emoji: '📖', titre: 'Choisir dans les recettes', sous: 'Parcourir la liste', action: () => { onClose(); onChoisir(); } },
    { cle: 'ecrire', emoji: '✏️', titre: 'Écrire mon propre repas', sous: 'Ex. : Repas anniversaire', action: () => setEcriture(true) },
    ...(onVider ? [{ cle: 'vider', emoji: '🗑️', titre: `Pas de repas ${libelleCreneau}`, sous: 'Laisser vide', action: () => lancer('vider', onVider) }] : []),
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true"
      aria-label={`Changer le repas de ${libelleCreneau}`}>
      <div className="absolute inset-0 bg-gray-900/40" onClick={onClose} aria-hidden />
      <div className="animate-sheet-in relative w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-xl px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] max-h-[90vh] overflow-y-auto">
        <div className="mx-auto h-1.5 w-12 rounded-full bg-gray-200 sm:hidden" aria-hidden />
        <div className="mt-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-display font-bold text-lg sm:text-xl text-gray-900 leading-snug">Changer le repas de {libelleCreneau}</h3>
            {titreActuel && <p className="mt-0.5 text-sm text-gray-500 truncate">Actuellement : {titreActuel}</p>}
          </div>
          <button onClick={onClose} aria-label="Fermer" className="p-2 -mr-2 rounded-full text-gray-500 hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {ecriture ? (
          <form className="mt-5" onSubmit={e => { e.preventDefault(); if (texte.trim()) void lancer('ecrire', () => onEcrire(texte.trim())); }}>
            <label htmlFor="texte-repas" className="block text-sm font-semibold text-gray-800 mb-2">Nom de votre repas</label>
            <input id="texte-repas" autoFocus value={texte} onChange={e => setTexte(e.target.value)} maxLength={80}
              placeholder="Repas anniversaire, Apéro dinatoire…"
              className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3.5 text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-300" />
            <div className="mt-4 flex gap-3">
              <button type="button" onClick={() => setEcriture(false)}
                className="flex-1 min-h-[52px] rounded-2xl bg-gray-100 text-gray-700 font-semibold">Retour</button>
              <button type="submit" disabled={!texte.trim() || enCours != null}
                className="flex-1 min-h-[52px] rounded-2xl bg-brand-500 text-white font-semibold disabled:opacity-40 flex items-center justify-center gap-2">
                {enCours === 'ecrire' && <Loader2 className="w-4 h-4 animate-spin" />} Valider
              </button>
            </div>
          </form>
        ) : (
          <>
            {/* Compact : les 4 choix ET les autres actions tiennent sur un petit téléphone (iPhone SE)
                sans devoir deviner qu'il faut faire défiler. */}
            <div className="mt-4 flex flex-col gap-2">
              {choix.map(c => (
                <button key={c.cle} onClick={c.action} disabled={enCours != null}
                  className={cn('w-full flex items-center gap-3 rounded-2xl border px-4 py-3 min-h-[56px] text-left transition-colors active:scale-[0.99] disabled:opacity-60',
                    c.mis ? 'border-brand-300 bg-brand-50 hover:bg-brand-100' : 'border-gray-200 bg-creme-50 hover:bg-gray-50')}>
                  <span className="text-xl w-7 text-center" aria-hidden>
                    {enCours === c.cle ? <Loader2 className="w-6 h-6 animate-spin text-brand-500 mx-auto" /> : c.emoji}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-bold text-gray-900 text-[15px] leading-tight">{c.titre}</span>
                    <span className="block text-[13px] text-gray-500 leading-tight mt-0.5">{c.sous}</span>
                  </span>
                  <ChevronRight className="w-5 h-5 text-gray-300 shrink-0" />
                </button>
              ))}
            </div>

            {secondaires.length > 0 && (
              <div className="mt-4 pt-3 border-t border-gray-100">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Autres actions</p>
                <div className="grid grid-cols-2 gap-2">
                  {secondaires.map(s => (
                    <button key={s.label} onClick={() => { onClose(); s.onClick(); }}
                      className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 min-h-[44px] text-left text-[13px] font-semibold text-gray-800 leading-tight hover:bg-gray-50">
                      <span aria-hidden className="shrink-0">{s.emoji}</span><span className="min-w-0">{s.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
