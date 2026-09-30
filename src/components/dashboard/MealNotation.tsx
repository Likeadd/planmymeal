'use client';

// ============================================================================
// MealNotation — « Après le repas, c'était comment ? »
//
// 5 niveaux (😍 → 🚫) puis, pour les notes négatives, la question « pourquoi ? »
// (trop long, trop cher, trop épicé…). L'enregistrement écrit à la fois le
// retour d'expérience (meal_history) et la mémoire de la recette
// (user_meal_preferences) : c'est ce couplage qui fait que noter un repas change
// réellement les semaines suivantes.
// ============================================================================

import { useState } from 'react';
import { X, Loader2, Check } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { toast } from 'sonner';
import { useAuth } from '@/components/AuthProvider';
import { NOTES_REPAS, type NoteRepas } from '@/lib/memoire';
import { RAISONS_NOTE, type RaisonNote } from '@/types';
import { errorMessage } from '@/lib/utils';

export function MealNotation({
  mealId, titre, onClose, onNoted,
}: {
  mealId: number;
  titre: string;
  onClose: () => void;
  /** Appelé après un enregistrement réussi (permet au parent de rafraîchir) */
  onNoted?: (note: NoteRepas) => void;
}) {
  const { user } = useAuth();
  const reduceMotion = useReducedMotion();

  const [note, setNote] = useState<NoteRepas | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const enregistrer = async (valeur: NoteRepas, raison: RaisonNote | null) => {
    if (!user) {
      toast.error('Connecte-toi pour noter un repas');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/noter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meal_id: mealId, note: valeur, raison }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: `Erreur ${res.status}` }));
        throw new Error(error);
      }
      setDone(true);
      onNoted?.(valeur);
      toast.success(
        valeur >= 4 ? 'Merci ! Le moteur en tiendra compte.'
          : valeur === 3 ? 'Noté — merci.'
            : valeur === 1 ? 'Cette recette ne sera plus proposée.'
              : 'Noté — on l’espacera.'
      );
      if (valeur > 2) onClose();
    } catch (e) {
      toast.error(errorMessage(e, "Impossible d'enregistrer la note"));
    } finally {
      setSaving(false);
    }
  };

  // Note négative → on demande « pourquoi ? » avant d'enregistrer
  const choisirNote = (valeur: NoteRepas) => {
    setNote(valeur);
    if (valeur > 2) void enregistrer(valeur, null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
      role="dialog" aria-modal="true" aria-label="Noter ce repas">
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
              {note != null && note <= 2 ? 'Pourquoi ?' : 'C’était comment ?'}
            </p>
            <h3 className="font-display font-bold text-gray-900 leading-snug line-clamp-2">{titre}</h3>
          </div>
          <button onClick={onClose} aria-label="Fermer"
            className="p-1.5 rounded-full text-gray-500 hover:text-gray-600 hover:bg-gray-50 transition-colors shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4">
          {done && (
            <p className="mb-3 flex items-center gap-2 text-sm text-sauge-700 bg-sauge-50 border border-sauge-200 rounded-xl px-3 py-2">
              <Check className="w-4 h-4" /> Note enregistrée
            </p>
          )}

          {note == null && (
            <div className="grid gap-2">
              {NOTES_REPAS.map(({ value, emoji, label }, i) => (
                <motion.button key={value}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: reduceMotion ? 0 : 0.18, delay: reduceMotion ? 0 : i * 0.03 }}
                  disabled={saving}
                  onClick={() => choisirNote(value)}
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-2xl border border-gray-200 bg-white hover:border-brand-300 hover:bg-brand-50/40 transition-colors text-left disabled:opacity-50">
                  <span className="text-xl" aria-hidden>{emoji}</span>
                  <span className="text-sm font-medium text-gray-800">{label}</span>
                </motion.button>
              ))}
            </div>
          )}

          {note != null && note <= 2 && (
            <>
              <p className="text-sm text-gray-500 mb-3">
                Qu&apos;est-ce qui n&apos;a pas marché ? (facultatif — ça aide le moteur)
              </p>
              <div className="flex flex-wrap gap-2">
                {RAISONS_NOTE.map(r => (
                  <button key={r.value} disabled={saving}
                    onClick={() => void enregistrer(note, r.value)}
                    className="px-3 py-1.5 text-xs font-medium rounded-full border border-gray-200 bg-gray-50 text-gray-600 hover:border-brand-300 hover:text-brand-600 transition-colors disabled:opacity-50">
                    {r.label}
                  </button>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-3">
                <button disabled={saving} onClick={() => void enregistrer(note, null)}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-full bg-brand-500 text-white hover:bg-brand-600 transition-colors disabled:opacity-50">
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Enregistrer sans préciser
                </button>
                <button onClick={() => setNote(null)} disabled={saving}
                  className="text-sm text-gray-500 hover:text-gray-600 transition-colors">
                  Retour
                </button>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
