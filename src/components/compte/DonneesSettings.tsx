'use client';

// ============================================================================
// DonneesSettings — vos données : récapitulatif hebdomadaire par email
// (désactivable) et export (RGPD art. 20, portabilité).
// ============================================================================

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Download, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/components/AuthProvider';

export function DonneesSettings() {
  const { profile } = useAuth();
  const [emails, setEmails] = useState(true);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    // Le profil arrive après le rendu initial : l'état local suit la valeur stockée
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (profile) setEmails(profile.emails_transactionnels !== false);
  }, [profile]);

  const changer = async (valeur: boolean) => {
    setEmails(valeur);
    setEnCours(true);
    try {
      const res = await fetch('/api/profil', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profil: { emails_transactionnels: valeur } }),
      });
      if (!res.ok) throw new Error();
      toast.success(valeur ? 'Récapitulatif hebdomadaire activé.' : 'Récapitulatif hebdomadaire désactivé.');
    } catch {
      setEmails(!valeur);
      toast.error('Modification impossible pour le moment.');
    }
    setEnCours(false);
  };

  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-xs">
      <h2 className="font-semibold text-gray-900 text-lg flex items-center gap-2 mb-1">
        <Mail className="w-5 h-5 text-brand-500" aria-hidden /> Mes données et mes emails
      </h2>
      <p className="text-sm text-gray-500 mb-4">
        Les emails de sécurité et de gestion du compte (confirmation, abonnement) restent toujours envoyés.
      </p>

      <label className="flex items-start gap-3 cursor-pointer">
        <input type="checkbox" checked={emails} disabled={enCours} onChange={e => changer(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 rounded border-gray-400 accent-brand-600" />
        <span className="text-sm text-gray-700">
          Recevoir chaque vendredi le récapitulatif de ma semaine et mes courses par email.
        </span>
      </label>

      <div className="mt-5 pt-5 border-t border-gray-100">
        <a href="/api/compte/export" download
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-800 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors">
          <Download className="w-4 h-4" aria-hidden /> Télécharger mes données (JSON)
        </a>
        <p className="mt-2 text-xs text-gray-500">
          Export complet de votre profil, plannings, listes, favoris et préférences. Détails dans la{' '}
          <Link href="/confidentialite" className="underline underline-offset-2">politique de confidentialité</Link>.
        </p>
      </div>
    </div>
  );
}
