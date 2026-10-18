// ============================================================================
// Mesure d'audience (sans cookie, sans donnée personnelle).
//
// - track() envoie un événement personnalisé à Plausible (les événements doivent être déclarés
//   comme « objectifs » dans son tableau de bord) ET à la mesure interne (/api/mesure), affichée
//   dans /admin : anonyme, sans IP stockée, voir lib/mesure-interne.ts.
// - Aucune source d'acquisition n'est mémorisée dans le navigateur ni rattachée à
//   un compte (minimisation RGPD) : Plausible attribue lui-même la source (?ref=,
//   utm_source, référent) aux objectifs, de façon anonyme.
// ============================================================================

import { OPPOSITION_CLES } from '@/lib/chemins';

type Props = Record<string, string | number | boolean>;
type Plausible = ((event: string, options?: { props?: Props }) => void) & { q?: unknown[] };

/** Événement Plausible — sans effet côté serveur, en dev ou si Plausible est bloqué. */
export function track(event: string, props?: Props): void {
  if (typeof window === 'undefined') return;
  const w = window as unknown as { plausible?: Plausible };
  // File d'attente : les appels faits avant le chargement du script sont rejoués par Plausible
  w.plausible ??= Object.assign(function (...args: unknown[]) { (w.plausible!.q ??= []).push(args); }, {}) as Plausible;
  try { w.plausible(event, props ? { props } : undefined); } catch { /* mesure best-effort */ }
  envoyerMesure({ t: 'e', n: event, ...(props ? { d: props } : {}) });
}

/** Mesure interne anonyme (/api/mesure) : en production seulement, jamais si le visiteur s'y est opposé. */
export function envoyerMesure(corps: Record<string, unknown>): void {
  if (typeof window === 'undefined' || process.env.NODE_ENV !== 'production') return;
  try { if (OPPOSITION_CLES.some(k => localStorage.getItem(k))) return; } catch { /* stockage indisponible */ }
  const donnees = JSON.stringify(corps);
  try { if (navigator.sendBeacon?.('/api/mesure', new Blob([donnees], { type: 'application/json' }))) return; } catch { /* repli ci-dessous */ }
  fetch('/api/mesure', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: donnees, keepalive: true }).catch(() => {});
}

export { cheminAnonyme, pagePublique } from '@/lib/chemins';
