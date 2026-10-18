'use client';

import { useEffect, useState } from 'react';

// Droit d'opposition à la mesure d'audience : Plausible ignore tout navigateur dont
// localStorage.plausible_ignore vaut « true » ; la mesure interne honore aussi pmm_no_track.
const CLE = 'plausible_ignore';
const CLE_INTERNE = 'pmm_no_track';

export function OppositionAudience() {
  const [exclu, setExclu] = useState(false);

  useEffect(() => {
    // localStorage n'existe pas au rendu serveur : lecture post-montage obligatoire
    try { setExclu(localStorage.getItem(CLE) === 'true'); } catch { /* stockage indisponible */ } // eslint-disable-line react-hooks/set-state-in-effect
  }, []);

  const basculer = () => {
    const suivant = !exclu;
    try {
      if (suivant) { localStorage.setItem(CLE, 'true'); localStorage.setItem(CLE_INTERNE, '1'); } else { localStorage.removeItem(CLE); localStorage.removeItem(CLE_INTERNE); }
      setExclu(suivant);
    } catch { /* stockage indisponible : l'opposition ne peut pas être mémorisée */ }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 flex flex-wrap items-center gap-3">
      <p className="text-sm text-gray-800 flex-1 min-w-[14rem]" role="status">
        {exclu ? 'Vous êtes exclu de la mesure d’audience sur ce navigateur.' : 'Votre visite est comptée dans les statistiques anonymes.'}
      </p>
      <button type="button" onClick={basculer} aria-pressed={exclu}
        className="px-4 py-2 min-h-[44px] rounded-full bg-brand-700 text-white text-sm font-semibold hover:bg-brand-800 transition-colors">
        {exclu ? 'Me remettre dans les statistiques' : 'Ne plus compter ma visite'}
      </button>
    </div>
  );
}
