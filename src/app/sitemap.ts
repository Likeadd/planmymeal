import type { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';

/**
 * Sitemap dynamique : pages statiques + 100 recettes publiques.
 * (Route serveur — la clé de rôle service n'est jamais exposée au client.)
 */
export const revalidate = 86400; // 1× par jour

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || 'https://planmymeal.app').replace(/\/$/, '');

  const statiques: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/vider-le-frigo`, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${base}/recettes`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/faq`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/contact`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/cgv`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${base}/mentions-legales`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${base}/confidentialite`, changeFrequency: 'yearly', priority: 0.2 },
  ];

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const { data } = await supabase
      .from('meals')
      .select('id, created_at')
      .eq('is_public', true)
      .order('id');

    const recettes: MetadataRoute.Sitemap = (data || []).map(m => ({
      url: `${base}/recette/${m.id}`,
      lastModified: m.created_at ? new Date(m.created_at) : undefined,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    }));

    return [...statiques, ...recettes];
  } catch {
    // La base est indisponible ? On renvoie au moins les pages statiques.
    return statiques;
  }
}
