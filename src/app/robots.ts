import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || 'https://planmymeal.app').replace(/\/$/, '');

  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/recette/', '/recettes', '/vider-le-frigo', '/faq', '/contact'],
        // Pages applicatives privées : rien à indexer
        disallow: ['/dashboard', '/compte', '/planning', '/favoris', '/budget', '/onboarding', '/login', '/signup', '/api/'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
