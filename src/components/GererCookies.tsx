'use client';

import { useEffect, useState } from 'react';
import { EVENEMENT_CHOIX, MESURE_AVEC_CONSENTEMENT, enregistrerChoix, lireChoix, type Choix } from '@/lib/consentement';

/** Choix actuel et boutons pour le modifier (page Cookies, Mon compte). Rien si aucun outil soumis à consentement. */
export function GererCookies() {
  const [choix, setChoix] = useState<Choix | null | undefined>(undefined);

  useEffect(() => {
    // localStorage n'existe pas au rendu serveur : lecture post-montage obligatoire
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChoix(lireChoix());
    const maj = () => setChoix(lireChoix());
    window.addEventListener(EVENEMENT_CHOIX, maj);
    return () => window.removeEventListener(EVENEMENT_CHOIX, maj);
  }, []);

  if (!MESURE_AVEC_CONSENTEMENT) return null;
  const bouton = 'min-h-[44px] px-5 rounded-full border text-sm font-semibold transition-colors';
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
      <p className="text-sm text-gray-800" role="status">
        {choix === 'accepte' ? 'Vous avez accepté Google Analytics et Amplitude.'
          : choix === 'refuse' ? 'Vous avez refusé Google Analytics et Amplitude : rien n’est déposé ni envoyé.'
          : 'Vous n’avez pas encore fait de choix : rien n’est déposé ni envoyé.'}
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => enregistrerChoix('refuse')} aria-pressed={choix === 'refuse'}
          className={`${bouton} ${choix === 'refuse' ? 'bg-gray-900 border-gray-900 text-white' : 'bg-white border-gray-400 text-gray-900 hover:bg-gray-50'}`}>
          Tout refuser
        </button>
        <button type="button" onClick={() => enregistrerChoix('accepte')} aria-pressed={choix === 'accepte'}
          className={`${bouton} ${choix === 'accepte' ? 'bg-brand-800 border-brand-800 text-white' : 'bg-brand-700 border-brand-700 text-white hover:bg-brand-800'}`}>
          Tout accepter
        </button>
      </div>
    </div>
  );
}
