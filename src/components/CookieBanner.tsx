'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Cookie } from 'lucide-react';

const CLE_STOCKAGE = 'pmm_cookies_ack';

/**
 * Bandeau informatif (pas un mur de consentement) : PlanMyMeal n'utilise que
 * des cookies techniques (session Supabase) et Plausible, qui mesure
 * l'audience SANS cookie ni donnée personnelle — aucun consentement légal
 * requis (CNIL). Le bandeau reste néanmoins affiché une fois par visiteur,
 * par transparence, avec un unique bouton d'accusé de réception.
 */
export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Lecture localStorage forcément post-montage (absent côté serveur) : un
    // useState paresseux romprait l'hydratation (SSR = false, client = true
    // dès le premier rendu). Le setState conditionnel ici est donc le seul
    // point d'entrée possible, pas un effet dérivable autrement.
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (!localStorage.getItem(CLE_STOCKAGE)) setVisible(true);
    } catch {
      // Stockage indisponible (navigation privée stricte) : on n'affiche pas
      // un bandeau qui réapparaîtrait à chaque page.
    }
  }, []);

  const fermer = () => {
    setVisible(false);
    try { localStorage.setItem(CLE_STOCKAGE, '1'); } catch { /* best-effort */ }
  };

  if (!visible) return null;

  // Simple mention (aucun consentement n'est juridiquement requis) : une
  // ligne compacte au-dessus de la barre de navigation mobile, au lieu d'une
  // carte qui masquait ~40 % de l'écran d'un téléphone.
  return (
    <div role="region" aria-label="Information cookies"
      className="fixed inset-x-0 bottom-3 [body:has([data-tour=nav-compte])_&]:bottom-[calc(4.5rem+env(safe-area-inset-bottom))] lg:bottom-4 lg:[body:has([data-tour=nav-compte])_&]:bottom-4 z-50 px-3 pointer-events-none">
      <div className="pointer-events-auto max-w-xl mx-auto bg-white/95 backdrop-blur border border-gray-200 rounded-full shadow-pop pl-4 pr-1.5 py-1.5 flex items-center gap-3">
        <Cookie className="w-4 h-4 text-brand-500 shrink-0" aria-hidden />
        <p className="text-xs text-gray-600 flex-1 leading-snug">
          Cookies techniques uniquement, audience anonyme sans cookie.{' '}
          <Link href="/confidentialite" className="inline-block py-3 -my-3 px-1 -mx-1 text-brand-600 underline underline-offset-2 decoration-brand-300 hover:text-brand-700">
            Détails
          </Link>
        </p>
        <button
          onClick={fermer}
          className="shrink-0 px-3.5 py-1.5 bg-brand-600 text-white text-xs font-semibold rounded-full hover:bg-brand-700 transition-colors"
        >
          OK
        </button>
      </div>
    </div>
  );
}
