'use client';

// ============================================================================
// Catalogue de recettes — /recettes
//
// Performance : pagination, filtres et tris sont faits CÔTÉ SERVEUR
// (`/api/recettes`, index en mémoire — voir lib/catalogue-index.ts). Le
// navigateur ne reçoit que 48 cartes à la fois (≈ 60 ko) au lieu des ≈ 10 Mo du
// catalogue entier ; « Afficher plus » demande la tranche suivante. Squelette
// pendant la première réponse. Le compteur du sous-titre reste le catalogue
// ENTIER (un test e2e le vérifie).
//
// Filtres : type, recherche (titre + ingrédients, insensible aux accents),
// équipement, difficulté, cuisine, saison, temps total max, calories max,
// prix max / portion, batch cooking (conservation ≥ 3 j) et régimes
// (multi-sélection, mêmes règles que le moteur via `recetteServable`).
// Tris : nom, temps, calories, prix et protéines (seule macro chargée —
// le tri « le plus protéiné » lit `proteines`, les autres macros restent
// exclues du select).
// ============================================================================

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Clock, Flame, ChefHat as ChefIcon, AlertTriangle,
  BookOpen, Package, Search, UtensilsCrossed, ArrowUpDown,
  SlidersHorizontal, ChevronDown, Beef,
} from 'lucide-react';
import type { TypeRepas, Equipement, Saison, Regime } from '@/types';
import { EQUIPEMENTS } from '@/types';
import type { MealCatalogue } from '@/lib/db-rows';
import { formatMinutes, formatCalories, formatTypeRepas, titreRecette, emojiRecette } from '@/lib/utils';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DemandeRecette } from '@/components/DemandeRecette';
import { FamilleBadges } from '@/components/dashboard/FamilleBadges';
import { recetteHref } from '@/lib/seo';
import { CATEGORIES_SEO } from '@/lib/categories-seo';

const TYPE_FILTERS: { value: TypeRepas | 'tous'; label: string }[] = [
  { value: 'tous', label: 'Tout' },
  { value: 'plat', label: 'Plats' },
  { value: 'entree', label: 'Entrées' },
  { value: 'dessert', label: 'Desserts' },
  { value: 'petit_dejeuner', label: 'Petits-déjs' },
  { value: 'snack', label: 'Snacks' },
];

/** Critères de tri du catalogue */
type TriChamp = 'idees' | 'nom' | 'temps' | 'calories' | 'prix' | 'proteines';
const TRI_OPTIONS: { value: TriChamp; label: string }[] = [
  { value: 'idees', label: 'Idées de la semaine' },
  { value: 'nom', label: 'A → Z' },
  { value: 'temps', label: 'Le plus rapide' },
  { value: 'calories', label: 'Le moins calorique' },
  { value: 'prix', label: 'Le moins cher' },
  { value: 'proteines', label: 'Le plus protéiné' },
];

/** En dessous de ce nombre de recettes, un filtre n'est pas proposé (bruit) */
const SEUIL_FILTRE = 10;

const DIFFICULTES: { value: 'toutes' | 'facile' | 'moyen' | 'difficile'; label: string }[] = [
  { value: 'toutes', label: 'Toutes difficultés' },
  { value: 'facile', label: 'Facile' },
  { value: 'moyen', label: 'Moyen' },
  { value: 'difficile', label: 'Difficile' },
];

/** Filtre saison : correspondance EXACTE (une recette « toutes saisons » ne se
 *  déclare ni été ni hiver — l'afficher sous « Été » rendrait le filtre muet). */
const SAISONS_FILTRES: { value: Saison | 'toutes'; label: string }[] = [
  { value: 'toutes', label: 'Toutes saisons' },
  { value: 'printemps', label: 'Printemps 🌸' },
  { value: 'ete', label: 'Été ☀️' },
  { value: 'automne', label: 'Automne 🍂' },
  { value: 'hiver', label: 'Hiver ❄️' },
];

/** Temps total (préparation + cuisson) maximum */
const TEMPS_MAX_OPTIONS: { value: number; label: string }[] = [
  { value: 15, label: '≤ 15 min' },
  { value: 30, label: '≤ 30 min' },
  { value: 45, label: '≤ 45 min' },
  { value: 60, label: '≤ 1 h' },
];

/** Calories par portion maximum */
const KCAL_MAX_OPTIONS: { value: number; label: string }[] = [
  { value: 300, label: '≤ 300 kcal' },
  { value: 500, label: '≤ 500 kcal' },
  { value: 750, label: '≤ 750 kcal' },
];

/** Prix par portion maximum */
const PRIX_MAX_OPTIONS: { value: number; label: string }[] = [
  { value: 2, label: '≤ 2 €' },
  { value: 3, label: '≤ 3 €' },
  { value: 5, label: '≤ 5 €' },
];

/** Régimes filtrables — mêmes règles ingrédient que le moteur (lib/regimes.ts). */
const REGIMES_FILTRES: { value: Regime; label: string }[] = [
  { value: 'vegetarien', label: 'Végétarien 🥬' },
  { value: 'vegan', label: 'Vegan 🌱' },
  { value: 'pesco_vegetarien', label: 'Pescétarien 🐟' },
  { value: 'sans_gluten', label: 'Sans gluten 🌾' },
  { value: 'sans_lactose', label: 'Sans lactose 🥛' },
  { value: 'sans_porc', label: 'Sans porc 🐷' },
  { value: 'halal', label: 'Halal 🕌' },
  { value: 'sans_alcool', label: 'Sans alcool 🚫' },
  { value: 'keto', label: 'Keto 🥑' },
  { value: 'low_carb', label: 'Low carb 🥩' },
  { value: 'paleo', label: 'Paléo 🍖' },
  { value: 'sans_sucre_ajoute', label: 'Sans sucre ajouté 🍬' },
];

/** Taille d'une tranche de grille rendue (« Afficher plus ») */
const TRANCHE_GRILLE = 48;
/** Seuil de conservation (jours) du filtre batch cooking */
const BATCH_MIN_JOURS = 3;
/**
 * Seuil « riche en protéines » (g par portion). Volontairement bas : c'est un
 * filtre DE CHOPPING (« montre-moi ce qui cale »), pas un label nutritionnel.
 * Les données réelles font le tri — la puce affiche son compteur, et les
 * recettes sans valeur sont exclues comme pour les autres seuils.
 */
const PROTEINES_MIN_G = 25;

/** Compteurs globaux des filtres, renvoyés par l'API (voir `Facettes` côté serveur) */
export interface Facettes {
  total: number;
  cuisines: string[];
  types: Record<string, number>;
  equipements: Record<string, number>;
  temps: Record<number, number>;
  kcal: Record<number, number>;
  prix: Record<number, number>;
  batch: number;
  proteines: number;
  regimes: Record<string, number>;
}

/** Puce de filtre (mêmes couleurs que les rangées de type / équipement) */
function PuceFiltre({
  actif, onClick, children, compteur,
}: {
  actif: boolean;
  onClick: () => void;
  children: React.ReactNode;
  compteur?: number;
}) {
  return (
    <button onClick={onClick}
      className={`inline-flex items-center min-h-[40px] px-4 py-2 text-xs font-medium rounded-full border transition-colors ${actif
        ? 'bg-brand-500 text-white border-brand-500 shadow-xs'
        : 'bg-white text-gray-600 border-gray-200 hover:border-brand-300 hover:text-brand-600'}`}>
      {children}
      {compteur != null && (
        <span className={`ml-1 ${actif ? 'text-white/70' : 'text-gray-500'}`}>({compteur})</span>
      )}
    </button>
  );
}

/** Groupe libellé du panneau de filtres avancés */
function GroupeFiltre({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1.5">{label}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

/** Carte fantôme du squelette de chargement */
function CarteSquelette() {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden animate-pulse" aria-hidden>
      <div className="bg-brand-50/60 h-32" />
      <div className="p-4 space-y-3">
        <div className="h-4 bg-gray-100 rounded-full w-3/4" />
        <div className="h-3 bg-gray-100 rounded-full w-1/2" />
        <div className="flex gap-2">
          <div className="h-5 bg-gray-100 rounded-full w-16" />
          <div className="h-5 bg-gray-100 rounded-full w-14" />
        </div>
        <div className="h-9 bg-gray-100 rounded-full w-full mt-5!" />
      </div>
    </div>
  );
}

/** Première tranche du catalogue (tri par défaut, sans filtre), rendue côté serveur. */
export interface CatalogueInitial { total: number; items: MealCatalogue[]; facettes: Facettes }

// Signature de la tranche serveur (tri par défaut, sans filtre). Lien avec
// filtres (?cuisine=…) : signature différente → rechargement via l'API.
const SIGNATURE_SERVEUR = new URLSearchParams({ tri: 'idees', offset: '0', limite: String(TRANCHE_GRILLE) }).toString();

export default function RecettesClient({ initial }: { initial: CatalogueInitial | null }) {
  const [meals, setMeals] = useState<MealCatalogue[]>(initial?.items ?? []);
  const [total, setTotal] = useState(initial?.total ?? 0);
  const [facettes, setFacettes] = useState<Facettes | null>(initial?.facettes ?? null);
  const [loading, setLoading] = useState(!initial);
  const [chargementPlus, setChargementPlus] = useState(false);
  const [error, setError] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeRepas | 'tous'>('tous');
  const [search, setSearch] = useState('');
  const [equipementFilter, setEquipementFilter] = useState<Equipement | 'tous'>('tous');
  const [tri, setTri] = useState<TriChamp>('idees');
  const [difficulteFilter, setDifficulteFilter] = useState<'toutes' | 'facile' | 'moyen' | 'difficile'>('toutes');
  const [saisonFilter, setSaisonFilter] = useState<Saison | 'toutes'>('toutes');
  // Liens directs depuis la landing et les pages catégories SEO (/recettes/categorie/*) :
  // /recettes?cuisine=X&prixMax=2&tempsMax=30&batch=1&proteines=1&regime=vegetarien
  // Lecture paresseuse (une seule fois) — sans risque d'hydration mismatch :
  // les filtres avancés ne se rendent qu'après chargement des données côté client.
  const paramsInitiaux = (): URLSearchParams =>
    typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search);
  const [tempsMax, setTempsMax] = useState<number | null>(() => {
    const v = Number(paramsInitiaux().get('tempsMax'));
    return v > 0 ? v : null;
  });
  const [kcalMax, setKcalMax] = useState<number | null>(null);
  const [prixMax, setPrixMax] = useState<number | null>(() => {
    const v = Number(paramsInitiaux().get('prixMax'));
    return v > 0 ? v : null;
  });
  const [batchOnly, setBatchOnly] = useState(() => paramsInitiaux().get('batch') === '1');
  const [proteinesOnly, setProteinesOnly] = useState(() => paramsInitiaux().get('proteines') === '1');
  const [regimes, setRegimes] = useState<Regime[]>(() => {
    const r = paramsInitiaux().get('regime');
    return r ? [r as Regime] : [];
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [cuisineFilter, setCuisineFilter] = useState<string>(() => paramsInitiaux().get('cuisine') ?? 'toutes');

  const [recherche, setRecherche] = useState('');

  // Recherche différée : une requête par pause de frappe, pas par touche.
  useEffect(() => {
    const t = setTimeout(() => setRecherche(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  const construireParams = (offset: number) => {
    const q = new URLSearchParams({ tri, offset: String(offset), limite: String(TRANCHE_GRILLE) });
    if (typeFilter !== 'tous') q.set('type', typeFilter);
    if (recherche) q.set('q', recherche);
    if (equipementFilter !== 'tous') q.set('equipement', equipementFilter);
    if (difficulteFilter !== 'toutes') q.set('difficulte', difficulteFilter);
    if (cuisineFilter !== 'toutes') q.set('cuisine', cuisineFilter);
    if (saisonFilter !== 'toutes') q.set('saison', saisonFilter);
    if (tempsMax != null) q.set('tempsMax', String(tempsMax));
    if (kcalMax != null) q.set('kcalMax', String(kcalMax));
    if (prixMax != null) q.set('prixMax', String(prixMax));
    if (batchOnly) q.set('batch', '1');
    if (proteinesOnly) q.set('proteines', '1');
    if (regimes.length > 0) q.set('regimes', regimes.join(','));
    return q;
  };

  // Chaque changement de filtre / tri repart de la première tranche. La
  // requête précédente encore en vol est annulée (pas de résultat périmé).
  const signature = construireParams(0).toString();
  // Tranche déjà rendue par le serveur : pas de requête en double au montage.
  const signatureServeur = initial ? SIGNATURE_SERVEUR : null;
  useEffect(() => {
    if (signature === signatureServeur) return;
    const ctrl = new AbortController();
    (async () => {
      setError('');
      try {
        const res = await fetch(`/api/recettes?${signature}`, { signal: ctrl.signal });
        if (!res.ok) throw new Error('Chargement du catalogue impossible.');
        const json = await res.json() as { total: number; items: MealCatalogue[]; facettes?: Facettes };
        setMeals(json.items);
        setTotal(json.total);
        if (json.facettes) setFacettes(json.facettes);
        setLoading(false);
      } catch (e) {
        if (ctrl.signal.aborted) return;
        setError(e instanceof Error ? e.message : 'Chargement du catalogue impossible.');
        setLoading(false);
      }
    })();
    return () => ctrl.abort();
  }, [signature, signatureServeur]);

  const afficherPlus = async () => {
    setChargementPlus(true);
    try {
      const res = await fetch(`/api/recettes?${construireParams(meals.length)}`);
      if (!res.ok) throw new Error();
      const json = await res.json() as { total: number; items: MealCatalogue[] };
      setMeals(prev => [...prev, ...json.items.filter(i => !prev.some(m => m.id === i.id))]);
      setTotal(json.total);
    } catch {
      setError('Chargement des recettes suivantes impossible.');
    } finally {
      setChargementPlus(false);
    }
  };

  const cuisines = facettes?.cuisines ?? [];
  const visibles = meals;
  const compteTemps = (v: number) => facettes?.temps[v] ?? 0;
  const compteKcal = (v: number) => facettes?.kcal[v] ?? 0;
  const comptePrix = (v: number) => facettes?.prix[v] ?? 0;
  const compteurBatch = facettes?.batch ?? 0;
  const compteurProteines = facettes?.proteines ?? 0;

  const nbFiltresAvances =
    (tempsMax != null ? 1 : 0) + (kcalMax != null ? 1 : 0) + (prixMax != null ? 1 : 0) +
    (batchOnly ? 1 : 0) + (proteinesOnly ? 1 : 0) + regimes.length +
    (equipementFilter !== 'tous' ? 1 : 0) + (difficulteFilter !== 'toutes' ? 1 : 0) + (saisonFilter !== 'toutes' ? 1 : 0);
  const nbFiltresActifs = nbFiltresAvances
    + (typeFilter !== 'tous' ? 1 : 0) + (search.trim() ? 1 : 0) + (cuisineFilter !== 'toutes' ? 1 : 0);

  const reinitialiser = () => {
    setTypeFilter('tous');
    setSearch('');
    setEquipementFilter('tous');
    setDifficulteFilter('toutes');
    setCuisineFilter('toutes');
    setSaisonFilter('toutes');
    setTempsMax(null);
    setKcalMax(null);
    setPrixMax(null);
    setBatchOnly(false);
    setProteinesOnly(false);
    setRegimes([]);
  };

  const basculerRegime = (r: Regime) => {
    setRegimes(prev => (prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]));
  };

  return (
    <DashboardShell>
      <div className="container-app py-8">
        {/* Titre */}
        <div className="mb-8">
          {/* Icône dans une pastille alignée sur la hauteur de la ligne :
              un simple flex items-center centre le texte sur la boîte de
              l'icône et faisait « flotter » le titre au-dessus de la marge
              du paragraphe en dessous. */}
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-2xl bg-brand-50 flex items-center justify-center shrink-0" aria-hidden>
              <BookOpen className="w-5 h-5 text-brand-500" />
            </span>
            <h1 className="font-display text-3xl font-bold text-gray-900 tracking-tight">Catalogue de recettes</h1>
          </div>
          <p className="text-gray-500 mt-2">
            {loading
              ? 'Chargement du catalogue...'
              : `${facettes?.total ?? 0} recette${(facettes?.total ?? 0) > 1 ? 's' : ''} · Parcourez tout le catalogue et cliquez pour voir le détail`}
          </p>
          {/* Sélections prêtes à l'emploi (pages catégories) */}
          <div className="mt-3 -mx-4 px-4 sm:mx-0 sm:px-0 flex gap-2 overflow-x-auto sm:flex-wrap [scrollbar-width:none]">
            {CATEGORIES_SEO.map(cat => (
              <Link key={cat.slug} href={`/recettes/categorie/${cat.slug}`}
                className="shrink-0 inline-flex items-center min-h-[40px] text-xs font-semibold px-3.5 py-1.5 rounded-full bg-white border border-gray-200 text-gray-600 hover:border-brand-300 hover:text-brand-600 transition-colors">
                {cat.court}
              </Link>
            ))}
            <DemandeRecette className="shrink-0" />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center mb-8">
            <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-3" />
            <p className="text-red-700 font-medium">{error}</p>
          </div>
        )}

        {/* Chargement : squelette (aucun écran vide avant la première donnée) */}
        {loading && !error && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" aria-busy="true">
            {Array.from({ length: 8 }, (_, i) => <CarteSquelette key={i} />)}
          </div>
        )}

        {/* Filtres */}
        {!error && !loading && facettes && (
          <>
            <div className="relative mb-3 max-w-md" data-tour="recettes-recherche">
              <Search className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher un plat ou un ingrédient..."
                className="w-full pl-10 pr-4 py-3 text-base sm:text-sm bg-white border border-gray-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-brand-300 focus:border-brand-300 placeholder:text-gray-400"
              />
            </div>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {TYPE_FILTERS.map(f => {
                const count = f.value === 'tous' ? facettes.total : (facettes.types[f.value] ?? 0);
                if (f.value !== 'tous' && count < SEUIL_FILTRE && typeFilter !== f.value) return null;
                return (
                  <button key={f.value} onClick={() => setTypeFilter(f.value)}
                  className={`inline-flex items-center min-h-[40px] px-4 py-2 text-xs font-medium rounded-full transition-colors ${typeFilter === f.value
                    ? 'bg-brand-500 text-white shadow-xs'
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-brand-50 hover:text-brand-600'}`}>
                    {f.label}
                    <span className={`ml-1 ${typeFilter === f.value ? 'text-white/70' : 'text-gray-500'}`}>({count})</span>
                  </button>
                );
              })}
            </div>

            {/* Tri + difficulté + cuisine + saison + panneau avancé */}
            <div className="flex flex-wrap items-center gap-2 mb-3" data-tour="recettes-filtres">
              {/* Tri */}
              <label className="inline-flex items-center gap-1.5 text-xs text-gray-500">
                <ArrowUpDown className="w-3.5 h-3.5 text-gray-500" />
                <span className="font-semibold uppercase tracking-wide text-[11px]">Trier :</span>
                <select value={tri} onChange={e => setTri(e.target.value as TriChamp)}
                  className="text-xs font-medium bg-white border border-gray-200 rounded-full px-4 min-h-[40px] py-2 focus:outline-hidden focus:ring-2 focus:ring-brand-300 cursor-pointer">
                  {TRI_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>

              {/* Cuisine */}
              {cuisines.length > 1 && (
                <select value={cuisineFilter} onChange={e => setCuisineFilter(e.target.value)}
                  className="text-xs font-medium bg-white border border-gray-200 rounded-full px-4 min-h-[40px] py-2 focus:outline-hidden focus:ring-2 focus:ring-brand-300 cursor-pointer">
                  <option value="toutes">Toutes cuisines</option>
                  {cuisines.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              )}

              {/* Panneau avancé (temps, calories, prix, batch, régimes) */}
              <button onClick={() => setShowAdvanced(v => !v)} aria-expanded={showAdvanced}
                className={`inline-flex items-center gap-1.5 px-4 min-h-[40px] py-2 text-xs font-semibold rounded-full border transition-colors ${showAdvanced || nbFiltresAvances > 0
                  ? 'bg-brand-500 text-white border-brand-500 shadow-xs'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-brand-300 hover:text-brand-600'}`}>
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Plus de filtres
                {nbFiltresAvances > 0 && (
                  <span className="px-1.5 py-0.5 text-[11px] leading-none font-bold bg-white text-brand-600 rounded-full">
                    {nbFiltresAvances}
                  </span>
                )}
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
              </button>

              {/* Réinitialisation globale (dès qu'UN filtre est actif) */}
              {nbFiltresActifs > 0 && (
                <button onClick={reinitialiser}
                  className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-brand-600 transition-colors underline underline-offset-2 decoration-gray-300">
                  Tout réinitialiser
                </button>
              )}

              {/* Compteur résultats */}
              <span className="ml-auto text-xs text-gray-500">{total} résultat{total > 1 ? 's' : ''}</span>
            </div>

            {/* Panneau de filtres avancés */}
            {showAdvanced && (
              <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-3 space-y-4">
                <GroupeFiltre label="Appareil">
            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => setEquipementFilter('tous')}
                className={`inline-flex items-center min-h-[40px] px-4 py-2 text-xs font-medium rounded-full border transition-colors ${equipementFilter === 'tous'
                  ? 'bg-accent-500 text-white border-accent-500 shadow-xs'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-accent-300 hover:text-accent-600'}`}>
                🍳 Tout appareil
              </button>
              {EQUIPEMENTS.map(eq => {
                const count = facettes.equipements[eq] ?? 0;
                if (count < SEUIL_FILTRE && equipementFilter !== eq) return null;
                return (
                  <button key={eq} onClick={() => setEquipementFilter(eq)}
                  className={`inline-flex items-center min-h-[40px] px-4 py-2 text-xs font-medium rounded-full border transition-colors ${equipementFilter === eq
                    ? 'bg-accent-500 text-white border-accent-500 shadow-xs'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-accent-300 hover:text-accent-600'}`}>
                    {eq} <span className={`ml-0.5 ${equipementFilter === eq ? 'text-white/60' : 'text-gray-500'}`}>({count})</span>
                  </button>
                );
              })}
            </div>

                </GroupeFiltre>

                <div className="flex flex-wrap gap-2">
              {/* Difficulté */}
              <select value={difficulteFilter} onChange={e => setDifficulteFilter(e.target.value as typeof difficulteFilter)}
                className="text-xs font-medium bg-white border border-gray-200 rounded-full px-4 min-h-[40px] py-2 focus:outline-hidden focus:ring-2 focus:ring-brand-300 cursor-pointer">
                {DIFFICULTES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>

              {/* Saison */}
              <select value={saisonFilter} onChange={e => setSaisonFilter(e.target.value as Saison | 'toutes')}
                className="text-xs font-medium bg-white border border-gray-200 rounded-full px-4 min-h-[40px] py-2 focus:outline-hidden focus:ring-2 focus:ring-brand-300 cursor-pointer">
                {SAISONS_FILTRES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>

                </div>

                <GroupeFiltre label="Prêt en (préparation + cuisson)">
                  {TEMPS_MAX_OPTIONS.map(o => (
                    <PuceFiltre key={o.value} actif={tempsMax === o.value}
                      onClick={() => setTempsMax(prev => (prev === o.value ? null : o.value))}
                      compteur={compteTemps(o.value)}>
                      {o.label}
                    </PuceFiltre>
                  ))}
                </GroupeFiltre>

                <GroupeFiltre label="Calories par portion">
                  {KCAL_MAX_OPTIONS.map(o => (
                    <PuceFiltre key={o.value} actif={kcalMax === o.value}
                      onClick={() => setKcalMax(prev => (prev === o.value ? null : o.value))}
                      compteur={compteKcal(o.value)}>
                      {o.label}
                    </PuceFiltre>
                  ))}
                </GroupeFiltre>

                <GroupeFiltre label="Prix par portion">
                  {PRIX_MAX_OPTIONS.map(o => (
                    <PuceFiltre key={o.value} actif={prixMax === o.value}
                      onClick={() => setPrixMax(prev => (prev === o.value ? null : o.value))}
                      compteur={comptePrix(o.value)}>
                      {o.label}
                    </PuceFiltre>
                  ))}
                </GroupeFiltre>

                <GroupeFiltre label="Batch cooking">
                  <PuceFiltre actif={batchOnly} onClick={() => setBatchOnly(v => !v)} compteur={compteurBatch}>
                    <Package className="w-3 h-3 inline -mt-0.5 mr-1" />
                    Se conserve {BATCH_MIN_JOURS} j et +
                  </PuceFiltre>
                </GroupeFiltre>

                <GroupeFiltre label="Protéines par portion">
                  <PuceFiltre actif={proteinesOnly} onClick={() => setProteinesOnly(v => !v)} compteur={compteurProteines}>
                    <Beef className="w-3 h-3 inline -mt-0.5 mr-1" />
                    Riche en protéines (≥ {PROTEINES_MIN_G} g)
                  </PuceFiltre>
                </GroupeFiltre>

                <GroupeFiltre label="Régimes (cumulables)">
                  {REGIMES_FILTRES.map(r => (
                    <PuceFiltre key={r.value} actif={regimes.includes(r.value)}
                      onClick={() => basculerRegime(r.value)}
                      compteur={facettes?.regimes[r.value] ?? 0}>
                      {r.label}
                    </PuceFiltre>
                  ))}
                </GroupeFiltre>
              </div>
            )}

          </>
        )}

        {/* Aucun résultat */}
        {!error && !loading && facettes && total === 0 && (
          <div className="text-center py-16">
            <UtensilsCrossed className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 mb-4">
              {recherche ? `Aucune recette (ni ingrédient) ne correspond à « ${recherche} ».` : 'Aucune recette ne correspond à ces filtres.'}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <button onClick={reinitialiser}
                className="px-4 py-2 text-sm font-medium text-brand-600 bg-brand-50 rounded-full hover:bg-brand-100 transition-colors">
                Tout réinitialiser
              </button>
              <DemandeRecette titreInitial={recherche} libelle="Demander cette recette" />
            </div>
          </div>
        )}

        {/* Grille de recettes — rendue par tranches (1 100+ cartes d'un coup
            coûtaient des centaines de ms de render pur pour rien) */}
        {!error && !loading && visibles.length > 0 && (
          <>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {visibles.map((meal, idx) => (
                <div key={meal.id} data-reveal style={{ '--i': idx % 4 } as React.CSSProperties}
                  className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-lg hover:border-brand-200 transition-all group">
                  {/* Illustration : emoji selon le type de recette (plus de photos) */}
                  <div className="bg-brand-50 h-32 flex items-center justify-center overflow-hidden">
                    <span className="w-14 h-14 rounded-2xl bg-white shadow-xs flex items-center justify-center text-3xl transition-transform duration-300 group-hover:scale-110">
                      {emojiRecette(meal.titre, meal.type_repas)}
                    </span>
                  </div>

                  <div className="p-4">
                    <Link href={recetteHref(meal)}>
                    <h3 className="font-semibold text-gray-900 text-sm mb-2 group-hover:text-brand-600 transition-colors line-clamp-2 min-h-10">
                      {titreRecette(meal.titre)}
                    </h3>
                  </Link>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 mb-4">
                      <span className="flex items-center gap-1 whitespace-nowrap"><Clock className="w-3 h-3" /> {formatMinutes(meal.temps_preparation + (meal.temps_cuisson || 0))}</span>
                      <span className="flex items-center gap-1 whitespace-nowrap"><Flame className="w-3 h-3" /> {formatCalories(meal.calories_par_portion)}</span>
                      {meal.proteines != null && (
                        <span className="flex items-center gap-1 whitespace-nowrap" title="Protéines par portion">
                          <Beef className="w-3 h-3" /> {Math.round(meal.proteines)} g
                        </span>
                      )}
                      <span className="flex items-center gap-1 whitespace-nowrap"><ChefIcon className="w-3 h-3" /> {meal.difficulte}</span>
                    </div>

                    {/* Badges */}
                    <div className="flex flex-wrap gap-1 mb-4">
                      <span className={`px-2 py-0.5 text-[11px] rounded-full border font-medium ${
                        meal.type_repas === 'dessert'
                          ? 'bg-sauge-100 text-sauge-700 border-sauge-200'
                          : 'bg-brand-50 text-brand-600 border-brand-100'
                      }`}>
                        {formatTypeRepas(meal.type_repas)}
                      </span>
                      {meal.cuisine && (
                        <span className="px-2 py-0.5 text-[11px] bg-gray-50 text-gray-500 rounded-full border border-gray-200">
                          {meal.cuisine}
                        </span>
                      )}
                      {meal.conservation_jours && meal.conservation_jours >= 3 && (
                        <span className="px-2 py-0.5 text-[11px] bg-sauge-100 text-sauge-700 rounded-full border border-sauge-200 flex items-center gap-0.5">
                          <Package className="w-2.5 h-2.5" /> {meal.conservation_jours}j
                        </span>
                      )}
                      {/* Avis de chaque membre du foyer (rien si foyer sans membre) */}
                      <FamilleBadges meal={meal} libelle="Foyer" />
                    </div>

                    <Link href={recetteHref(meal)}
                      className="block w-full text-center px-4 py-2.5 text-sm font-medium text-brand-600 bg-brand-50 rounded-full hover:bg-brand-100 transition-colors">
                      Voir la recette
                    </Link>
                  </div>
                </div>
              ))}
            </div>

            {/* Afficher plus : la tranche suivante de la grille */}
            {total > visibles.length && (
              <div className="text-center mt-8">
                <button onClick={afficherPlus} disabled={chargementPlus}
                  className="px-6 py-2.5 text-sm font-semibold text-brand-600 bg-white border border-brand-200 rounded-full hover:bg-brand-50 transition-colors disabled:opacity-60">
                  {chargementPlus ? 'Chargement…' : `Afficher plus (${total - visibles.length} restante${total - visibles.length > 1 ? 's' : ''})`}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardShell>
  );
}
