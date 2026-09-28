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

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 p-4 sm:p-6">
      <div className="max-w-3xl mx-auto bg-white border border-gray-200 rounded-2xl shadow-pop p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <Cookie className="w-6 h-6 text-brand-500 shrink-0" aria-hidden />
        <p className="text-sm text-gray-600 leading-relaxed flex-1">
          PlanMyMeal utilise uniquement des cookies techniques nécessaires
          (connexion) et une mesure d’audience anonyme (Plausible) qui ne
          dépose aucun cookie. Aucune donnée n’est partagée à des fins
          publicitaires.{' '}
          <Link href="/mentions-legales" className="text-brand-600 underline underline-offset-2 decoration-brand-300 hover:text-brand-700">
            En savoir plus
          </Link>
        </p>
        <button
          onClick={fermer}
          className="shrink-0 px-5 py-2.5 bg-brand-600 text-white text-sm font-semibold rounded-full hover:bg-brand-700 transition-colors"
        >
          J’ai compris
        </button>
      </div>
    </div>
  );
}
