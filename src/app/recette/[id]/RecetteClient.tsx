'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Clock, Flame, ChefHat as ChefIcon, Star, ThumbsDown,
  ArrowLeft, Loader2, Utensils, Package, AlertTriangle, Users, Euro, CookingPot
} from 'lucide-react';
import type { Meal, IngredientQuantity, TypeRepas } from '@/types';
import { toMeal, type MealWithIngredients } from '@/lib/db-rows';
import { createBrowserClient } from '@/lib/supabase';
import { formatMinutes, formatCalories, formatTypeRepas, titreMajuscules } from '@/lib/utils';
import { prixParPortion, prixRecette, prixLigne, formatPrix } from '@/lib/budget';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { USTENSILE_ICONS, detecterUstensile } from '@/lib/ustensiles';
import { useAuth } from '@/components/AuthProvider';
import { FamilleBadges } from '@/components/dashboard/FamilleBadges';

/** Emoji illustratif par type de recette (remplace les photos générées) */
function typeEmoji(type: TypeRepas): string {
  const emojis: Record<TypeRepas, string> = {
    plat: '🍛',
    entree: '🥗',
    dessert: '🍰',
    petit_dejeuner: '🥐',
    snack: '🍎',
  };
  return emojis[type] ?? '🍽️';
}

export default function RecetteClient({
  mealId, initial,
}: {
  mealId: number;
  /** Recette publique rendue côté serveur (SEO + affichage immédiat) ;
   *  null pour une recette privée, alors chargée ici avec la session. */
  initial: MealWithIngredients | null;
}) {
  const { user } = useAuth();
  const supabase = createBrowserClient();

  const [initialMeal] = useState<Meal | null>(() => (initial ? toMeal(initial) : null));
  const [meal, setMeal] = useState<Meal | null>(initialMeal);
  const [ingredients, setIngredients] = useState<IngredientQuantity[]>(initialMeal?.ingredients || []);
  const [loading, setLoading] = useState(!initialMeal);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState<'liked' | 'disliked' | null>(null);
  const [saving, setSaving] = useState(false);

  // Charger la recette + ingrédients
  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!mealId || isNaN(mealId)) {
        if (!cancelled) { setError('ID de recette invalide'); setLoading(false); }
        return;
      }

      // Recette privée (non rendue côté serveur) : chargement avec la session
      if (!initialMeal) {
        const { data: mealData, error: mealError } = await supabase
          .from('meals')
          .select('*, meal_ingredients(quantite, unite, est_optionnel, ingredients!inner(*))')
          .eq('id', mealId)
          .single();

        if (cancelled) return;

        if (mealError || !mealData) {
          setError('Recette introuvable');
          setLoading(false);
          return;
        }

        // Normaliser meal_ingredients → ingredients pour le calcul du prix
        const normalized: Meal = toMeal(mealData as unknown as MealWithIngredients);
        setMeal(normalized);
        setIngredients(normalized.ingredients || []);
      }

      // Vérifier si l'utilisateur a déjà liké/disliké
      if (user) {
        const { data: history } = await supabase
          .from('meal_history')
          .select('status')
          .eq('user_id', user.id)
          .eq('meal_id', mealId)
          .in('status', ['liked', 'disliked'])
          .order('created_at', { ascending: false })
          .limit(1);

        if (!cancelled && history && history.length > 0) {
          setFeedback(history[0].status as 'liked' | 'disliked');
        }
      }

      if (!cancelled) setLoading(false);
    }

    load();
    // supabase est un singleton stable
    return () => { cancelled = true; };
  }, [mealId, user, supabase, initialMeal]);

  const handleFeedback = async (status: 'liked' | 'disliked') => {
    if (!user || !meal) return;
    setSaving(true);

    // Si on reclique sur le même, annuler
    const newStatus = feedback === status ? null : status;
    if (newStatus) {
      await supabase.from('meal_history').insert({
        user_id: user.id,
        meal_id: meal.id,
        planned_date: new Date().toISOString().split('T')[0],
        status: newStatus,
      });
    }
    setFeedback(newStatus);
    setSaving(false);
  };

  // ─── Loading ─────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-brand-500 animate-spin" />
      </div>
    );
  }

  // ─── Error ───────────────────────────────────────
  if (error || !meal) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-300 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">{error || 'Recette introuvable'}</h1>
          <Link href="/dashboard" className="text-brand-600 hover:text-brand-700 font-medium">
            ← Retour au planning
          </Link>
        </div>
      </div>
    );
  }

  // ─── Rendu principal ─────────────────────────────
  const difficulteLabel =
    meal.difficulte === 'facile' ? 'Facile' :
    meal.difficulte === 'moyen' ? 'Moyen' : 'Difficile';

  return (
    <DashboardShell>
      <div className="container-app py-8">
        <div className="max-w-3xl mx-auto">
          {/* ─── Bandeau illustratif (emoji selon le type, plus de photos) ── */}
          <div className="relative bg-brand-100 rounded-3xl h-64 sm:h-80 flex items-center justify-center mb-8 overflow-hidden">
            {/* Vague crème en bas de bandeau */}
            <svg className="absolute bottom-0 left-0 w-full text-gray-50" viewBox="0 0 800 60" preserveAspectRatio="none" aria-hidden>
              <path d="M0 60 V30 C150 0 300 55 450 28 C600 5 720 35 800 18 V60 Z" fill="currentColor" opacity="0.5" />
            </svg>
            <span className="text-8xl drop-shadow-xs" aria-hidden>{typeEmoji(meal.type_repas)}</span>
          </div>

          {/* ─── Titre + badges ──────────────────────── */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  {formatTypeRepas(meal.type_repas)}
                </span>
                {meal.cuisine && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                    {meal.cuisine}
                  </span>
                )}
                {meal.saison !== 'toutes' && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-sauge-50 text-sauge-700">
                    {meal.saison}
                  </span>
                )}
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">{titreMajuscules(meal.titre)}</h1>
              {meal.description && (
                <p className="text-gray-500 mt-2">{meal.description}</p>
              )}
            </div>

            {/* Like / Dislike */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => handleFeedback('liked')}
                disabled={saving}
                className={`p-2.5 rounded-xl border-2 transition-all ${
                  feedback === 'liked'
                    ? 'bg-sable-50 border-sable-400 text-sable-600'
                    : 'border-gray-200 text-gray-300 hover:border-sable-300 hover:text-sable-500'
                }`}
                title="J'aime cette recette"
              >
                <Star className={`w-5 h-5 ${feedback === 'liked' ? 'fill-current' : ''}`} />
              </button>
              <button
                onClick={() => handleFeedback('disliked')}
                disabled={saving}
                className={`p-2.5 rounded-xl border-2 transition-all ${
                  feedback === 'disliked'
                    ? 'bg-red-50 border-red-400 text-red-600'
                    : 'border-gray-200 text-gray-300 hover:border-red-300 hover:text-red-400'
                }`}
                title="Je n'aime pas cette recette"
              >
                <ThumbsDown className={`w-5 h-5 ${feedback === 'disliked' ? 'fill-current' : ''}`} />
              </button>
            </div>
          </div>

          {/* ─── Infos rapides (macros + temps + prix) ─── */}
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 mb-8">
            <InfoChip
              icon={<Clock className="w-4 h-4" />}
              label="Préparation"
              value={formatMinutes(meal.temps_preparation + (meal.temps_cuisson || 0))}
            />
            <InfoChip
              icon={<Flame className="w-4 h-4" />}
              label="Calories"
              value={formatCalories(meal.calories_par_portion)}
            />
            <InfoChip
              icon={<Euro className="w-4 h-4" />}
              label="Prix / portion"
              value={formatPrix(prixParPortion(meal))}
              highlight
            />
            <InfoChip
              icon={<ChefIcon className="w-4 h-4" />}
              label="Difficulté"
              value={difficulteLabel}
            />
            <InfoChip
              icon={<Users className="w-4 h-4" />}
              label="Portions"
              value={`${meal.portions_par_defaut}`}
            />
            <InfoChip
              icon={<Package className="w-4 h-4" />}
              label="Conservation"
              value={meal.conservation_jours ? `${meal.conservation_jours} jours` : '—'}
            />
          </div>

          {/* ─── Avis de chaque membre du foyer sur cette recette ───
              Les ingrédients sont chargés ici (toMeal), donc l'humeur affichée
              est exactement celle du planning. Ligne entièrement absente si le
              foyer n'a pas de membre. */}
          <FamilleBadges
            meal={meal}
            libelle="Ce que le foyer en pense"
            className="mb-8 px-3 py-2 rounded-xl border border-gray-100 bg-white shadow-xs"
          />

          <div className="grid lg:grid-cols-3 gap-8">
            {/* ─── Colonne gauche : ingrédients + macros ─── */}
            <div className="lg:col-span-1 space-y-6">
              {/* Ingrédients avec prix */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-gray-900 flex items-center gap-2">
                    <Utensils className="w-5 h-5 text-brand-500" />
                    Ingrédients
                  </h2>
                  <span className="text-sm font-bold text-brand-600">
                    {formatPrix(prixRecette(meal).total)}
                  </span>
                </div>
                <div className="space-y-2">
                  {ingredients.length === 0 ? (
                    <p className="text-sm text-gray-500">Aucun ingrédient listé</p>
                  ) : (
                    ingredients.map((iq, i) => {
                      const prix = prixLigne(iq);
                      return (
                        <div
                          key={i}
                          className={`flex items-center justify-between py-2 text-sm ${
                            i < ingredients.length - 1 ? 'border-b border-gray-50' : ''
                          }`}
                        >
                          <span className={iq.est_optionnel ? 'text-gray-500 italic' : 'text-gray-700'}>
                            {iq.ingredient.nom}
                            {iq.est_optionnel && (
                              <span className="text-xs text-gray-500 ml-1">(optionnel)</span>
                            )}
                          </span>
                          <span className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">
                              {iq.quantite} {iq.unite}
                            </span>
                            <span className={`text-xs ${prix != null ? 'text-gray-500' : 'hidden'}`}>
                              {formatPrix(prix)}
                            </span>
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Ustensiles */}
              {meal.ustensiles && meal.ustensiles.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-xs">
                  <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <CookingPot className="w-5 h-5 text-brand-500" />
                    Ustensiles nécessaires
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {meal.ustensiles.map(u => (
                      <span key={u} className="px-3 py-1.5 bg-gray-50 border border-gray-100 rounded-xl text-sm text-gray-700">
                        {USTENSILE_ICONS[u] ? `${USTENSILE_ICONS[u]} ` : ''}{u}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Macros détaillés */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-xs">
                <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Flame className="w-5 h-5 text-brand-500" />
                  Valeurs nutritionnelles
                </h2>
                <div className="text-xs text-gray-500 mb-3">Par portion</div>
                <div className="space-y-3">
                  <MacroBar label="Protéines" value={meal.proteines} unit="g" color="bg-red-400" />
                  <MacroBar label="Glucides" value={meal.glucides} unit="g" color="bg-sauge-400" />
                  <MacroBar label="Lipides" value={meal.lipides} unit="g" color="bg-sable-400" />
                  {meal.fibres != null && (                      <MacroBar label="Fibres" value={meal.fibres} unit="g" color="bg-sauge-500" />
                  )}
                </div>
                <div className="mt-4 pt-4 border-t border-gray-50">
                  <div className="flex justify-between text-sm">
                    <span className="font-semibold text-gray-900">Total</span>
                    <span className="font-bold text-brand-600">
                      {meal.calories_par_portion || '—'} kcal
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* ─── Colonne droite : instructions pas à pas ─── */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-8 shadow-xs">
                <h2 className="font-bold text-gray-900 mb-6 flex items-center gap-2 text-lg">
                  <ChefIcon className="w-5 h-5 text-brand-500" />
                  Instructions pas à pas
                </h2>

                {meal.instructions && meal.instructions.length > 0 ? (
                  <div className="space-y-6">
                    {meal.instructions.map((step, i) => {
                      const ustensile = detecterUstensile(step);
                      return (
                        <div key={i} className="flex gap-4 group">
                          {/* Numéro */}
                          <div className="shrink-0 w-8 h-8 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center text-sm font-bold group-hover:bg-brand-500 group-hover:text-white transition-colors">
                            {i + 1}
                          </div>
                          {/* Texte */}
                          <div className="flex-1 pt-1">
                            <p className="text-gray-700 leading-relaxed">{step}</p>
                            {ustensile && (
                              <span className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 bg-brand-50 text-brand-600 text-xs rounded-full">
                                {USTENSILE_ICONS[ustensile] ? `${USTENSILE_ICONS[ustensile]} ` : ''}{ustensile}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p>Aucune instruction détaillée pour cette recette.</p>
                  </div>
                )}

                {/* Astuce batch cooking */}
                {meal.conservation_jours != null && meal.conservation_jours >= 3 && (
                  <div className="mt-8 p-4 bg-brand-50 border border-brand-100 rounded-xl flex items-start gap-3">
                    <Package className="w-5 h-5 text-brand-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-brand-800 text-sm">Idéal pour le batch cooking !</p>
                      <p className="text-brand-600 text-sm mt-0.5">
                        Cette recette se conserve {meal.conservation_jours} jours au réfrigérateur.
                        Parfait pour cuisiner le dimanche et manger jusqu&apos;à mercredi.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ─── Navigation bas ──────────────────────── */}
          <div className="mt-10 flex items-center justify-between">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Retour au planning
            </Link>
            {feedback === 'liked' && (
              <span className="text-sm text-sable-600 font-medium flex items-center gap-1">
                <Star className="w-4 h-4 fill-current" /> Recette likée — elle reviendra plus souvent !
              </span>
            )}
            {feedback === 'disliked' && (
              <span className="text-sm text-red-500 font-medium flex items-center gap-1">
                <ThumbsDown className="w-4 h-4" /> Recette dislikée — on évitera de vous la reproposer.
              </span>
            )}
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}

// ─── Sous-composants ──────────────────────────────────────────────────────

function InfoChip({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-3 text-center shadow-xs ${
      highlight ? 'bg-sauge-50 border-sauge-200' : 'bg-white border-gray-100'
    }`}>
      <div className="flex items-center justify-center gap-1 text-gray-500 mb-1">
        {icon}
      </div>
      <div className="text-xs text-gray-500 mb-0.5">{label}</div>
      <div className={`text-sm font-semibold ${highlight ? 'text-sauge-700' : 'text-gray-900'}`}>{value}</div>
    </div>
  );
}

// ─── Ustensiles : icônes + détection automatique (voir src/lib/ustensiles.ts) ──

function MacroBar({
  label,
  value,
  unit,
  color,
}: {
  label: string;
  value: number | null;
  unit: string;
  color: string;
}) {
  const v = value ?? 0;
  const pct = Math.min(100, v); // simplification visuelle

  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-600">{label}</span>
        <span className="font-medium text-gray-900">
          {value != null ? `${value} ${unit}` : '—'}
        </span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
