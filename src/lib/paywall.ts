// ============================================================================
// Paywall — déclenchement côté client.
//
// Une route serveur réservée aux plans payants répond 402 avec
// `{ error, paywall: <raison> }`. `gererPaywall(res)` ouvre alors la fenêtre
// d'offre (composant <Paywall />, monté dans DashboardShell) au lieu
// d'afficher une erreur. `ouvrirPaywall` peut aussi être appelé directement
// (bouton verrouillé), avec une action « continuer en gratuit » facultative.
// ============================================================================

import type { RaisonPaywall } from '@/lib/limites';

export const EVENEMENT_PAYWALL = 'pmm:paywall';

export interface DetailPaywall {
  raison: RaisonPaywall;
  /** Action proposée par « Continuer avec la version gratuite » */
  continuer?: () => void;
}

export function ouvrirPaywall(raison: RaisonPaywall, continuer?: () => void): void {
  window.dispatchEvent(new CustomEvent<DetailPaywall>(EVENEMENT_PAYWALL, { detail: { raison, continuer } }));
}

/** Réponse 402 d'une route payante → ouvre le paywall et renvoie true. */
/** Erreur levée quand le paywall a pris le relais : l'appelant n'affiche pas d'erreur. */
export class ErreurPaywall extends Error {
  constructor() { super('Fonction réservée aux plans payants'); }
}

export async function gererPaywall(res: Response): Promise<boolean> {
  if (res.status !== 402) return false;
  const corps = await res.clone().json().catch(() => ({})) as { paywall?: RaisonPaywall };
  ouvrirPaywall(corps.paywall ?? 'decouvrir');
  return true;
}
