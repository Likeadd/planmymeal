'use client';

// ============================================================================
// Mon frigo — garde-manger persistant
//
// Complète « Vider le frigo » (recherche ponctuelle, sans mémoire) par un
// inventaire PERSISTANT : ce que tu as chez toi est enregistré, le moteur en
// tient compte à la génération (léger boost des recettes concernées) et la
// liste de courses en déduit automatiquement les quantités disponibles.
//
// À chaque ajout ou retrait, /api/frigo recalcule la liste de courses de la
// semaine en cours : l'inventaire et les courses ne peuvent pas diverger.
// ============================================================================

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Refrigerator, Loader2, Plus, Trash2, Search, Sparkles, CalendarDays, Check, Zap, AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import type { FridgeItem, Ingredient } from '@/types';
import { createBrowserClient } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { ALIMENTS_FRIGO, cleNomIngredient, UNITES_FRIGO } from '@/lib/frigo';
import { getMonday } from '@/lib/dates';
import { errorMessage, cn } from '@/lib/utils';

/** Ligne de plan_meals avec l'embed minimal nécessaire au comptage frigo */
interface PlanMealFrigo {
  jour_semaine: number;
  repas_type: string;
  meals: { meal_ingredients: { ingredient_id: number }[] } | null;
}

/**
 * Groupe d'ajouts rapides : les puces du rayon, cliquables une à une, avec
 * l'état « déjà au frigo » (pastille sauge + coche, comme la recherche).
 */
function GroupeAjoutsRapides({
  label, aliments, frigoCles, onChoisir,
}: {
  label: string;
  aliments: { nom: string; emoji: string; quantite: number; unite: string; ingredient: Ingredient }[];
  /** Clés (noms normalisés) des ingrédients déjà dans le garde-manger */
  frigoCles: Set<string>;
  onChoisir: (a: { nom: string; emoji: string; quantite: number; unite: string; ingredient: Ingredient }) => void;
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1.5">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {aliments.map(a => {
          const dedans = frigoCles.has(cleNomIngredient(a.nom));
          return (
            <button key={a.nom} onClick={() => onChoisir(a)}
              title={`${a.nom} — ${a.quantite} ${a.unite}`}
              className={cn(
                'inline-flex items-center min-h-[40px] px-3 py-2 text-xs font-medium rounded-full border transition-colors',
                dedans
                  ? 'bg-sauge-50 text-sauge-700 border-sauge-200'
                  : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-brand-300 hover:text-brand-600'
              )}>
              <span aria-hidden>{a.emoji}</span> {a.nom}
              {dedans && <Check className="w-3 h-3 inline ml-1 -mt-0.5" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function FrigoPage() {
  const supabase = createBrowserClient();
  const { user, loading: authLoading } = useAuth();

  const [items, setItems] = useState<FridgeItem[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [recherche, setRecherche] = useState('');
  const [selection, setSelection] = useState<Ingredient | null>(null);
  const [quantite, setQuantite] = useState('1');
  const [unite, setUnite] = useState<string>('g');
  const [expiration, setExpiration] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [planMeals, setPlanMeals] = useState<PlanMealFrigo[]>([]);
  const [error, setError] = useState('');
  /** Date seuil « périme bientôt » (J+3), calculée dans l'effet de chargement */
  const [seuilPeremption, setSeuilPeremption] = useState('');

  const semaine = getMonday();

  // ── Chargement : catalogue d'ingrédients + garde-manger + semaine en cours ──
  useEffect(() => {
    if (authLoading || !user) return;
    let alive = true;

    (async () => {
      try {
        const [catalogue, frigoRes, planRes] = await Promise.all([
          supabase.from('ingredients').select('id, nom, rayon').order('nom'),
          fetch('/api/frigo').then(r => r.json().then(j => ({ ok: r.ok, j }))),
          supabase.from('weekly_plans')
            .select('id, plan_meals(jour_semaine, repas_type, meals(meal_ingredients(ingredient_id)))')
            .eq('user_id', user.id).eq('semaine_debut', semaine).maybeSingle(),
        ]);

        if (!alive) return;

        const dans3Jours = new Date();
        dans3Jours.setDate(dans3Jours.getDate() + 3);
        setSeuilPeremption(dans3Jours.toISOString().split('T')[0]);

        if (catalogue.data) setIngredients(catalogue.data as unknown as Ingredient[]);
        if (frigoRes.ok) setItems(frigoRes.j.items ?? []);
        else setError(frigoRes.j?.error ?? 'Erreur de chargement du frigo');

        const plan = planRes.data as unknown as { plan_meals: PlanMealFrigo[] } | null;
        setPlanMeals(plan?.plan_meals ?? []);
      } catch (e) {
        if (alive) setError(errorMessage(e, 'Erreur de chargement'));
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => { alive = false; };
  }, [supabase, user, authLoading, semaine]);

  const ingredientsFiltres = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    if (!q) return ingredients.slice(0, 40);
    return ingredients.filter(i => i.nom.toLowerCase().includes(q)).slice(0, 40);
  }, [ingredients, recherche]);

  const frigoIds = useMemo(() => new Set(items.map(i => i.ingredient_id)), [items]);

  // Clés (noms normalisés) du garde-manger : l'état « déjà au frigo » des
  // puces d'ajouts rapides, résolu par NOM (les ids ne sont pas connus avant
  // le croisement avec le catalogue).
  const frigoCles = useMemo(
    () => new Set(items.map(i => cleNomIngredient(i.ingredient?.nom ?? ''))),
    [items]
  );

  /**
   * Ajouts rapides résolus contre le catalogue : chaque aliment curaté est
   * rapproché de l'ingrédient RÉEL en base (clé insensible à la casse, aux
   * accents et aux apostrophes). Un nom introuvable est masqué — on ne crée
   * jamais d'ingrédient côté client : le catalogue reste la source de vérité
   * (prix, rayon, macros), et une mise à jour de la base se répercute sans
   * aucune modification du code.
   */
  const groupesRapides = useMemo(() => {
    const index = new Map(ingredients.map(ing => [cleNomIngredient(ing.nom), ing]));
    return ALIMENTS_FRIGO
      .map(({ label, aliments }) => ({
        label,
        aliments: aliments
          .map(a => ({ ...a, ingredient: index.get(cleNomIngredient(a.nom)) }))
          .filter((a): a is typeof a & { ingredient: Ingredient } => a.ingredient != null),
      }))
      .filter(g => g.aliments.length > 0);
  }, [ingredients]);

  /** Sélectionne un aliment d'ajout rapide : même formulaire que la recherche,
   *  mais quantité et unité pré-remplies pour un stock courant. */
  const choisirRapide = useCallback(
    (a: { nom: string; emoji: string; quantite: number; unite: string; ingredient: Ingredient }) => {
      setSelection(a.ingredient);
      setQuantite(String(a.quantite));
      setUnite(a.unite);
      setExpiration('');
      setRecherche(a.nom);
    },
    []
  );

  /**
   * Créneaux de la semaine qui utilisent au moins un ingrédient du frigo.
   * Comptage par (jour, créneau) : deux repas du même jour comptent double,
   * comme les 14 repas de la semaine.
   */
  const creneauxCouverts = useMemo(() => {
    if (frigoIds.size === 0) return 0;
    const creneaux = new Set<string>();
    for (const pm of planMeals) {
      const ids = pm.meals?.meal_ingredients?.map(mi => mi.ingredient_id) ?? [];
      if (ids.some(id => frigoIds.has(id))) creneaux.add(`${pm.jour_semaine}-${pm.repas_type}`);
    }
    return creneaux.size;
  }, [planMeals, frigoIds]);

  // ── Audit #18 : le frigo devient une page DÉCISIONNELLE ──────────────────

  /** Produits à consommer en priorité : périmés ou ≤ 3 jours (triés par urgence) */
  const aUtiliser = useMemo(() => {
    if (!seuilPeremption) return [];
    const aujISO = seuilPeremption; // borne haute J+3
    const auj = new Date(`${new Date().toISOString().split('T')[0]}T12:00:00`);
    return items
      .filter(i => i.expiration != null && i.expiration <= aujISO)
      .sort((a, b) => (a.expiration ?? '').localeCompare(b.expiration ?? ''))
      .map(i => ({
        item: i,
        joursRestants: Math.round(
          (new Date(`${i.expiration}T12:00:00`).getTime() - auj.getTime()) / 86_400_000
        ),
      }));
  }, [items, seuilPeremption]);

  /** Répartition du garde-manger par rayon (compteurs, comme la maquette) */
  const parRayon = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of items) {
      const r = i.ingredient?.rayon ?? 'autres';
      m.set(r, (m.get(r) ?? 0) + 1);
    }
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [items]);

  const ajouter = useCallback(async () => {
    if (!selection) return;
    const q = Number(quantite);
    if (!Number.isFinite(q) || q <= 0) {
      toast.error('Indique une quantité valide');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/frigo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ingredient_id: selection.id,
          quantite: q,
          unite,
          expiration: expiration || null,
          semaine_debut: semaine,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`);
      setItems(json.items ?? []);
      setSelection(null);
      setRecherche('');
      setQuantite('1');
      setExpiration('');
      toast.success(
        json.liste_recalculee
          ? 'Ajouté — liste de courses mise à jour'
          : 'Ajouté à ton frigo'
      );
    } catch (e) {
      toast.error(errorMessage(e, "Impossible d'ajouter cet article"));
    } finally {
      setSaving(false);
    }
  }, [selection, quantite, unite, expiration, semaine]);

  const retirer = useCallback(async (id: number) => {
    try {
      const res = await fetch(`/api/frigo?id=${id}&semaine_debut=${semaine}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`);
      setItems(json.items ?? []);
    } catch (e) {
      toast.error(errorMessage(e, 'Impossible de retirer cet article'));
    }
  }, [semaine]);

  // Comparaison de dates uniquement : aucune fonction impure dans le rendu.
  const estProchePeremption = (date: string | null): boolean =>
    date != null && seuilPeremption !== '' && date <= seuilPeremption;

  // Session absente ou expirée : on explique au lieu de tourner indéfiniment
  // (le chargement du frigo ne démarre qu'avec un utilisateur).
  if (!authLoading && !user) {
    return (
      <DashboardShell>
        <div className="container-app py-20 text-center">
          <p className="text-gray-500 mb-4">Connecte-toi pour gérer ton frigo et ton garde-manger.</p>
          <Link href="/login"
            className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-brand-500 rounded-full hover:bg-brand-600 transition-colors">
            Se connecter
          </Link>
        </div>
      </DashboardShell>
    );
  }

  if (authLoading || loading) {
    return (
      <DashboardShell>
        <div className="container-app py-20 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-brand-500 animate-spin" />
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="container-app py-8 max-w-4xl">
        {/* Titre — pastille 44px inline (même convention que /recettes) au
            lieu du bloc 64px empilé qui décentrait la page en colonne étroite. */}
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-2xl bg-brand-50 flex items-center justify-center flex-shrink-0" aria-hidden>
              <Refrigerator className="w-5 h-5 text-brand-500" />
            </span>
            <h1 className="text-3xl font-bold font-display text-gray-900">Mon frigo</h1>
          </div>
          <p className="text-gray-500 mt-2 max-w-xl mx-auto">
            Ce que tu as déjà chez toi : le moteur privilégie les recettes qui l&apos;utilisent
            et la liste de courses en déduit les quantités. Anti-gaspillage 🌱
          </p>
        </div>

        {error && (
          <div className="bg-sable-50 border border-sable-200 rounded-2xl p-4 text-sm text-sable-700 text-center mb-6">
            {error}
          </div>
        )}

        {/* Insight : créneaux de la semaine couverts par le frigo + CTA (audit #18) */}
        {items.length > 0 && (
          <div className="mb-6 flex items-center justify-between gap-3 rounded-2xl bg-sauge-50 border border-sauge-200 px-4 py-3">
            <div className="flex items-center gap-3 min-w-0">
              <CalendarDays className="w-5 h-5 text-sauge-600 flex-shrink-0" />
              <p className="text-sm text-sauge-800 min-w-0">
                {creneauxCouverts > 0
                  ? <>✨ <strong>{creneauxCouverts} repas</strong> de cette semaine peuvent utiliser ce que tu as déjà.</>
                  : <>Ta semaine en cours n&apos;utilise encore aucun article de ton frigo.</>}
              </p>
            </div>
            <Link href="/vider-le-frigo" title="3 recettes rapides avec ce que tu as"
              className="flex-shrink-0 flex items-center gap-1.5 px-4 min-h-[40px] text-xs font-semibold text-white bg-sauge-600 rounded-full hover:bg-sauge-700 transition-colors">
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Optimiser avec mon frigo</span>
              <span className="sm:hidden">Optimiser</span>
            </Link>
          </div>
        )}

        {/* À utiliser rapidement : péremption ≤ 3 jours (audit #18 — la priorité
            absolue de la page : ce qui va se passer AVANT tout le reste) */}
        {aUtiliser.length > 0 && (
          <div className="mb-6 rounded-2xl border border-sable-300 bg-sable-50 p-4">
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-sable-700 mb-2.5">
              <AlertTriangle className="w-3.5 h-3.5" /> À utiliser rapidement ({aUtiliser.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {aUtiliser.slice(0, 8).map(({ item, joursRestants }) => (
                <span key={item.id}
                  className={cn(
                    'inline-flex items-center gap-1 min-h-[36px] px-3 py-1.5 text-xs font-medium rounded-full border',
                    joursRestants < 0 ? 'bg-red-50 text-red-700 border-red-200'
                      : joursRestants === 0 ? 'bg-sable-200 text-sable-800 border-sable-300'
                      : 'bg-white text-sable-700 border-sable-200'
                  )}
                  title={item.expiration != null ? `À consommer avant le ${new Date(`${item.expiration}T12:00:00`).toLocaleDateString('fr-FR')}` : ''}>
                  {item.ingredient?.nom ?? `#${item.ingredient_id}`}
                  <span className="font-bold">
                    {joursRestants < 0 ? '· dépassé' : joursRestants === 0 ? '· aujourd\u2019hui' : `· ${joursRestants}j`}
                  </span>
                </span>
              ))}
              {aUtiliser.length > 8 && <span className="text-xs text-sable-600 self-center">+{aUtiliser.length - 8}</span>}
            </div>
            <p className="text-[11px] text-sable-600 mt-2">
              Le moteur privilégie déjà ces produits à la prochaine génération — ou cuisine-les ce soir via « Optimiser ».
            </p>
          </div>
        )}

        {/* Répartition par rayon : lecture d'un coup d'œil (audit #18) */}
        {parRayon.length > 0 && (
          <div className="mb-6 flex flex-wrap gap-1.5">
            {parRayon.map(([rayon, n]) => (
              <span key={rayon} className="inline-flex items-center gap-1 px-3 py-1.5 min-h-[36px] text-xs font-medium rounded-full bg-white border border-gray-200 text-gray-600">
                {rayon} <span className="font-bold text-gray-900">{n}</span>
              </span>
            ))}
          </div>
        )}

        {/* Ajout d'un article */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900 text-sm">Ajouter un article</h2>
            {selection && (
              <span className="text-xs text-gray-500">Le formulaire ci-dessous est pré-rempli — ajustez puis validez.</span>
            )}
          </div>

          {/* Ajouts rapides : le garde-manger courant, par rayon, en un clic.
              Croisés avec le catalogue (jamais de création côté client) et
              repliés quand un ingredient est déjà sélectionné. */}
          {!selection && groupesRapides.length > 0 && (
            <div className="mb-4 rounded-xl bg-gray-50/60 border border-gray-100 p-4">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 mb-3">
                <Zap className="w-3.5 h-3.5 text-brand-500" />
                Ajouts rapides
                <span className="font-normal text-gray-500">— un clic pré-remplit le formulaire</span>
              </p>
              <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                {groupesRapides.map(g => (
                  <GroupeAjoutsRapides
                    key={g.label}
                    label={g.label}
                    aliments={g.aliments}
                    frigoCles={frigoCles}
                    onChoisir={choisirRapide}
                  />
                ))}
              </div>
            </div>
          )}

          {!selection ? (
            <>
              <div className="relative mb-3">
                <Search className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={recherche}
                  onChange={e => setRecherche(e.target.value)}
                  placeholder="Rechercher un ingrédient (œufs, poulet, carottes…)"
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-brand-300 placeholder:text-gray-400"
                />
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-52 overflow-y-auto">
                {ingredientsFiltres.map(ing => {
                  const dejaDedans = frigoIds.has(ing.id);
                  return (
                    <button key={ing.id}
                      onClick={() => { setSelection(ing); setQuantite('1'); }}
                      className={cn(
                        'inline-flex items-center min-h-[40px] px-3.5 py-2 text-xs font-medium rounded-full border transition-colors',
                        dejaDedans
                          ? 'bg-sauge-50 text-sauge-700 border-sauge-200 hover:border-sauge-300'
                          : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-brand-300 hover:text-brand-600'
                      )}>
                      {dejaDedans && <Check className="w-3 h-3 inline mr-1" />}
                      {ing.nom}
                    </button>
                  );
                })}
                {ingredientsFiltres.length === 0 && (
                  <p className="text-sm text-gray-500 py-4">Aucun ingrédient trouvé.</p>
                )}
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 bg-brand-500 text-white text-xs font-medium rounded-full">
                  {selection.nom}
                </span>
                <button onClick={() => setSelection(null)}
                  className="text-xs text-gray-500 hover:text-gray-600 transition-colors">
                  changer
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Quantité</span>
                  <input type="number" min={0.1} step="0.1" value={quantite}
                    onChange={e => setQuantite(e.target.value)}
                    className="px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-300" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Unité</span>
                  <select value={unite} onChange={e => setUnite(e.target.value)}
                    className="px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-300">
                    {['g', 'kg', 'ml', 'cl', 'L', ...UNITES_FRIGO.filter(u => u !== 'g' && u !== 'ml')]
                      .filter((u, i, arr) => arr.indexOf(u) === i)
                      .map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Péremption</span>
                  <input type="date" value={expiration} onChange={e => setExpiration(e.target.value)}
                    className="px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-300" />
                </label>
              </div>

              <button onClick={ajouter} disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-brand-500 rounded-full hover:bg-brand-600 disabled:opacity-50 transition-colors">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Ajouter au frigo
              </button>
            </div>
          )}
        </div>

        {/* Inventaire */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900 text-sm">
              Mon garde-manger <span className="text-gray-500 font-normal">({items.length})</span>
            </h2>
            <Link href="/vider-le-frigo"
              className="flex items-center gap-1 py-2.5 -my-2.5 text-xs font-medium text-brand-600 hover:text-brand-700 transition-colors">
              <Sparkles className="w-3 h-3" /> Trouver une recette avec ce frigo
            </Link>
          </div>

          {items.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-4xl mb-2" aria-hidden>🧊</p>
              <p className="text-sm text-gray-500">Ton frigo est vide ici.</p>
              <p className="text-xs text-gray-500 mt-1">
                Ajoute ce que tu as chez toi : le moteur en tiendra compte dès la prochaine génération.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-50">
              {items.map(item => (
                <li key={item.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {item.ingredient?.nom ?? `Ingrédient #${item.ingredient_id}`}
                    </p>
                    <p className="text-[11px] text-gray-500">
                      {item.quantite} {item.unite}
                      {item.expiration && (
                        <span className={cn('ml-2 font-semibold', estProchePeremption(item.expiration) ? 'text-sable-600' : 'text-gray-500')}>
                          {estProchePeremption(item.expiration) ? '⏳ ' : ''}
                          à consommer avant le {new Date(`${item.expiration}T12:00:00`).toLocaleDateString('fr-FR')}
                        </span>
                      )}
                    </p>
                  </div>
                  <button onClick={() => retirer(item.id)} aria-label={`Retirer ${item.ingredient?.nom ?? ''}`}
                    className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
