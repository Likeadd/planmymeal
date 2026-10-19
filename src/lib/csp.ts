// ============================================================================
// Politique de sécurité du contenu (CSP), partagée par next.config.ts et src/proxy.ts.
//
// - Pages publiques (statiques, mises en cache) : `script-src 'unsafe-inline'`, car Next.js insère des
//   scripts en ligne sans nonce dans le HTML pré-généré (une CSP stricte casse l'hydratation, testé).
// - Pages connectées et pages de connexion (rendues à chaque requête) : NONCE aléatoire par requête et
//   'strict-dynamic' — aucun script en ligne injecté ne peut s'exécuter (audit VULN-010).
// ============================================================================

const HOTES_SCRIPTS = 'https://js.stripe.com https://plausible.io';

export function construireCsp({ nonce, isDev }: { nonce?: string; isDev: boolean }): string {
  const scripts = nonce
    ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''} ${HOTES_SCRIPTS}`
    : `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} ${HOTES_SCRIPTS}`;
  return [
    "default-src 'self'",
    scripts,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.supabase.co",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://m.stripe.network https://plausible.io",
    "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ['upgrade-insecure-requests']),
  ].join('; ');
}

/** Nonce aléatoire (128 bits, base64) — Web Crypto, disponible dans le runtime du proxy */
export function nouveauNonce(): string {
  const octets = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...octets));
}
