// ============================================================================
// Mesure d'audience (Plausible : sans cookie, sans donnée personnelle) et
// suivi de la SOURCE d'acquisition (« d'où vient ce visiteur ? »).
//
// - track() envoie un événement personnalisé à Plausible. Les événements doivent
//   être déclarés comme « objectifs » (Goals) dans le tableau de bord Plausible.
// - La source est capturée à la 1re visite (?ref= ou ?utm_source=, sinon le site
//   référent) puis conservée dans le navigateur : elle est jointe à l'inscription.
// ============================================================================

type Props = Record<string, string | number | boolean>;
type Plausible = ((event: string, options?: { props?: Props }) => void) & { q?: unknown[] };

/** Événement Plausible — sans effet côté serveur, en dev ou si Plausible est bloqué. */
export function track(event: string, props?: Props): void {
  if (typeof window === 'undefined') return;
  const w = window as unknown as { plausible?: Plausible };
  // File d'attente : les appels faits avant le chargement du script sont rejoués par Plausible
  w.plausible ??= Object.assign(function (...args: unknown[]) { (w.plausible!.q ??= []).push(args); }, {}) as Plausible;
  try { w.plausible(event, props ? { props } : undefined); } catch { /* mesure best-effort */ }
}

const CLE_SOURCE = 'pmm_source';
/** Source valide : lettres minuscules, chiffres, tiret, souligné, point (40 max) */
export const SOURCE_RE = /^[a-z0-9][a-z0-9._-]{0,39}$/;

export const nettoyerSource = (v: string | null | undefined): string | null => {
  const s = (v ?? '').trim().toLowerCase();
  return SOURCE_RE.test(s) ? s : null;
};

/** Source de la visite en cours : ?ref=, ?utm_source=, sinon domaine référent (« direct » si aucun). */
export function sourceDeLaVisite(): string {
  const p = new URLSearchParams(window.location.search);
  const explicite = nettoyerSource(p.get('ref')) ?? nettoyerSource(p.get('utm_source'));
  if (explicite) return explicite;
  try {
    const hote = document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, '') : '';
    if (hote && hote !== window.location.hostname) return nettoyerSource(hote) ?? 'autre';
  } catch { /* référent illisible */ }
  return 'direct';
}

/** Mémorise la source à la 1re visite (« first touch ») et la renvoie. */
export function capterSource(): string {
  try {
    const deja = nettoyerSource(localStorage.getItem(CLE_SOURCE));
    if (deja) return deja;
    const s = sourceDeLaVisite();
    // « direct » ne remplace jamais une vraie source arrivée plus tard : on ne le mémorise pas
    if (s !== 'direct') localStorage.setItem(CLE_SOURCE, s);
    return s;
  } catch {
    return sourceDeLaVisite();
  }
}

/** Source mémorisée (ou « direct ») — jointe à l'inscription. */
export function lireSource(): string {
  try { return nettoyerSource(localStorage.getItem(CLE_SOURCE)) ?? 'direct'; } catch { return 'direct'; }
}
