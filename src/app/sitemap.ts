import type { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';

/**
 * Sitemap dynamique : pages publiques + TOUTES les recettes publiques.
 * (Route serveur — la clé de rôle service n'est jamais exposée au client.)
 */
export const revalidate = 86400; // 1× par jour

const PAGE = 1000; // plafond PostgREST par réponse

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || 'https://planmymeal.app').replace(/\/$/, '');

  const statiques: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/recettes`, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${base}/faq`, changeFrequency: 'monthly', priority: 0.6 },
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
    const { count } = await supabase
      .from('meals')
      .select('id', { count: 'exact', head: true })
      .eq('is_public', true);

    // Sans pagination, seules les 1000 premières recettes étaient listées.
    const lots = await Promise.all(
      Array.from({ length: Math.ceil((count ?? 0) / PAGE) }, (_, i) =>
        supabase
          .from('meals')
          .select('id, updated_at')
          .eq('is_public', true)
          .order('id')
          .range(i * PAGE, (i + 1) * PAGE - 1)
      )
    );

    const recettes: MetadataRoute.Sitemap = lots.flatMap(({ data }) => data ?? []).map(m => ({
      url: `${base}/recette/${m.id}`,
      lastModified: m.updated_at ? new Date(m.updated_at) : undefined,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    }));

    return [...statiques, ...recettes];
  } catch {
    // La base est indisponible ? On renvoie au moins les pages statiques.
    return statiques;
  }
}
