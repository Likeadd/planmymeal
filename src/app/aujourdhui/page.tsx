'use client';

// ============================================================================
// Aujourd'hui — le tableau de bord personnel (audit #22).
//
// Le planning hebdo n'est pas le seul écran d'accueil : cette page répond aux
// questions du QUOTIDIEN — « qu'est-ce qu'on mange aujourd'hui ? », « qu'est-ce
// qui va se perdre ? », « qu'est-ce qu'il manque ? » — avant de renvoyer vers
// la vue semaine.
//
// Anti-arbitraire (constante du produit) : chaque chiffre affiché est VRAI ou
// n'est pas affiché. Le prochain repas lit le planning réel du jour (aujourd'hui
// → sa semaine ; sinon → la semaine suivante, déjà générée ou non) ; les
// produits « à utiliser » ont une péremption réelle ; le budget lit le
// snapshot /api/budget — jamais de donnée inventée.
// ============================================================================

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Clock, Flame, AlertTriangle, ShoppingCart, Wallet, ArrowRight,
  ChefHat, Loader2, CalendarDays,
} from 'lucide-react';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { useAuth } from '@/components/AuthProvider';
import { createBrowserClient } from '@/lib/supabase';
import { useTodayIndex, JOUR_INCONNU } from '@/lib/useTodayIndex';
import { getMondayWithOffset, getMonday } from '@/lib/dates';
import { formatMinutes, formatCalories, cn, titreMajuscules } from '@/lib/utils';
import { formatPrix } from '@/lib/budget';
import { COLONNES_RECETTE_PLANNING, toRecettePlanning, type WeeklyPlanEmbed } from '@/lib/db-rows';
import type { RecettePlanning } from '@/types';

interface BudgetRecap {
  budget: number | null;
  depense: number;
}

/** Produit du frigo dont la péremption approche (audit #22 « À utiliser ») */
interface AUtiliser {
  nom: string;
  expiration: string;
  /** Jours restants (0 = aujourd'hui, <0 = dépassé) — ancré fuseau Paris via dates.ts */
  joursRestants: number;
}

/** Deux repas du même jour, dans l'ordre réel de la journée */
const ORDRE_CRENEAUX: Record<string, number> = { dejeuner: 0, dessert_midi: 1, diner: 2, dessert: 3 };
type RepasType = string;

export default function AujourdhuiPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const todayIndex = useTodayIndex(); // 0=lundi…6=dimanche, -1 au SSR

  const [prochain, setProchain] = useState<{ label: string; meal: RecettePlanning } | null>(null);
  const [nbRepasRestants, setNbRepasRestants] = useState(0);
  const [aUtiliser, setAUtiliser] = useState<AUtiliser[]>([]);
  const [nbCourses, setNbCourses] = useState(0);
  const [recap, setRecap] = useState<BudgetRecap | null>(null);
  const [loading, setLoading] = useState(true);
  const [planningVide, setPlanningVide] = useState(false);

  // Semaine à lire : celle d'aujourd'hui, sinon la suivante (le planning est
  // mono-semaine : après dimanche soir, « aujourd'hui » vit déjà dans la
  // semaine N+1 — on la lit, générée ou non).
  const semaineCourante = getMonday();
  const semaineAujourdhui = useMemo(
    () => (todayIndex >= 0 && todayIndex <= 6 ? getMondayWithOffset(0) : semaineCourante),
    [todayIndex, semaineCourante]
  );
  const semaineDuProchain = todayIndex >= 0 && todayIndex <= 6 ? semaineAujourdhui : getMondayWithOffset(1);

  useEffect(() => {
    if (authLoading || !user || todayIndex === JOUR_INCONNU) return;
    let alive = true;
    const supabase = createBrowserClient();

    (async () => {
      try {
        // ── Prochain repas : le 1er créneau non passé du jour ────────────
        const { data: plan } = await supabase
          .from('weekly_plans')
          .select(`id, plan_meals(jour_semaine, repas_type, est_reste_de, meals!plan_meals_meal_id_fkey(${COLONNES_RECETTE_PLANNING}))`)
          .eq('user_id', user.id)
          .eq('is_active', true)
          .eq('semaine_debut', semaineDuProchain)
          .maybeSingle();

        if (!alive) return;
        const planEmbed = plan as unknown as WeeklyPlanEmbed | null;
        const slots = (planEmbed?.plan_meals ?? [])
          .filter(pm => pm.jour_semaine === todayIndex)
          .map(pm => ({
            ordre: ORDRE_CRENEAUX[pm.repas_type as RepasType] ?? 99,
            repas_type: pm.repas_type,
            est_reste_de: pm.est_reste_de,
            meal: pm.meals ? toRecettePlanning(pm.meals) : null,
          }))
          .sort((a, b) => a.ordre - b.ordre);        const prochains = slots.filter(s => s.meal);
        setNbRepasRestants(prochains.length);
        const premier = prochains[0];
        if (premier?.meal) {
          setProchain({
            label: premier.repas_type === 'dejeuner' ? 'Déjeuner'
              : premier.repas_type === 'diner' ? 'Dîner'
              : premier.repas_type === 'dessert_midi' ? 'Dessert de midi' : 'Dessert',
            meal: premier.meal,
          });
          setPlanningVide(false);
        } else {
          setProchain(null);
          setPlanningVide(true);
        }

        // ── Frigo : produits proches de péremption (≤ 3 jours) ───────────
        const { data: frigo } = await supabase
          .from('fridge_items')
          .select('expiration, ingredients(nom)')
          .not('expiration', 'is', null)
          .lte('expiration', dans3JoursISO());

        if (!alive) return;
        const aujISO = aujourdhuiISO();
        const items: AUtiliser[] = (frigo ?? []).map(r => ({
          nom: r.ingredients?.nom ?? '',
          expiration: r.expiration as string,
          joursRestants: Math.round((new Date(`${r.expiration}T12:00:00`).getTime() - new Date(`${aujISO}T12:00:00`).getTime()) / 86_400_000),
        })).sort((a, b) => a.expiration.localeCompare(b.expiration));
        setAUtiliser(items);

        // ── Courses : items non cochés de la liste de la semaine ────────
        // La liste est liée au PLAN (pas de colonne semaine sur shopping_lists) :
        // on retrouve le plan de la semaine courante puis sa liste active.
        const { data: listRow } = await supabase
          .from('weekly_plans')
          .select('id, shopping_lists(id)')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .eq('semaine_debut', semaineCourante)
          .maybeSingle();
        if (!alive) return;
        const listId = (listRow as { shopping_lists: { id: number }[] | null } | null)?.shopping_lists?.[0]?.id ?? null;
        if (listId) {
          const { data: items } = await supabase
            .from('shopping_list_items')
            .select('ingredient_id, checked')
            .eq('list_id', listId);
          if (!alive) return;
          setNbCourses((items ?? []).filter(i => !i.checked).length);
        } else {
          setNbCourses(0);
        }

        // ── Budget : snapshot réel de la semaine ─────────────────────────
        const res = await fetch(`/api/budget?semaine_debut=${semaineCourante}`);
        const json = res.ok ? await res.json() : null;
        if (!alive) return;
        if (json) setRecap({ budget: json.budget ?? null, depense: json.depense ?? 0 });
      } catch {
        // Requête perdue : les KPI restent à leur état neutre (loading → vide),
        // aucun chiffre inventé n'est affiché.
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => { alive = false; };
    // todayIndex passe de -1 (SSR) au jour réel → l'effet se rejoue une fois
  }, [user, authLoading, todayIndex, semaineAujourdhui, semaineDuProchain, semaineCourante]);

  const prenom = (profile?.full_name || '').split(' ')[0] || '';

  return (
    <DashboardShell>
      <div className="container-app py-6 max-w-3xl">
        {/* ── Salutation ─────────────────────────────────────────────────── */}
        <h1 className="font-display font-bold text-3xl text-gray-900 tracking-tight">
          {prenom ? `Bonjour ${prenom}` : 'Bonjour'} 👋
        </h1>
        <p className="text-gray-500 mt-1 text-sm">
          Voici ce que votre foyer a prévu aujourd&apos;hui.
        </p>

        {loading ? (
          <div className="mt-10 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-brand-500 animate-spin" />
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {/* ── Prochain repas ─────────────────────────────────────────── */}
            {prochain ? (
              <Link href={`/recette/${prochain.meal.id}`}
                className="block group rounded-3xl border border-gray-100 bg-white shadow-card hover:shadow-pop hover:-translate-y-0.5 transition-all p-5">
                <p className="text-[11px] font-semibold tracking-[0.14em] uppercase text-brand-500 mb-2 flex items-center gap-1.5">
                  <ChefHat className="w-3.5 h-3.5" /> Prochain repas · {prochain.label}
                </p>
                <h2 className="font-display font-bold text-xl text-gray-900 group-hover:text-brand-600 transition-colors">
                  {titreMajuscules(prochain.meal.titre)}
                </h2>
                <div className="flex items-center gap-3.5 text-[13px] text-gray-500 mt-2.5">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" /> {formatMinutes(prochain.meal.temps_preparation + (prochain.meal.temps_cuisson || 0))}
                  </span>
                  <span className="flex items-center gap-1">
                    <Flame className="w-3.5 h-3.5" /> {formatCalories(prochain.meal.calories_par_portion)}
                  </span>
                  {nbRepasRestants > 1 && (
                    <span className="text-gray-500">+ {nbRepasRestants - 1} autre{nbRepasRestants > 2 ? 's' : ''} repas aujourd&apos;hui</span>
                  )}
                </div>
              </Link>
            ) : (
              <div className="rounded-3xl border-2 border-dashed border-gray-200 bg-gray-50/60 p-6 text-center">
                <p className="text-sm text-gray-500">
                  {planningVide
                    ? "Aucun repas prévu aujourd'hui."
                    : "Votre planning n'est pas encore optimisé pour cette semaine."}
                </p>
                <Link href="/dashboard"
                  className="mt-3 inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-brand-500 rounded-full hover:bg-brand-600 transition-colors shadow-cta">
                  {planningVide ? 'Voir le planning' : 'Optimiser ma semaine'} <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            )}

            {/* ── À utiliser (frigo, péremption ≤ 3 jours) ───────────────── */}
            {aUtiliser.length > 0 && (
              <Link href="/frigo"
                className="block group rounded-3xl border border-sauge-200 bg-sauge-50 p-5 hover:border-sauge-300 transition-colors">
                <p className="text-[11px] font-semibold tracking-[0.14em] uppercase text-sauge-700 mb-2 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> À utiliser rapidement
                </p>
                <ul className="space-y-1">
                  {aUtiliser.slice(0, 3).map((a, i) => (
                    <li key={i} className="text-sm text-gray-700">
                      <strong className="font-semibold">{a.nom}</strong>
                      <span className="text-sauge-700"> — {a.joursRestants <= 0 ? 'aujourd\u2019hui' : a.joursRestants === 1 ? 'expire demain' : `expire dans ${a.joursRestants} jours`}</span>
                    </li>
                  ))}
                </ul>
                {aUtiliser.length > 3 && (
                  <p className="text-xs text-sauge-600 mt-1.5">+ {aUtiliser.length - 3} autre{aUtiliser.length > 4 ? 's' : ''} produit{aUtiliser.length > 4 ? 's' : ''}</p>
                )}
              </Link>
            )}

            {/* ── Courses restantes ──────────────────────────────────────── */}
            <Link href="/dashboard?tab=courses"
              className="block group rounded-3xl border border-gray-100 bg-white shadow-card p-5 hover:shadow-pop transition-all">
              <p className="text-[11px] font-semibold tracking-[0.14em] uppercase text-gray-500 mb-2 flex items-center gap-1.5">
                <ShoppingCart className="w-3.5 h-3.5" /> Courses
              </p>
              <p className="text-2xl font-bold text-gray-900">
                {nbCourses} <span className="text-sm font-medium text-gray-500">produit{nbCourses > 1 ? 's' : ''} à acheter</span>
              </p>
            </Link>

            {/* ── Budget (référence réelle ou rien) ───────────────────────── */}
            {recap?.budget != null && (
              <Link href="/budget"
                className="block group rounded-3xl border border-gray-100 bg-white shadow-card p-5 hover:shadow-pop transition-all">
                <p className="text-[11px] font-semibold tracking-[0.14em] uppercase text-gray-500 mb-2 flex items-center gap-1.5">
                  <Wallet className="w-3.5 h-3.5" /> Budget
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatPrix(recap.depense)} <span className="text-sm font-medium text-gray-500">/ {formatPrix(recap.budget)}</span>
                </p>
                <div className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden max-w-[160px]">
                  <div
                    className={cn('h-full rounded-full transition-all duration-500',
                      recap.depense > recap.budget ? 'bg-red-500'
                        : recap.depense >= recap.budget * 0.8 ? 'bg-sable-400' : 'bg-sauge-500')}
                    style={{ width: `${Math.min(100, Math.round((recap.depense / recap.budget) * 100))}%` }}
                  />
                </div>
              </Link>
            )}

            {/* ── Lien vers la vue semaine ───────────────────────────────── */}
            <Link href="/dashboard"
              className="group flex items-center justify-between rounded-2xl border border-gray-100 bg-white px-5 py-4 hover:border-brand-200 transition-colors">
              <span className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <CalendarDays className="w-4 h-4 text-brand-500" /> Planning de la semaine
              </span>
              <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-brand-500 transition-colors" />
            </Link>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

// ─── Helpers date (aucune fonction impure dans le rendu) ────────────────────

/** Aujourd'hui (YYYY-MM-DD), fuseau Europe/Paris — même convention que dates.ts */
function aujourdhuiISO(): string {
  return new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

/** Dans 3 jours (YYYY-MM-DD) : seuil « à utiliser rapidement » */
function dans3JoursISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  return new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}
