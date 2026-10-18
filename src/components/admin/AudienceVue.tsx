'use client';

// Audience (type Google Analytics) : visiteurs, pages, sources, pays, appareils, navigateurs, événements.

import { Barres, Carte, ListeBarres, nb, pct } from '@/components/admin/ui';
import { formatDateLongueFr } from '@/lib/dates';

interface Ligne { nom: string; n?: number; visiteurs?: number; total?: number; chemin?: string; vues?: number }
export interface Audience {
  visiteurs: number; pages_vues: number; rebond: number; pages_par_visite: number; temps_reel: number;
  serie: { jour: string; pages_vues: number; visiteurs: number }[];
  pages: { chemin: string; vues: number; visiteurs: number }[];
  sources: Ligne[]; pays: Ligne[]; appareils: Ligne[]; navigateurs: Ligne[]; systemes: Ligne[];
  evenements: { nom: string; total: number; visiteurs: number }[];
}

const NOMS_PAYS = typeof Intl !== 'undefined' && 'DisplayNames' in Intl ? new Intl.DisplayNames(['fr'], { type: 'region' }) : null;
const nomPays = (code: string) => {
  if (code === '??') return 'Pays inconnu';
  const drapeau = [...code].map(c => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65)).join('');
  let nom = code;
  try { nom = NOMS_PAYS?.of(code) ?? code; } catch { /* code non reconnu */ }
  return `${drapeau} ${nom}`;
};
const lignes = (l: Ligne[], f: (n: string) => string = n => n) => l.map(x => ({ nom: f(x.nom), n: x.visiteurs ?? 0 }));

/** Série complète sur la période (jours sans visite = 0) */
function serieComplete(serie: Audience['serie'], jours: number, cle: 'visiteurs' | 'pages_vues') {
  const parJour = new Map(serie.map(s => [s.jour, s[cle]]));
  return Array.from({ length: jours }, (_, i) => {
    const jour = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date(Date.now() - (jours - 1 - i) * 86_400_000));
    return { jour, n: parJour.get(jour) ?? 0 };
  });
}

export function AudienceVue({ a, jours }: { a: Audience; jours: number }) {
  const vide = a.pages_vues === 0;
  return (
    <div className="space-y-6">
      {vide && (
        <p className="rounded-xl border border-sauge-200 bg-sauge-50 p-4 text-sm text-gray-700">
          Aucune visite enregistrée pour le moment. La mesure démarre dès le déploiement : les premières visites apparaissent ici en quelques secondes.
          Les robots, les visiteurs qui activent « Ne pas suivre » et ceux qui s’y opposent (page Cookies) ne sont pas comptés.
        </p>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Carte titre="Visiteurs" valeur={nb(a.visiteurs)} detail="uniques par jour, cumulés" />
        <Carte titre="Pages vues" valeur={nb(a.pages_vues)} />
        <Carte titre="Pages par visite" valeur={String(a.pages_par_visite).replace('.', ',')} />
        <Carte titre="Taux de rebond" valeur={`${a.rebond} %`} detail="visites d’une seule page" />
        <Carte titre="En ce moment" valeur={nb(a.temps_reel)} detail="visiteurs, 30 dernières minutes" />
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <Barres titre="Visiteurs par jour" donnees={serieComplete(a.serie, jours, 'visiteurs')} />
        <Barres titre="Pages vues par jour" donnees={serieComplete(a.serie, jours, 'pages_vues')} />
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <ListeBarres titre="Pages les plus vues" colonne="Vues · visiteurs"
          lignes={a.pages.map(p => ({ nom: p.chemin, n: p.vues, detail: `${nb(p.visiteurs)} vis.` }))} />
        <ListeBarres titre="Sources d’acquisition" lignes={lignes(a.sources, n => (n === 'direct' ? 'Direct / inconnu' : n))} />
        <ListeBarres titre="Pays" lignes={lignes(a.pays, nomPays)} />
        <ListeBarres titre="Appareils" lignes={lignes(a.appareils, n => n.charAt(0).toUpperCase() + n.slice(1))} />
        <ListeBarres titre="Navigateurs" lignes={lignes(a.navigateurs)} />
        <ListeBarres titre="Systèmes" lignes={lignes(a.systemes)} />
      </div>
      <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-xs">
        <h2 className="font-semibold text-gray-900 text-sm">Événements (actions des utilisateurs)</h2>
        {a.evenements.length === 0 ? <p className="mt-3 text-xs text-gray-500">Pas encore d’événement.</p> : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="text-gray-600"><tr><th className="py-1.5 pr-3 font-semibold">Événement</th><th className="py-1.5 pr-3 font-semibold text-right">Total</th><th className="py-1.5 pr-3 font-semibold text-right">Visiteurs</th><th className="py-1.5 font-semibold text-right">Part des visiteurs</th></tr></thead>
              <tbody>
                {a.evenements.map(e => (
                  <tr key={e.nom} className="border-t border-gray-100">
                    <th scope="row" className="py-1.5 pr-3 font-medium text-gray-900">{e.nom}</th>
                    <td className="py-1.5 pr-3 text-right">{nb(e.total)}</td>
                    <td className="py-1.5 pr-3 text-right">{nb(e.visiteurs)}</td>
                    <td className="py-1.5 text-right">{pct(e.visiteurs, a.visiteurs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <p className="text-xs text-gray-500">
        Mesure interne anonyme, sans cookie : aucune adresse IP n’est conservée et un visiteur reçoit un identifiant différent chaque jour
        (« visiteurs » = visiteurs uniques par jour, additionnés). Période : {formatDateLongueFr(serieComplete(a.serie, jours, 'visiteurs')[0].jour)} → aujourd’hui.
      </p>
    </div>
  );
}
