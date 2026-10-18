import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MenuVue } from '../MenuVue';
import { VARIANTES, varianteParSlug } from '@/lib/menu-public';
import { getMenuSemaine } from '../data';
import { SITE_URL } from '@/lib/seo';
import { formatWeekRange } from '@/lib/dates';

// Le menu change chaque lundi à 8 h : régénéré toutes les 30 minutes.
export const revalidate = 1800;
export const dynamicParams = false;

export function generateStaticParams() {
  return VARIANTES.map(v => ({ slug: v.slug }));
}

const eur = (n: number) => `${n.toFixed(2).replace('.', ',')} €`;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const menu = await getMenuSemaine(slug);
  const variante = varianteParSlug(slug);
  if (!menu || !variante) return { title: 'Menu introuvable', robots: { index: false } };

  const semaine = formatWeekRange(menu.semaineDebut);
  const titre = `${variante.titre} (${semaine}) — liste de courses incluse`;
  const description = `${variante.titre} : 14 repas, liste de courses chiffrée (${eur(menu.total)}) et recettes détaillées pour la semaine du ${semaine}. Un nouveau menu chaque lundi.`;
  const url = `${SITE_URL}/menu-semaine/${slug}`;
  return { title: titre, description, alternates: { canonical: url }, openGraph: { title: titre, description, type: 'article', url } };
}

export default async function MenuSemainePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const menu = await getMenuSemaine(slug);
  if (!menu) notFound();
  const { variante } = menu;
  return (
    <MenuVue
      menu={menu}
      chemin={`/menu-semaine/${variante.slug}`}
      maillons={[{ label: 'Accueil', href: '/' }, { label: 'Menus de la semaine', href: '/menu-semaine' }, { label: variante.titre }]}
      titre={variante.titre}
      accroche={variante.accroche}
    />
  );
}
