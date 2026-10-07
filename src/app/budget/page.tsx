'use client';

import { ouvrirPaywall } from '@/lib/paywall';
import { errorMessage } from '@/lib/utils';

import { useEffect, useState, useCallback } from 'react';
import {
  Wallet, Loader2, PiggyBank, TrendingDown, TrendingUp,
  Pencil, Check, X, History,
} from 'lucide-react';
import { toast } from 'sonner';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { CountUp } from '@/components/CountUp';
import { celebrate } from '@/lib/celebrate';
import { formatPrix } from '@/lib/budget';
import { formatRayon } from '@/lib/utils';
import { useAuth } from '@/components/AuthProvider';
import { formatDateLongueFr, getMonday } from '@/lib/dates';

interface BudgetData {
  budget: number | null;
  nb_personnes: number;
  prix_max_portion: number | null;
  /** true = la semaine ne dépasse pas le budget ; false = autour du budget */
  budget_strict: boolean;
  depense: number;
  economie: number;
  /** Base de dépense DÉCLARÉE par l'utilisateur (null = non saisie → widget masqué) */
  depense_reference_hebdo: number | null;
  depense_reference_saisie_le: string | null;
  economie_reference: {
    depenseReference: number;
    economie: number;
    pourcentage: number;
    depassement: boolean;
  } | null;
  snapshot: { depense_reelle: number | null } | null;
  history: {
    semaine_debut: string;
    budget: number;
    depense: number;
    economie: number;
    depense_reelle: number | null;
    economie_reelle: number | null;
    nb_personnes: number;
  }[];
}

interface PricedItem {
  ingredient_id: number;
  nom: string;
  rayon: string;
  quantite_totale: number;
  unite: string;
  quantite_achat: number | null;
  unite_prix: string | null;
  prix_unitaire: number | null;
  prix: number | null;
  checked: boolean;
}

interface PricedSection {
  rayon: string;
  label: string;
  items: PricedItem[];
  total: number;
}

const BUDGETS_RAPIDES = [20, 30, 40, 50, 70, 100];

export default function BudgetPage() {
  const [data, setData] = useState<BudgetData | null>(null);
  const [sections, setSections] = useState<PricedSection[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [savingBudget, setSavingBudget] = useState(false);
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');
  const [editingItem, setEditingItem] = useState<number | null>(null);
  const [savingPrixMax, setSavingPrixMax] = useState(false);
  const [editingPrixMax, setEditingPrixMax] = useState(false);
  const [prixMaxInput, setPrixMaxInput] = useState('');
  const [prixInput, setPrixInput] = useState('');
  const [savingPrix, setSavingPrix] = useState(false);
  // Économies vs base déclarée (décision produit : ancrage utilisateur)
  const [editingRef, setEditingRef] = useState(false);
  const [refInput, setRefInput] = useState('');
  const [savingRef, setSavingRef] = useState(false);
  const [editingReelle, setEditingReelle] = useState(false);
  const [reelleInput, setReelleInput] = useState('');
  const [savingReelle, setSavingReelle] = useState(false);
  const { profile } = useAuth();
  const isPro = profile?.plan === 'pro' || profile?.plan === 'famille';

  // getMonday() est ancré sur Europe/Paris : la semaine affichée (et donc les
  // requêtes lancées) est la même côté serveur (UTC) et côté navigateur. Le
  // calcul local précédent changeait de semaine à minuit UTC → budget d'une
  // autre semaine et hydration mismatch.
  const semaineDebut = getMonday();

  const load = useCallback(async () => {
    // NB : le premier setState est après le premier await (pas de setState
    // synchrone dans l'effet de chargement)
    try {
      const [budgetRes, prixRes] = await Promise.all([
        fetch(`/api/budget?semaine_debut=${semaineDebut}`),
        fetch(`/api/prix?semaine_debut=${semaineDebut}`),
      ]);
      const budgetData = await budgetRes.json();
      const prixData = await prixRes.json();
      setData(budgetData);
      setSections(prixData.sections || []);
      setTotal(prixData.total || 0);
      setBudgetInput(budgetData.budget != null ? String(budgetData.budget) : '');
      setPrixMaxInput(budgetData.prix_max_portion != null ? String(budgetData.prix_max_portion) : '');
    } catch {
      toast.error('Erreur de chargement du budget');
    } finally {
      setLoading(false);
    }
  }, [semaineDebut]);

  // Chargement initial (IIFE async : setState tous après le premier await)
  useEffect(() => {
    void (async () => { await load(); })();
  }, [load]);

  const saveMode = async (strict: boolean) => {
    if (!data || data.budget_strict === strict) return;
    setData({ ...data, budget_strict: strict });
    try {
      const res = await fetch('/api/budget', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ budget_strict: strict }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Erreur');
      toast.success(strict ? 'Budget strict : vos semaines resteront sous le budget' : 'Budget souple : vos semaines resteront autour du budget');
    } catch (e) {
      setData(d => (d ? { ...d, budget_strict: !strict } : d));
      toast.error(errorMessage(e, 'Erreur lors de la sauvegarde'));
    }
  };

  const saveBudget = async (value: number | null) => {
    setSavingBudget(true);
    try {
      const res = await fetch('/api/budget', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ budget_hebdo: value, semaine_debut: semaineDebut }),
      });
      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error || 'Erreur');
      }
      toast.success(value != null ? `Budget fixé à ${formatPrix(value)} / semaine` : 'Budget supprimé');
      setEditingBudget(false);
      await load();
    } catch (e) {
      toast.error(errorMessage(e, 'Erreur lors de la sauvegarde'));
    } finally {
      setSavingBudget(false);
    }
  };

  const savePrixMax = async (value: number | null) => {
    setSavingPrixMax(true);
    try {
      const res = await fetch('/api/budget', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prix_max_portion: value }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erreur');
      toast.success(value != null
        ? `Cap fixé : aucune recette au-dessus de ${formatPrix(value)} / portion`
        : 'Cap prix supprimé');
      setEditingPrixMax(false);
      await load();
    } catch (e) {
      toast.error(errorMessage(e, 'Erreur lors de la sauvegarde'));
    } finally {
      setSavingPrixMax(false);
    }
  };

  const savePrix = async (ingredientId: number) => {
    const prix = parseFloat(prixInput.replace(',', '.'));
    if (!Number.isFinite(prix) || prix < 0) {
      toast.error('Prix invalide');
      return;
    }
    setSavingPrix(true);
    try {
      const res = await fetch('/api/prix', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ingredient_id: ingredientId, prix_unitaire: prix, semaine_debut: semaineDebut }),
      });
      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error || 'Erreur');
      }
      toast.success('Prix mis à jour — la semaine est recalculée');
      setEditingItem(null);
      await load();
    } catch (e) {
      toast.error(errorMessage(e, 'Erreur lors de la mise à jour du prix'));
    } finally {
      setSavingPrix(false);
    }
  };

  // ─── Économies vs base déclarée ──────────────────────────────────────────

  const saveDepenseReference = async (valueOverride?: number) => {
    const ref = valueOverride ?? parseFloat(refInput.replace(',', '.'));
    if (!Number.isFinite(ref) || ref <= 0 || ref > 10000) {
      toast.error('Base invalide (1 – 10000 €)');
      return;
    }
    setSavingRef(true);
    try {
      const res = await fetch('/api/budget', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ depense_reference_hebdo: ref }),
      });
      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error || 'Erreur');
      }
      toast.success(`Base fixée à ${formatPrix(ref)} / semaine — vos économies sont suivies 🎯`);
      setEditingRef(false);
      await load();
    } catch (e) {
      toast.error(errorMessage(e, 'Erreur lors de la sauvegarde'));
    } finally {
      setSavingRef(false);
    }
  };

  const saveDepenseReelle = async () => {
    const v = parseFloat(reelleInput.replace(',', '.'));
    if (!Number.isFinite(v) || v < 0 || v > 10000) {
      toast.error('Dépense invalide (0 – 10000 €)');
      return;
    }
    setSavingReelle(true);
    try {
      const res = await fetch('/api/budget', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ depense_reelle: v, semaine_debut: semaineDebut }),
      });
      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error || 'Erreur');
      }
      toast.success('Dépense réelle enregistrée — votre économie devient un chiffre réel 💰');
      // Célébration : l'économie devient un chiffre réel (roadmap animation n°6)
      celebrate();
      setEditingReelle(false);
      await load();
    } catch (e) {
      toast.error(errorMessage(e, 'Erreur lors de la sauvegarde'));
    } finally {
      setSavingReelle(false);
    }
  };

  // ─── Loading ──────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-brand-500 animate-spin" />
      </div>
    );
  }

  const budget = data?.budget ?? null;
  const depense = data?.depense ?? total;
  const economie = budget != null ? budget - depense : 0;
  const depassement = budget != null && depense > budget;
  const pourcentage = budget && budget > 0 ? Math.min(150, Math.round((depense / budget) * 100)) : 0;
  // Dépense réelle saisie après les courses (snapshot de la semaine)
  const depenseReelleSemaine = data?.snapshot?.depense_reelle ?? null;

  return (
    <DashboardShell>

      <div className="container-app py-8 max-w-4xl">
        {/* ─── Titre ─── */}
        <div className="flex items-center gap-3 mb-2">
          {/* Pastille 44px = convention des autres pages (/recettes, /planning) :
              icône 20px, le titre sur la ligne de base commune. */}
          <div className="w-11 h-11 rounded-2xl bg-brand-50 flex items-center justify-center shrink-0" aria-hidden>
            <Wallet className="w-5 h-5 text-brand-500" />
          </div>
          <div>
            <h1 className="font-display text-3xl font-bold text-gray-900 tracking-tight">Mon budget</h1>
            <p className="text-gray-500">Fixez votre budget courses de la semaine — vos menus s&apos;adaptent.</p>
          </div>
        </div>

        {/* ─── Bloc budget ─── */}
        <div className={`mt-8 rounded-3xl border p-6 sm:p-8 transition-all ${depassement ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100 shadow-xs'}`}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm text-gray-500 mb-1">Budget hebdomadaire</p>
              {editingBudget ? (
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <input
                      type="number" min="0" step="1" autoFocus value={budgetInput}
                      onChange={e => setBudgetInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveBudget(parseFloat(budgetInput.replace(',', '.')) || null); }}
                      className="w-40 px-4 py-2 pr-9 text-3xl font-bold border-2 border-brand-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-brand-200"
                      placeholder="50"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xl text-gray-500 font-semibold">€</span>
                  </div>
                  <button onClick={() => saveBudget(parseFloat(budgetInput.replace(',', '.')) || null)} disabled={savingBudget}
                    className="p-2.5 rounded-full bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50 transition-colors">
                    <Check className="w-5 h-5" />
                  </button>
                  <button onClick={() => setEditingBudget(false)}
                    className="p-2.5 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <button onClick={() => { setBudgetInput(budget != null ? String(budget) : ''); setEditingBudget(true); }}
                  className="group flex items-baseline gap-2 text-left">
                  <span className="font-display text-5xl font-bold text-gray-900 group-hover:text-brand-600 transition-colors">
                    {budget != null ? <CountUp value={budget} format={formatPrix} /> : '—'}
                  </span>
                  <Pencil className="w-4 h-4 text-gray-300 group-hover:text-brand-500 transition-colors mb-2" />
                </button>
              )}
              <p className="text-sm text-gray-500 mt-1">
                {budget != null
                  ? `Soit environ ${formatPrix(budget / (data?.nb_personnes || 2))} par personne`
                  : 'Aucun budget défini — cliquez pour le fixer'}
              </p>
              {budget != null && (
                <div className="mt-4">
                  <div role="radiogroup" aria-label="Respect du budget" className="inline-flex rounded-full bg-gray-100 p-1 text-sm">
                    {([[true, 'Strict'], [false, 'Souple']] as const).map(([val, label]) => (
                      <button key={label} type="button" role="radio" aria-checked={(data?.budget_strict ?? true) === val} onClick={() => saveMode(val)}
                        className={`px-4 py-1.5 rounded-full font-semibold transition-colors ${(data?.budget_strict ?? true) === val ? 'bg-white text-brand-700 shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-gray-500 max-w-xs">
                    {(data?.budget_strict ?? true)
                      ? 'Chaque optimisation compose une semaine qui ne dépasse pas ce budget.'
                      : 'Chaque optimisation vise ce budget, avec une marge d’environ 10 %, pour garder plus de variété.'}
                  </p>
                </div>
              )}
            </div>

            {/* Dépense + économie */}
            <div className="flex gap-4">
              <div className="text-right">
                <p className="text-sm text-gray-500 mb-1">Semaine prévue</p>
                <p className={`font-display text-2xl font-bold ${depassement ? 'text-red-600' : 'text-gray-900'}`}>
                  <CountUp value={depense} format={formatPrix} />
                </p>
              </div>
              {budget != null && (
                <div className={`text-right px-4 py-2 rounded-2xl ${depassement ? 'bg-red-100' : 'bg-sauge-100'}`}>
                  <p className={`text-sm text-gray-500 mb-1 flex items-center gap-1 justify-end`}>
                    {depassement ? <TrendingUp className="w-3.5 h-3.5 text-red-500" /> : <TrendingDown className="w-3.5 h-3.5 text-sauge-600" />}
                    {depassement ? 'Dépassement' : 'Économie'}
                  </p>
                  <p className={`font-display text-2xl font-bold ${depassement ? 'text-red-600' : 'text-sauge-700'}`}>
                    <CountUp value={Math.abs(economie)} format={formatPrix} />
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Barre de progression */}
          {budget != null && budget > 0 && (
            <div className="mt-6">
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${depassement ? 'bg-red-500' : pourcentage > 85 ? 'bg-sable-400' : 'bg-brand-500'}`}
                  style={{ width: `${pourcentage}%` }} />
              </div>
              <div className="flex justify-between mt-2 text-xs text-gray-500">
                <span>{pourcentage}% du budget utilisé</span>
                <span>{depassement ? 'Au-dessus du budget' : 'Sous le budget 🎉'}</span>
              </div>
            </div>
          )}

          {/* Budgets rapides */}
          {editingBudget && (
            <div className="mt-4 flex flex-wrap gap-2">
              {BUDGETS_RAPIDES.map(b => (
                <button key={b} onClick={() => { setBudgetInput(String(b)); saveBudget(b); }} disabled={savingBudget}
                  className="px-4 py-1.5 text-sm rounded-full border border-gray-200 hover:border-brand-400 hover:bg-brand-50 hover:text-brand-600 transition-colors">
                  {b} €
                </button>
              ))}
              <button onClick={() => saveBudget(null)} disabled={savingBudget}
                className="px-4 py-1.5 text-sm rounded-full border border-gray-200 text-gray-500 hover:border-gray-300 transition-colors">
                Retirer le budget
              </button>
            </div>
          )}

          {/* ─── Prix max par portion (Pro) ─── */}
          <div className="mt-6 pt-6 border-t border-gray-100">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  🎯 Prix max par portion
                  {!isPro && (
                    <span className="text-[11px] bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full font-bold uppercase">Pro</span>
                  )}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  L&apos;algorithme ne sélectionnera <strong>que</strong> des recettes sous ce seuil.
                </p>
              </div>
              {isPro ? (
                editingPrixMax ? (
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <input type="number" min="0.5" step="0.5" autoFocus value={prixMaxInput}
                        onChange={e => setPrixMaxInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') savePrixMax(parseFloat(prixMaxInput.replace(',', '.')) || null); }}
                        className="w-28 px-3 py-2 pr-8 text-lg font-bold border-2 border-brand-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-brand-200"
                        placeholder="3" />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-gray-500 font-semibold">€</span>
                    </div>
                    <button onClick={() => savePrixMax(parseFloat(prixMaxInput.replace(',', '.')) || null)} disabled={savingPrixMax}
                      className="p-2 rounded-full bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50 transition-colors">
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={() => setEditingPrixMax(false)}
                      className="p-2 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { setPrixMaxInput(data?.prix_max_portion != null ? String(data.prix_max_portion) : ''); setEditingPrixMax(true); }}
                      className="group flex items-baseline gap-1.5">
                      <span className="font-display text-2xl font-bold text-gray-900 group-hover:text-brand-600 transition-colors">
                        {data?.prix_max_portion != null ? `${formatPrix(data.prix_max_portion)}` : 'Aucun cap'}
                      </span>
                      <Pencil className="w-3.5 h-3.5 text-gray-300 group-hover:text-brand-500 transition-colors" />
                    </button>
                    {data?.prix_max_portion != null && (
                      <button onClick={() => savePrixMax(null)} disabled={savingPrixMax}
                        className="text-xs text-gray-500 hover:text-red-500 transition-colors">
                        Retirer
                      </button>
                    )}
                  </div>
                )
              ) : (
                <button onClick={() => ouvrirPaywall('prix-max')}
                  className="px-4 py-2 text-sm font-medium text-brand-600 bg-brand-50 rounded-full hover:bg-brand-100 transition-colors">
                  Débloquer avec Pro
                </button>
              )}
            </div>
            {isPro && data?.prix_max_portion != null && (
              <p className="text-xs text-sauge-700 mt-2">
                ✅ Actif : seules les recettes ≤ {formatPrix(data.prix_max_portion)} / portion seront proposées à la prochaine génération.
              </p>
            )}
          </div>
        </div>

        {/* ─── Économies vs VOTRE base (décision produit : ancrage utilisateur) ───
            La base n'est jamais devinée : widget masqué tant que non saisie. */}
        <div className="mt-4 rounded-3xl border border-gray-100 bg-white p-6 sm:p-8 shadow-xs">
          {editingRef ? (
            <div>
              <p className="text-sm font-semibold text-gray-900">
                Combien dépensiez-vous par semaine en courses, avant PlanMyMeal ?
              </p>
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <input
                    type="number" min="1" step="1" autoFocus value={refInput}
                    onChange={e => setRefInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') saveDepenseReference();
                      if (e.key === 'Escape') setEditingRef(false);
                    }}
                    className="w-36 px-4 py-2 pr-9 font-display text-2xl font-bold border-2 border-brand-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-brand-200"
                    placeholder="80"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-lg text-gray-500 font-semibold">€</span>
                </div>
                <button onClick={() => saveDepenseReference()} disabled={savingRef}
                  className="p-2.5 rounded-full bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50 transition-colors">
                  <Check className="w-5 h-5" />
                </button>
                <button onClick={() => setEditingRef(false)}
                  className="p-2.5 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {[50, 70, 90, 120, 150].map(v => (
                  <button key={v} onClick={() => { setRefInput(String(v)); saveDepenseReference(v); }} disabled={savingRef}
                    className="px-4 py-1.5 text-sm rounded-full border border-gray-200 hover:border-brand-400 hover:bg-brand-50 hover:text-brand-600 transition-colors">
                    {v} €
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-3">
                Vos économies seront calculées contre <strong>votre</strong> base, jamais contre une moyenne théorique.
              </p>
            </div>
          ) : data?.depense_reference_hebdo == null ? (
            <button onClick={() => { setRefInput(''); setEditingRef(true); }} className="w-full text-left group">
              <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                🎯 Suivez vos économies réelles
                <Pencil className="w-3.5 h-3.5 text-gray-300 group-hover:text-brand-500 transition-colors" />
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Indiquez ce que vous dépensiez par semaine avant PlanMyMeal — on calcule vos économies contre votre base.
              </p>
            </button>
          ) : (
            <div>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-gray-500 mb-1 flex items-center gap-1.5">
                    🎯 Économies vs votre base
                    <button onClick={() => { setRefInput(String(data.depense_reference_hebdo)); setEditingRef(true); }}
                      className="p-1 rounded-sm text-gray-300 hover:text-brand-500 transition-colors" title="Modifier la base">
                      <Pencil className="w-3 h-3" />
                    </button>
                  </p>
                  <p className="font-display text-2xl font-bold text-gray-900">
                    {formatPrix(data.depense_reference_hebdo)}
                    <span className="text-sm font-normal text-gray-500"> / semaine</span>
                  </p>
                  {data.depense_reference_saisie_le && (
                    <p className="text-xs text-gray-500 mt-1">
                      Base déclarée le {new Date(`${data.depense_reference_saisie_le}T12:00:00`).toLocaleDateString('fr-FR')}
                    </p>
                  )}
                </div>
                {data.economie_reference && (
                  <div className={`text-right px-4 py-2 rounded-2xl ${data.economie_reference.depassement ? 'bg-red-100' : 'bg-sauge-100'}`}>
                    <p className="text-sm text-gray-500 mb-1">Prévu cette semaine</p>
                    <p className={`font-display text-2xl font-bold ${data.economie_reference.depassement ? 'text-red-600' : 'text-sauge-700'}`}>
                      {data.economie_reference.economie >= 0 ? '+' : ''}{formatPrix(data.economie_reference.economie)}
                    </p>
                  </div>
                )}
              </div>

              {/* Dépense réelle post-courses → vérité terrain */}
              <div className="mt-5 pt-5 border-t border-gray-100">
                {editingReelle ? (
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Combien avez-vous réellement dépensé cette semaine ?</p>
                    <div className="mt-3 flex items-center gap-2">
                      <div className="relative">
                        <input
                          type="number" min="0" step="0.01" autoFocus value={reelleInput}
                          onChange={e => setReelleInput(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') saveDepenseReelle();
                            if (e.key === 'Escape') setEditingReelle(false);
                          }}
                          className="w-36 px-4 py-2 pr-9 font-display text-2xl font-bold border-2 border-brand-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-brand-200"
                          placeholder="62,40"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-lg text-gray-500 font-semibold">€</span>
                      </div>
                      <button onClick={saveDepenseReelle} disabled={savingReelle}
                        className="p-2.5 rounded-full bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50 transition-colors">
                        <Check className="w-5 h-5" />
                      </button>
                      <button onClick={() => setEditingReelle(false)}
                        className="p-2.5 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors">
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ) : depenseReelleSemaine != null ? (
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <p className="text-sm text-gray-500">Dépense réelle cette semaine</p>
                      <p className="font-display text-2xl font-bold text-gray-900">{formatPrix(depenseReelleSemaine)}</p>
                    </div>
                    {(() => {
                      const ref = data.depense_reference_hebdo;
                      const ecoReelle = ref != null && depenseReelleSemaine != null
                        ? Math.round((ref - depenseReelleSemaine) * 100) / 100
                        : null;
                      if (ecoReelle == null) return null;
                      return (
                        <div className={`px-4 py-2 rounded-2xl text-right ${ecoReelle >= 0 ? 'bg-sauge-100' : 'bg-red-100'}`}>
                          <p className="text-sm text-gray-500 mb-1">💰 Économie réelle</p>
                          <p className={`font-display text-2xl font-bold ${ecoReelle >= 0 ? 'text-sauge-700' : 'text-red-600'}`}>
                            {ecoReelle >= 0 ? '+' : ''}{formatPrix(ecoReelle)}
                          </p>
                        </div>
                      );
                    })()}
                    <button onClick={() => { setReelleInput(String(depenseReelleSemaine)); setEditingReelle(true); }}
                      className="text-xs text-gray-500 hover:text-brand-600 underline transition-colors">
                      Corriger
                    </button>
                  </div>
                ) : (
                  <button onClick={() => { setReelleInput(''); setEditingReelle(true); }} className="w-full text-left group">
                    <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                      🛒 Après vos courses, indiquez votre dépense réelle
                      <Pencil className="w-3.5 h-3.5 text-gray-300 group-hover:text-brand-500 transition-colors" />
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Votre économie devient un chiffre réel (plus une estimation) — et aide à calibrer nos prix.
                    </p>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ─── Explication de l'adaptation ─── */}
        {budget != null && (
          <div className="mt-4 flex items-start gap-3 bg-brand-50 border border-brand-100 rounded-2xl p-4">
            <SparklesIcon />
            <p className="text-sm text-brand-800">
              <strong>Vos menus s&apos;adaptent à ce budget.</strong> À la prochaine génération de semaine, les recettes
              {depassement ? ' économiques seront privilégiées pour revenir sous le budget' : ' seront équilibrées selon votre budget'}.
              Régénérez la semaine pour en profiter.
            </p>
          </div>
        )}

        {/* ─── Liste de courses chiffrée ─── */}
        <h2 className="text-xl font-bold text-gray-900 mt-10 mb-4 flex items-center gap-2">
          <PiggyBank className="w-5 h-5 text-brand-500" />
          Courses de la semaine — {formatPrix(total)}
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          Les prix sont des estimations. Modifiez un prix (votre magasin, votre marque) : tout est recalculé.
        </p>

        {sections.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-500">
            Générez votre semaine sur le dashboard pour voir vos courses chiffrées.
          </div>
        ) : (
          <div className="space-y-4">
            {sections.map(section => (
              <div key={section.rayon} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="px-5 py-3 bg-creme-50 border-b flex items-center justify-between">
                  <h3 className="font-semibold">{formatRayon(section.rayon)}</h3>
                  <span className="text-sm font-bold text-brand-600">{formatPrix(section.total)}</span>
                </div>
                <div className="divide-y divide-gray-50">
                  {section.items.map(item => (
                    <div key={item.ingredient_id} className="px-5 py-3 flex items-center gap-3 hover:bg-gray-50">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800">{item.nom}</p>
                        <p className="text-xs text-gray-500">
                          recette : {item.quantite_totale} {item.unite}
                          {item.quantite_achat != null && item.unite_prix && (
                            <> · à acheter : {item.quantite_achat} {item.unite_prix === 'kg' ? 'kg' : item.unite_prix === 'L' ? 'L' : item.unite_prix}</>
                          )}
                        </p>
                      </div>

                      {/* Prix éditable */}
                      {editingItem === item.ingredient_id ? (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <input
                            type="number" min="0" step="0.01" autoFocus value={prixInput}
                            onChange={e => setPrixInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') savePrix(item.ingredient_id); if (e.key === 'Escape') setEditingItem(null); }}
                            className="w-24 px-2.5 py-1.5 text-sm border-2 border-brand-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-brand-200"
                            placeholder={item.prix_unitaire != null ? String(item.prix_unitaire) : 'prix'}
                          />
                          <button onClick={() => savePrix(item.ingredient_id)} disabled={savingPrix}
                            className="p-1.5 rounded-lg bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50">
                            <Check className="w-4 h-4" />
                          </button>
                          <button onClick={() => setEditingItem(null)}
                            className="p-1.5 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="text-right">
                            <p className={`text-sm font-semibold ${item.prix != null ? 'text-gray-900' : 'text-gray-300'}`}>
                              {formatPrix(item.prix)}
                            </p>
                            {item.prix_unitaire != null && (
                              <p className="text-xs text-gray-500">
                                {formatPrix(item.prix_unitaire)} / {prettyUnite(item.unite_prix!)}
                              </p>
                            )}
                          </div>
                          <button onClick={() => { setEditingItem(item.ingredient_id); setPrixInput(item.prix_unitaire != null ? String(item.prix_unitaire) : ''); }}
                            className="p-1.5 rounded-lg text-gray-300 hover:text-brand-500 hover:bg-brand-50 transition-colors"
                            title="Corriger ce prix">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Total */}
            <div className="bg-brand-500 rounded-2xl p-5 flex items-center justify-between text-white">
              <span className="font-semibold">Total semaine</span>
              <span className="font-display text-2xl font-bold"><CountUp value={total} format={formatPrix} /></span>
            </div>
          </div>
        )}

        {/* ─── Historique des économies ─── */}
        {data && data.history.length > 0 && (
          <>
            <h2 className="text-xl font-bold text-gray-900 mt-10 mb-4 flex items-center gap-2">
              <History className="w-5 h-5 text-brand-500" />
              Historique de vos économies
            </h2>

            {/* Graphique 8 dernières semaines (dépense vs budget) */}
            <SavingsChart history={[...data.history].slice(0, 8).reverse()} />

            <div className="bg-white rounded-2xl border border-gray-100 overflow-x-auto mt-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-creme-50 text-left text-gray-500">
                    <th className="px-5 py-3 font-medium">Semaine</th>
                    <th className="px-5 py-3 font-medium text-right">Budget</th>
                    <th className="px-5 py-3 font-medium text-right">Dépense</th>
                    <th className="px-5 py-3 font-medium text-right">Réel</th>
                    <th className="px-5 py-3 font-medium text-right">Économie</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.history.map(h => {
                    const dep = h.depense > h.budget;
                    return (
                      <tr key={h.semaine_debut} className="hover:bg-gray-50">
                        <td className="px-5 py-3 text-gray-700">{formatSemaine(h.semaine_debut)}</td>
                        <td className="px-5 py-3 text-right text-gray-500">{formatPrix(h.budget)}</td>
                        <td className={`px-5 py-3 text-right font-medium ${dep ? 'text-red-600' : 'text-gray-900'}`}>{formatPrix(h.depense)}</td>
                        <td className="px-5 py-3 text-right text-gray-500">
                          {h.depense_reelle != null ? formatPrix(h.depense_reelle) : '—'}
                        </td>
                        <td className={`px-5 py-3 text-right font-bold ${h.economie >= 0 ? 'text-sauge-700' : 'text-red-600'}`}>
                          {h.economie >= 0 ? '+' : ''}{formatPrix(h.economie)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </DashboardShell>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────

// ─── Graphique des économies : 8 dernières semaines ──────────────────────

function SavingsChart({
  history,
}: {
  history: { semaine_debut: string; budget: number; depense: number; economie: number }[];
}) {
  if (history.length === 0) return null;

  // Échelle : le max entre la plus grosse dépense, le plus gros budget et 10 €
  const maxVal = Math.max(
    10,
    ...history.map(h => Math.max(h.depense, h.budget || 0))
  );

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-semibold text-gray-900">8 dernières semaines</h3>
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-xs bg-brand-500" /> Dépense</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-1.5 rounded-xs bg-gray-500" /> Budget</span>
        </div>
      </div>

      <div className="flex items-end justify-between gap-2 sm:gap-3" style={{ height: '160px' }}>
        {history.map(h => {
          const depassement = h.depense > h.budget;
          const depH = Math.max(2, Math.round((h.depense / maxVal) * 100));
          const budH = h.budget > 0 ? Math.max(2, Math.round((h.budget / maxVal) * 100)) : 0;
          return (
            <div key={h.semaine_debut} className="flex-1 flex flex-col items-center gap-2 h-full justify-end min-w-0"
              title={`${formatSemaine(h.semaine_debut)} — dépense ${formatPrix(h.depense)} / budget ${formatPrix(h.budget)} · économie ${formatPrix(h.economie)}`}>

              {/* Valeur de dépense au-dessus de la barre */}
              <span className={`text-[11px] font-semibold whitespace-nowrap ${depassement ? 'text-red-600' : 'text-brand-600'}`}>
                {h.depense.toFixed(0)} €
              </span>

              {/* Barres */}
              <div className="w-full max-w-[40px] flex flex-col justify-end items-center gap-0.5" style={{ height: '100%' }}>
                <div className={`w-full rounded-t-md transition-all ${depassement ? 'bg-red-400' : 'bg-brand-500'}`}
                  style={{ height: `${depH}%` }} />
                {budH > 0 && (
                  <div className="w-full rounded-b-md bg-gray-500" style={{ height: `${budH}%` }} />
                )}
              </div>

              {/* Label semaine */}
              <span className="text-[11px] text-gray-500 whitespace-nowrap">
                {formatDateLongueFr(h.semaine_debut, { day: 'numeric', month: 'short' })}
              </span>
            </div>
          );
        })}
      </div>

      {/* Total économisé sur la période */}
      {(() => {
        const totalEco = history.reduce((s, h) => s + h.economie, 0);
        if (totalEco <= 0) return null;
        return (
          <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between">
            <span className="text-sm text-gray-500">Total économisé sur la période</span>
            <span className="text-lg font-bold text-sauge-700">{formatPrix(totalEco)}</span>
          </div>
        );
      })()}
    </div>
  );
}

function prettyUnite(u: string): string {
  const labels: Record<string, string> = {
    kg: 'kg', L: 'L', pcs: 'pièce', botte: 'botte', boite: 'boîte', sachet: 'sachet', tranche: 'tranche',
  };
  return labels[u] || u;
}

function formatSemaine(iso: string): string {
  const start = new Date(iso);
  const end = new Date(iso);
  end.setDate(end.getDate() + 6);
  const fmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
  return `${fmt.format(start)} → ${fmt.format(end)}`;
}

function SparklesIcon() {
  return (
    <svg className="w-5 h-5 text-brand-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  );
}
