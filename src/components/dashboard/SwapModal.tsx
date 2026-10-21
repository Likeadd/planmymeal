'use client';

// ============================================================================
// SwapModal — remplacement d'un repas par une recette du catalogue COMPLET
// (extraite du dashboard, audit P3). Recherche, filtres adaptés au créneau
// (dessert → desserts only) et pagination « Afficher plus » : la liste porte
// sur toutes les recettes du site (/api/recettes, filtrées et paginées côté
// serveur), plus sur un échantillon aléatoire d'une dizaine de suggestions.
// Charte LANDING : titre serif, filtres pilules (terracotta actif, lavande
// pour les desserts), rangées crème chaudes, prix en sauge — aucun gris froid.
// ============================================================================

import { useState, useEffect, useRef } from 'react';
import { Clock, Loader2, Pencil, Plus, Search, Shuffle, Utensils, X } from 'lucide-react';
import type { RecetteSwap, RepasSlot, TypeRepas } from '@/types';
import type { MealCatalogue } from '@/lib/db-rows';
import { formatMinutes, formatCalories, familleDessert, titreRecette } from '@/lib/utils';
import { formatPrix, prixParPortion } from '@/lib/budget';

const SWAP_FILTERS: { value: TypeRepas | 'tous'; label: string }[] = [
  { value: 'plat', label: 'Plats' },
  { value: 'entree', label: 'Entrées' },
  { value: 'dessert', label: 'Desserts' },
  { value: 'petit_dejeuner', label: 'Petits-déjs' },
  { value: 'snack', label: 'Snacks' },
  { value: 'tous', label: 'Tout' },
];

/** Filtres express pour les créneaux dessert : yaourt / fruits / autres */
const DESSERT_EXPRESS_FILTERS = [
  { value: 'express', label: '⚡ Express (≤ 10 min)' },
  { value: 'yaourt', label: '🥛 Yaourt / fromage blanc' },
  { value: 'fruits', label: '🍓 Fruits' },
  { value: 'tous', label: '🍰 Tous les desserts' },
] as const;

type DessertExpressFilter = (typeof DESSERT_EXPRESS_FILTERS)[number]['value'];

/** Taille d'une page de la liste (« Afficher plus » ajoute la suivante) */
const TAILLE_PAGE = 24;

/** Filtres proposés dans la modal de swap selon le créneau */
function swapFiltersPour(repas: RepasSlot) {
  if (repas === 'dessert' || repas === 'dessert_midi') {
    return SWAP_FILTERS.filter(f => f.value === 'dessert' || f.value === 'tous');
  }
  return SWAP_FILTERS;
}

export function SwapModal({
  dayIndex, repas, dejaDansLaSemaine, swapping, onSelect, onCustom, onClose,
}: {
  dayIndex: number; repas: RepasSlot;
  /** Recettes déjà au menu cette semaine : signalées, pas masquées */
  dejaDansLaSemaine?: Set<number>;
  swapping: boolean;
  onSelect: (mealId: number) => void;
  /** Remplace le créneau par un texte libre (« Repas anniversaire »…) */
  onCustom: (texte: string) => void;
  onClose: () => void;
}) {
  const [texte, setTexte] = useState('');
  // Par défaut on ne propose que des plats (cohérence déjeuner/dîner) — sauf
  // créneau dessert (soir ou midi), qui ne propose que des desserts.
  const estSlotDessert = repas === 'dessert' || repas === 'dessert_midi';
  const [filter, setFilter] = useState<TypeRepas | 'tous'>(estSlotDessert ? 'dessert' : 'plat');
  // Filtre express additionnel sur les créneaux dessert (yaourt / fruits...)
  const [dessertFilter, setDessertFilter] = useState<DessertExpressFilter>(
    repas === 'dessert_midi' ? 'express' : 'tous'
  );
  const [recherche, setRecherche] = useState('');
  const [rechercheDifferee, setRechercheDifferee] = useState('');
  const [items, setItems] = useState<MealCatalogue[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [chargementPlus, setChargementPlus] = useState(false);
  const [erreur, setErreur] = useState(false);

  // Recherche différée : une requête par pause de frappe, pas par touche.
  useEffect(() => {
    const t = setTimeout(() => setRechercheDifferee(recherche.trim()), 250);
    return () => clearTimeout(t);
  }, [recherche]);

  /** Paramètres de la requête catalogue (sans offset) pour les critères courants */
  const construireParams = (offset: number) => {
    const q = new URLSearchParams({ tri: 'nom', offset: String(offset), limite: String(TAILLE_PAGE) });
    q.set('type', estSlotDessert ? 'dessert' : filter);
    // La recherche de l'utilisateur prime ; sinon les filtres yaourt / fruits servent de mot-clé
    const motCle = rechercheDifferee
      || (estSlotDessert && dessertFilter === 'yaourt' ? 'yaourt' : '')
      || (estSlotDessert && dessertFilter === 'fruits' ? 'fruit' : '');
    if (motCle) q.set('q', motCle);
    if (estSlotDessert && dessertFilter === 'express') q.set('tempsMax', '10');
    return q;
  };

  // Chaque changement de critère repart de la première page ; la requête
  // précédente encore en vol est annulée (pas de résultat périmé).
  const signature = construireParams(0).toString();
  const premiereCharge = useRef(true);
  useEffect(() => {
    const ctrl = new AbortController();
    void (async () => {
      // Premier rendu : `loading` vaut déjà true ; ensuite on le rallume ici (après un await-free départ asynchrone)
      if (!premiereCharge.current) setLoading(true);
      premiereCharge.current = false;
      setErreur(false);
      try {
        const res = await fetch(`/api/recettes?${signature}`, { signal: ctrl.signal });
        if (!res.ok) throw new Error();
        const json = await res.json() as { total: number; items: MealCatalogue[] };
        setItems(json.items);
        setTotal(json.total);
        setLoading(false);
      } catch {
        if (ctrl.signal.aborted) return;
        setItems([]);
        setTotal(0);
        setErreur(true);
        setLoading(false);
      }
    })();
    return () => ctrl.abort();
  }, [signature]);

  const afficherPlus = async () => {
    setChargementPlus(true);
    try {
      const res = await fetch(`/api/recettes?${construireParams(items.length)}`);
      if (!res.ok) throw new Error();
      const json = await res.json() as { total: number; items: MealCatalogue[] };
      setItems(prev => [...prev, ...json.items.filter(i => !prev.some(m => m.id === i.id))]);
      setTotal(json.total);
    } catch {
      setErreur(true);
    } finally {
      setChargementPlus(false);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    // Mobile : feuille ancrée en bas de l'écran (comme WhyModal/MealNotation) —
    // l'ancien centrage vertical + en-tête non fixe faisait disparaître le
    // titre et le bouton fermer dès qu'on faisait défiler les suggestions,
    // et le padding desktop (p-6) laissait peu de place utile sur petit écran.
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
      role="dialog" aria-modal="true" aria-label="Remplacer ce repas" data-jour={dayIndex}>
      <div className="absolute inset-0 bg-gray-900/30 backdrop-blur-xs" onClick={onClose} aria-hidden />

      <div className="animate-sheet-in relative w-full sm:max-w-lg bg-creme-50 rounded-t-3xl sm:rounded-3xl shadow-xl border border-gray-100 max-h-[85vh] overflow-y-auto">

        <div className="sticky top-0 z-10 bg-creme-50/95 backdrop-blur-sm px-5 pt-5 pb-3 border-b border-gray-100 flex items-center justify-between gap-3">
          <h3 className="font-display font-bold text-gray-900 text-lg flex items-center gap-2">
            <Shuffle className="w-5 h-5 text-brand-500" /> Remplacer ce repas
          </h3>
          <button onClick={onClose} aria-label="Fermer"
            className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500 shrink-0"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-5 py-4">
          {/* Repas libre : le créneau porte le texte de l'utilisateur (sans recette ni courses) */}
          <form onSubmit={e => { e.preventDefault(); if (texte.trim()) onCustom(texte.trim()); }}
            className="mb-5 rounded-2xl border border-accent-200 bg-accent-50/60 p-3">
            <label htmlFor="repas-libre" className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 mb-2">
              <Pencil className="w-4 h-4 text-accent-600" /> Ou écrivez votre propre repas
            </label>
            <div className="flex gap-2">
              <input id="repas-libre" value={texte} onChange={e => setTexte(e.target.value)} maxLength={80}
                placeholder="Repas anniversaire, Apéro dinatoire…"
                className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-accent-300" />
              <button type="submit" disabled={swapping || !texte.trim()}
                className="shrink-0 rounded-xl bg-accent-500 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                Valider
              </button>
            </div>
            <p className="mt-1.5 text-xs text-gray-500">Aucun ingrédient ajouté à la liste de courses pour ce repas.</p>
          </form>

          {/* Recherche dans tout le catalogue */}
          <label className="relative block mb-3">
            <span className="sr-only">Rechercher une recette</span>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden />
            <input type="search" value={recherche} onChange={e => setRecherche(e.target.value)}
              placeholder="Rechercher un plat ou un ingrédient…"
              className="w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-300" />
          </label>

          {/* Filtre par type de repas (adapté au créneau) */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {swapFiltersPour(repas).map(f => (
              <button key={f.value} onClick={() => setFilter(f.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${filter === f.value
                  ? 'bg-brand-500 text-white shadow-xs'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-brand-50 hover:text-brand-600'}`}>
                {f.label}
              </button>
            ))}
          </div>

          {/* Filtres express dessert : yaourt / fruits / autres types */}
          {estSlotDessert && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {DESSERT_EXPRESS_FILTERS.map(f => (
                <button key={f.value} onClick={() => setDessertFilter(f.value)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${dessertFilter === f.value
                    ? 'bg-accent-500 text-white shadow-xs'
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-accent-50 hover:text-accent-600'}`}>
                  {f.label}
                </button>
              ))}
            </div>
          )}

          <p className="text-sm text-gray-500 mb-4" aria-live="polite">
            {loading ? 'Chargement des recettes…'
              : `${total.toLocaleString('fr-FR')} recette${total > 1 ? 's' : ''} — choisissez-en une :`}
          </p>

          {loading ? (
            <div className="py-10 text-center">
              <Loader2 className="w-6 h-6 text-brand-400 animate-spin mx-auto" />
            </div>
          ) : erreur && items.length === 0 ? (
            <div className="py-10 text-center text-gray-500">
              <Utensils className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Chargement des recettes impossible — réessayez dans un instant.</p>
            </div>
          ) : items.length === 0 ? (
            <div className="py-10 text-center text-gray-500">
              <Utensils className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Aucune recette trouvée — essayez un autre filtre ou une autre recherche.</p>
            </div>
          ) : (
            <>
              <div className="grid sm:grid-cols-2 gap-2">
                {items.map(meal => {
                  // Les desserts affichent leur famille (yaourt, compote,
                  // pâtisserie...) : repère visuel immédiat pour choisir.
                  const famille = estSlotDessert ? familleDessert(meal as unknown as RecetteSwap) : null;
                  const prix = prixParPortion(meal);
                  const dejaLa = dejaDansLaSemaine?.has(meal.id) ?? false;
                  return (
                    <button key={meal.id} onClick={() => onSelect(meal.id)} disabled={swapping}
                      className="w-full text-left p-3 rounded-2xl border border-gray-200 bg-white hover:border-brand-300 hover:bg-brand-50/50 hover:shadow-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium text-gray-900 text-sm flex items-center gap-1.5">
                          {famille && <span aria-hidden>{famille.emoji}</span>}
                          <span className="truncate">{titreRecette(meal.titre)}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-500 mt-1 flex-wrap">
                          {famille && (
                            <span className="px-1.5 py-0.5 rounded-full bg-accent-50 text-accent-700 font-medium">{famille.label}</span>
                          )}
                          <span><Clock className="w-3 h-3 inline mr-0.5" />{formatMinutes(meal.temps_preparation + (meal.temps_cuisson || 0))}</span>
                          <span>{formatCalories(meal.calories_par_portion)}</span>
                          {prix != null && <span className="font-semibold text-sauge-700 bg-sauge-100 px-1.5 py-0.5 rounded-full">{formatPrix(prix)}</span>}
                          {dejaLa && <span className="px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">Déjà au menu</span>}
                        </div>
                      </div>
                      <Plus className="w-4 h-4 text-brand-400 shrink-0 mt-0.5" />
                    </button>
                  );
                })}
              </div>

              {items.length < total && (
                <button onClick={afficherPlus} disabled={chargementPlus}
                  className="mt-4 w-full min-h-[44px] rounded-full border border-gray-200 bg-white text-sm font-semibold text-gray-800 hover:border-brand-300 hover:text-brand-600 disabled:opacity-60 transition-colors">
                  {chargementPlus
                    ? <Loader2 className="w-4 h-4 animate-spin mx-auto" aria-label="Chargement" />
                    : `Afficher plus (${(total - items.length).toLocaleString('fr-FR')} restantes)`}
                </button>
              )}
              {erreur && <p className="mt-2 text-center text-xs text-red-600">Chargement des recettes suivantes impossible.</p>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
