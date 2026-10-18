import type { Metadata } from 'next';
import Link from 'next/link';
import LandingHeader from '@/components/LandingHeader';
import LandingFooter from '@/components/LandingFooter';
import { FilAriane } from '@/components/FilAriane';
import { VARIANTES } from '@/lib/menu-public';
import { SITE_URL, jsonLdFilAriane, serialiserJsonLd } from '@/lib/seo';
import { formatWeekRange, getMondayMenu } from '@/lib/dates';

export const revalidate = 1800;

const titre = 'Menus de la semaine pas chers : 14 repas et liste de courses';
const description = 'Un nouveau menu de la semaine chaque lundi : à 25, 30, 50, 80 ou 100 €, végétarien, rapide ou riche en protéines. 14 repas, liste de courses chiffrée et recettes détaillées.';

export const metadata: Metadata = {
  title: titre,
  description,
  alternates: { canonical: `${SITE_URL}/menu-semaine` },
  openGraph: { title: titre, description, type: 'website', url: `${SITE_URL}/menu-semaine` },
};

export default function MenusSemainePage() {
  const semaine = formatWeekRange(getMondayMenu());
  const maillons = [{ label: 'Accueil', href: '/' }, { label: 'Menus de la semaine' }];
  const jsonLdListe = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Menus de la semaine PlanMyMeal',
    itemListElement: VARIANTES.map((v, i) => ({ '@type': 'ListItem', position: i + 1, name: v.titre, url: `${SITE_URL}/menu-semaine/${v.slug}` })),
  };

  return (
    <>
      <LandingHeader />
      {[jsonLdFilAriane(maillons), jsonLdListe].map((d, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: serialiserJsonLd(d) }} />
      ))}
      <main id="contenu" className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        <FilAriane maillons={maillons} className="mb-4" />
        <p className="text-[11px] font-semibold tracking-[0.14em] uppercase text-brand-500 mb-1.5">Semaine du {semaine} · nouveau menu chaque lundi à 8 h</p>
        <h1 className="font-display font-bold text-2xl sm:text-4xl text-gray-900 leading-tight">Menus de la semaine</h1>
        <p className="mt-3 text-gray-600 max-w-3xl">
          Chaque lundi, PlanMyMeal compose des menus complets de 14 repas qui respectent un budget : la liste de courses est chiffrée
          à partir de prix moyens de supermarché, triée par rayon, et chaque plat renvoie vers sa recette détaillée.
          Choisissez celui qui correspond à votre foyer, puis adaptez-le à vos goûts en quelques secondes.
        </p>

        <Link href="/menu-de-la-semaine" className="mt-8 block rounded-2xl bg-brand-50 border border-brand-100 p-5 hover:border-brand-300 transition-colors">
          <p className="text-[11px] font-semibold tracking-[0.14em] uppercase text-brand-700">Le menu de la semaine</p>
          <p className="mt-1 font-display font-bold text-lg text-gray-900">Le menu exemple de cette semaine, avec son budget — nouveau chaque lundi à 8 h</p>
          <p className="mt-1 text-sm font-semibold text-brand-700">Voir le menu →</p>
        </Link>

        <ul className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {VARIANTES.map(v => (
            <li key={v.slug}>
              <Link href={`/menu-semaine/${v.slug}`} className="block h-full rounded-2xl border border-gray-100 bg-white shadow-card hover:shadow-pop hover:-translate-y-0.5 transition-all p-5">
                <p className="text-2xl font-bold text-brand-600">{v.budget} €</p>
                <h2 className="mt-1 font-display font-bold text-gray-900 leading-snug">{v.titre}</h2>
                <p className="mt-2 text-sm text-gray-600">{v.accroche}</p>
                <p className="mt-3 text-xs font-semibold text-brand-600">Voir le menu et la liste de courses →</p>
              </Link>
            </li>
          ))}
        </ul>

        <div className="mt-12 rounded-2xl bg-brand-50 p-8 text-center">
          <p className="font-display font-bold text-lg text-gray-900">Un menu qui tient compte de vos goûts, allergies et budget ?</p>
          <p className="mt-1.5 text-sm text-gray-600">PlanMyMeal compose le vôtre en 2 minutes, avec sa liste de courses. Gratuit, sans carte bancaire.</p>
          <Link href="/signup?ref=menus-semaine" className="inline-flex items-center justify-center min-h-[44px] rounded-full bg-brand-500 text-white font-semibold px-6 mt-4 hover:bg-brand-600 transition-colors">
            Optimiser ma semaine
          </Link>
        </div>
      </main>
      <LandingFooter />
    </>
  );
}
