import Link from 'next/link';
import { Carrot, House, LayoutDashboard } from 'lucide-react';

// ============================================================================
// 404 — PlanMyMeal : page introuvable, même design que le reste de l'appli.
// ============================================================================

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center bg-white rounded-3xl border border-gray-200 shadow-sm p-10 animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bg-brand-50 flex items-center justify-center mx-auto mb-6">
          <Carrot className="w-8 h-8 text-brand-500" />
        </div>
        <p className="text-brand-600 text-[11px] font-semibold tracking-[0.28em] uppercase">
          Erreur 404
        </p>
        <h1 className="font-display text-2xl font-bold text-gray-900 mt-3">
          Cette page a quitté la cuisine
        </h1>
        <p className="text-gray-500 mt-3 leading-relaxed">
          La page que vous cherchez n&apos;existe pas (ou plus). Votre planning,
          lui, est bien au chaud.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-brand-500 text-white font-semibold text-sm rounded-xl hover:bg-brand-600 transition-colors shadow-cta"
          >
            <House className="w-4 h-4" /> Retour à l&apos;accueil
          </Link>
          <Link
            href="/aujourdhui"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gray-100 text-gray-600 font-semibold text-sm rounded-xl hover:bg-gray-200 transition-colors"
          >
            <LayoutDashboard className="w-4 h-4" /> Mon dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
