'use client';

// Bouton + fenêtre « Demander une recette » : l'utilisateur propose un plat
// absent du catalogue (POST /api/demande-recette). Réservé aux comptes connectés.

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Lightbulb, X, Send, Check } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { cn } from '@/lib/utils';

export function DemandeRecette({ className, titreInitial = '', libelle = 'Demander une recette' }: {
  className?: string;
  /** Pré-remplit le nom du plat (ex. la recherche qui n'a rien donné) */
  titreInitial?: string;
  libelle?: string;
}) {
  const { user } = useAuth();
  const [ouvert, setOuvert] = useState(false);
  const [titre, setTitre] = useState('');
  const [details, setDetails] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [envoye, setEnvoye] = useState(false);
  const [erreur, setErreur] = useState('');
  const champ = useRef<HTMLInputElement>(null);

  const ouvrir = () => {
    setTitre(titreInitial);
    setDetails('');
    setErreur('');
    setEnvoye(false);
    setOuvert(true);
  };
  const fermer = () => setOuvert(false);

  useEffect(() => {
    if (!ouvert) return;
    champ.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOuvert(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [ouvert]);

  const envoyer = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnvoi(true);
    setErreur('');
    try {
      const res = await fetch('/api/demande-recette', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titre, details }),
      });
      if (res.ok) setEnvoye(true);
      else setErreur((await res.json().catch(() => ({}))).error || 'Envoi impossible pour le moment.');
    } catch {
      setErreur('Connexion impossible. Réessayez dans un instant.');
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <>
      <button type="button" onClick={ouvrir} data-tour="recettes-demande"
        className={cn('inline-flex items-center gap-2 min-h-[40px] px-4 py-2 text-xs font-semibold rounded-full border border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100 transition-colors', className)}>
        <Lightbulb className="w-3.5 h-3.5" aria-hidden /> {libelle}
      </button>

      {ouvert && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true" aria-label="Demander une recette">
          <div className="absolute inset-0 bg-gray-900/50" onClick={fermer} aria-hidden />
          <div className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <button onClick={fermer} aria-label="Fermer"
              className="absolute top-3 right-3 w-9 h-9 flex items-center justify-center rounded-full text-gray-500 hover:bg-gray-100">
              <X className="w-4 h-4" />
            </button>

            {envoye ? (
              <div className="text-center py-6">
                <div className="w-12 h-12 rounded-full bg-sauge-100 flex items-center justify-center mx-auto mb-4">
                  <Check className="w-6 h-6 text-sauge-700" />
                </div>
                <h2 className="font-display text-xl font-bold text-gray-900">Demande envoyée</h2>
                <p className="mt-2 text-sm text-gray-600">Merci ! Nous étudions chaque demande et ajoutons régulièrement de nouvelles recettes au catalogue.</p>
                <button onClick={fermer} className="mt-5 px-6 py-2.5 text-sm font-semibold text-white bg-brand-500 rounded-full hover:bg-brand-600">Fermer</button>
              </div>
            ) : !user ? (
              <div className="text-center py-4">
                <h2 className="font-display text-xl font-bold text-gray-900">Demander une recette</h2>
                <p className="mt-2 text-sm text-gray-600">Connectez-vous pour proposer un plat à ajouter au catalogue.</p>
                <div className="mt-5 flex justify-center gap-3">
                  <Link href="/login" className="px-5 py-2.5 text-sm font-semibold text-white bg-brand-500 rounded-full hover:bg-brand-600">Se connecter</Link>
                  <Link href="/signup" className="px-5 py-2.5 text-sm font-semibold text-brand-600 border border-brand-200 rounded-full hover:bg-brand-50">Créer un compte</Link>
                </div>
              </div>
            ) : (
              <form onSubmit={envoyer} className="space-y-4">
                <div>
                  <h2 className="font-display text-xl font-bold text-gray-900 pr-8">Demander une recette</h2>
                  <p className="mt-1 text-sm text-gray-600">Un plat vous manque ? Dites-nous lequel, nous l’ajouterons si possible.</p>
                </div>
                <div>
                  <label htmlFor="dr-titre" className="block text-sm font-medium text-gray-700 mb-1.5">Nom du plat</label>
                  <input ref={champ} id="dr-titre" required minLength={3} maxLength={120} value={titre} onChange={e => setTitre(e.target.value)}
                    placeholder="Ex. : Gratin de crozets au reblochon"
                    className="w-full px-4 py-3 text-base sm:text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-brand-300" />
                </div>
                <div>
                  <label htmlFor="dr-details" className="block text-sm font-medium text-gray-700 mb-1.5">Précisions <span className="text-gray-500 font-normal">(facultatif)</span></label>
                  <textarea id="dr-details" rows={3} maxLength={600} value={details} onChange={e => setDetails(e.target.value)}
                    placeholder="Ingrédients souhaités, régime, version végétarienne…"
                    className="w-full px-4 py-3 text-base sm:text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-brand-300 resize-none" />
                </div>
                {erreur && <p role="alert" className="text-sm text-red-600">{erreur}</p>}
                <button type="submit" disabled={envoi}
                  className="inline-flex items-center justify-center gap-2 w-full min-h-[44px] text-sm font-semibold text-white bg-brand-500 rounded-full hover:bg-brand-600 disabled:opacity-60 transition-colors">
                  {envoi ? 'Envoi…' : 'Envoyer ma demande'} <Send className="w-4 h-4" />
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
