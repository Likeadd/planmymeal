import type { NextConfig } from 'next';
import { validateEnv } from './src/lib/env';

// ── Validation de l'environnement au build ──────────────────────────────────
// En production (`next build`), une variable CRITIQUE manquante fait échouer
// le build avec la liste précise de ce qui manque — au lieu d'un crash
// cryptique `process.env.X!` au premier render en prod. En dev : warning only.
validateEnv({ failOnCritical: process.env.NODE_ENV === 'production' });

// ── En-têtes de sécurité ────────────────────────────────────────────────────
// Appliqués à toutes les routes. CSP BLOQUANT : aucun script/iframe/connexion
// hors des domaines listés (anti-injection de code). 'unsafe-eval' n'est
// autorisé qu'en dev (HMR) ; 'unsafe-inline' reste requis par Next sans nonce.
const isDev = process.env.NODE_ENV !== 'production';
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} https://js.stripe.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://m.stripe.network",
  "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ['upgrade-insecure-requests']),
].join('; ');

const securityHeaders = [
  // Force HTTPS (inclut les sous-domaines ; preload une fois la politique stabilisée)
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  // Empêche le sniffing MIME (scripts servis en image, etc.)
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Anti-clickjacking
  { key: 'X-Frame-Options', value: 'DENY' },
  // Ne fuit l'URL d'origine que sur navigation même-site
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Désactive les APIs navigateur inutiles (caméra, micro, géoloc…)
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
  // CSP appliqué (bloque les scripts injectés)
  { key: 'Content-Security-Policy', value: CSP },
];

const nextConfig: NextConfig = {
  // Production : supprime les console.log/info/debug du bundle (garde error/warn)
  compiler: {
    removeConsole: isDev ? false : { exclude: ['error', 'warn'] },
  },
  // Le repo git est le dossier parent (C:\…\SAAS) : sans cette racine
  // explicite, Turbopack émet un warning à chaque démarrage dev.
  turbopack: {
    root: __dirname,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
