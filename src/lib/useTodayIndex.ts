'use client';

// ============================================================================
// useTodayIndex — « quel jour sommes-nous ? », sans casser l'hydratation.
//
// Pourquoi un hook (et pas `new Date().getDay()` dans le rendu) :
//   1. `new Date()` est une fonction impure appelée pendant le render ;
//   2. le serveur (Vercel, UTC) et le navigateur ne sont pas dans le même
//      fuseau → entre 23 h et minuit UTC les deux rendus diffèrent, donc
//      « Hydration failed because the server rendered HTML didn't match… ».
//
// useSyncExternalStore est LE pattern React prévu pour une valeur qui ne peut
// pas être calculée côté serveur : `getServerSnapshot` renvoie une sentinelle
// (-1 = « inconnu »), React rend donc l'hydratation avec cette valeur puis
// bascule sur la vraie dès que le composant est monté. Aucun mismatch possible.
//
// Le calcul reste ancré sur Europe/Paris (cf. lib/dates) : le « jour courant »
// d'un produit français ne doit pas dépendre du fuseau du serveur.
// ============================================================================

import { useSyncExternalStore } from 'react';
import { jourSemaineParis } from '@/lib/dates';

/** Le serveur ne connaît pas le fuseau du visiteur */
export const JOUR_INCONNU = -1;

// La date ne change pas pendant une session : aucun abonnement nécessaire.
// (Conséquence assumée : si l'onglet reste ouvert à travers minuit, la
// surbrillance « Aujourd'hui » ne se met à jour qu'au prochain chargement.)
const subscribe = () => () => {};

/**
 * Index du jour courant, 0 = lundi … 6 = dimanche.
 * Vaut `JOUR_INCONNU` (-1) pendant le rendu serveur et l'hydratation.
 */
export function useTodayIndex(): number {
  return useSyncExternalStore(subscribe, jourSemaineParis, () => JOUR_INCONNU);
}
