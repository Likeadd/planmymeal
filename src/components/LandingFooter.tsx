'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Heart, Mail } from 'lucide-react';
import { anneeParis } from '@/lib/dates';
import { BrandMark } from '@/components/BrandMark';
import { CATEGORIES_SEO } from '@/lib/categories-seo';

const FOOTER_LINKS = [
  ['FAQ', '/faq'],
  ['Mentions légales', '/mentions-legales'],
  ['CGV', '/cgv'],
  ['Contact', '/contact'],
];

export default function LandingFooter() {
  const [email, setEmail] = useState('');
  const [statut, setStatut] = useState<'idle' | 'envoi' | 'ok' | 'erreur'>('idle');

  async function inscrire(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || statut === 'envoi') return;
    setStatut('envoi');
    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      setStatut(res.ok ? 'ok' : 'erreur');
    } catch {
      setStatut('erreur');
    }
  }

  return (
    <footer className="bg-gray-50 border-t border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid md:grid-cols-3 gap-10 items-start">
          {/* Rejoindre */}
          <div>
            <h3 className="font-display text-2xl font-bold text-gray-900">
              Rejoignez PlanMyMeal
            </h3>
            <p className="mt-3 text-gray-600 text-sm leading-relaxed">
              Recevez gratuitement le menu de la semaine et sa liste de
              courses, chaque dimanche — sans créer de compte.
            </p>
          </div>

          {/* Newsletter */}
          <div>
            {statut === 'ok' ? (
              <p className="text-brand-600 font-medium text-sm pt-2">
                📬 Presque fini ! Confirmez votre adresse via l’email que nous venons d’envoyer.
              </p>
            ) : (
              <form onSubmit={inscrire}
                className="flex items-center gap-2 border-b border-gray-400 pb-2 focus-within:border-brand-500 transition-colors">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="ADRESSE EMAIL"
                  className="flex-1 bg-transparent text-sm tracking-wider text-gray-800 placeholder-gray-500 outline-hidden uppercase"
                />
                <button type="submit" aria-label="S’inscrire" disabled={statut === 'envoi'}
                  className="text-brand-600 hover:text-brand-700 transition-colors disabled:opacity-50">
                  <ArrowRight className="w-5 h-5" />
                </button>
              </form>
            )}
            {statut === 'erreur' && (
              <p className="text-red-600 text-xs mt-2">Une erreur est survenue, réessayez.</p>
            )}
          </div>

          {/* Liens + social */}
          <div className="flex flex-col items-start md:items-end gap-4">
            <ul className="flex flex-wrap gap-x-6 gap-y-2">
              {FOOTER_LINKS.map(([label, href]) => (
                <li key={label}>
                  <Link href={href} className="text-[11px] font-semibold tracking-[0.16em] uppercase text-gray-700 hover:text-brand-600 transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="flex items-center gap-3">
              {/* Pas de compte Instagram actif pour l'instant — pas de lien mort ("#") */}
              <a href="mailto:contact@getplanmymeal.com" aria-label="Nous contacter par email"
                className="w-10 h-10 rounded-full border border-gray-300 flex items-center justify-center text-gray-700 hover:text-brand-600 hover:border-brand-400 transition-colors">
                <Mail className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Idées de recettes : pages catégories (SEO + navigation des visiteurs) */}
      <nav aria-label="Idées de recettes" className="border-t border-gray-200 py-5 px-4">
        <ul className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-gray-600">
          {CATEGORIES_SEO.map(cat => (
            <li key={cat.slug}>
              <Link href={`/recettes/categorie/${cat.slug}`} className="hover:text-brand-600 transition-colors">
                {cat.court}
              </Link>
            </li>
          ))}
          <li><Link href="/recettes" className="hover:text-brand-600 transition-colors">Toutes les recettes</Link></li>
        </ul>
      </nav>

      <div className="border-t border-gray-200 py-6 flex flex-col items-center gap-3">
        <BrandMark href="/" height={26} />
        <p className="text-center text-xs text-gray-500">
          {/* Année ancrée sur Europe/Paris : `new Date().getFullYear()` était
              évalué au BUILD (page statique) → « 2026 » figé et mismatch au
              passage à l'année suivante. */}
          © {anneeParis()} PlanMyMeal — Fait maison avec <Heart className="w-3 h-3 inline text-brand-500" /> pour les foodies indécis
        </p>
      </div>
    </footer>
  );
}
