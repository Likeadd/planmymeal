'use client';

// Choix d'un nouveau mot de passe après le lien de réinitialisation (session de récupération ouverte par
// /auth/callback). Page protégée par le proxy : sans session, redirection vers /login.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock } from 'lucide-react';
import { toast } from 'sonner';
import LandingHeader from '@/components/LandingHeader';
import LandingFooter from '@/components/LandingFooter';
import { LoadingButton } from '@/components/LoadingButton';
import { createBrowserClient } from '@/lib/supabase';

export default function NouveauMotDePassePage() {
  const router = useRouter();
  const [mdp, setMdp] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const enregistrer = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (mdp.length < 8 || mdp.length > 72 || !/[a-zA-Z]/.test(mdp) || !/[0-9]/.test(mdp)) {
      setError('Le mot de passe doit contenir 8 à 72 caractères, dont une lettre et un chiffre.');
      return;
    }
    if (mdp !== confirmation) { setError('Les mots de passe ne correspondent pas.'); return; }
    setLoading(true);
    const { error: erreur } = await createBrowserClient().auth.updateUser({ password: mdp });
    setLoading(false);
    if (erreur) {
      setError(erreur.code === 'weak_password' ? 'Mot de passe trop faible ou trop courant.'
        : erreur.code === 'same_password' ? 'Choisissez un mot de passe différent de l’ancien.'
        : 'Le lien a expiré : redemandez-en un depuis « Mot de passe oublié ».');
      return;
    }
    toast.success('Mot de passe mis à jour.');
    router.push('/aujourdhui');
  };

  const champ = 'w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 outline-hidden focus:border-brand-400 focus:bg-white transition-colors';
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <LandingHeader />
      <main id="contenu" className="max-w-md mx-auto px-4 py-16">
        <h1 className="font-display text-3xl font-bold text-gray-900">Nouveau mot de passe</h1>
        <form onSubmit={enregistrer} className="mt-6 bg-white rounded-3xl border border-gray-200 shadow-xs p-6 space-y-5">
          {error && <p className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700" role="alert">{error}</p>}
          {[['nouveau', 'Nouveau mot de passe', mdp, setMdp], ['confirmation', 'Confirmation', confirmation, setConfirmation]].map(([id, label, valeur, maj]) => (
            <div key={id as string}>
              <label htmlFor={id as string} className="block text-[11px] font-semibold tracking-[0.18em] uppercase text-gray-700 mb-2">{label as string}</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" aria-hidden />
                <input id={id as string} type="password" autoComplete="new-password" required value={valeur as string}
                  onChange={e => (maj as (v: string) => void)(e.target.value)} className={champ} />
              </div>
            </div>
          ))}
          <p className="text-xs text-gray-500">8 caractères minimum, dont une lettre et un chiffre.</p>
          <LoadingButton type="submit" loading={loading}
            className="w-full px-6 py-3 bg-brand-500 text-white font-semibold text-sm rounded-full hover:bg-brand-600 transition-colors shadow-cta">
            Enregistrer
          </LoadingButton>
        </form>
      </main>
      <LandingFooter sansNewsletter />
    </div>
  );
}
