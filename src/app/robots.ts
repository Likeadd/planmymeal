import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || 'https://planmymeal.app').replace(/\/$/, '');

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Espace connecté (redirige vers /login) et API : rien à explorer.
        // /login et /signup restent explorables pour que leur `noindex` soit lu.
        disallow: [
          '/aujourdhui', '/dashboard', '/planning', '/frigo', '/vider-le-frigo',
          '/favoris', '/budget', '/compte', '/onboarding', '/offline', '/auth/', '/api/',
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
