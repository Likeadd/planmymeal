'use client';

// Rétention & parcours (type Amplitude) : entonnoir de conversion et cohortes de rétention hebdomadaires.

import { nb, pct } from '@/components/admin/ui';
import { formatDateLongueFr } from '@/lib/dates';

export interface Etape { etape: string; n: number }
export interface Cohorte { semaine: string; taille: number; retention: (number | null)[] }

/** Couleur de cellule selon le taux (accessible : la valeur reste écrite en toutes lettres) */
const fond = (v: number | null) => (v == null ? 'transparent' : `rgba(184, 77, 37, ${0.08 + (Math.min(100, v) / 100) * 0.72})`);
const texte = (v: number | null) => (v != null && v >= 55 ? '#fff' : '#332a1e');

export function RetentionVue({ entonnoir, cohortes }: { entonnoir: Etape[]; cohortes: Cohorte[] }) {
  const premier = Math.max(1, entonnoir[0]?.n ?? 1);
  const maxSemaines = Math.max(...cohortes.map(c => c.retention.length), 1);
  const aucuneCohorte = cohortes.every(c => c.taille === 0);
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-xs">
        <h2 className="font-semibold text-gray-900 text-sm">Entonnoir de conversion</h2>
        <p className="text-xs text-gray-500 mt-0.5">Du visiteur à l’abonné : combien de personnes passent chaque étape sur la période.</p>
        <ol className="mt-3 space-y-2">
          {entonnoir.map((e, i) => (
            <li key={e.etape}>
              <div className="flex justify-between gap-3 text-[13px]">
                <span className="text-gray-800">{i + 1}. {e.etape}</span>
                <span className="font-semibold text-gray-900">
                  {nb(e.n)}
                  {i > 0 && <span className="ml-2 font-normal text-gray-500">{pct(e.n, entonnoir[i - 1].n)} de l’étape précédente</span>}
                </span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-gray-100 overflow-hidden" role="img" aria-label={`${e.etape} : ${nb(e.n)}, ${pct(e.n, premier)} des visiteurs`}>
                <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.max(1, Math.min(100, (e.n / premier) * 100))}%` }} />
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-[11px] text-gray-500">
          Les visiteurs viennent de la mesure d’audience anonyme ; les comptes, onboardings, semaines générées et abonnements viennent de la base de données.
          Les deux ne sont pas reliés individuellement : l’entonnoir donne des ordres de grandeur, pas un suivi de personnes.
        </p>
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-xs">
        <h2 className="font-semibold text-gray-900 text-sm">Rétention par cohorte d’inscription</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Part des comptes créés une semaine donnée qui sont encore actifs (génération de semaine, repas notés ou planifiés) 1, 2, 3… semaines plus tard.
        </p>
        {aucuneCohorte ? (
          <p className="mt-3 text-xs text-gray-500">Pas encore d’inscription sur les 8 dernières semaines.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-center text-[12px] border-separate border-spacing-1">
              <caption className="sr-only">Rétention hebdomadaire par cohorte d’inscription</caption>
              <thead>
                <tr className="text-gray-600">
                  <th scope="col" className="text-left font-semibold pr-2">Semaine d’inscription</th>
                  <th scope="col" className="font-semibold px-1">Comptes</th>
                  {Array.from({ length: maxSemaines }, (_, k) => <th key={k} scope="col" className="font-semibold px-1">S{k}</th>)}
                </tr>
              </thead>
              <tbody>
                {cohortes.map(c => (
                  <tr key={c.semaine}>
                    <th scope="row" className="text-left font-medium text-gray-800 pr-2 whitespace-nowrap">{formatDateLongueFr(c.semaine, { day: 'numeric', month: 'short' })}</th>
                    <td className="text-gray-800">{nb(c.taille)}</td>
                    {Array.from({ length: maxSemaines }, (_, k) => {
                      const v = c.retention[k];
                      return (
                        <td key={k} className="rounded px-1 py-1.5 font-semibold" style={{ background: fond(v ?? null), color: texte(v ?? null) }}>
                          {v == null || c.taille === 0 ? '' : `${v} %`}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-[11px] text-gray-500">S0 = semaine de l’inscription. Calculé à partir de l’activité réelle des comptes, sans traceur supplémentaire.</p>
      </section>
    </div>
  );
}
