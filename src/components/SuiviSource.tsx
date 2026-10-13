'use client';

// Suit les clics d'inscription (événement Plausible anonyme).
// Un seul écouteur délégué : tout lien vers /signup (accueil, fiche, tarifs, menu
// partagé…) envoie « CTA inscription » avec l'emplacement, sans modifier chaque page.

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { track } from '@/lib/analytics';

export function SuiviSource() {
  const pathname = usePathname();

  useEffect(() => {
    const clic = (e: MouseEvent) => {
      const lien = (e.target as Element | null)?.closest?.('a[href*="/signup"]');
      if (!lien) return;
      const ref = new URL((lien as HTMLAnchorElement).href, window.location.origin).searchParams.get('ref');
      track('CTA inscription', { page: pathname === '/' ? 'accueil' : pathname.split('/')[1] || 'autre', ...(ref ? { ref } : {}) });
    };
    document.addEventListener('click', clic, { capture: true });
    return () => document.removeEventListener('click', clic, { capture: true });
  }, [pathname]);

  return null;
}
