import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MenuVue } from '../menu-semaine/MenuVue';
import { getMenuExemple } from '../menu-semaine/data';
import { SITE_URL } from '@/lib/seo';
import { formatWeekRange } from '@/lib/dates';

// Nouveau menu exemple chaque lundi à 8 h (Paris) : régénéré toutes les 30 minutes.
export const revalidate = 1800;

const eur = (n: number) => `${n.toFixed(2).replace('.', ',')} €`;
const personnes = (n: number) => `${n} personne${n > 1 ? 's' : ''}`;

export async function generateMetadata(): Promise<Metadata> {
  const menu = await getMenuExemple();
  if (!menu) return { title: 'Menu de la semaine', robots: { index: false } };
  const { variante } = menu;
  const semaine = formatWeekRange(menu.semaineDebut);
  const titre = `Menu de la semaine pas cher : ${variante.budget} € pour ${personnes(variante.personnes)} (${semaine})`;
  const description = `Le menu de la semaine du ${semaine} : 14 repas, liste de courses à ${eur(menu.total)} pour ${personnes(variante.personnes)} et recettes détaillées. Nouveau menu et nouveau budget chaque lundi à 8 h.`;
  const url = `${SITE_URL}/menu-de-la-semaine`;
  return { title: titre, description, alternates: { canonical: url }, openGraph: { title: titre, description, type: 'article', url } };
}

export default async function MenuDeLaSemainePage() {
  const menu = await getMenuExemple();
  if (!menu) notFound();
  const { variante } = menu;
  return (
    <MenuVue
      menu={menu}
      chemin="/menu-de-la-semaine"
      maillons={[{ label: 'Accueil', href: '/' }, { label: 'Menus de la semaine', href: '/menu-semaine' }, { label: 'Menu de la semaine' }]}
      titre={`Menu de la semaine pas cher : ${variante.budget} € pour ${personnes(variante.personnes)}`}
      accroche={`Chaque lundi à 8 h, un nouveau menu complet de 14 repas avec son budget : cette semaine, ${variante.accroche.charAt(0).toLowerCase()}${variante.accroche.slice(1)}`}
    />
  );
}
