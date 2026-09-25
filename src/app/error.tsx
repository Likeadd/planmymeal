'use client';

// ============================================================================
// Error boundary racine (erreur de rendu React) — PlanMyMeal
// Remplace l'écran d'erreur brut de Next : même design crème/terracotta que
// l'appli, bouton de réessai et sortie de secours vers le dashboard.
// ============================================================================

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RotateCw, LayoutDashboard } from 'lucide-react';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Journalisation serveur/console — point d'ancrage pour un futur
    // reporter d'erreurs (Sentry, etc.)
    // Détails en console de dev seulement : jamais d'info technique en prod
    if (process.env.NODE_ENV !== 'production') console.error('[error boundary]', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center bg-white rounded-3xl border border-gray-200 shadow-sm p-10 animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bg-brand-50 flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="w-8 h-8 text-brand-500" />
        </div>
        <h1 className="font-display text-2xl font-bold text-gray-900">
          Oups, un grain de sel dans la recette
        </h1>
        <p className="text-gray-500 mt-3 leading-relaxed">
          Une erreur inattendue est survenue. Réessayez — si le problème
          persiste, revenez à votre planning, rien n&apos;a été perdu.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-brand-500 text-white font-semibold text-sm rounded-xl hover:bg-brand-600 transition-colors shadow-cta"
          >
            <RotateCw className="w-4 h-4" /> Réessayer
          </button>
          <Link
            href="/aujourdhui"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gray-100 text-gray-600 font-semibold text-sm rounded-xl hover:bg-gray-200 transition-colors"
          >
            <LayoutDashboard className="w-4 h-4" /> Mon dashboard
          </Link>
        </div>

        {error.digest && (
          <p className="mt-6 text-[11px] text-gray-500" title="Identifiant technique de l'erreur (à joindre au support)">
            Référence : {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
