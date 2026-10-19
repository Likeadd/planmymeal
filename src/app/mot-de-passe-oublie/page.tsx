'use client';

// Demande de réinitialisation du mot de passe (audit VULN-009). Message identique que le compte existe ou non.

import { useState } from 'react';
import Link from 'next/link';
import { Mail } from 'lucide-react';
import LandingHeader from '@/components/LandingHeader';
import LandingFooter from '@/components/LandingFooter';
import { LoadingButton } from '@/components/LoadingButton';

export default function MotDePasseOubliePage() {
  const [email, setEmail] = useState('');
  const [envoye, setEnvoye] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const envoyer = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim()) { setError('Saisissez votre adresse email.'); return; }
    setLoading(true);
    const res = await fetch('/api/auth/mot-de-passe-oublie', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim() }),
    }).catch(() => null);
    setLoading(false);
    if (res?.ok) { setEnvoye(true); return; }
    const json = await res?.json().catch(() => ({}));
    setError(json?.error || 'Envoi impossible pour le moment. Réessayez dans quelques minutes.');
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <LandingHeader />
      <main id="contenu" className="max-w-md mx-auto px-4 py-16">
        <h1 className="font-display text-3xl font-bold text-gray-900">Mot de passe oublié</h1>
        {envoye ? (
          <div className="mt-6 p-4 bg-sauge-50 border border-sauge-200 rounded-xl text-sm text-gray-800" role="status">
            Si un compte existe pour <strong>{email.trim()}</strong>, vous allez recevoir un email avec un lien pour choisir un nouveau
            mot de passe. Pensez à regarder dans les courriers indésirables.
          </div>
        ) : (
          <form onSubmit={envoyer} className="mt-6 bg-white rounded-3xl border border-gray-200 shadow-xs p-6 space-y-5">
            <p className="text-sm text-gray-600">Indiquez l’adresse de votre compte : nous vous envoyons un lien pour en choisir un nouveau.</p>
            {error && <p className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700" role="alert">{error}</p>}
            <div>
              <label htmlFor="email" className="block text-[11px] font-semibold tracking-[0.18em] uppercase text-gray-700 mb-2">Adresse email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" aria-hidden />
                <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 outline-hidden focus:border-brand-400 focus:bg-white transition-colors" />
              </div>
            </div>
            <LoadingButton type="submit" loading={loading}
              className="w-full px-6 py-3 bg-brand-500 text-white font-semibold text-sm rounded-full hover:bg-brand-600 transition-colors shadow-cta">
              Recevoir le lien
            </LoadingButton>
          </form>
        )}
        <p className="mt-6 text-center text-sm">
          <Link href="/login" className="text-brand-700 font-medium underline underline-offset-2">Retour à la connexion</Link>
        </p>
      </main>
      <LandingFooter sansNewsletter />
    </div>
  );
}
