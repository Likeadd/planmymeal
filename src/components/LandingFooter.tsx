'use client';

import { track } from '@/lib/analytics';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { anneeParis } from '@/lib/dates';
import { BrandMark } from '@/components/BrandMark';

const FOOTER_LINKS = [
  ['FAQ', '/faq'],
  ['Menus', '/menu-semaine'],
  ['Contact', '/contact'],
  ['Mentions légales', '/mentions-legales'],
  ['CGU', '/cgu'],
  ['CGV', '/cgv'],
  ['Confidentialité', '/confidentialite'],
  ['Cookies', '/cookies'],
  ['Rétractation', '/retractation'],
  ['Résilier', '/resiliation'],
];

/** `sansNewsletter` : pages connexion / inscription, où l'inscription à la newsletter n'a pas lieu d'être. */
export default function LandingFooter({ sansNewsletter = false }: { sansNewsletter?: boolean }) {
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
      if (res.ok) track('Newsletter', { page: window.location.pathname === '/' ? 'accueil' : window.location.pathname.split('/')[1] || 'autre' });
    } catch {
      setStatut('erreur');
    }
  }

  return (
    <footer className="bg-gray-50 border-t border-gray-200 print:hidden">
      <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${sansNewsletter ? 'py-10' : 'py-16'}`}>
        <div className={sansNewsletter ? 'flex justify-center' : 'grid md:grid-cols-3 gap-10 items-start'}>
          {!sansNewsletter && (<>
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
                  aria-label="Votre adresse email"
                  autoComplete="email"
                  className="flex-1 bg-transparent text-sm tracking-wider text-gray-800 placeholder-gray-500 outline-hidden uppercase"
                />
                <button type="submit" aria-label="S’inscrire" disabled={statut === 'envoi'}
                  className="text-brand-600 hover:text-brand-700 transition-colors disabled:opacity-50">
                  <ArrowRight className="w-5 h-5" />
                </button>
              </form>
            )}
            {statut !== 'ok' && (
              <p className="mt-2 text-xs text-gray-600 leading-snug">
                Votre adresse sert uniquement à vous envoyer le menu de la semaine, après confirmation par email. Désinscription en un clic dans
                chaque message. <Link href="/confidentialite" className="underline underline-offset-2">En savoir plus</Link>.
              </p>
            )}
            {statut === 'erreur' && (
              <p className="text-red-600 text-xs mt-2">Une erreur est survenue, réessayez.</p>
            )}
          </div>
          </>)}

          {/* Liens */}
          <ul className={`flex flex-wrap gap-x-6 gap-y-2 ${sansNewsletter ? 'justify-center' : 'md:justify-end'}`}>
            {FOOTER_LINKS.map(([label, href]) => (
              <li key={label}>
                <Link href={href} className="text-[11px] font-semibold tracking-[0.16em] uppercase text-gray-700 hover:text-brand-600 transition-colors">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-gray-200 py-6 flex flex-col items-center gap-3">
        <BrandMark href="/" height={26} />
        <p className="text-center text-xs text-gray-500">
          {/* Année ancrée sur Europe/Paris : `new Date().getFullYear()` était
              évalué au BUILD (page statique) → « 2026 » figé et mismatch au
              passage à l'année suivante. */}
          © {anneeParis()} PlanMyMeal
        </p>
      </div>
    </footer>
  );
}
