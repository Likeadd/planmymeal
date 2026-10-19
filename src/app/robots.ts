import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

/** Robots d'IA explicitement autorisés sur le contenu public (référencement par les assistants). */
const ROBOTS_IA = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-User', 'Claude-SearchBot', 'PerplexityBot', 'Perplexity-User', 'Google-Extended', 'Applebot-Extended', 'CCBot'];

export default function robots(): MetadataRoute.Robots {
  const base = SITE_URL;

  return {
    rules: [
      {
        userAgent: ['*', ...ROBOTS_IA],
        allow: '/',
        // Espace connecté (redirige vers /login) et API : rien à explorer.
        // /login et /signup restent explorables pour que leur `noindex` soit lu.
        disallow: [
          '/aujourdhui', '/admin', '/nouveau-mot-de-passe', '/dashboard', '/planning', '/frigo',
          '/favoris', '/budget', '/compte', '/onboarding', '/offline', '/auth/', '/api/',
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
