'use client';

// ============================================================================
// Consentement aux outils d'analyse (GA4, Amplitude) : bannière « Tout refuser / Tout accepter »
// (même poids visuel), chargement des outils uniquement après acceptation, pages vues anonymisées
// et identifiant pseudonyme du compte pour la rétention. Monté seulement si un outil est configuré.
// ============================================================================

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Cookie } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import {
  EVENEMENT_CHOIX, EVENEMENT_OUVRIR, enregistrerChoix, lireChoix, type Choix,
} from '@/lib/consentement';
import { activer, desactiver, identifier, pageVue } from '@/lib/mesure-consentie';

export function ConsentementCookies() {
  const pathname = usePathname();
  const { user, profile } = useAuth();
  const [choix, setChoix] = useState<Choix | null | undefined>(undefined); // undefined = pas encore lu (SSR)
  const [ouvert, setOuvert] = useState(false);

  const appliquer = useCallback((c: Choix | null) => {
    setChoix(c);
    if (c === 'accepte') void activer(); else desactiver();
  }, []);

  useEffect(() => {
    // Lecture post-montage obligatoire (localStorage absent côté serveur)
    const initial = lireChoix();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    appliquer(initial);
    setOuvert(initial === null);
    const surChoix = (e: Event) => { appliquer((e as CustomEvent<Choix>).detail); setOuvert(false); };
    const surOuvrir = () => setOuvert(true);
    window.addEventListener(EVENEMENT_CHOIX, surChoix);
    window.addEventListener(EVENEMENT_OUVRIR, surOuvrir);
    return () => { window.removeEventListener(EVENEMENT_CHOIX, surChoix); window.removeEventListener(EVENEMENT_OUVRIR, surOuvrir); };
  }, [appliquer]);

  // Page vue à chaque navigation (URL anonymisée)
  useEffect(() => { if (choix === 'accepte') pageVue(pathname); }, [choix, pathname]);

  // Rétention : identifiant pseudonyme du compte (UUID) et formule
  useEffect(() => { if (choix === 'accepte') identifier(user?.id ?? null, profile?.plan); }, [choix, user?.id, profile?.plan]);

  if (!ouvert) return null;

  return (
    <div role="dialog" aria-modal="false" aria-labelledby="cookies-titre"
      className="print:hidden fixed inset-x-0 bottom-3 [body:has([data-tour=nav-compte])_&]:bottom-[calc(4.5rem+env(safe-area-inset-bottom))] lg:bottom-4 lg:[body:has([data-tour=nav-compte])_&]:bottom-4 z-50 px-3 pointer-events-none">
      <div className="pointer-events-auto max-w-xl mx-auto bg-white border border-gray-200 rounded-2xl shadow-pop p-4">
        <p id="cookies-titre" className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <Cookie className="w-4 h-4 text-brand-500 shrink-0" aria-hidden /> Vos choix sur les cookies
        </p>
        <p className="mt-1.5 text-xs text-gray-700 leading-relaxed">
          Avec votre accord, nous utilisons Google Analytics et Amplitude pour mesurer l’audience et comprendre comment le site est utilisé
          (pages visitées, retour des utilisateurs) afin de l’améliorer. Sans votre accord, rien n’est déposé ni envoyé.
          Vous pouvez changer d’avis à tout moment (« Gérer mes cookies » en bas de page).{' '}
          <Link href="/cookies" className="underline underline-offset-2 text-brand-700 hover:text-brand-800">En savoir plus</Link>
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => enregistrerChoix('refuse')}
            className="min-h-[44px] rounded-full border border-gray-400 bg-white text-gray-900 text-sm font-semibold hover:bg-gray-50 transition-colors">
            Tout refuser
          </button>
          <button type="button" onClick={() => enregistrerChoix('accepte')}
            className="min-h-[44px] rounded-full border border-brand-700 bg-brand-700 text-white text-sm font-semibold hover:bg-brand-800 transition-colors">
            Tout accepter
          </button>
        </div>
      </div>
    </div>
  );
}
