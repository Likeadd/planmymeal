'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import Image from 'next/image';
import {
  Clock, Flame, ChefHat as ChefIcon, Heart, ThumbsDown,
  ArrowLeft, Loader2, Utensils, Package, AlertTriangle, Users, Euro, CookingPot
} from 'lucide-react';
import type { Meal, IngredientQuantity } from '@/types';
import { toMeal, type MealWithIngredients } from '@/lib/db-rows';
import { createBrowserClient } from '@/lib/supabase';
import { formatMinutes, formatCalories, formatTypeRepas, titreRecette, emojiRecette } from '@/lib/utils';
import { prixParPortion, prixRecette, prixLigne, formatPrix } from '@/lib/budget';
import { quantiteLisible } from '@/lib/quantites';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { USTENSILE_ICONS, detecterUstensile } from '@/lib/ustensiles';
import { useAuth } from '@/components/AuthProvider';
import { FamilleBadges } from '@/components/dashboard/FamilleBadges';
import { AjouterSemaine } from '@/components/AjouterSemaine';
import { BoutonPartager } from '@/components/BoutonPartager';
import { recetteHref, filArianeRecette } from '@/lib/seo';
import { FilAriane } from '@/components/FilAriane';


export interface RecetteSimilaire {
  id: number; titre: string; href: string; cuisine: string | null;
  minutes: number; kcal: number | null; prix: number | null;
}

export default function RecetteClient({
  mealId, initial, similaires = [],
}: {
  mealId: number;
  /** Recette publique rendue côté serveur (SEO + affichage immédiat) ;
   *  null pour une recette privée, alors chargée ici avec la session. */
  initial: MealWithIngredients | null;
  /** Recettes proches, calculées côté serveur (liens internes) */
  similaires?: RecetteSimilaire[];
}) {
  const { user } = useAuth();
  const router = useRouter();
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

  // Avis via l'API serveur : un second clic sur le même bouton RETIRE vraiment
  // l'avis (avant, l'annulation n'était qu'affichée, la base gardait le like).
  const handleFeedback = async (status: 'liked' | 'disliked') => {
    if (!meal) return;
    // Sans compte : un clic ne doit jamais rester sans effet
    if (!user) {
      toast('Créez un compte gratuit pour enregistrer vos favoris.');
      router.push('/signup');
      return;
    }
    setSaving(true);
    const newStatus = feedback === status ? null : status;
    try {
      const res = await fetch('/api/favori', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meal_id: meal.id, avis: newStatus }),
      });
      if (res.ok) setFeedback(newStatus);
    } finally {
      setSaving(false);
    }
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
      <DashboardShell>
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-300 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">{error || 'Recette introuvable'}</h1>
          <Link href={user ? '/dashboard' : '/recettes'} className="text-brand-600 hover:text-brand-700 font-medium">
            ← {user ? 'Retour au planning' : 'Toutes les recettes'}
          </Link>
        </div>
      </div>
      </DashboardShell>
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
          <FilAriane maillons={filArianeRecette(meal, titreRecette(meal.titre))} className="mb-4" />

          {/* ─── Bandeau illustratif (emoji selon le type, plus de photos) ── */}
          <div className="relative bg-brand-100 rounded-3xl h-40 sm:h-64 flex items-center justify-center mb-8 overflow-hidden">
            {/* Vague crème en bas de bandeau */}
            <svg className="absolute bottom-0 left-0 w-full text-gray-50" viewBox="0 0 800 60" preserveAspectRatio="none" aria-hidden>
              <path d="M0 60 V30 C150 0 300 55 450 28 C600 5 720 35 800 18 V60 Z" fill="currentColor" opacity="0.5" />
            </svg>
            {meal.photo ? (
              <Image src={meal.photo.url} alt={meal.titre} fill priority sizes="(max-width: 768px) 100vw, 768px"
                className="object-cover" />
            ) : (
              <span className="text-8xl drop-shadow-xs" aria-hidden>{emojiRecette(meal.titre, meal.type_repas)}</span>
            )}
          </div>
          {/* Attribution exigée par la banque d'images */}
          {meal.photo && (
            <p className="-mt-6 mb-6 text-[11px] text-gray-500 text-right">
              Photo :{' '}
              {meal.photo.auteurUrl ? (
                <a href={meal.photo.auteurUrl} target="_blank" rel="noopener noreferrer nofollow" className="underline decoration-gray-300 hover:text-brand-600">{meal.photo.auteur}</a>
              ) : meal.photo.auteur}
              {' '}sur{' '}
              <a href={meal.photo.pageUrl ?? '#'} target="_blank" rel="noopener noreferrer nofollow" className="underline decoration-gray-300 hover:text-brand-600 capitalize">{meal.photo.source}</a>
            </p>
          )}

          {/* ─── Titre + badges ──────────────────────── */}
          <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
            <div className="min-w-0">
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
                    {SAISON_LABEL[meal.saison] ?? meal.saison}
                  </span>
                )}
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">{titreRecette(meal.titre)}</h1>
              {meal.description && (
                <p className="text-gray-500 mt-2">{meal.description}</p>
              )}
            </div>

            {/* Partager / Like / Dislike */}
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <BoutonPartager type="recette" titre={titreRecette(meal.titre)}
                texte={`Une recette à essayer : ${titreRecette(meal.titre)}`} chemin={recetteHref(meal)} />
              <button
                onClick={() => handleFeedback('liked')}
                disabled={saving}
                aria-pressed={feedback === 'liked'}
                className={`inline-flex items-center gap-1.5 min-h-[44px] px-3.5 rounded-xl border-2 text-sm font-semibold transition-all ${
                  feedback === 'liked'
                    ? 'bg-brand-50 border-brand-400 text-brand-600'
                    : 'border-gray-200 text-gray-500 hover:border-brand-300 hover:text-brand-500'
                }`}
                title={feedback === 'liked' ? 'Retirer des favoris' : 'Ajouter aux favoris'}
              >
                <Heart className={`w-5 h-5 ${feedback === 'liked' ? 'fill-current' : ''}`} />
                {feedback === 'liked' ? 'Favori' : 'Ajouter aux favoris'}
              </button>
              <button
                onClick={() => handleFeedback('disliked')}
                disabled={saving}
                aria-pressed={feedback === 'disliked'}
                aria-label="Je n'aime pas cette recette"
                className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl border-2 transition-all ${
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

          {/* ─── Appel à l'action en haut de fiche : visiteur → inscription gratuite, connecté → planning ─── */}
          <AjouterSemaine mealId={meal.id} typeRepas={meal.type_repas} className="mb-6" />

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

          {/* Mobile : ingrédients → étapes → ustensiles & nutrition (on cuisine
              avec les étapes, elles ne doivent pas arriver en dernier).
              Desktop : ingrédients + extras à gauche, étapes à droite. */}
          <div className="grid lg:grid-cols-5 lg:grid-rows-[auto_1fr] gap-6 lg:gap-8 items-start">
            <div className="lg:col-span-2 lg:col-start-1 lg:row-start-1 space-y-6">
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
                          className={`flex items-center gap-2.5 py-2 text-sm ${
                            i < ingredients.length - 1 ? 'border-b border-gray-50' : ''
                          }`}
                        >
                          {/* Nom : prend la place restante et passe à la ligne ; quantité et prix : colonnes
                              fixes, jamais coupées — l'alignement reste identique sur toutes les lignes. */}
                          <span className={`min-w-0 flex-1 break-words hyphens-auto ${iq.est_optionnel ? 'text-gray-500 italic' : 'text-gray-700'}`}>
                            {iq.ingredient.nom}
                            {iq.est_optionnel && (
                              <span className="text-xs text-gray-500 ml-1">(optionnel)</span>
                            )}
                          </span>
                          <span className="shrink-0 whitespace-nowrap text-right font-medium text-gray-900">
                            {quantiteLisible(iq.quantite, iq.unite, iq.ingredient.nom)}
                          </span>
                          <span className="shrink-0 w-11 text-right text-xs text-gray-500">
                            {prix != null ? formatPrix(prix) : '—'}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 lg:col-start-1 lg:row-start-2 space-y-6 order-3 lg:order-none">
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
            <div className="lg:col-span-3 lg:col-start-3 lg:row-start-1 lg:row-span-2 order-2 lg:order-none">
              <div className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-8 shadow-xs">
                <h2 className="font-bold text-gray-900 mb-6 flex items-center gap-2 text-lg">
                  <ChefIcon className="w-5 h-5 text-brand-500" />
                  Instructions pas à pas
                </h2>

                {meal.instructions && meal.instructions.length > 0 ? (
                  <div className="space-y-6">
                    {meal.instructions.map((step, i) => {
                      if (i === 0 && step.startsWith('Mise en place')) return <MiseEnPlace key={i} texte={step} />;
                      const ustensile = detecterUstensile(step);
                      const numero = meal.instructions![0].startsWith('Mise en place') ? i : i + 1;
                      return (
                        <div key={i} className="flex gap-4 group">
                          {/* Numéro */}
                          <div className="shrink-0 w-8 h-8 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center text-sm font-bold group-hover:bg-brand-500 group-hover:text-white transition-colors">
                            {numero}
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

          {/* ─── Visiteur : la recette est une porte d'entrée (Google, partage) ── */}
          {!user && (
            <div className="mt-10 rounded-3xl bg-brand-50 border border-brand-100 p-6 sm:p-8 text-center">
              <p className="font-display font-bold text-xl text-gray-900">Ajoutez cette recette à votre semaine</p>
              <p className="mt-2 text-sm text-gray-600 max-w-md mx-auto">
                PlanMyMeal compose vos menus selon votre budget, vos goûts et votre frigo,
                et prépare la liste de courses. Gratuit, sans carte bancaire.
              </p>
              <Link href="/signup?ref=recette"
                className="mt-5 inline-flex items-center justify-center rounded-full bg-brand-500 text-white font-semibold px-6 py-3 hover:bg-brand-600 transition-colors shadow-cta">
                Ajouter à ma semaine — gratuit
              </Link>
            </div>
          )}

          {/* ─── Recettes similaires (maillage interne) ─── */}
          {similaires.length > 0 && (
            <section className="mt-12" aria-labelledby="titre-similaires">
              <h2 id="titre-similaires" className="font-display font-bold text-xl text-gray-900 mb-4">Recettes similaires</h2>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {similaires.map(r => (
                  <li key={r.id}>
                    <Link href={r.href} className="block h-full rounded-2xl border border-gray-100 bg-white shadow-card hover:shadow-pop hover:-translate-y-0.5 transition-all p-4">
                      <p className="font-display font-bold text-gray-900 leading-snug">{titreRecette(r.titre)}</p>
                      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-gray-500">
                        <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" aria-hidden />{formatMinutes(r.minutes)}</span>
                        {r.kcal != null && <span className="flex items-center gap-1"><Flame className="w-3.5 h-3.5" aria-hidden />{formatCalories(r.kcal)}</span>}
                        {r.prix != null && <span className="font-semibold text-sauge-700">{formatPrix(r.prix)}/portion</span>}
                        {r.cuisine && <span className="text-gray-400">{r.cuisine}</span>}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* ─── Navigation bas ──────────────────────── */}
          <div className="mt-10 flex items-center justify-between">
            <Link
              href={user ? '/dashboard' : '/recettes'}
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              {user ? 'Retour au planning' : 'Toutes les recettes'}
            </Link>
            {feedback === 'liked' && (
              <span className="text-sm text-brand-600 font-medium flex items-center gap-1">
                <Heart className="w-4 h-4 fill-current" /> Dans vos favoris — elle reviendra plus souvent
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

const SAISON_LABEL: Record<string, string> = { ete: 'Été', hiver: 'Hiver', printemps: 'Printemps', automne: 'Automne' };

/** L'étape « Mise en place » : liste à puces (non numérotée), le reste des étapes est numéroté à partir de 1 */
function MiseEnPlace({ texte }: { texte: string }) {
  const m = texte.match(/^Mise en place[^.]*\.\s*Pesez et préparez : (.+?)\.\s+((?:Sortez|Temps)[\s\S]*)$/);
  if (!m) return <p className="text-gray-700 leading-relaxed">{texte}</p>;
  return (
    <div className="rounded-xl bg-sable-50 border border-sable-100 p-4 text-sm text-gray-700">
      <p className="font-semibold text-gray-900 mb-2">Mise en place — tout peser avant de commencer</p>
      <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-1 list-disc pl-5">
        {m[1].split(' ; ').map(l => <li key={l}>{l}</li>)}
      </ul>
      {m[2] && <p className="mt-2 text-gray-600">{m[2]}</p>}
    </div>
  );
}

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
          {value != null ? `${String(value).replace('.', ',')} ${unit}` : '—'}
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
