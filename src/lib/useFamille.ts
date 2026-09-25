'use client';

// ============================================================================
// useFamille — le foyer, disponible dans les cartes du planning.
//
// Une seule requête pour tout le dashboard : la promesse est partagée au niveau
// du module, donc les ~28 puces d'une semaine ne déclenchent qu'un seul appel
// à /api/famille, aussi court soit le nombre de composants montés.
//
// ⚠️ RENDU : le premier rendu renvoie toujours `FAMILLE_VIDE`, côté serveur
// COMME côté client. Les pastilles n'apparaissent qu'après la résolution de la
// promesse (dans un effet), donc le HTML serveur et le premier rendu client
// sont identiques — aucun risque d'hydration mismatch, leçon du bug `Reveal`.
// ============================================================================

import { useEffect, useState } from 'react';
import { FAMILLE_VIDE, indexerFamille, type Famille } from '@/lib/famille';

/** Promesse partagée : un seul aller-retour par chargement de page */
let promesse: Promise<Famille> | null = null;

async function charger(): Promise<Famille> {
  const res = await fetch('/api/famille');
  if (!res.ok) throw new Error(`Erreur ${res.status}`);
  const json = await res.json();
  return indexerFamille(json.membres ?? [], json.poids_famille ?? FAMILLE_VIDE.poidsFamille);
}

/**
 * Charge (ou réutilise) la famille du foyer.
 * Un échec ne reste pas en cache : la prochaine carte montée réessaiera.
 */
function chargerFamillePartagee(): Promise<Famille> {
  if (!promesse) {
    promesse = charger().catch(e => {
      promesse = null;
      throw e;
    });
  }
  return promesse;
}

/** À appeler après une modification du foyer (écran de réglages) */
export function invaliderFamille(): void {
  promesse = null;
}

/**
 * Famille du foyer. Vaut `FAMILLE_VIDE` tant que le chargement n'est pas
 * terminé — et le restera pour un foyer sans membre, ce qui rend les composants
 * qui l'utilisent inactifs sans qu'ils aient à connaître l'état de chargement.
 */
export function useFamille(): Famille {
  const [famille, setFamille] = useState<Famille>(FAMILLE_VIDE);

  useEffect(() => {
    let monte = true;
    void chargerFamillePartagee()
      .then(f => { if (monte) setFamille(f); })
      .catch(() => { /* pas de foyer affichable : on n'affiche simplement rien */ });
    return () => { monte = false; };
  }, []);

  return famille;
}
