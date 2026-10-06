'use client';

// ============================================================================
// Écran de chargement « création de votre planning sur mesure ».
//
// Affiché plein écran à la fin de l'onboarding, pendant que le serveur
// enregistre le profil puis compose la première semaine (quelques secondes).
// La barre avance par à-coups réalistes (elle ralentit en approchant de la
// cible de l'étape en cours) et passe à 100 % quand le planning est prêt ;
// les messages décrivent ce que fait réellement le moteur.
// ============================================================================

import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Étape réelle du traitement (pilotée par la page) */
export type EtapeChargement = 'profil' | 'semaine' | 'fin';

/** Progression visée par étape : la barre s'en approche sans jamais l'atteindre avant la fin */
const CIBLES: Record<EtapeChargement, number> = { profil: 22, semaine: 94, fin: 100 };

const MESSAGES = [
  { seuil: 0, texte: 'Enregistrement de votre profil' },
  { seuil: 22, texte: 'Prise en compte de vos allergies et de vos goûts' },
  { seuil: 42, texte: 'Sélection des recettes adaptées à votre budget' },
  { seuil: 62, texte: 'Équilibrage des temps de cuisine et des nutriments' },
  { seuil: 80, texte: 'Composition de vos déjeuners et dîners' },
  { seuil: 92, texte: 'Création de votre liste de courses' },
  { seuil: 100, texte: 'Votre planning est prêt !' },
];

export function ChargementPlanning({ etape }: { etape: EtapeChargement }) {
  const [progression, setProgression] = useState(2);

  useEffect(() => {
    const cible = CIBLES[etape];
    const t = window.setInterval(() => {
      setProgression(p => {
        if (etape === 'fin') return Math.min(100, p + 6);
        // Approche asymptotique : rapide au début, de plus en plus lente
        const suivant = p + Math.max(0.15, (cible - p) * 0.045);
        return Math.min(cible - 0.5, suivant);
      });
    }, 120);
    return () => window.clearInterval(t);
  }, [etape]);

  const pct = Math.round(progression);
  const message = [...MESSAGES].reverse().find(m => progression >= m.seuil) ?? MESSAGES[0];
  const termine = pct >= 100;

  return (
    <div className="fixed inset-0 z-[120] bg-gray-50 flex items-center justify-center px-6" role="alertdialog" aria-modal="true" aria-labelledby="chargement-titre" aria-live="polite">
      <div className="w-full max-w-md text-center">
        <div className={cn('mx-auto w-16 h-16 rounded-2xl flex items-center justify-center text-3xl transition-colors', termine ? 'bg-sauge-100' : 'bg-brand-50')} aria-hidden>
          {termine ? <Check className="w-8 h-8 text-sauge-700" /> : <span className="animate-pulse">🍽️</span>}
        </div>
        <h1 id="chargement-titre" className="mt-6 font-display text-2xl sm:text-3xl font-bold text-gray-900 leading-snug">
          {termine ? 'Votre planning sur mesure est prêt' : 'Nous créons votre planning sur mesure'}
        </h1>
        <p className="mt-2 text-sm text-gray-600">{termine ? 'Redirection vers votre semaine…' : 'Quelques secondes, le moteur compose votre première semaine.'}</p>

        <div className="mt-8">
          <div className="h-3 rounded-full bg-gray-200 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Création du planning">
            <div className="h-full rounded-full bg-brand-500 transition-[width] duration-200 ease-out" style={{ width: `${progression}%` }} />
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 text-sm">
            <span className="text-gray-700 text-left">{message.texte}</span>
            <span className="font-semibold text-brand-600 tabular-nums whitespace-nowrap shrink-0">{pct}&nbsp;%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
