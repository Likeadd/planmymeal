// ============================================================================
// Liste de courses partageable : ordre du magasin, libellés de quantités,
// version texte (copier / WhatsApp) et lien public.
// ============================================================================

import { quantiteLisible } from '@/lib/quantites';
import { formatRayon } from '@/lib/utils';
import { lienPublicMenu } from '@/lib/partage-menu';

/**
 * Ordre de parcours d'un supermarché (entrée → caisse) : frais d'abord pour
 * limiter le temps hors frigo, sec/sucré/boissons en fin de course.
 */
export const ORDRE_MAGASIN = [
  'fruits_legumes', 'boulangerie', 'frais', 'viande_poisson', 'surgeles',
  'epicerie_salee', 'conserves', 'epices', 'epicerie_sucree', 'boissons',
];
export const rangMagasin = (rayon: string) => {
  const i = ORDRE_MAGASIN.indexOf(rayon);
  return i === -1 ? ORDRE_MAGASIN.length : i;
};

/** « 1,2 kg », « 450 g », « 2 pièces » : les grandes quantités passent en kg / L. */
export function quantiteCourses(quantite: number, unite: string, nom = ''): string {
  if (unite === 'g' && quantite >= 1000) return `${String(Math.round(quantite / 100) / 10).replace('.', ',')} kg`;
  if (unite === 'ml' && quantite >= 1000) return `${String(Math.round(quantite / 100) / 10).replace('.', ',')} L`;
  if (unite === 'g' || unite === 'ml') return `${Math.round(quantite / 5) * 5 || Math.round(quantite)} ${unite}`;
  // On n'achète que des unités entières : 19,5 œufs → 20
  if (['pcs', 'tranche', 'botte', 'sachet', 'boite'].includes(unite)) return quantiteLisible(Math.max(1, Math.ceil(quantite - 0.01)), unite, nom);
  return quantiteLisible(quantite, unite, nom);
}

export interface SectionListe { label: string; rayon?: string; items: { nom: string; quantite: string }[] }

/** Liste prête à coller dans un message (WhatsApp, SMS, notes) : un rayon par bloc, une case par article. */
export function listeEnTexte(titre: string, sections: SectionListe[], lien?: string): string {
  const blocs = sections
    .filter(s => s.items.length > 0)
    .map(s => `${s.label}\n${s.items.map(i => `☐ ${i.nom} — ${i.quantite}`).join('\n')}`);
  return [`🛒 ${titre}`, ...blocs, ...(lien ? [`Composée avec PlanMyMeal : ${lien}`] : [])].join('\n\n');
}

export const libelleRayon = formatRayon;

/** Lien public de la LISTE de courses d'une semaine (même jeton que le menu partagé). */
export async function lienPublicListe(semaineDebut: string): Promise<string> {
  return (await lienPublicMenu(semaineDebut)).replace('/menu/', '/liste/');
}
