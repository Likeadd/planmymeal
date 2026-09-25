'use client';

import { useEffect } from 'react';
import { parseSemaineParam } from '@/lib/dates';

/**
 * Helpers d'historique navigateur pour le paramètre ?semaine=YYYY-MM-DD.
 * Partagés par le dashboard et la page planning :
 *  - navigation interne → pushState (la semaine devient une entrée historique)
 *  - retour/avant navigateur → popstate → on re-lit le paramètre d'URL
 */

/** Construit l'URL mise à jour : ?semaine= ajouté/retiré (null = retiré). */
function semaineUrl(semaine: string | null): string {
  const url = new URL(window.location.href);
  if (semaine === null) url.searchParams.delete('semaine');
  else url.searchParams.set('semaine', semaine);
  return url.toString();
}

/**
 * Pousse une nouvelle entrée historique (bouton ← → utilisables).
 * À appeler quand l'utilisateur navigue vers une semaine non courante.
 */
export function pushSemaine(semaine: string): void {
  window.history.pushState({ semaine }, '', semaineUrl(semaine));
}

/** Remplace l'entrée courante (sans créer d'entrée) — initialisation/fallback. */
export function replaceSemaine(semaine: string | null): void {
  window.history.replaceState({ semaine }, '', semaineUrl(semaine));
}

/** Lit ?semaine= depuis l'entrée d'historique courante (normalisée au lundi). */
function readSemaineFromHistory(): string | null {
  const params = new URLSearchParams(window.location.search);
  return parseSemaineParam(params.get('semaine'));
}

/**
 * Abonne le composant aux navigations retour/avant : à chaque popstate, la
 * semaine affichée est resynchronisée sur l'URL. Le callback reçoit la valeur
 * normalisée du paramètre (null = semaine courante).
 */
export function useSemainePopstate(onPop: (semaine: string | null) => void): void {
  useEffect(() => {
    const handler = () => onPop(readSemaineFromHistory());
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, [onPop]);
}
