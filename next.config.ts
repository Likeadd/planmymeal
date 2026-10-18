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
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} https://js.stripe.com https://plausible.io https://www.googletagmanager.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co https://*.google-analytics.com https://*.googletagmanager.com",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://m.stripe.network https://plausible.io https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com https://*.amplitude.com",
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
  // Ne révèle pas la stack technique (X-Powered-By: Next.js)
  poweredByHeader: false,
  // Production : supprime les console.log/info/debug du bundle (garde error/warn)
  compiler: {
    removeConsole: isDev ? false : { exclude: ['error', 'warn'] },
  },
  // Racine explicite pour Turbopack (évite un warning si le repo git est
  // ouvert depuis un dossier parent).
  //
  // ⚠️ `npm run dev` force --webpack (voir package.json) : avec Tailwind v4
  // (CSS-first, @tailwindcss/postcss), Turbopack dev échoue sur Next.js
  // 16.3.6 avec « Cannot find module '@tailwindcss/postcss' » dans son
  // sous-processus postcss (pool_entry-[turbopack-node]_transforms_postcss),
  // alors que Node résout le module sans problème et que `next build`
  // (webpack par défaut) fonctionne. Bug de résolution de module propre à
  // Turbopack dev, pas à ce projet — à retirer `--webpack` quand corrigé
  // en amont (suivre les release notes Next.js).
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
  // Ancienne page « Cuisiner avec mon frigo » : fusionnée dans /frigo
  async redirects() {
    return [{ source: '/vider-le-frigo', destination: '/frigo', permanent: true }];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      // Icônes et logos (public/) : servis sans cache par défaut → 7 jours,
      // revalidables. sw.js reste volontairement hors de cette règle.
      {
        source: '/:dir(icons|brand)/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=86400' }],
      },
    ];
  },
};

export default nextConfig;
