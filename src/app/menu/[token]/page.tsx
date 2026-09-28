import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Clock, Flame, ShoppingBasket } from 'lucide-react';
import { getPlanPartage, type RepasJour } from './data';
import { recetteHref } from '@/lib/seo';
import { JOURS_NOMS, formatWeekRange } from '@/lib/dates';
import { formatMinutes, formatCalories, titreMajuscules } from '@/lib/utils';
import { formatPrix, prixParPortion } from '@/lib/budget';
import type { RecettePlanning } from '@/types';

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const plan = await getPlanPartage(token);
  if (!plan) return { title: 'Menu introuvable', robots: { index: false } };

  const semaine = formatWeekRange(plan.semaineDebut);
  return {
    title: `Menu de la semaine partagé — ${semaine}`,
    description: `Un menu de la semaine planifié avec PlanMyMeal (${semaine}), avec sa liste de courses.`,
    // Page personnelle éphémère : partageable (aperçus WhatsApp/réseaux OK)
    // mais pas indexée — éviterait du contenu quasi dupliqué en masse.
    robots: { index: false, follow: true },
    openGraph: {
      title: `Menu de la semaine — ${semaine}`,
      description: 'Planifié avec PlanMyMeal : budget, courses et repas de la semaine.',
      type: 'website',
    },
  };
}

function CarteRepas({ label, recette }: { label: string; recette?: RecettePlanning }) {
  if (!recette) return null;
  const prix = prixParPortion(recette);
  return (
    <Link href={recetteHref(recette)}
      className="block rounded-xl border border-gray-100 bg-white shadow-card hover:shadow-pop transition-all p-3">
      <p className="text-[10px] font-semibold tracking-[0.14em] uppercase text-brand-500 mb-1">{label}</p>
      <p className="font-display font-bold text-sm text-gray-900 leading-snug">{titreMajuscules(recette.titre)}</p>
      <div className="flex items-center gap-2.5 text-[11px] text-gray-500 mt-1.5">
        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatMinutes(recette.temps_preparation + (recette.temps_cuisson || 0))}</span>
        {recette.calories_par_portion != null && (
          <span className="flex items-center gap-1"><Flame className="w-3 h-3" />{formatCalories(recette.calories_par_portion)}</span>
        )}
        {prix != null && <span className="ml-auto font-semibold text-sauge-700">{formatPrix(prix)}</span>}
      </div>
    </Link>
  );
}

export default async function MenuPartagePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const plan = await getPlanPartage(token);
  if (!plan) notFound();

  const totalCourses = plan.courses.reduce((s, sec) => s + sec.total, 0);

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      <p className="text-[11px] font-semibold tracking-[0.14em] uppercase text-brand-500 mb-1.5">Menu partagé</p>
      <h1 className="font-display font-bold text-2xl sm:text-3xl text-gray-900">
        Semaine du {formatWeekRange(plan.semaineDebut)}
      </h1>
      <p className="mt-2 text-gray-600 text-sm">
        Planifié avec PlanMyMeal — budget, calories et liste de courses calculés automatiquement.
      </p>

      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {plan.jours.map((jour: RepasJour, i: number) => {
          const repas = [
            jour.dejeuner && <CarteRepas key="d" label="Déjeuner" recette={jour.dejeuner} />,
            jour.diner && <CarteRepas key="n" label="Dîner" recette={jour.diner} />,
            jour.dessert && <CarteRepas key="p" label="Dessert" recette={jour.dessert} />,
          ].filter(Boolean);
          if (repas.length === 0) return null;
          return (
            <div key={i} data-reveal style={{ '--i': i % 4 } as React.CSSProperties}>
              <h2 className="font-display font-bold text-gray-900 text-sm mb-2">{JOURS_NOMS[i]}</h2>
              <div className="space-y-2">{repas}</div>
            </div>
          );
        })}
      </div>

      {plan.courses.length > 0 && (
        <section className="mt-12">
          <div className="flex items-center gap-2 mb-4">
            <ShoppingBasket className="w-5 h-5 text-brand-500" />
            <h2 className="font-display font-bold text-xl text-gray-900">Liste de courses</h2>
            <span className="ml-auto font-semibold text-sauge-700">{formatPrix(totalCourses)}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {plan.courses.map(section => (
              <div key={section.rayon} className="rounded-xl border border-gray-100 bg-white p-4">
                <p className="font-semibold text-sm text-gray-900 mb-2">{section.label}</p>
                <ul className="space-y-1">
                  {section.items.map(item => (
                    <li key={item.ingredient_id} className="text-[13px] text-gray-600 flex justify-between gap-2">
                      <span>{item.nom}</span>
                      {item.prix != null && <span className="text-gray-400">{formatPrix(item.prix)}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="mt-12 text-center rounded-2xl bg-brand-50 p-8">
        <p className="font-display font-bold text-lg text-gray-900">Planifiez le vôtre en 2 minutes</p>
        <p className="mt-1.5 text-sm text-gray-600">Budget, goûts, stock et anti-gaspi optimisés automatiquement.</p>
        <Link href="/signup?ref=partage"
          className="inline-flex items-center justify-center rounded-full bg-brand-500 text-white font-semibold px-6 py-3 mt-4 hover:bg-brand-600 transition-colors">
          Commencer gratuitement
        </Link>
      </div>
    </main>
  );
}
