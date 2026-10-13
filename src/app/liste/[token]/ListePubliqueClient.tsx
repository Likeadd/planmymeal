'use client';

// Liste de courses publique : cases à cocher (locales, rien n'est enregistré),
// impression / PDF, copie en texte et partage.

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Check, ClipboardCopy, Printer } from 'lucide-react';
import { BoutonPartager } from '@/components/BoutonPartager';
import { copyToClipboard, cn } from '@/lib/utils';
import { listeEnTexte, type SectionListe } from '@/lib/liste-courses';
import { track } from '@/lib/analytics';

export interface SectionPublique extends SectionListe { items: { nom: string; quantite: string; prix: string | null }[] }

export function ListePubliqueClient({
  titre, semaine, sections, total, chemin,
}: { titre: string; semaine: string; sections: SectionPublique[]; total: string | null; chemin: string }) {
  const [coches, setCoches] = useState<Set<string>>(new Set());
  const nbArticles = sections.reduce((n, s) => n + s.items.length, 0);

  const basculer = (cle: string) => setCoches(prev => { const n = new Set(prev); if (n.has(cle)) n.delete(cle); else n.add(cle); return n; });

  const copier = async () => {
    const ok = await copyToClipboard(listeEnTexte(`${titre} — ${semaine}`, sections, `${window.location.origin}${chemin}`));
    if (ok) { toast.success('Liste copiée : collez-la dans un message 📋'); track('Partage', { type: 'liste', canal: 'texte' }); }
    else toast.error('Copie impossible dans ce navigateur.');
  };
  const imprimer = () => { track('Liste imprimée'); window.print(); };

  const bouton = 'inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-xl border-2 border-gray-200 text-sm font-semibold text-gray-600 hover:border-brand-300 hover:text-brand-600 transition-all';

  return (
    <>
      <div className="print:hidden flex flex-wrap items-center gap-2 mt-6">
        <button type="button" onClick={imprimer} className={bouton}><Printer className="w-4 h-4" aria-hidden /> Imprimer / PDF</button>
        <button type="button" onClick={copier} className={bouton}><ClipboardCopy className="w-4 h-4" aria-hidden /> Copier en texte</button>
        <BoutonPartager type="liste" titre={`${titre} — ${semaine}`} texte="Ma liste de courses de la semaine :" chemin={chemin} />
      </div>

      <p className="mt-6 text-sm text-gray-500">
        {nbArticles} articles{total ? <> · estimation <strong className="text-gray-800">{total}</strong></> : null}
        <span className="print:hidden"> · touchez un article pour le barrer</span>
      </p>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 print:block print:columns-2 print:gap-6">
        {sections.map(section => (
          <section key={section.label} className="rounded-2xl border border-gray-100 bg-white p-4 break-inside-avoid print:mb-4 print:rounded-none print:border-gray-300">
            <h2 className="font-display font-bold text-gray-900 mb-2">{section.label}</h2>
            <ul className="divide-y divide-gray-50">
              {section.items.map(item => {
                const cle = `${section.label}|${item.nom}`;
                const coche = coches.has(cle);
                return (
                  <li key={cle}>
                    <button type="button" onClick={() => basculer(cle)} aria-pressed={coche}
                      className="w-full flex items-center gap-3 py-2.5 min-h-[44px] text-left">
                      <span className={cn('w-5 h-5 shrink-0 rounded border-2 flex items-center justify-center', coche ? 'bg-sauge-500 border-sauge-500 text-white' : 'border-gray-300 print:border-gray-500')}>
                        {coche && <Check className="w-3.5 h-3.5" aria-hidden />}
                      </span>
                      <span className={cn('flex-1 text-sm', coche ? 'line-through text-gray-400' : 'text-gray-800')}>{item.nom}</span>
                      <span className="text-sm text-gray-500 whitespace-nowrap">{item.quantite}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      <div className="print:hidden mt-10 text-center rounded-2xl bg-brand-50 p-8">
        <p className="font-display font-bold text-lg text-gray-900">Votre liste de courses, calculée pour vous</p>
        <p className="mt-1.5 text-sm text-gray-600">Menus, budget et liste triée par rayon : composés en 2 minutes, gratuitement.</p>
        <Link href="/signup?ref=liste" className="inline-flex items-center justify-center rounded-full bg-brand-500 text-white font-semibold px-6 py-3 mt-4 hover:bg-brand-600 transition-colors">
          Créer ma liste gratuitement
        </Link>
      </div>
    </>
  );
}
