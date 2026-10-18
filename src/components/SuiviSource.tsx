'use client';

// Mesure d'audience ANONYME (événements Plausible, aucun cookie, aucun identifiant) sur les pages PUBLIQUES :
//  - « CTA inscription » : tout lien vers /signup, avec l'emplacement ;
//  - « Clic » : lien cliqué (page de départ → destination, sans identifiant de recette ni jeton) ;
//  - « Défilement » : profondeur de lecture atteinte (25, 50, 75, 100 %), une fois par page.
// Un seul écouteur délégué pour toute l'application, sans modifier chaque page.

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { track } from '@/lib/analytics';
import { cheminAnonyme, pagePublique } from '@/lib/chemins';

export function SuiviSource() {
  const pathname = usePathname();

  useEffect(() => {
    const clic = (e: MouseEvent) => {
      const lien = (e.target as Element | null)?.closest?.('a[href*="/signup"]');
      if (!lien) return;
      const ref = new URL((lien as HTMLAnchorElement).href, window.location.origin).searchParams.get('ref');
      track('CTA inscription', { page: pathname === '/' ? 'accueil' : pathname.split('/')[1] || 'autre', ...(ref ? { ref } : {}) });
    };
    const clicLien = (e: MouseEvent) => {
      if (!pagePublique(pathname)) return;
      const lien = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!lien) return;
      let url: URL;
      try { url = new URL(lien.href, window.location.origin); } catch { return; }
      if (!/^https?:$/.test(url.protocol)) return; // mailto:, tel:…
      const interne = url.origin === window.location.origin;
      track('Clic', { page: cheminAnonyme(pathname), cible: interne ? cheminAnonyme(url.pathname) : url.hostname });
    };
    document.addEventListener('click', clic, { capture: true });
    document.addEventListener('click', clicLien, { capture: true });

    // Profondeur de défilement
    const atteints = new Set<number>();
    const defilement = () => {
      if (!pagePublique(pathname)) return;
      const haut = document.documentElement;
      const restant = haut.scrollHeight - window.innerHeight;
      if (restant < 200) return; // page trop courte pour être significative
      const pct = (window.scrollY / restant) * 100;
      for (const palier of [25, 50, 75, 100]) {
        if (pct >= palier - 2 && !atteints.has(palier)) {
          atteints.add(palier);
          track('Défilement', { page: cheminAnonyme(pathname), profondeur: palier });
        }
      }
    };
    window.addEventListener('scroll', defilement, { passive: true });
    return () => {
      document.removeEventListener('click', clic, { capture: true });
      document.removeEventListener('click', clicLien, { capture: true });
      window.removeEventListener('scroll', defilement);
    };
  }, [pathname]);

  return null;
}
