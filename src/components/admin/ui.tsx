import { formatDateLongueFr } from '@/lib/dates';

export interface Serie { jour: string; n: number }
export const nb = (n: number) => n.toLocaleString('fr-FR');
export const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)} %` : '—');

export function Carte({ titre, valeur, detail }: { titre: string; valeur: string; detail?: string }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-xs">
      <p className="text-xs text-gray-500">{titre}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{valeur}</p>
      {detail && <p className="text-[11px] text-gray-500 mt-0.5">{detail}</p>}
    </div>
  );
}

export function Barres({ titre, donnees, suffixe = 'sur la période' }: { titre: string; donnees: Serie[]; suffixe?: string }) {
  const max = Math.max(1, ...donnees.map(d => d.n));
  const total = donnees.reduce((s, d) => s + d.n, 0);
  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-xs">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-semibold text-gray-900 text-sm">{titre}</h2>
        <p className="text-xs text-gray-500">{nb(total)} {suffixe}</p>
      </div>
      <div className="mt-3 flex items-end gap-[3px] h-28" role="img" aria-label={`${titre} : ${nb(total)} ${suffixe}`}>
        {donnees.map(d => (
          <div key={d.jour} title={`${formatDateLongueFr(d.jour)} : ${d.n}`}
            className="flex-1 rounded-t bg-brand-500/85 min-h-[2px]" style={{ height: `${Math.max(2, (d.n / max) * 100)}%` }} />
        ))}
      </div>
      {donnees.length > 0 && (
        <div className="mt-1 flex justify-between text-[10px] text-gray-500">
          <span>{formatDateLongueFr(donnees[0].jour, { day: 'numeric', month: 'short' })}</span><span>aujourd’hui</span>
        </div>
      )}
    </section>
  );
}

/** Liste classée avec barre proportionnelle (pages, sources, pays…) */
export function ListeBarres({ titre, lignes, colonne = 'Visiteurs', vide = 'Pas encore de données.' }: {
  titre: string; lignes: { nom: string; n: number; detail?: string }[]; colonne?: string; vide?: string;
}) {
  const max = Math.max(1, ...lignes.map(l => l.n));
  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-xs">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-semibold text-gray-900 text-sm">{titre}</h2>
        <p className="text-[11px] text-gray-500">{colonne}</p>
      </div>
      {lignes.length === 0 ? <p className="mt-3 text-xs text-gray-500">{vide}</p> : (
        <ul className="mt-3 space-y-1.5">
          {lignes.map(l => (
            <li key={l.nom} className="relative text-[13px]">
              <span className="absolute inset-y-0 left-0 rounded bg-brand-100/80" style={{ width: `${Math.max(3, (l.n / max) * 100)}%` }} aria-hidden />
              <span className="relative flex justify-between gap-3 px-2 py-1">
                <span className="truncate text-gray-800">{l.nom}</span>
                <span className="shrink-0 font-semibold text-gray-900">{nb(l.n)}{l.detail ? <span className="ml-2 font-normal text-gray-500">{l.detail}</span> : null}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
