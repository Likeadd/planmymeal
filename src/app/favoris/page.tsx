'use client';

import { errorMessage } from '@/lib/utils';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Star, Clock, Flame, ChefHat as ChefIcon, Loader2, AlertTriangle,
  ArrowLeft, Plus, X, Check, Package,
} from 'lucide-react';
import type { RecetteFavori, TypeRepas } from '@/types';
import { useFavorites } from '@/lib/useFavorites';
import { formatMinutes, formatCalories, formatTypeRepas, titreMajuscules } from '@/lib/utils';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { FamilleBadges } from '@/components/dashboard/FamilleBadges';
import { JOURS_NOMS } from '@/lib/dates';


const TYPE_FILTERS: { value: TypeRepas | 'tous'; label: string }[] = [
  { value: 'tous', label: 'Tout' },
  { value: 'plat', label: 'Plats' },
  { value: 'entree', label: 'Entrées' },
  { value: 'dessert', label: 'Desserts' },
  { value: 'petit_dejeuner', label: 'Petits-déjs' },
  { value: 'snack', label: 'Snacks' },
];

type SortKey = 'defaut' | 'temps' | 'calories' | 'type';
const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'defaut', label: 'Défaut' },
  { value: 'temps', label: '⏱ Temps' },
  { value: 'calories', label: '🔥 Calories' },
  { value: 'type', label: '🏷 Type' },
];

/** Ordre de regroupement pour le tri par type */
const TYPE_ORDER: Record<string, number> = {
  plat: 0, entree: 1, dessert: 2, petit_dejeuner: 3, snack: 4,
};

export default function FavorisPage() {
  const { favorites, loading, error, addToPlanning, adding } = useFavorites();
  const [addModal, setAddModal] = useState<RecetteFavori | null>(null);
  const [selectedDay, setSelectedDay] = useState<number>(0);
  const [selectedRepas, setSelectedRepas] = useState<'dejeuner' | 'diner'>('dejeuner');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<TypeRepas | 'tous'>('tous');
  const [sortKey, setSortKey] = useState<SortKey>('defaut');
  const [sortAsc, setSortAsc] = useState(true);
  const reduceMotion = useReducedMotion();

  /** Clic sur un tri : si déjà actif, on inverse la direction */
  const handleSort = (key: SortKey) => {
    if (key === sortKey && key !== 'defaut') setSortAsc(prev => !prev);
    else { setSortKey(key); setSortAsc(true); }
  };

  // Favoris filtrés par type puis triés
  const filteredFavorites = useMemo(() => {
    const list = typeFilter === 'tous' ? favorites : favorites.filter(m => m.type_repas === typeFilter);
    if (sortKey === 'defaut') return list;

    const dir = sortAsc ? 1 : -1;
    return [...list].sort((a, b) => {
      if (sortKey === 'temps') {
        return dir * ((a.temps_preparation + (a.temps_cuisson || 0)) - (b.temps_preparation + (b.temps_cuisson || 0)));
      }
      if (sortKey === 'calories') {
        const ca = a.calories_par_portion, cb = b.calories_par_portion;
        if (ca == null && cb == null) return 0;
        if (ca == null) return 1;  // valeurs inconnues à la fin, quelle que soit la direction
        if (cb == null) return -1;
        return dir * (ca - cb);
      }
      // Tri par type : regroupement plat → entrée → dessert → petit-déj → snack, puis alphabétique
      const ta = TYPE_ORDER[a.type_repas] ?? 99;
      const tb = TYPE_ORDER[b.type_repas] ?? 99;
      return dir * (ta - tb) || (a.titre || '').localeCompare(b.titre || '', 'fr');
    });
  }, [favorites, typeFilter, sortKey, sortAsc]);

  const handleAddConfirm = async () => {
    if (!addModal) return;
    try {
      await addToPlanning(addModal.id, selectedDay, selectedRepas);
      setAddModal(null);
      setFeedback(`✅ "${addModal.titre}" ajouté au ${JOURS_NOMS[selectedDay].toLowerCase()} (${selectedRepas}) !`);
      setTimeout(() => setFeedback(null), 3000);
    } catch (err) {
      setFeedback(`❌ Erreur : ${errorMessage(err)}`);
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-brand-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Chargement de vos favoris...</p>
        </div>
      </div>
    );
  }

  return (
    <DashboardShell>

      {/* Feedback toast */}
      {feedback && (
        <div className={`fixed top-20 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-2xl shadow-lg text-sm font-medium ${
          feedback.startsWith('✅') ? 'bg-sauge-100 text-sauge-700 border border-sauge-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {feedback}
        </div>
      )}

      <div className="container-app py-8">
        {/* Titre */}
        <div className="mb-8">
          {/* Icône en pastille : même convention d'alignement que /recettes et
              /planning (texte sur la ligne de base commune). */}
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-2xl bg-sable-50 flex items-center justify-center flex-shrink-0" aria-hidden>
              <Star className="w-5 h-5 text-sable-400 fill-sable-400" />
            </span>
            <h1 className="font-display text-3xl font-bold text-gray-900 tracking-tight">Mes favoris</h1>
          </div>
          <p className="text-gray-500 mt-2">
            {favorites.length > 0
              ? `${favorites.length} repas liké${favorites.length > 1 ? 's' : ''} · Ajoutez-les directement au planning de la semaine`
              : 'Likez des repas depuis le dashboard pour les retrouver ici'}
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center mb-8">
            <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-3" />
            <p className="text-red-700 font-medium">{error}</p>
          </div>
        )}

        {/* Empty */}
        {!error && favorites.length === 0 && (
          <div className="text-center py-20">
            <div className="text-6xl mb-6">⭐</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Aucun favori pour le moment</h2>
            <p className="text-gray-500 mb-8">
              Cliquez sur l&apos;étoile ⭐ sur les cartes repas du dashboard pour les ajouter à vos favoris.
            </p>
            <Link href="/aujourdhui"
              className="inline-flex items-center gap-2 px-6 py-3 bg-brand-500 text-white font-semibold rounded-full hover:bg-brand-600 transition-all shadow-cta">
              <ArrowLeft className="w-4 h-4" /> Aller au dashboard
            </Link>
          </div>
        )}

        {/* Filtre par type de repas */}
        {!error && favorites.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {TYPE_FILTERS.map(f => {
              const count = f.value === 'tous'
                ? favorites.length
                : favorites.filter(m => m.type_repas === f.value).length;
              return (
                <button key={f.value} onClick={() => setTypeFilter(f.value)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${typeFilter === f.value
                    ? 'bg-brand-500 text-white shadow-sm'
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-brand-50 hover:text-brand-600'}`}>
                  {f.label}
                  <span className={`ml-1 ${typeFilter === f.value ? 'text-white/70' : 'text-gray-500'}`}>({count})</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Tri */}
        {!error && favorites.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mb-6">
            <span className="text-xs text-gray-500 mr-1">Trier :</span>
            {SORT_OPTIONS.map(s => (
              <button key={s.value} onClick={() => handleSort(s.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${sortKey === s.value
                  ? 'bg-accent-500 text-white shadow-sm'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-accent-50 hover:text-accent-600'}`}>
                {s.label}{sortKey === s.value && s.value !== 'defaut' && (
                  <span className="ml-1">{sortAsc ? '↑' : '↓'}</span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Aucun favori pour ce filtre */}
        {!error && favorites.length > 0 && filteredFavorites.length === 0 && (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">🍽️</div>
            <p className="text-gray-500 mb-4">Aucun favori de ce type pour le moment.</p>
            <button onClick={() => setTypeFilter('tous')}
              className="px-4 py-2 text-sm font-medium text-brand-600 bg-brand-50 rounded-full hover:bg-brand-100 transition-colors">
              Voir tous mes favoris
            </button>
          </div>
        )}

        {/* Grille de favoris */}
        {!error && filteredFavorites.length > 0 && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredFavorites.map(meal => (
              <div key={meal.id}
                className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-lg hover:border-brand-200 transition-all group">
                {/* Image placeholder */}
                <div className="bg-brand-50 h-32 flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center">
            <Star className="w-6 h-6 text-sable-400 fill-sable-400" />
                  </div>
                </div>

                <div className="p-4">
                  <Link href={`/recette/${meal.id}`}>
                    <h3 className="font-semibold text-gray-900 text-sm mb-2 group-hover:text-brand-600 transition-colors line-clamp-2">
                      {titreMajuscules(meal.titre)}
                    </h3>
                  </Link>

                  <div className="flex items-center gap-3 text-xs text-gray-500 mb-4">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {formatMinutes(meal.temps_preparation + (meal.temps_cuisson || 0))}</span>
                    <span className="flex items-center gap-1"><Flame className="w-3 h-3" /> {formatCalories(meal.calories_par_portion)}</span>
                    <span className="flex items-center gap-1"><ChefIcon className="w-3 h-3" /> {meal.difficulte}</span>
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

                  {/* Bouton ajouter au planning */}
                  <button
                    onClick={() => { setAddModal(meal); setSelectedDay(0); setSelectedRepas('dejeuner'); }}
                    disabled={adding === meal.id}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-brand-600 bg-brand-50 rounded-full hover:bg-brand-100 disabled:opacity-50 transition-colors">
                    {adding === meal.id ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Ajout...</>
                    ) : (
                      <><Plus className="w-4 h-4" /> Ajouter au planning</>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal : choisir créneau — feuille ancrée en bas sur mobile (comme
          WhyModal/MealNotation) : en-tête toujours visible + hauteur bornée,
          l'ancien centrage sans limite de hauteur pouvait dépasser l'écran
          sur un petit téléphone (grille des 7 jours + tout le reste). */}
      {addModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
          role="dialog" aria-modal="true" aria-label="Ajouter au planning"
          onClick={() => setAddModal(null)}>
          <div className="absolute inset-0 bg-gray-900/30 backdrop-blur-sm" aria-hidden />

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.22, ease: 'easeOut' }}
            className="relative w-full sm:max-w-md bg-creme-50 rounded-t-3xl sm:rounded-3xl shadow-xl border border-gray-100 max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-creme-50/95 backdrop-blur px-6 pt-6 pb-4 border-b border-gray-100 flex items-center justify-between gap-3">
              <h3 className="font-display font-bold text-gray-900 text-lg flex items-center gap-2">
                <Plus className="w-5 h-5 text-brand-500" /> Ajouter au planning
              </h3>
              <button onClick={() => setAddModal(null)} aria-label="Fermer"
                className="p-1 rounded-lg hover:bg-gray-100 text-gray-500 flex-shrink-0">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 pt-6 pb-6">
            <div className="bg-brand-50 rounded-xl p-3 mb-6">
              <p className="font-medium text-gray-900 text-sm">{addModal.titre}</p>
              <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                <span>{formatMinutes(addModal.temps_preparation + (addModal.temps_cuisson || 0))}</span>
                <span>·</span>
                <span>{formatCalories(addModal.calories_par_portion)}</span>
              </div>
            </div>

            {/* Choix du jour */}
            <label className="block text-sm font-medium text-gray-700 mb-2">Jour</label>
            <div className="grid grid-cols-7 gap-1.5 mb-4">
              {JOURS_NOMS.map((jour, idx) => (
                <button key={jour}
                  onClick={() => setSelectedDay(idx)}
                  className={`px-2 py-2 rounded-full text-xs font-medium transition-all ${
                    selectedDay === idx
                      ? 'bg-brand-500 text-white shadow-sm'
                      : idx >= 5
                        ? 'bg-sable-100 text-sable-700 hover:bg-sable-200'
                        : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
                  }`}>
                  {jour.slice(0, 3)}
                </button>
              ))}
            </div>

            {/* Choix du repas */}
            <label className="block text-sm font-medium text-gray-700 mb-2">Repas</label>
            <div className="flex gap-2 mb-6">
              {(['dejeuner', 'diner'] as const).map(r => (
                <button key={r}
                  onClick={() => setSelectedRepas(r)}
                  className={`flex-1 py-3 rounded-full text-sm font-medium transition-all ${
                    selectedRepas === r
                      ? 'bg-brand-500 text-white shadow-sm'
                      : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
                  }`}>
                  {r === 'dejeuner' ? '☀️ Déjeuner' : '🌙 Dîner'}
                </button>
              ))}
            </div>

            {/* Récap */}
            <div className="bg-creme-50 rounded-xl p-3 mb-6 text-center text-sm text-gray-500">
              <Check className="w-4 h-4 inline text-sauge-600 mr-1" />
              {JOURS_NOMS[selectedDay]} · {selectedRepas === 'dejeuner' ? 'Déjeuner' : 'Dîner'}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setAddModal(null)}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors">
                Annuler
              </button>
              <button onClick={handleAddConfirm}
                disabled={adding === addModal.id}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-brand-500 rounded-full hover:bg-brand-600 transition-colors disabled:opacity-50 shadow-cta">
                Confirmer
              </button>
            </div>
            </div>
          </motion.div>
        </div>
      )}
    </DashboardShell>
  );
}