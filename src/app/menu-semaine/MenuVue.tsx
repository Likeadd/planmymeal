import Link from 'next/link';
import { Clock, Flame, ShoppingBasket, Wallet } from 'lucide-react';
import LandingHeader from '@/components/LandingHeader';
import LandingFooter from '@/components/LandingFooter';
import { FilAriane } from '@/components/FilAriane';
import { BoutonPartager } from '@/components/BoutonPartager';
import { VARIANTES, type MenuPublic } from '@/lib/menu-public';
import { SITE_URL, jsonLdFilAriane, recetteHref, serialiserJsonLd } from '@/lib/seo';
import { formatWeekRange } from '@/lib/dates';
import { formatPrix, prixParPortion } from '@/lib/budget';
import { formatCalories, formatMinutes, titreRecette } from '@/lib/utils';
import { libelleRayon, quantiteCourses, rangMagasin } from '@/lib/liste-courses';
import type { MealCatalogue } from '@/lib/db-rows';

const eur = (n: number) => `${n.toFixed(2).replace('.', ',')} €`;

function CarteRepas({ label, meal }: { label: string; meal: MealCatalogue }) {
  const prix = prixParPortion(meal);
  return (
    <Link href={recetteHref(meal)} className="block rounded-xl border border-gray-100 bg-white shadow-card hover:shadow-pop transition-all p-3">
      <p className="text-[10px] font-semibold tracking-[0.14em] uppercase text-brand-500 mb-1">{label}</p>
      <p className="font-display font-bold text-sm text-gray-900 leading-snug">{titreRecette(meal.titre)}</p>
      <p className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-gray-500 mt-1.5">
        <span className="flex items-center gap-1"><Clock className="w-3 h-3" aria-hidden />{formatMinutes(meal.temps_preparation + (meal.temps_cuisson || 0))}</span>
        {meal.calories_par_portion != null && <span className="flex items-center gap-1"><Flame className="w-3 h-3" aria-hidden />{formatCalories(meal.calories_par_portion)}</span>}
        {prix != null && <span className="ml-auto font-semibold text-sauge-700">{formatPrix(prix)}</span>}
      </p>
    </Link>
  );
}

/**
 * Vue complète d'un menu de la semaine public (14 repas, liste de courses chiffrée, FAQ, schema.org) :
 * partagée par /menu-semaine/[slug] et la page « menu exemple » /menu-de-la-semaine.
 */
export function MenuVue({ menu, chemin, maillons, titre, accroche, autresMenus = true }: {
  menu: MenuPublic;
  chemin: string;
  maillons: { label: string; href?: string }[];
  titre: string;
  accroche: string;
  /** Affiche la liste des autres menus (pages /menu-semaine/[slug]) en bas de page */
  autresMenus?: boolean;
}) {
  const { variante } = menu;
  const semaine = formatWeekRange(menu.semaineDebut);
  const sections = [...menu.courses].sort((a, b) => rangMagasin(a.rayon) - rangMagasin(b.rayon));
  const pluriel = variante.personnes > 1 ? 's' : '';

  const faq = [
    { q: 'Combien coûte vraiment ce menu ?', r: `La liste de courses ci-dessous est estimée à ${eur(menu.total)} pour ${variante.personnes} personne${pluriel}, soit environ ${eur(menu.parPersonneParJour)} par personne et par jour. Les prix sont des moyennes de supermarché : ils varient selon l’enseigne et la région.` },
    { q: 'Ce menu est-il équilibré ?', r: `Les 14 plats apportent en moyenne ${menu.kcalMoyen ?? '—'} kcal par portion et varient les protéines (viande, poisson, œufs, légumineuses). Pour un menu adapté à vos besoins, vos allergies et vos goûts, PlanMyMeal le compose automatiquement.` },
    { q: 'Le menu change-t-il chaque semaine ?', r: 'Oui, un nouveau menu est publié chaque lundi à 8 h (heure de Paris), avec un budget différent d’une semaine à l’autre. Le menu de cette page reste le même toute la semaine.' },
    { q: 'Puis-je adapter ce menu à mon budget ?', r: 'Oui : créez un compte gratuit, indiquez votre budget, votre nombre de personnes et vos contraintes, et PlanMyMeal recompose le menu et la liste de courses en un clic.' },
  ];

  const jsonLdListe = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${variante.titre} — semaine du ${semaine}`,
    itemListElement: menu.jours.flatMap((j, i) => [j.dejeuner, j.diner].map((m, k) => ({
      '@type': 'ListItem', position: i * 2 + k + 1, name: titreRecette(m.titre), url: `${SITE_URL}${recetteHref(m)}`,
    }))),
  };
  const jsonLdFaq = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.r } })),
  };

  return (
    <>
      <LandingHeader />
      {[jsonLdFilAriane(maillons), jsonLdListe, jsonLdFaq].map((d, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: serialiserJsonLd(d) }} />
      ))}
      <main id="contenu" className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        <FilAriane maillons={maillons} className="mb-4" />

        <p className="text-[11px] font-semibold tracking-[0.14em] uppercase text-brand-500 mb-1.5">Semaine du {semaine} · nouveau menu chaque lundi à 8 h</p>
        <h1 className="font-display font-bold text-2xl sm:text-4xl text-gray-900 leading-tight">{titre}</h1>
        <p className="mt-3 text-gray-600 max-w-3xl">{accroche}</p>

        <dl className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            ['Liste de courses', eur(menu.total), `budget : ${variante.budget} €`],
            ['Par personne et par jour', eur(menu.parPersonneParJour), `${variante.personnes} personne${pluriel}`],
            ['Calories par plat', menu.kcalMoyen ? `${menu.kcalMoyen} kcal` : '—', 'en moyenne'],
            ['Temps par plat', formatMinutes(menu.minutesMoyennes), 'préparation + cuisson'],
          ].map(([t, valeur, detail]) => (
            <div key={t} className="rounded-2xl border border-gray-100 bg-white p-4">
              <dt className="text-xs text-gray-500">{t}</dt>
              <dd className="mt-1 font-bold text-xl text-gray-900">{valeur}</dd>
              <dd className="text-[11px] text-gray-400">{detail}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link href="/signup?ref=menu-semaine" className="inline-flex items-center justify-center min-h-[44px] rounded-full bg-brand-500 text-white font-semibold px-6 hover:bg-brand-600 transition-colors shadow-cta">
            Adapter ce menu à mon budget — gratuit
          </Link>
          <BoutonPartager type="menu" titre={variante.titre} texte={`${variante.titre} — liste de courses incluse :`} chemin={chemin} />
        </div>

        <h2 className="mt-12 font-display font-bold text-xl text-gray-900">Les 14 repas de la semaine</h2>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {menu.jours.map(j => (
            <div key={j.jour}>
              <h3 className="font-display font-bold text-gray-900 text-sm mb-2">{j.jour}</h3>
              <div className="space-y-2">
                <CarteRepas label="Déjeuner" meal={j.dejeuner} />
                <CarteRepas label="Dîner" meal={j.diner} />
              </div>
            </div>
          ))}
        </div>

        <section className="mt-12" aria-labelledby="courses">
          <div className="flex items-center gap-2 mb-4">
            <ShoppingBasket className="w-5 h-5 text-brand-500" aria-hidden />
            <h2 id="courses" className="font-display font-bold text-xl text-gray-900">Liste de courses</h2>
            <span className="ml-auto font-semibold text-sauge-700 flex items-center gap-1.5"><Wallet className="w-4 h-4" aria-hidden />{eur(menu.total)}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sections.map(section => (
              <div key={section.rayon} className="rounded-xl border border-gray-100 bg-white p-4">
                <p className="font-semibold text-sm text-gray-900 mb-2">{libelleRayon(section.rayon)}</p>
                <ul className="space-y-1">
                  {[...section.items].sort((a, b) => a.nom.localeCompare(b.nom, 'fr')).map(item => (
                    <li key={item.ingredient_id} className="text-[13px] text-gray-600 flex justify-between gap-2">
                      <span className="min-w-0 flex-1 break-words">{item.nom}</span>
                      <span className="shrink-0 text-gray-500 whitespace-nowrap">{quantiteCourses(item.quantite_totale, item.unite, item.nom)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-gray-500">Quantités calculées pour {variante.personnes} personne{pluriel}, prix estimés d’après des moyennes de supermarché.</p>
        </section>

        <section className="mt-12" aria-labelledby="conseils">
          <h2 id="conseils" className="font-display font-bold text-xl text-gray-900">Nos conseils pour tenir le budget</h2>
          <ul className="mt-3 space-y-2 list-disc pl-5 text-gray-700">
            {variante.conseils.map(c => <li key={c}>{c}</li>)}
          </ul>
        </section>

        <section className="mt-12" aria-labelledby="faq">
          <h2 id="faq" className="font-display font-bold text-xl text-gray-900">Questions fréquentes</h2>
          <div className="mt-3 divide-y divide-gray-100 rounded-2xl border border-gray-100 bg-white">
            {faq.map(f => (
              <details key={f.q} className="group p-4">
                <summary className="cursor-pointer list-none font-semibold text-gray-900 flex justify-between gap-3 [&::-webkit-details-marker]:hidden">
                  {f.q}<span className="text-brand-500 group-open:rotate-45 transition-transform" aria-hidden>+</span>
                </summary>
                <p className="mt-2 text-sm text-gray-600">{f.r}</p>
              </details>
            ))}
          </div>
        </section>

        {autresMenus && (
          <section className="mt-12" aria-labelledby="autres">
            <h2 id="autres" className="font-display font-bold text-xl text-gray-900">Autres menus de la semaine</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {VARIANTES.filter(v => v.slug !== variante.slug).map(v => (
                <li key={v.slug}>
                  <Link href={`/menu-semaine/${v.slug}`} className="inline-block text-xs font-semibold px-3 py-2 rounded-full bg-gray-50 text-gray-600 hover:bg-brand-50 hover:text-brand-700 transition-colors">
                    {v.titre.replace('Menu de la semaine ', '')}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
      <LandingFooter />
    </>
  );
}
