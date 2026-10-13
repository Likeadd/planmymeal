import type { ReactNode } from 'react';
import Link from 'next/link';
import LandingHeader from '@/components/LandingHeader';
import LandingFooter from '@/components/LandingFooter';
import { Underlined } from '@/components/WavyUnderline';

export type SectionLegale = { title: string; body: ReactNode };

/** Lien de texte courant des pages légales */
export const lienTexte = 'text-brand-700 underline underline-offset-2 decoration-brand-300 hover:text-brand-800';

/**
 * Gabarit commun des pages légales (CGU, confidentialité, cookies, rétractation) :
 * même hero et même mise en page que Mentions légales / CGV.
 */
export function PageLegale({ titre, motSouligne, accroche, sections, majLe, couleur = '#C4552C' }: {
  titre: string;
  motSouligne: string;
  accroche: string;
  sections: SectionLegale[];
  /** Date FIGÉE de dernière modification du texte (jamais « aujourd'hui ») */
  majLe: string;
  couleur?: string;
}) {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <LandingHeader />
      <main id="contenu">
        <section className="relative overflow-hidden border-b border-gray-200">
          <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 text-center">
            <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-gray-900 text-balance">
              {titre}{' '}
              <Underlined color={couleur}>{motSouligne}</Underlined>
            </h1>
            <p className="mt-6 text-gray-600 text-base sm:text-lg leading-relaxed max-w-xl mx-auto">{accroche}</p>
          </div>
        </section>

        <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-16">
          {/* Sommaire : utile aux lecteurs d'écran, aux assistants IA et aux longs textes */}
          <nav aria-label="Sommaire" className="mb-10 rounded-2xl border border-gray-200 bg-white p-5">
            <p className="text-[11px] font-semibold tracking-[0.22em] uppercase text-gray-800 mb-2">Sommaire</p>
            <ol className="list-decimal pl-5 space-y-1 text-sm text-gray-700 columns-1 sm:columns-2">
              {sections.map((s, i) => (
                <li key={s.title}><a href={`#section-${i + 1}`} className={lienTexte}>{s.title}</a></li>
              ))}
            </ol>
          </nav>

          <div className="space-y-10">
            {sections.map((section, i) => (
              <section key={section.title} id={`section-${i + 1}`} aria-labelledby={`titre-${i + 1}`} className="scroll-mt-28">
                <div className="flex items-center gap-3 mb-3">
                  <span className="w-2 h-2 rounded-full bg-brand-500" aria-hidden />
                  <h2 id={`titre-${i + 1}`} className="text-[11px] font-semibold tracking-[0.22em] uppercase text-gray-800">
                    {i + 1}. {section.title}
                  </h2>
                </div>
                <div className="pl-5 space-y-3 text-gray-700 text-sm leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_ol]:list-decimal [&_ol]:pl-5">
                  {section.body}
                </div>
              </section>
            ))}
          </div>

          <p className="mt-12 text-xs text-gray-600">Dernière mise à jour : {majLe}.</p>

          <div className="mt-8 bg-white border border-gray-200 rounded-2xl p-6 text-center">
            <p className="text-gray-700 text-sm">
              Une question ? Consultez la <Link href="/faq" className={lienTexte}>FAQ</Link> ou{' '}
              <Link href="/contact" className={lienTexte}>contactez-nous</Link>.
            </p>
          </div>
        </section>
      </main>
      <LandingFooter />
    </div>
  );
}
