'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Mail, Clock, Heart, Send, ArrowRight } from 'lucide-react';
import LandingHeader from '@/components/LandingHeader';
import LandingFooter from '@/components/LandingFooter';
import { Underlined } from '@/components/WavyUnderline';

const SUBJECTS = [
  'Question générale',
  'Mon abonnement',
  'Un problème technique',
  'Données personnelles',
  'Partenariat',
];

export default function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);

  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');
  const [piege, setPiege] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnvoi(true);
    setErreur('');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, subject, message, site: piege }),
      });
      if (res.ok) setSent(true);
      else setErreur((await res.json().catch(() => ({}))).error || 'Envoi impossible pour le moment.');
    } catch {
      setErreur('Connexion impossible. Réessayez dans un instant.');
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <LandingHeader />
      <main id="contenu">
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-gray-200">
          <div className="absolute -top-6 right-10 flex items-center gap-1.5 opacity-60" aria-hidden>
            <span className="w-2 h-2 rounded-full bg-accent-400" />
            <span className="w-3.5 h-3.5 rounded-full bg-accent-300" />
            <span className="w-2 h-2 rounded-full bg-accent-400" />
          </div>
          {/* Décorative uniquement : sur un hero mobile court, elle finit
              derrière le texte au lieu de rester dans un coin vide. */}

          <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 text-center">
            <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-gray-900 text-balance">
              <Underlined color="#7C5FBF">Parlons-en.</Underlined>
            </h1>
            <p className="mt-6 text-gray-600 text-base sm:text-lg leading-relaxed max-w-xl mx-auto">
              Une question, une idée, un souci ? Notre équipe répond avec
              plaisir, en général sous 48 h ouvrées.
            </p>
          </div>
        </section>

        {/* Formulaire + infos */}
        <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-16">
          <div className="grid lg:grid-cols-[1fr_340px] gap-10 items-start">
            {/* Formulaire */}
            <div className="bg-white border border-gray-200 rounded-3xl p-6 sm:p-8">
              {sent ? (
                <div className="text-center py-12">
                  <div className="w-14 h-14 rounded-full bg-brand-100 flex items-center justify-center mx-auto mb-5">
                    <Mail className="w-6 h-6 text-brand-600" />
                  </div>
                  <h2 className="font-display text-2xl font-bold text-gray-900">
                    Message envoyé
                  </h2>
                  <p className="mt-3 text-gray-600 text-sm leading-relaxed max-w-sm mx-auto">
                    Merci de nous avoir écrit. Nous vous répondons par email,
                    en général sous 48 h ouvrées.
                  </p>
                  <button
                    onClick={() => { setSent(false); setName(''); setEmail(''); setMessage(''); }}
                    className="mt-7 inline-flex items-center gap-2 px-6 py-3 bg-brand-500 text-white font-semibold text-sm rounded-full hover:bg-brand-600 transition-colors shadow-cta">
                    Envoyer un autre message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <input type="text" name="site" value={piege} onChange={e => setPiege(e.target.value)}
                    tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
                  <div className="grid sm:grid-cols-2 gap-5">
                    <div>
                      <label htmlFor="name" className="block text-[11px] font-semibold tracking-[0.18em] uppercase text-gray-700 mb-2">
                        Nom
                      </label>
                      <input
                        id="name"
                        type="text"
                        required
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="Votre nom"
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 outline-hidden focus:border-brand-400 focus:bg-white transition-colors"
                      />
                    </div>
                    <div>
                      <label htmlFor="email" className="block text-[11px] font-semibold tracking-[0.18em] uppercase text-gray-700 mb-2">
                        Email
                      </label>
                      <input
                        id="email"
                        type="email"
                        required
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="vous@exemple.com"
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 outline-hidden focus:border-brand-400 focus:bg-white transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="subject" className="block text-[11px] font-semibold tracking-[0.18em] uppercase text-gray-700 mb-2">
                      Sujet
                    </label>
                    <select
                      id="subject"
                      value={subject}
                      onChange={e => setSubject(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 outline-hidden focus:border-brand-400 focus:bg-white transition-colors">
                      {SUBJECTS.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="message" className="block text-[11px] font-semibold tracking-[0.18em] uppercase text-gray-700 mb-2">
                      Message
                    </label>
                    <textarea
                      id="message"
                      required
                      rows={5}
                      value={message}
                      onChange={e => setMessage(e.target.value)}
                      placeholder="Dites-nous tout…"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 outline-hidden focus:border-brand-400 focus:bg-white transition-colors resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={envoi}
                    className="inline-flex items-center gap-2 px-7 py-3 disabled:opacity-60 bg-brand-500 text-white font-semibold text-sm rounded-full hover:bg-brand-600 transition-colors shadow-cta">
                    {envoi ? 'Envoi…' : 'Envoyer le message'}
                    <Send className="w-4 h-4" />
                  </button>
                  {erreur && <p role="alert" className="text-sm text-red-600">{erreur}</p>}
                </form>
              )}
            </div>

            {/* Infos */}
            <div className="space-y-5">
              <div className="bg-white border border-gray-200 rounded-3xl p-6">
                <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center mb-4">
                  <Mail className="w-5 h-5 text-brand-600" />
                </div>
                <h2 className="font-display text-lg font-bold text-gray-900">Par email</h2>
                <a href="mailto:contact@getplanmymeal.com"
                  className="mt-2 block text-sm text-brand-600 font-medium underline underline-offset-2 decoration-brand-300 hover:text-brand-700 break-all">
                  contact@getplanmymeal.com
                </a>
              </div>

              <div className="bg-white border border-gray-200 rounded-3xl p-6">
                <div className="w-10 h-10 rounded-full bg-accent-100 flex items-center justify-center mb-4">
                  <Clock className="w-5 h-5 text-accent-700" />
                </div>
                <h2 className="font-display text-lg font-bold text-gray-900">Délai de réponse</h2>
                <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                  En général sous <strong>48 h ouvrées</strong>, du lundi au
                  vendredi.
                </p>
              </div>

              <div className="bg-brand-600 rounded-3xl p-6 text-white relative overflow-hidden">
                <div className="absolute -top-6 right-4 flex items-center gap-1.5 opacity-40" aria-hidden>
                  <span className="w-2 h-2 rounded-full bg-white" />
                  <span className="w-3.5 h-3.5 rounded-full bg-white/80" />
                  <span className="w-2 h-2 rounded-full bg-white" />
                </div>
                <div className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center mb-4">
                  <Heart className="w-5 h-5" />
                </div>
                <h2 className="font-display text-lg font-bold">Une question fréquente ?</h2>
                <p className="mt-2 text-sm text-white/95 leading-relaxed">
                  La réponse est peut-être déjà dans notre FAQ.
                </p>
                <Link href="/faq"
                  className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-white underline underline-offset-4 decoration-white/50 hover:decoration-white transition-colors">
                  Consulter la FAQ
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
      <LandingFooter />
    </div>
  );
}
