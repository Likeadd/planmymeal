'use client';

// ============================================================================
// /admin — tableau de bord interne, réservé aux adresses de ADMIN_EMAILS (contrôle serveur) :
//   Audience    (type Google Analytics) : visiteurs, pages, sources, pays, appareils, événements ;
//   Rétention   (type Amplitude)        : entonnoir de conversion et cohortes de rétention ;
//   Comptes                              : inscriptions, activité, abonnés, contenu.
// Tout vient de nos propres données, anonymes et sans cookie (voir lib/mesure-interne.ts).
// ============================================================================

import { useEffect, useState } from 'react';
import { BarChart3, ExternalLink } from 'lucide-react';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { Barres, Carte, nb, pct, type Serie } from '@/components/admin/ui';
import { AudienceVue, type Audience } from '@/components/admin/AudienceVue';
import { RetentionVue, type Cohorte, type Etape } from '@/components/admin/RetentionVue';
import { formatDateLongueFr } from '@/lib/dates';

interface Stats {
  genere_le: string;
  comptes: { total: number; onboarding: number; pro: number; famille: number; gratuit: number; inscrits_7j: number; inscrits_30j: number; actifs_1j: number; actifs_7j: number; actifs_30j: number };
  inscriptions_par_jour: Serie[];
  plans_generes_par_jour: Serie[];
  newsletter: { confirmes: number; en_attente: number };
  contenu: { recettes_publiques: number; indexables: number; avis_positifs: number; demandes_recettes_30j: number };
}
interface Analytique { jours: number; audience: Audience; entonnoir: Etape[]; cohortes: Cohorte[] }

const PLAUSIBLE_URL = process.env.NEXT_PUBLIC_PLAUSIBLE_URL || 'https://plausible.io/getplanmymeal.com';
const ONGLETS = [['audience', 'Audience'], ['retention', 'Rétention et parcours'], ['comptes', 'Comptes']] as const;
type Onglet = (typeof ONGLETS)[number][0];
const PERIODES = [7, 30, 90] as const;
const ERREUR_ACCES = 'Accès réservé aux administrateurs (variable ADMIN_EMAILS).';

function ComptesVue({ stats }: { stats: Stats }) {
  const c = stats.comptes;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Carte titre="Comptes" valeur={nb(c.total)} detail={`${nb(c.inscrits_7j)} cette semaine · ${nb(c.inscrits_30j)} en 30 j`} />
        <Carte titre="Actifs (7 jours)" valeur={nb(c.actifs_7j)} detail={`${nb(c.actifs_1j)} aujourd’hui · ${nb(c.actifs_30j)} en 30 j`} />
        <Carte titre="Onboarding terminé" valeur={pct(c.onboarding, c.total)} detail={`${nb(c.onboarding)} sur ${nb(c.total)}`} />
        <Carte titre="Abonnés payants" valeur={nb(c.pro + c.famille)} detail={`${nb(c.pro)} Pro · ${nb(c.famille)} Famille · ${pct(c.pro + c.famille, c.total)}`} />
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <Barres titre="Inscriptions par jour" donnees={stats.inscriptions_par_jour} suffixe="sur 30 jours" />
        <Barres titre="Semaines générées par jour" donnees={stats.plans_generes_par_jour} suffixe="sur 30 jours" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Carte titre="Newsletter" valeur={nb(stats.newsletter.confirmes)} detail={`${nb(stats.newsletter.en_attente)} en attente de confirmation`} />
        <Carte titre="Recettes publiques" valeur={nb(stats.contenu.recettes_publiques)} detail={`${nb(stats.contenu.indexables)} indexables (Google)`} />
        <Carte titre="Recettes aimées" valeur={nb(stats.contenu.avis_positifs)} />
        <Carte titre="Demandes de recettes" valeur={nb(stats.contenu.demandes_recettes_30j)} detail="30 derniers jours" />
      </div>
      <p className="text-xs text-gray-500">Données du {formatDateLongueFr(stats.genere_le.slice(0, 10))}, calculées à l’ouverture de la page.</p>
    </div>
  );
}

export default function AdminPage() {
  const [onglet, setOnglet] = useState<Onglet>('audience');
  const [jours, setJours] = useState<(typeof PERIODES)[number]>(30);
  const [analytique, setAnalytique] = useState<Analytique | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    let vivant = true;
    const url = onglet === 'comptes' ? '/api/admin/stats' : `/api/admin/analytics?jours=${jours}`;
    fetch(url)
      .then(async r => {
        if (!vivant) return;
        if (!r.ok) { setErreur(r.status === 404 ? ERREUR_ACCES : 'Statistiques indisponibles pour le moment.'); return; }
        setErreur('');
        if (onglet === 'comptes') setStats(await r.json()); else setAnalytique(await r.json());
      })
      .catch(() => { if (vivant) setErreur('Statistiques indisponibles pour le moment.'); });
    return () => { vivant = false; };
  }, [onglet, jours]);

  const donnees = onglet === 'comptes' ? stats : analytique;
  return (
    <DashboardShell>
      <div className="container-app py-6 max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display font-bold text-3xl text-gray-900 tracking-tight flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-brand-500" aria-hidden /> Statistiques
          </h1>
          <a href={PLAUSIBLE_URL} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 min-h-[44px] rounded-full border border-gray-300 bg-white text-gray-800 text-sm font-semibold hover:bg-gray-50 transition-colors">
            Plausible <ExternalLink className="w-4 h-4" aria-hidden />
          </a>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div role="tablist" aria-label="Rubriques" className="inline-flex rounded-full bg-gray-100 p-1">
            {ONGLETS.map(([id, label]) => (
              <button key={id} role="tab" type="button" aria-selected={onglet === id} onClick={() => setOnglet(id)}
                className={`px-4 min-h-[40px] rounded-full text-sm font-semibold transition-colors ${onglet === id ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}>
                {label}
              </button>
            ))}
          </div>
          {onglet !== 'comptes' && (
            <div role="group" aria-label="Période" className="inline-flex rounded-full bg-gray-100 p-1">
              {PERIODES.map(p => (
                <button key={p} type="button" aria-pressed={jours === p} onClick={() => setJours(p)}
                  className={`px-3 min-h-[40px] rounded-full text-sm font-semibold transition-colors ${jours === p ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}>
                  {p} jours
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6" role="tabpanel">
          {erreur && <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">{erreur}</p>}
          {!donnees && !erreur && <div className="h-40 rounded-2xl animate-shimmer" aria-busy="true" aria-label="Chargement" />}
          {!erreur && onglet === 'audience' && analytique && <AudienceVue a={analytique.audience} jours={analytique.jours} />}
          {!erreur && onglet === 'retention' && analytique && <RetentionVue entonnoir={analytique.entonnoir} cohortes={analytique.cohortes} />}
          {!erreur && onglet === 'comptes' && stats && <ComptesVue stats={stats} />}
        </div>
      </div>
    </DashboardShell>
  );
}
