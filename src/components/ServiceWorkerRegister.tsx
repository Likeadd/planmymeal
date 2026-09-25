'use client';

import { useEffect } from 'react';

/**
 * Enregistre le service worker (production uniquement — en dev, le SW
 * servirait des chunks périmés et compliquerait le HMR).
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch((e) => {
        console.error('Erreur enregistrement service worker:', e);
      });
    };

    if (document.readyState === 'complete') register();
    else {
      window.addEventListener('load', register, { once: true });
      return () => window.removeEventListener('load', register);
    }
  }, []);

  return null;
}
