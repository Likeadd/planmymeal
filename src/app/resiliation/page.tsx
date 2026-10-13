'use client';

// Page publique « Résilier mon abonnement » : lien direct, visible dans le pied
// de page. Connecté : le bouton de résiliation s'affiche ici ; sinon, connexion d'abord.

import Link from 'next/link';
import LandingHeader from '@/components/LandingHeader';
import LandingFooter from '@/components/LandingFooter';
import { useAuth } from '@/components/AuthProvider';
import { AbonnementSettings } from '@/components/compte/AbonnementSettings';
import { EMAIL_CONTACT } from '@/lib/legal';

export default function ResiliationPage() {
  const { user, loading, refreshProfile } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <LandingHeader />
      <main id="contenu" className="max-w-xl mx-auto px-4 sm:px-6 py-14 sm:py-20 space-y-6">
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-gray-900">Résilier mon abonnement</h1>
        <p className="text-gray-600">
          Résiliez en un clic, sans motif et sans frais. Vous gardez l’accès jusqu’à la fin de la période déjà payée.
        </p>

        {loading ? null : user ? (
          <AbonnementSettings onChange={refreshProfile} />
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-xs space-y-3">
            <p className="text-sm text-gray-700">Connectez-vous pour résilier ou vous rétracter.</p>
            <Link href="/login" className="inline-flex items-center justify-center min-h-[44px] px-5 rounded-full bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600">
              Me connecter
            </Link>
            <p className="text-xs text-gray-500">
              Impossible de vous connecter ? Écrivez-nous à{' '}
              <a href={`mailto:${EMAIL_CONTACT}`} className="underline">{EMAIL_CONTACT}</a> depuis l’adresse de votre compte : la résiliation est traitée sous 48 h.
            </p>
          </div>
        )}
      </main>
      <LandingFooter sansNewsletter />
    </div>
  );
}
