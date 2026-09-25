'use client';

import { useEffect } from 'react';

interface WakeLockSentinelLike {
  released: boolean;
  release(): Promise<void>;
  addEventListener(type: 'release', listener: () => void): void;
}
interface NavigatorWakeLock {
  request(type: 'screen'): Promise<WakeLockSentinelLike>;
}

/**
 * Maintient l'écran allumé tant que `enabled` (onglet liste de courses en
 * magasin : on ne veut pas déverrouiller le téléphone à chaque rayon).
 * Ré-acquiert le lock au retour de visibilité (le système le relâche quand
 * l'onglet passe en arrière-plan) et libère au démontage.
 * No-op silencieux si l'API n'existe pas (desktop, vieux navigateurs).
 */
export function useWakeLock(enabled = true) {
  useEffect(() => {
    if (!enabled || typeof navigator === 'undefined') return;
    const wakeLock = (navigator as Navigator & { wakeLock?: NavigatorWakeLock }).wakeLock;
    if (!wakeLock) return;

    let sentinel: WakeLockSentinelLike | null = null;

    const acquire = async () => {
      if (sentinel || document.visibilityState !== 'visible') return;
      try {
        sentinel = await wakeLock.request('screen');
        sentinel.addEventListener('release', () => { sentinel = null; });
      } catch {
        // Permission refusée / batterie faible → on abandonne silencieusement
      }
    };

    void acquire();

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void acquire();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      if (sentinel && !sentinel.released) {
        sentinel.release().catch(() => { /* déjà relâché par le système */ });
      }
      sentinel = null;
    };
  }, [enabled]);
}
