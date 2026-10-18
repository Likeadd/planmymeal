// ============================================================================
// Mesure d'audience (Plausible : sans cookie, sans donnée personnelle).
//
// - track() envoie un événement personnalisé à Plausible. Les événements doivent
//   être déclarés comme « objectifs » (Goals) dans le tableau de bord Plausible.
// - GA4 et Amplitude (retention) ne reçoivent les mêmes événements qu'APRÈS consentement (lib/mesure-consentie.ts).
// - Aucune source d'acquisition n'est mémorisée dans le navigateur ni rattachée à
//   un compte (minimisation RGPD) : Plausible attribue lui-même la source (?ref=,
//   utm_source, référent) aux objectifs, de façon anonyme.
// ============================================================================

import { MESURE_AVEC_CONSENTEMENT } from '@/lib/consentement';

type Props = Record<string, string | number | boolean>;
type Plausible = ((event: string, options?: { props?: Props }) => void) & { q?: unknown[] };

/** Événement Plausible — sans effet côté serveur, en dev ou si Plausible est bloqué. */
export function track(event: string, props?: Props): void {
  if (typeof window === 'undefined') return;
  const w = window as unknown as { plausible?: Plausible };
  // File d'attente : les appels faits avant le chargement du script sont rejoués par Plausible
  w.plausible ??= Object.assign(function (...args: unknown[]) { (w.plausible!.q ??= []).push(args); }, {}) as Plausible;
  try { w.plausible(event, props ? { props } : undefined); } catch { /* mesure best-effort */ }
  // GA4 / Amplitude : seulement si le visiteur a accepté (sinon envoyerEvenement ne fait rien)
  if (!MESURE_AVEC_CONSENTEMENT) return;
  void import('@/lib/mesure-consentie').then(m => m.envoyerEvenement(event, props)).catch(() => {});
}

export { cheminAnonyme, pagePublique } from '@/lib/chemins';
