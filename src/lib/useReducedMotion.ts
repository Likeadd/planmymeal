'use client';

import { useSyncExternalStore } from 'react';

// prefers-reduced-motion (remplace le hook de framer-motion, retiré pour alléger le JS)
const requete = '(prefers-reduced-motion: reduce)';

export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    cb => {
      const mq = window.matchMedia(requete);
      mq.addEventListener('change', cb);
      return () => mq.removeEventListener('change', cb);
    },
    () => window.matchMedia(requete).matches,
    () => false,
  );
}
