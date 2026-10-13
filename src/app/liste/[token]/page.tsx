import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import LandingHeader from '@/components/LandingHeader';
import LandingFooter from '@/components/LandingFooter';
import { getPlanPartage } from '@/app/menu/[token]/data';
import { formatWeekRange } from '@/lib/dates';
import { formatPrix } from '@/lib/budget';
import { libelleRayon, quantiteCourses, rangMagasin } from '@/lib/liste-courses';
import { ListePubliqueClient, type SectionPublique } from './ListePubliqueClient';

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const plan = await getPlanPartage(token);
  if (!plan) return { title: 'Liste introuvable', robots: { index: false } };
  const semaine = formatWeekRange(plan.semaineDebut);
  return {
    title: `Liste de courses — ${semaine}`,
    description: `Une liste de courses de la semaine (${semaine}), triée par rayon, composée avec PlanMyMeal.`,
    // Page personnelle : partageable (aperçus WhatsApp) mais non indexée
    robots: { index: false, follow: true },
    openGraph: { title: `Liste de courses — ${semaine}`, description: 'Triée par rayon, prête à imprimer ou à partager.', type: 'website' },
  };
}

export default async function ListePartagePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const plan = await getPlanPartage(token);
  if (!plan || plan.courses.length === 0) notFound();

  const sections: SectionPublique[] = [...plan.courses]
    .sort((a, b) => rangMagasin(a.rayon) - rangMagasin(b.rayon))
    .map(s => ({
      label: libelleRayon(s.rayon),
      rayon: s.rayon,
      items: [...s.items]
        .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
        .map(i => ({ nom: i.nom, quantite: quantiteCourses(i.quantite_totale, i.unite, i.nom), prix: i.prix != null ? formatPrix(i.prix) : null })),
    }));
  const total = plan.courses.reduce((s, sec) => s + sec.total, 0);

  return (
    <>
      <LandingHeader />
      <main id="contenu" className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <p className="print:hidden text-[11px] font-semibold tracking-[0.14em] uppercase text-brand-500 mb-1.5">Liste partagée</p>
        <h1 className="font-display font-bold text-2xl sm:text-3xl text-gray-900">Liste de courses</h1>
        <p className="mt-1 text-gray-600 text-sm">Semaine du {formatWeekRange(plan.semaineDebut)}</p>
        <ListePubliqueClient titre="Liste de courses" semaine={`semaine du ${formatWeekRange(plan.semaineDebut)}`}
          sections={sections} total={total > 0 ? formatPrix(total) : null} chemin={`/liste/${token}`} />
      </main>
      <LandingFooter />
    </>
  );
}
