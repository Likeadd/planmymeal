import type { MetadataRoute } from 'next';
import { getSupabaseAdmin } from '@/lib/supabase';
import { SITE_URL, recetteHref } from '@/lib/seo';
import { CATEGORIES_SEO } from '@/lib/categories-seo';
import { VARIANTES } from '@/lib/menu-public';

/**
 * Sitemap dynamique : pages publiques + recettes INDEXABLES (rédigées à la main, colonne `indexable`).
 * Les variantes assemblées automatiquement restent en noindex (voir scripts/definir-indexation.ts).
 * (Route serveur — la clé de rôle service n'est jamais exposée au client.)
 */
export const revalidate = 86400; // 1× par jour

const FENETRE = 1000; // identifiants par requête (plafond PostgREST : 1 000 lignes par réponse)

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = SITE_URL;

  const statiques: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/recettes`, changeFrequency: 'weekly', priority: 0.9 },
    ...CATEGORIES_SEO.map(c => ({
      url: `${base}/recettes/categorie/${c.slug}`,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
    { url: `${base}/menu-de-la-semaine`, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${base}/menu-semaine`, changeFrequency: 'weekly', priority: 0.9 },
    ...VARIANTES.map(v => ({ url: `${base}/menu-semaine/${v.slug}`, changeFrequency: 'weekly' as const, priority: 0.8 })),
    { url: `${base}/faq`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/contact`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/cgv`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${base}/mentions-legales`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${base}/confidentialite`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${base}/cgu`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${base}/cookies`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${base}/retractation`, changeFrequency: 'yearly', priority: 0.2 },
  ];

  try {
    const supabase = getSupabaseAdmin();
    // Fenêtres d'identifiants (index de la clé primaire, coût constant) en parallèle, chaque fenêtre
    // retentée : une requête perdue ne doit jamais faire disparaître silencieusement 1 000 fiches.
    const { data: dernier, error: erreurMax } = await supabase
      .from('meals').select('id').eq('is_public', true).eq('indexable', true).order('id', { ascending: false }).limit(1);
    if (erreurMax) throw new Error(erreurMax.message);
    const idMax = dernier?.[0]?.id ?? 0;

    const fenetres: number[] = [];
    for (let debut = 0; debut <= idMax; debut += FENETRE) fenetres.push(debut);
    const lots: { id: number; titre: string; updated_at: string | null }[][] = new Array(fenetres.length);
    let suivante = 0;
    await Promise.all(Array.from({ length: Math.min(6, fenetres.length) }, async () => {
      while (suivante < fenetres.length) {
        const i = suivante++;
        for (let essai = 0; ; essai++) {
          const { data, error } = await supabase
            .from('meals')
            .select('id, titre, updated_at')
            .eq('is_public', true)
            .eq('indexable', true)
            .gte('id', fenetres[i]).lt('id', fenetres[i] + FENETRE)
            .order('id');
          if (!error) { lots[i] = data ?? []; break; }
          if (essai >= 2) throw new Error(`sitemap : fenêtre ${fenetres[i]} — ${error.message}`);
        }
      }
    }));

    const recettes: MetadataRoute.Sitemap = lots.flat().map(m => ({
      url: `${base}${recetteHref(m)}`,
      lastModified: m.updated_at ? new Date(m.updated_at) : undefined,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    }));

    return [...statiques, ...recettes];
  } catch (e) {
    // La base est indisponible ? On renvoie au moins les pages statiques (et on le journalise).
    console.error('[sitemap]', e instanceof Error ? e.message : e);
    return statiques;
  }
}
