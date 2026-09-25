'use client';

// ============================================================================
// WhyModal — « Pourquoi ce repas ? »
//
// Affiche les raisons renvoyées par /api/pourquoi, calculées par le moteur à
// partir des données réellement utilisées (note, fréquence, ancienneté, frigo,
// temps du jour, budget, saison…). Aucune justification n'est inventée ici :
// la modale ne fait que rendre ce que le serveur a vérifié.
// ============================================================================

import { useEffect, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import type { ExplicationLigne, RepasSlot } from '@/types';
import { errorMessage } from '@/lib/utils';

export function WhyModal({
  mealId, titre, jour, repas, onClose,
}: {
  mealId: number;
  titre: string;
  jour: number;
  repas: RepasSlot;
  onClose: () => void;
}) {
  const [lignes, setLignes] = useState<ExplicationLigne[] | null>(null);
  const [error, setError] = useState('');
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch(
          `/api/pourquoi?meal_id=${mealId}&jour=${jour}&repas=${repas}`,
          { signal: controller.signal }
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`);
        setLignes(json.lignes ?? []);
      } catch (e) {
        if (!controller.signal.aborted) setError(errorMessage(e, "Impossible de charger l'explication"));
      }
    })();
    return () => controller.abort();
  }, [mealId, jour, repas]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
      role="dialog" aria-modal="true" aria-label="Pourquoi ce repas ?">
      <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-xs" onClick={onClose} aria-hidden />

      <motion.div
        // `initial` identique au SSR (useReducedMotion vaut null côté serveur) :
        // seul le durée change → pas d'hydration mismatch.
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.22, ease: 'easeOut' }}
        className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-xl border border-gray-100 max-h-[85vh] overflow-y-auto">

        <div className="sticky top-0 bg-white/95 backdrop-blur-sm px-5 pt-5 pb-3 border-b border-gray-100 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.14em] uppercase text-brand-500">
              Pourquoi ce repas ?
            </p>
            <h3 className="font-display font-bold text-gray-900 leading-snug line-clamp-2">{titre}</h3>
          </div>
          <button onClick={onClose} aria-label="Fermer"
            className="p-1.5 rounded-full text-gray-500 hover:text-gray-600 hover:bg-gray-50 transition-colors shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4">
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>
          )}

          {!error && !lignes && (
            <div className="py-8 flex items-center justify-center">
              <Loader2 className="w-5 h-5 text-brand-500 animate-spin" />
            </div>
          )}

          {!error && lignes && (
            <ul className="space-y-2.5">
              {lignes.map((l, i) => (
                <motion.li key={i}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: reduceMotion ? 0 : 0.2, delay: reduceMotion ? 0 : i * 0.04 }}
                  className="flex items-start gap-3 text-sm text-gray-700">
                  <span className="text-base leading-5 shrink-0" aria-hidden>{l.emoji}</span>
                  <span className="leading-relaxed">{l.texte}</span>
                </motion.li>
              ))}
            </ul>
          )}

          <p className="mt-4 text-[11px] text-gray-500">
            Ces raisons proviennent de tes réglages et de ton historique — jamais d&apos;une justification inventée.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
