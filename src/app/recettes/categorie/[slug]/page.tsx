import type { Metadata } from 'next';
import Link from 'next/link';
import LandingHeader from '@/components/LandingHeader';
import LandingFooter from '@/components/LandingFooter';
import { notFound } from 'next/navigation';
import { Clock, Flame } from 'lucide-react';
import { CATEGORIES_SEO, getCategorieSeo } from '@/lib/categories-seo';
import { getCatalogueSeo } from './data';
import { recetteHref, SITE_URL } from '@/lib/seo';
import { formatMinutes, formatCalories, titreRecette } from '@/lib/utils';
import { formatPrix } from '@/lib/budget';
import { prixParPortion } from '@/lib/budget';

// Rendu serveur + ISR : le contenu (titres, prix, temps) est dans le HTML
// initial, indexable sans exécuter de JavaScript — contrairement à
// /recettes qui charge son catalogue côté client.
export const revalidate = 86400;

const NB_AFFICHEES = 60;

export function generateStaticParams() {
  return CATEGORIES_SEO.map(c => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const categorie = getCategorieSeo(slug);
  if (!categorie) return { title: 'Catégorie introuvable', robots: { index: false } };

  const url = `${SITE_URL}/recettes/categorie/${categorie.slug}`;
  return {
    title: categorie.metaTitle,
    description: categorie.metaDescription,
    alternates: { canonical: url },
    openGraph: { title: categorie.metaTitle, description: categorie.metaDescription, type: 'website', url },
  };
}

export default async function CategorieRecettesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const categorie = getCategorieSeo(slug);
  if (!categorie) notFound();

  const catalogue = await getCatalogueSeo();
  const recettes = catalogue.filter(categorie.filtre).sort(categorie.tri).slice(0, NB_AFFICHEES);

  return (
    <>
    <LandingHeader />
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <nav className="text-sm text-gray-500 mb-4">
        <Link href="/recettes" className="hover:text-brand-600">Recettes</Link>
        <span className="mx-1.5">›</span>
        <span className="text-gray-700">{categorie.h1}</span>
      </nav>

      <h1 className="font-display font-bold text-2xl sm:text-3xl text-gray-900">{categorie.h1}</h1>
      <p className="mt-2.5 text-gray-600 max-w-2xl">{categorie.intro}</p>

      <div className="mt-3.5 flex flex-wrap gap-2">
        {CATEGORIES_SEO.filter(c => c.slug !== categorie.slug).map(c => (
          <Link key={c.slug} href={`/recettes/categorie/${c.slug}`}
            className="text-xs font-semibold px-3 py-1.5 rounded-full bg-gray-50 text-gray-600 hover:bg-brand-50 hover:text-brand-700 transition-colors">
            {c.court}
          </Link>
        ))}
      </div>

      {recettes.length === 0 ? (
        <p className="mt-10 text-gray-500">Aucune recette ne correspond pour le moment.</p>
      ) : (
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {recettes.map((meal, idx) => {
            const prix = prixParPortion(meal);
            return (
              <Link key={meal.id} href={recetteHref(meal)} data-reveal style={{ '--i': idx % 3 } as React.CSSProperties}
                className="press block rounded-2xl border border-gray-100 bg-white shadow-card hover:shadow-pop hover:-translate-y-0.5 transition-all p-4">
                <h2 className="font-display font-bold text-gray-900 leading-snug">{titreRecette(meal.titre)}</h2>
                <div className="flex items-center gap-3 text-[13px] text-gray-500 mt-2">
                  <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{formatMinutes(meal.temps_preparation + (meal.temps_cuisson || 0))}</span>
                  {meal.calories_par_portion != null && (
                    <span className="flex items-center gap-1"><Flame className="w-3.5 h-3.5" />{formatCalories(meal.calories_par_portion)}</span>
                  )}
                  {prix != null && <span className="ml-auto font-semibold text-sauge-700">{formatPrix(prix)}/portion</span>}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <div className="mt-10 text-center">
        <Link href={categorie.hrefCatalogue}
          className="inline-flex items-center justify-center rounded-full bg-brand-500 text-white font-semibold px-6 py-3 hover:bg-brand-600 transition-colors">
          Voir tout le catalogue et affiner les filtres
        </Link>
      </div>
    </main>
    <LandingFooter />
    </>
  );
}
