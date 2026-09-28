'use client';

// ============================================================================
// GlobalLoadingBar — barre de progression fine en haut de l'écran.
// S'affiche (1) pendant une navigation interne et (2) tant qu'une requête vers
// la base (Supabase) ou l'API de l'app est en cours — donc à chaque
// chargement de données, sur toutes les pages, sans modifier chaque écran.
//
// - Un délai de 150 ms évite le clignotement sur les requêtes instantanées.
// - Seules les requêtes Supabase et /api/ sont comptées (pas les prefetch RSC,
//   images ou analytics).
// - Le patch de window.fetch est posé une fois et restauré au démontage.
// - prefers-reduced-motion : la règle globale de globals.css neutralise le
//   mouvement, la barre reste un simple indicateur.
// ============================================================================

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

const DELAI_AFFICHAGE_MS = 150;

function estRequeteSuivie(input: RequestInfo | URL): boolean {
  try {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    return url.includes('.supabase.co') || url.startsWith('/api/') || url.includes(`${window.location.origin}/api/`);
  } catch {
    return false;
  }
}

export function GlobalLoadingBar() {
  const pathname = usePathname();
  const enCours = useRef(0);
  const navigation = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const maj = () => {
      const actif = enCours.current > 0 || navigation.current;
      if (actif) {
        if (!timer.current) timer.current = setTimeout(() => setVisible(true), DELAI_AFFICHAGE_MS);
      } else {
        if (timer.current) { clearTimeout(timer.current); timer.current = null; }
        setVisible(false);
      }
    };

    // Requêtes base de données / API
    const fetchOriginal = window.fetch;
    window.fetch = async (...args: Parameters<typeof fetch>) => {
      if (!estRequeteSuivie(args[0])) return fetchOriginal.apply(window, args);
      enCours.current++;
      maj();
      try {
        return await fetchOriginal.apply(window, args);
      } finally {
        enCours.current = Math.max(0, enCours.current - 1);
        maj();
      }
    };

    // Navigation interne : démarre au clic sur un lien interne
    const onClick = (e: MouseEvent) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a || a.target === '_blank' || a.origin !== window.location.origin) return;
      if (a.pathname === window.location.pathname && a.search === window.location.search) return;
      navigation.current = true;
      maj();
      // Filet de sécurité : jamais bloquée si la navigation avorte
      setTimeout(() => { navigation.current = false; maj(); }, 8000);
    };
    document.addEventListener('click', onClick);

    return () => {
      window.fetch = fetchOriginal;
      document.removeEventListener('click', onClick);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  // Fin de navigation : le chemin a changé
  useEffect(() => {
    navigation.current = false;
    if (enCours.current === 0) {
      if (timer.current) { clearTimeout(timer.current); timer.current = null; }
      setVisible(false);
    }
  }, [pathname]);

  return (
    <div
      aria-hidden
      className={`fixed top-0 left-0 right-0 z-[100] h-[3px] overflow-hidden pointer-events-none transition-opacity duration-300 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className="h-full w-1/3 bg-brand-500 rounded-full animate-loading-bar" />
    </div>
  );
}
