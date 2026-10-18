'use client';

// ============================================================================
// /admin — statistiques internes (comptes, activité, contenu). Réservé aux adresses de
// ADMIN_EMAILS (contrôle serveur dans /api/admin/stats) ; la fréquentation du site est dans Plausible.
// ============================================================================

import { useEffect, useState } from 'react';
import { BarChart3, ExternalLink } from 'lucide-react';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { formatDateLongueFr } from '@/lib/dates';

interface Serie { jour: string; n: number }
interface Stats {
  genere_le: string;
  comptes: { total: number; onboarding: number; pro: number; famille: number; gratuit: number; inscrits_7j: number; inscrits_30j: number; actifs_1j: number; actifs_7j: number; actifs_30j: number };
  inscriptions_par_jour: Serie[];
  plans_generes_par_jour: Serie[];
  newsletter: { confirmes: number; en_attente: number };
  contenu: { recettes_publiques: number; indexables: number; avis_positifs: number; demandes_recettes_30j: number };
}

const PLAUSIBLE_URL = process.env.NEXT_PUBLIC_PLAUSIBLE_URL || 'https://plausible.io/getplanmymeal.com';
const nb = (n: number) => n.toLocaleString('fr-FR');
const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)} %` : '—');

function Carte({ titre, valeur, detail }: { titre: string; valeur: string; detail?: string }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-xs">
      <p className="text-xs text-gray-500">{titre}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{valeur}</p>
      {detail && <p className="text-[11px] text-gray-500 mt-0.5">{detail}</p>}
    </div>
  );
}

function Barres({ titre, donnees }: { titre: string; donnees: Serie[] }) {
  const max = Math.max(1, ...donnees.map(d => d.n));
  const total = donnees.reduce((s, d) => s + d.n, 0);
  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-xs">
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold text-gray-900 text-sm">{titre}</h2>
        <p className="text-xs text-gray-500">{nb(total)} sur 30 jours</p>
      </div>
      <div className="mt-3 flex items-end gap-[3px] h-28" role="img" aria-label={`${titre} : ${nb(total)} sur 30 jours`}>
        {donnees.map(d => (
          <div key={d.jour} title={`${formatDateLongueFr(d.jour)} : ${d.n}`}
            className="flex-1 rounded-t bg-brand-500/85 min-h-[2px]" style={{ height: `${Math.max(2, (d.n / max) * 100)}%` }} />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-gray-500">
        <span>{formatDateLongueFr(donnees[0].jour, { day: 'numeric', month: 'short' })}</span><span>aujourd’hui</span>
      </div>
    </section>
  );
}

export default function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    let vivant = true;
    fetch('/api/admin/stats')
      .then(async r => {
        if (!vivant) return;
        if (r.ok) setStats(await r.json());
        else setErreur(r.status === 404 ? 'Accès réservé aux administrateurs (variable ADMIN_EMAILS).' : 'Statistiques indisponibles pour le moment.');
      })
      .catch(() => { if (vivant) setErreur('Statistiques indisponibles pour le moment.'); });
    return () => { vivant = false; };
  }, []);

  const c = stats?.comptes;
  return (
    <DashboardShell>
      <div className="container-app py-6 max-w-4xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display font-bold text-3xl text-gray-900 tracking-tight flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-brand-500" aria-hidden /> Statistiques
          </h1>
          <a href={PLAUSIBLE_URL} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 min-h-[44px] rounded-full bg-brand-700 text-white text-sm font-semibold hover:bg-brand-800 transition-colors">
            Visiteurs, pages et sources (Plausible) <ExternalLink className="w-4 h-4" aria-hidden />
          </a>
        </div>
        <p className="mt-1 text-sm text-gray-500">Comptes, activité et contenu. La fréquentation du site (visiteurs, pages vues, sources, pays, appareils) est dans Plausible.</p>

        {erreur && <p className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">{erreur}</p>}
        {!stats && !erreur && <div className="mt-6 h-40 rounded-2xl animate-shimmer" aria-busy="true" aria-label="Chargement" />}

        {stats && c && (
          <div className="mt-6 space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Carte titre="Comptes" valeur={nb(c.total)} detail={`${nb(c.inscrits_7j)} cette semaine · ${nb(c.inscrits_30j)} en 30 j`} />
              <Carte titre="Actifs (7 jours)" valeur={nb(c.actifs_7j)} detail={`${nb(c.actifs_1j)} aujourd’hui · ${nb(c.actifs_30j)} en 30 j`} />
              <Carte titre="Onboarding terminé" valeur={pct(c.onboarding, c.total)} detail={`${nb(c.onboarding)} sur ${nb(c.total)}`} />
              <Carte titre="Abonnés payants" valeur={nb(c.pro + c.famille)} detail={`${nb(c.pro)} Pro · ${nb(c.famille)} Famille · ${pct(c.pro + c.famille, c.total)}`} />
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <Barres titre="Inscriptions par jour" donnees={stats.inscriptions_par_jour} />
              <Barres titre="Semaines générées par jour" donnees={stats.plans_generes_par_jour} />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Carte titre="Newsletter" valeur={nb(stats.newsletter.confirmes)} detail={`${nb(stats.newsletter.en_attente)} en attente de confirmation`} />
              <Carte titre="Recettes publiques" valeur={nb(stats.contenu.recettes_publiques)} detail={`${nb(stats.contenu.indexables)} indexables (Google)`} />
              <Carte titre="Recettes aimées" valeur={nb(stats.contenu.avis_positifs)} />
              <Carte titre="Demandes de recettes" valeur={nb(stats.contenu.demandes_recettes_30j)} detail="30 derniers jours" />
            </div>
            <p className="text-xs text-gray-500">Données du {formatDateLongueFr(stats.genere_le.slice(0, 10))}, calculées à l’ouverture de la page.</p>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
