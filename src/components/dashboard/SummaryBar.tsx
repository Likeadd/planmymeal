'use client';

// ============================================================================
// SummaryBar — barre de résumé fine (1 ligne) qui remplace les 4 cartes KPI.
// Économies · Budget (ou coût estimé) · Temps de cuisine · Gaspillage évité —
// même logique de données que l'ancienne KpiBand. Logique anti-arbitraire :
// chaque KPI cite sa RÉFÉRENCE (économies → base déclarée ou budget ; temps →
// limite hebdo déclarée ; sans budget → « coût estimé », pas de barre).
// Aucune donnée inventée : les économies ne s'affichent que si la base
// déclarée existe — profiles.depense_reference_hebdo — sinon repli sur
// l'économie vs budget hebdo, sinon 0.
//
// Charte : chiffres en SANS-SERIF (audit #21 : les données doivent se lire
// d'un coup d'œil, la serif est réservée aux titres), icônes en pastilles
// douces (brand terracotta / accent lavande / sauge), aucun bloc sombre.
// ============================================================================

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, Loader2, Pencil, PiggyBank, Timer, Wallet, X, Recycle } from 'lucide-react';
import { toast } from 'sonner';
import { formatPrix } from '@/lib/budget';
import { errorMessage, formatMinutes } from '@/lib/utils';
import { getMonday } from '@/lib/dates';
import { useAuth } from '@/components/AuthProvider';
import { cn } from '@/lib/utils';
import type { DayPlan } from '@/types';

interface BudgetRecap {
  budget: number | null;
  depense: number;
  economie: number;
  depense_reference_hebdo: number | null;
  /** Objet EconomieReference (calculerEconomieReference) — voir /lib/budget */
  economie_reference: { economie: number; pourcentage: number; depassement: boolean; depenseReference: number } | null;
}

export function SummaryBar({ days }: { days: DayPlan[] }) {
  const { profile, refreshProfile } = useAuth();
  const [recap, setRecap] = useState<BudgetRecap | null>(null);
  // Saisie inline du budget depuis la cellule « Coût estimé » (aucun budget
  // défini) : le KPI sans référence devient l'endroit où la créer.
  const [editionBudget, setEditionBudget] = useState(false);
  const [budgetSaisie, setBudgetSaisie] = useState('');
  const [enregistreBudget, setEnregistreBudget] = useState(false);
  // Budget/économies : toujours la semaine COURANTE (comparaison cumulée),
  // calculée dans le fuseau de l'app (identique serveur / navigateur).
  const semaineCourante = getMonday();

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/budget?semaine_debut=${semaineCourante}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (!cancelled && d) setRecap(d); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [semaineCourante]);

  // Économie « vérité » : vs base déclarée si saisie, sinon vs budget hebdo.
  const economie = recap?.economie_reference?.economie
    ?? (profile?.depense_reference_hebdo == null && profile?.budget_hebdo != null ? recap?.economie ?? null : null);

  /** Ouvre la saisie inline pré-remplie avec le budget courant (s'il existe). */
  const ouvrirEditionBudget = () => {
    setBudgetSaisie(recap?.budget != null ? String(recap.budget) : '');
    setEditionBudget(true);
  };

  /** Enregistre le budget (null = retiré) via l'API /api/budget, puis
   *  rafraîchit le profil : la cellule Économies lit profile.budget_hebdo. */
  const enregistrerBudget = async () => {
    if (enregistreBudget) return;
    const brut = budgetSaisie.replace(',', '.').trim();
    const valeur = brut === '' ? null : Number(brut);
    if (valeur != null && (!Number.isFinite(valeur) || valeur < 0 || valeur > 10000)) {
      toast.error('Budget invalide (0 – 10 000 €)');
      return;
    }
    setEnregistreBudget(true);
    try {
      const res = await fetch('/api/budget', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ budget_hebdo: valeur, semaine_debut: semaineCourante }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`);
      if (recap) {
        setRecap({
          ...recap,
          budget: valeur,
          economie: valeur != null ? Math.round((valeur - recap.depense) * 100) / 100 : recap.economie,
        });
      }
      await refreshProfile();
      setEditionBudget(false);
      toast.success(valeur != null ? 'Budget hebdo enregistré' : 'Budget retiré');
    } catch (e) {
      toast.error(errorMessage(e, "Impossible d'enregistrer le budget"));
    } finally {
      setEnregistreBudget(false);
    }
  };

  // Temps de cuisine : somme réelle des temps de la semaine affichée.
  // « Temps gagné » était un mensonge doux — ce n'est pas un gain mesuré,
  // c'est du temps passé. La référence anti-arbitraire est la LIMITE que
  // l'utilisateur s'est fixée (profiles.temps_max_semaine), si elle existe.
  const limiteTemps = profile?.temps_max_semaine != null && profile.temps_max_semaine > 0
    ? profile.temps_max_semaine : null;
  const tempsTotal = useMemo(
    () => days.reduce((s, d) =>
      [d.dejeuner, d.diner, d.dessert, d.dessertMidi].reduce(
        (s2, m) => s2 + (m ? m.temps_preparation + (m.temps_cuisson || 0) : 0), s), 0),
    [days]
  );

  // Pas de référence (ni budget ni dépense habituelle) : « 0 € d'économies »
  // se lisait comme un échec — on invite à définir la référence à la place.
  const sansReference = profile?.budget_hebdo == null && recap?.economie_reference == null;
  const valeurEconomie = economie != null && economie > 0 ? formatPrix(economie) : sansReference ? 'À définir' : '0 €';

  // Anti-gaspi : déjeuners marqués « restes » dans la semaine affichée
  const nbRestes = useMemo(() => days.filter(d => d.restesDe != null).length, [days]);

  return (
    <div className="rounded-3xl border border-gray-200 bg-white shadow-card">
      {/* Mobile : grille 2×2 compacte (icône + valeur) — tout reste visible,
          sans défilement horizontal ni cellule coupée au bord de l'écran. */}
      <div className="grid grid-cols-2 md:hidden *:border-gray-100 [&>*:nth-child(odd)]:border-r [&>*:nth-child(-n+2)]:border-b">
        <CelluleCompacte
          href="/compte" titre="Économies"
          icone={<PiggyBank className="w-3.5 h-3.5" />} iconCls="bg-brand-50 text-brand-600"
          valeur={recap == null ? null : valeurEconomie}
          loadingClass="w-12" />
        {editionBudget ? (
          <span className="flex items-center gap-1.5 px-3 py-2.5 min-w-0">
            <MetricIcon className="bg-accent-50 text-accent-600 w-7! h-7!"><Wallet className="w-3.5 h-3.5" /></MetricIcon>
            <input type="number" min={0} max={10000} step="0.5" value={budgetSaisie}
              onChange={e => setBudgetSaisie(e.target.value)} placeholder="45" autoFocus
              aria-label="Budget hebdomadaire en euros"
              onKeyDown={e => { if (e.key === 'Escape') setEditionBudget(false); }}
              className="w-16 px-1.5 py-1 text-[13px] bg-white border border-accent-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-accent-300" />
            <button onClick={enregistrerBudget} disabled={enregistreBudget} title="Enregistrer"
              className="p-1.5 rounded-lg bg-sauge-500 text-white hover:bg-sauge-600 disabled:opacity-50 transition-colors">
              {enregistreBudget ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
            </button>
            <button onClick={() => setEditionBudget(false)} title="Annuler"
              className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-600 transition-colors">
              <X className="w-3 h-3" />
            </button>
          </span>
        ) : (
          <CelluleCompacte
            href={recap?.budget != null ? '/budget' : undefined}
            onClicSansLien={recap?.budget == null ? ouvrirEditionBudget : undefined}
            titre={recap?.budget != null ? `sur ${formatPrix(recap.budget)}` : 'Coût · fixer budget'}
            icone={<Wallet className="w-3.5 h-3.5" />} iconCls="bg-accent-50 text-accent-600"
            valeur={recap == null ? null : formatPrix(recap.depense)}
            loadingClass="w-16" />
        )}
        <CelluleCompacte titre="Cuisine"
          icone={<Timer className="w-3.5 h-3.5" />} iconCls="bg-brand-50 text-brand-600"
          valeur={tempsTotal >= 60 ? `${Math.floor(tempsTotal / 60)} h ${String(tempsTotal % 60).padStart(2, '0')}` : `${tempsTotal} min`} />
        <CelluleCompacte titre={nbRestes > 0 ? 'restes cuisinés' : 'Restes'}
          icone={<Recycle className="w-3.5 h-3.5" />} iconCls="bg-sauge-100 text-sauge-600"
          valeur={nbRestes > 0 ? `${nbRestes} repas` : 'Aucun'} />
      </div>
      <div className="hidden md:grid grid-cols-4 divide-x divide-gray-100">
        {/* Économies — la promesse produit. KPI « Économies » nu = arbitraire
            (« économisé par rapport à quoi ? ») : la sous-ligne dit la
            RÉFÉRENCE — base déclarée (calculerEconomieReference) ou budget. */}
        <Link href="/compte" title="Voir mes économies" className="group flex items-center gap-3 px-4 py-3 min-w-0 hover:bg-brand-50/50 transition-colors">
          <MetricIcon className="bg-brand-50 text-brand-600 group-hover:bg-brand-100"><PiggyBank className="w-4 h-4" /></MetricIcon>
          <div className="min-w-0">
            <MetricValue loading={recap === null} loadingClass="w-14">
              {valeurEconomie}
            </MetricValue>
            <MetricLabel>
              {recap?.economie_reference ? 'vs vos achats habituels'
                : profile?.budget_hebdo != null ? 'vs votre budget' : 'Économies (dans Compte)'}
            </MetricLabel>
          </div>
        </Link>

        {/* Budget courses — dépense vs budget quand il existe ; sinon
            « Coût estimé » DEVIEN CLIQUABLE : la cellule est l'endroit où
            créer la référence (saisie inline, PUT /api/budget). */}
        {editionBudget ? (
          <form
            onSubmit={e => { e.preventDefault(); enregistrerBudget(); }}
            className="flex items-center gap-2 px-4 py-3 min-w-0"
          >
            <MetricIcon className="bg-accent-50 text-accent-600"><Wallet className="w-4 h-4" /></MetricIcon>
            <div className="flex items-center gap-1.5 min-w-0">
              <input
                type="number" min={0} max={10000} step="0.5"
                value={budgetSaisie}
                onChange={e => setBudgetSaisie(e.target.value)}
                placeholder="ex : 45"
                autoFocus
                aria-label="Budget hebdomadaire en euros"
                className="w-20 px-2 py-1 text-sm bg-white border border-accent-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-accent-300"
              />
              <span className="text-sm text-gray-500 font-medium">€/sem</span>
              <button type="submit" disabled={enregistreBudget} title="Enregistrer"
                className="p-1.5 rounded-lg bg-sauge-500 text-white hover:bg-sauge-600 disabled:opacity-50 transition-colors">
                {enregistreBudget ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              </button>
              <button type="button" onClick={() => setEditionBudget(false)} title="Annuler"
                className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-600 transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>
        ) : (
          <Link
            href={recap?.budget != null ? '/budget' : '#'}
            onClick={e => { if (recap?.budget == null) { e.preventDefault(); ouvrirEditionBudget(); } }}
            title={recap?.budget != null ? 'Voir mon budget' : 'Définir un budget hebdo'}
            className="group flex items-center gap-3 px-4 py-3 min-w-0 hover:bg-brand-50/50 transition-colors"
          >
            <MetricIcon className="bg-accent-50 text-accent-600 group-hover:bg-accent-100"><Wallet className="w-4 h-4" /></MetricIcon>
            <div className="min-w-0 flex-1">
              <MetricValue loading={recap === null} loadingClass="w-16">
                {recap ? (
                  <span className={recap.budget != null && recap.depense > recap.budget ? 'text-red-600' : undefined}>
                    {formatPrix(recap.depense)}
                  </span>
                ) : null}
                {recap?.budget != null && <span className="text-sm text-gray-500 font-medium"> / {formatPrix(recap.budget)}</span>}
              </MetricValue>
              {recap?.budget != null && (
                <div className="mt-1 h-1 rounded-full bg-gray-100 overflow-hidden max-w-[96px]">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-500',
                      recap.depense > recap.budget ? 'bg-red-500'
                        : recap.depense >= recap.budget * 0.8 ? 'bg-sable-400'
                          : 'bg-sauge-500'
                    )}
                    style={{ width: `${Math.min(100, Math.round((recap.depense / recap.budget) * 100))}%` }}
                  />
                </div>
              )}
              <MetricLabel>
                {recap?.budget != null ? 'Budget' : (
                  <span className="inline-flex items-center gap-1 text-accent-600 group-hover:text-accent-700">
                    <Pencil className="w-2.5 h-2.5" /> Définir mon budget
                  </span>
                )}
              </MetricLabel>
            </div>
          </Link>
        )}

        {/* Temps de cuisine — le total réel de la semaine affichée, avec la
            limite déclarée en référence quand elle existe. */}
        <div className="flex items-center gap-3 px-4 py-3 min-w-0">
          <MetricIcon className="bg-brand-50 text-brand-600"><Timer className="w-4 h-4" /></MetricIcon>
          <div className="min-w-0">
            <MetricValue>
              {tempsTotal >= 60
                ? <>{Math.floor(tempsTotal / 60)} h {String(tempsTotal % 60).padStart(2, '0')}</>
                : <>{tempsTotal} min</>}
            </MetricValue>
            <MetricLabel>{limiteTemps != null ? `limite ${formatMinutes(limiteTemps)}` : 'Temps de cuisine'}</MetricLabel>
          </div>
        </div>

        {/* Gaspillage évité — un « 0 anti-gaspi » se lit comme un échec.
            Le libellé énonce la PROMESSE : le compteur mesure ce que la
            semaine a évité (restes réinclus au planning). */}
        <div className="flex items-center gap-3 px-4 py-3 min-w-0">
          <MetricIcon className="bg-sauge-100 text-sauge-600"><Recycle className="w-4 h-4" /></MetricIcon>
          <div className="min-w-0">
            <MetricValue>{nbRestes}</MetricValue>
            <MetricLabel>{nbRestes > 0 ? 'repas anti-gaspi' : 'Gaspillage évité'}</MetricLabel>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sous-composants de présentation ────────────────────────────────────────

/** Cellule ultra-compacte de la ligne mobile (audit #11) : icône + valeur +
 *  libellé minuscule, sans bordure (séparés par un simple filet vertical via
 *  le conteneur). `valeur` null = squelette shimmer (chargement). */
function CelluleCompacte({ href, onClicSansLien, titre, icone, iconCls, valeur, loadingClass = 'w-14' }: {
  href?: string;
  /** Pas de lien : le clic déclenche une action locale (ex : saisie budget) */
  onClicSansLien?: () => void;
  titre: string;
  icone: React.ReactNode;
  iconCls: string;
  valeur?: React.ReactNode | null;
  loadingClass?: string;
}) {
  const contenu = (
    <>
      <MetricIcon className={cn('w-7! h-7! rounded-lg', iconCls)}>{icone}</MetricIcon>
      <span className="min-w-0">
        {valeur === null
          ? <span className={cn('inline-block h-4 rounded-lg animate-shimmer align-middle', loadingClass)} />
          : <span className="block font-bold text-[14px] leading-tight text-gray-900 truncate tabular-nums">{valeur ?? '—'}</span>}
        <span className="block text-[11px] font-bold tracking-[0.08em] uppercase text-gray-500 truncate">{titre}</span>
      </span>
    </>
  );
  const cls = 'flex items-center gap-2 px-3 py-2.5 min-w-0 text-left';
  if (href) {
    return <Link href={href} className={cn(cls, 'hover:bg-brand-50/50 transition-colors')}>{contenu}</Link>;
  }
  if (onClicSansLien) {
    return <button onClick={onClicSansLien} title="Définir un budget hebdo" className={cn(cls, 'hover:bg-accent-50/60 transition-colors')}>{contenu}</button>;
  }
  return <span className={cls}>{contenu}</span>;
}

function MetricIcon({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return (
    <span className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors', className)}>
      {children}
    </span>
  );
}

function MetricValue({ children, loading, loadingClass = 'w-14' }: {
  children: React.ReactNode; loading?: boolean; loadingClass?: string;
}) {
  if (loading) return <span className={cn('inline-block h-5 rounded-lg animate-shimmer align-middle', loadingClass)} />;
  return (
    <span className="block font-bold text-xl leading-none tracking-tight text-gray-900 truncate tabular-nums">
      {children}
    </span>
  );
}

function MetricLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="mt-1 block text-[11px] font-semibold tracking-widest uppercase text-gray-500 truncate">
      {children}
    </span>
  );
}

