'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Mail, Plus } from 'lucide-react';
import LandingHeader from '@/components/LandingHeader';
import LandingFooter from '@/components/LandingFooter';
import { Underlined } from '@/components/WavyUnderline';
import { FAQ_CATEGORIES, type FaqItem } from './faq-data';

export default function FaqPage() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <LandingHeader />
      <main>
        <FaqHero />
        <FaqContent />
        <FaqCta />
      </main>
      <LandingFooter />
    </div>
  );
}

// ─── Hero FAQ ───────────────────────────────────────────────────────────────

function FaqHero() {
  return (
    <section className="relative overflow-hidden border-b border-gray-200">
      {/* Bulles décoratives */}
      <div className="absolute -top-6 right-10 flex items-center gap-1.5 opacity-60" aria-hidden>
        <span className="w-2 h-2 rounded-full bg-accent-400" />
        <span className="w-3.5 h-3.5 rounded-full bg-accent-300" />
        <span className="w-2 h-2 rounded-full bg-accent-400" />
      </div>
      {/* Décorative uniquement : sur un hero mobile court, elle finit
          derrière le texte au lieu de rester dans un coin vide. */}
      <div className="hidden lg:block absolute bottom-8 left-8 w-24 h-24 rounded-full bg-brand-100/70" aria-hidden />

      <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 text-center">
        <p className="text-[11px] font-semibold tracking-[0.22em] uppercase text-brand-600 mb-5">
          Foire aux questions
        </p>
        <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-gray-900 text-balance">
          Des questions ?{' '}
          <Underlined color="#7C5FBF">Des réponses.</Underlined>
        </h1>
        <p className="mt-6 text-gray-600 text-base sm:text-lg leading-relaxed max-w-xl mx-auto">
          Tout ce qu&apos;il faut savoir sur PlanMyMeal : la génération de menus,
          les abonnements, la liste de courses et vos données.
        </p>
      </div>
    </section>
  );
}


function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="space-y-3">
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <div
            key={item.q}
            className={`bg-white rounded-2xl border transition-all ${
              isOpen ? 'border-brand-300 shadow-pop' : 'border-gray-200'
            }`}>
            <button
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="w-full flex items-center justify-between gap-4 text-left px-5 sm:px-6 py-4">
              <span className="font-medium text-gray-900 text-sm sm:text-base leading-snug">
                {item.q}
              </span>
              <span
                className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                  isOpen ? 'bg-brand-500 text-white rotate-45' : 'bg-gray-100 text-gray-700'
                }`}>
                <Plus className="w-4 h-4" />
              </span>
            </button>
            {isOpen && (
              <div className="px-5 sm:px-6 pb-5 -mt-1">
                <p className="text-gray-600 text-sm leading-relaxed">
                  {item.a}
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function FaqContent() {
  return (
    <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-16 space-y-12">
      {FAQ_CATEGORIES.map(cat => (
        <div key={cat.label}>
          <div className="flex items-center gap-3 mb-5">
            <span className="w-2 h-2 rounded-full bg-brand-500" aria-hidden />
            <h2 className="text-[11px] font-semibold tracking-[0.22em] uppercase text-gray-800">
              {cat.label}
            </h2>
          </div>
          <FaqAccordion items={cat.items} />
        </div>
      ))}
    </section>
  );
}

// ─── CTA final ──────────────────────────────────────────────────────────────

function FaqCta() {
  return (
    <section className="px-4 sm:px-6 lg:px-8 pb-20">
      <div className="max-w-3xl mx-auto bg-brand-600 rounded-3xl px-6 sm:px-12 py-12 text-center relative overflow-hidden">
        <div className="absolute -top-8 right-6 flex items-center gap-1.5 opacity-40" aria-hidden>
          <span className="w-2 h-2 rounded-full bg-white" />
          <span className="w-3.5 h-3.5 rounded-full bg-white/80" />
          <span className="w-2 h-2 rounded-full bg-white" />
        </div>
        <h2 className="font-display text-2xl sm:text-3xl font-bold text-white text-balance">
          Vous ne trouvez pas votre réponse ?
        </h2>
        <p className="mt-3 text-white/80 text-sm sm:text-base max-w-md mx-auto">
          Notre équipe répond rapidement, avec plaisir.
        </p>
        <div className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-3">
          <a
            href="mailto:contact@getplanmymeal.com"
            className="inline-flex items-center gap-2 px-7 py-3 bg-white text-brand-700 font-semibold text-sm rounded-full hover:bg-gray-50 transition-colors shadow-xs">
            <Mail className="w-4 h-4" /> Nous écrire
          </a>
          <Link href="/signup"
            className="inline-flex items-center gap-2 px-7 py-3 border-2 border-white/60 text-white font-semibold text-sm rounded-full hover:bg-white/10 transition-colors">
            Essayer gratuitement <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}


