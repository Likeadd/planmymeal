'use client';

// ============================================================================
// Mon frigo — garde-manger persistant
//
// Inventaire PERSISTANT : ce que tu as chez toi est enregistré, le moteur en
// tient compte à la génération (léger boost des recettes concernées) et la
// liste de courses en déduit automatiquement les quantités disponibles.
// L'utilisateur coche les aliments qu'il veut écouler : /api/vider-le-frigo
// propose alors 3 recettes, affichées sous l'inventaire.
//
// À chaque ajout ou retrait, /api/frigo recalcule la liste de courses de la
// semaine en cours : l'inventaire et les courses ne peuvent pas diverger.
// ============================================================================

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Refrigerator, Loader2, Plus, Trash2, Sparkles, Check, Zap, AlertTriangle, X, Minus,
  Clock, ShoppingCart, RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { gererPaywall } from '@/lib/paywall';
import type { FridgeItem, Ingredient } from '@/types';
import { createBrowserClient } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { ALIMENTS_FRIGO, cleNomIngredient } from '@/lib/frigo';
import { getMonday } from '@/lib/dates';
import { DICT_FR } from '@/lib/i18n/fr';
import { errorMessage, cn, formatMinutes } from '@/lib/utils';
import { formatPrix } from '@/lib/budget';
import { recetteHref } from '@/lib/seo';

/** Ligne de plan_meals avec l'embed minimal nécessaire au comptage frigo */
interface PlanMealFrigo {
  jour_semaine: number;
  repas_type: string;
  meals: { meal_ingredients: { ingredient_id: number }[] } | null;
}

/** Recette proposée par /api/vider-le-frigo */
interface RecetteFrigo {
  id: number;
  titre: string;
  temps_total: number;
  prix_portion: number | null;
  couverture: number;
  nb_manquants: number;
  manquants: string[];
}

/** Plafond d'ingrédients accepté par /api/vider-le-frigo */
const MAX_SELECTION = 15;

/** Un aliment d'ajout rapide résolu contre le catalogue réel, en attente d'ajout. */
interface AlimentPanier {
  nom: string;
  emoji: string;
  quantite: number;
  unite: string;
  ingredient: Ingredient;
}

/** Pas d'incrément du stepper de quantité, adapté à l'unité — 1 pièce n'a pas
 *  le même sens qu'1 gramme. */
function stepPourUnite(unite: string): number {
  if (['pcs', 'botte', 'boite', 'sachet'].includes(unite)) return 1;
  if (unite === 'kg' || unite === 'L') return 0.5;
  if (unite === 'cl') return 5;
  return 50; // g, ml
}

/**
 * Groupe d'ajouts rapides : les puces du rayon, cliquables une à une pour
 * basculer dans le panier ci-dessous. Deux états visuels indépendants :
 * « déjà au frigo » (informatif, pastille sauge) et « dans le panier »
 * (sélection en cours, pastille brand — c'est celui qui prime).
 */
function GroupeAjoutsRapides({
  label, aliments, frigoCles, panierIds, onToggle,
}: {
  label: string;
  aliments: AlimentPanier[];
  /** Clés (noms normalisés) des ingrédients déjà dans le garde-manger */
  frigoCles: Set<string>;
  /** Ids des ingrédients actuellement dans le panier (en attente d'ajout) */
  panierIds: Set<number>;
  onToggle: (a: AlimentPanier) => void;
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1.5">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {aliments.map(a => {
          const dansPanier = panierIds.has(a.ingredient.id);
          const dejaDedans = !dansPanier && frigoCles.has(cleNomIngredient(a.nom));
          return (
            <button key={a.nom} onClick={() => onToggle(a)}
              title={`${a.nom} — ${a.quantite} ${a.unite}`}
              className={cn(
                'inline-flex items-center min-h-[40px] px-3 py-2 text-xs font-medium rounded-full border transition-colors',
                dansPanier
                  ? 'bg-brand-500 text-white border-brand-500'
                  : dejaDedans
                    ? 'bg-sauge-50 text-sauge-700 border-sauge-200'
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-brand-300 hover:text-brand-600'
              )}>
              <span aria-hidden>{a.emoji}</span> {a.nom}
              {dansPanier && <Check className="w-3 h-3 inline ml-1 -mt-0.5" />}
              {dejaDedans && <Check className="w-3 h-3 inline ml-1 -mt-0.5" />}
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
  /** Panier de la modale : aliments cochés dans les ajouts rapides, en attente
   *  de validation (récap affiché sous les puces). */
  const [panier, setPanier] = useState<AlimentPanier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [planMeals, setPlanMeals] = useState<PlanMealFrigo[]>([]);
  const [error, setError] = useState('');
  /** Date seuil « périme bientôt » (J+3), calculée dans l'effet de chargement */
  const [seuilPeremption, setSeuilPeremption] = useState('');
  /** Modale « Ajouter un article » — repliée par défaut (nouveau design) */
  const [ajoutOuvert, setAjoutOuvert] = useState(false);
  /** Aliments cochés (ingredient_id) pour la recherche de recettes */
  const [selection, setSelection] = useState<Set<number>>(new Set());
  const [recettes, setRecettes] = useState<RecetteFrigo[] | null>(null);
  const [recherche, setRecherche] = useState(false);
  const [erreurRecettes, setErreurRecettes] = useState('');

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

  /** Ids du panier (pour l'état visuel des puces) */
  const panierIds = useMemo(() => new Set(panier.map(p => p.ingredient.id)), [panier]);

  /** Coche/décoche un aliment d'ajout rapide : bascule dans le panier avec sa
   *  quantité courante, prête à ajuster dans le récap. */
  const togglePanier = useCallback((a: AlimentPanier) => {
    setPanier(prev => {
      const i = prev.findIndex(p => p.ingredient.id === a.ingredient.id);
      if (i >= 0) return prev.filter((_, idx) => idx !== i);
      return [...prev, a];
    });
  }, []);

  /** Ajuste la quantité d'un article du panier (jamais en dessous de 0,1). */
  const ajusterQuantitePanier = useCallback((ingredientId: number, delta: number) => {
    setPanier(prev => prev.map(p =>
      p.ingredient.id === ingredientId
        ? { ...p, quantite: Math.max(0.1, Math.round((p.quantite + delta) * 100) / 100) }
        : p
    ));
  }, []);

  const retirerDuPanier = useCallback((ingredientId: number) => {
    setPanier(prev => prev.filter(p => p.ingredient.id !== ingredientId));
  }, []);

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

  /** Inventaire groupé par rayon (libellé + emoji du dictionnaire), triés par
   *  nombre d'articles décroissant — lecture par famille au lieu d'une liste
   *  plate, plus lisible dès qu'il y a plus d'une poignée d'articles. */
  const inventaireParRayon = useMemo(() => {
    const groupes = new Map<string, FridgeItem[]>();
    for (const item of items) {
      const r = item.ingredient?.rayon ?? 'autres';
      const arr = groupes.get(r) ?? [];
      arr.push(item);
      groupes.set(r, arr);
    }
    return Array.from(groupes.entries())
      .map(([rayon, arr]) => ({
        rayon,
        label: DICT_FR.rayons[rayon as keyof typeof DICT_FR.rayons] ?? `📦 ${rayon}`,
        items: arr,
      }))
      .sort((a, b) => b.items.length - a.items.length);
  }, [items]);

  /** Valide le panier : ajoute chaque article coché, un appel API à la fois
   *  (l'endpoint ne prend qu'un ingrédient par requête). En cas d'échec, les
   *  articles déjà ajoutés restent enregistrés et seuls ceux qui restent sont
   *  laissés dans le panier pour un nouvel essai. */
  const ajouterPanier = useCallback(async () => {
    if (panier.length === 0) return;
    setSaving(true);
    let dernierRecalcul = false;
    const restants = [...panier];
    try {
      while (restants.length > 0) {
        const a = restants[0];
        const res = await fetch('/api/frigo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ingredient_id: a.ingredient.id,
            quantite: a.quantite,
            unite: a.unite,
            semaine_debut: semaine,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`);
        setItems(json.items ?? []);
        dernierRecalcul = json.liste_recalculee ?? dernierRecalcul;
        restants.shift();
        setPanier([...restants]);
      }
      toast.success(
        dernierRecalcul
          ? `${panier.length} article(s) ajouté(s) — liste de courses mise à jour`
          : `${panier.length} article(s) ajouté(s) à ton frigo`
      );
      setAjoutOuvert(false);
    } catch (e) {
      toast.error(errorMessage(e, "Impossible d'ajouter certains articles"));
    } finally {
      setSaving(false);
    }
  }, [panier, semaine]);

  /** Sélection réellement valide : un article retiré du frigo sort du lot. */
  const selectionValide = useMemo(
    () => Array.from(selection).filter(id => frigoIds.has(id)),
    [selection, frigoIds]
  );

  const basculerSelection = useCallback((ingredientId: number) => {
    setRecettes(null); // nouvelle sélection → résultats périmés
    setErreurRecettes('');
    setSelection(prev => {
      const next = new Set(prev);
      if (next.has(ingredientId)) next.delete(ingredientId);
      else if (next.size < MAX_SELECTION) next.add(ingredientId);
      else toast.info(`${MAX_SELECTION} aliments maximum par recherche`);
      return next;
    });
  }, []);

  /** Tout cocher : les produits qui périment d'abord, puis le reste. */
  const toutSelectionner = useCallback(() => {
    setRecettes(null);
    setErreurRecettes('');
    const urgents = aUtiliser.map(u => u.item.ingredient_id);
    const autres = items.map(i => i.ingredient_id).filter(id => !urgents.includes(id));
    setSelection(new Set([...urgents, ...autres].slice(0, MAX_SELECTION)));
  }, [items, aUtiliser]);

  const toutDecocher = useCallback(() => {
    setSelection(new Set());
    setRecettes(null);
    setErreurRecettes('');
  }, []);

  const trouverRecettes = useCallback(async () => {
    if (selectionValide.length === 0) return;
    setRecherche(true);
    setErreurRecettes('');
    try {
      const res = await fetch('/api/vider-le-frigo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ingredient_ids: selectionValide }),
      });
      if (await gererPaywall(res)) return;
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`);
      setRecettes(json.recettes ?? []);
      if (!json.recettes?.length) {
        setErreurRecettes('Aucune recette rapide ne correspond à ta sélection — coche un aliment de plus.');
      }
    } catch (e) {
      setErreurRecettes(errorMessage(e, 'Impossible de chercher des recettes'));
    } finally {
      setRecherche(false);
    }
  }, [selectionValide]);

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
        {/* En-tête : titre + CTA d'ajout principal, sur la même ligne en desktop
            (nouveau design — l'action la plus fréquente est visible sans scroll). */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-2xl bg-brand-50 flex items-center justify-center shrink-0" aria-hidden>
              <Refrigerator className="w-5 h-5 text-brand-500" />
            </span>
            <div>
              <h1 className="text-3xl font-bold font-display text-gray-900">Mon frigo</h1>
              <p className="text-gray-500 text-sm mt-0.5 max-w-md">
                Ce que tu as déjà chez toi — le moteur privilégie ces recettes. Anti-gaspillage 🌱
              </p>
            </div>
          </div>
          <button data-tour="frigo-ajouter" onClick={() => setAjoutOuvert(true)}
            className="flex items-center gap-2 px-5 py-3 min-h-[44px] text-sm font-semibold text-white bg-brand-500 rounded-full hover:bg-brand-600 shadow-cta transition-colors shrink-0">
            <Plus className="w-4 h-4" /> Ajouter un article
          </button>
        </div>

        {error && (
          <div className="bg-sable-50 border border-sable-200 rounded-2xl p-4 text-sm text-sable-700 text-center mb-6">
            {error}
          </div>
        )}

        {/* Stats en un coup d'œil (nouveau design — remplace le bandeau unique) */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="rounded-2xl bg-white border border-gray-100 shadow-xs px-4 py-3.5 text-center">
            <p className="text-2xl font-bold font-display text-gray-900">{items.length}</p>
            <p className="text-[11px] text-gray-500 mt-0.5">Articles</p>
          </div>
          <div className="rounded-2xl bg-sauge-50 border border-sauge-200 px-4 py-3.5 text-center">
            <p className="text-2xl font-bold font-display text-sauge-700">{creneauxCouverts}</p>
            <p className="text-[11px] text-sauge-700 mt-0.5">Repas couverts</p>
          </div>
          <div className={cn(
            'rounded-2xl border px-4 py-3.5 text-center',
            aUtiliser.length > 0 ? 'bg-sable-50 border-sable-300' : 'bg-white border-gray-100 shadow-xs'
          )}>
            <p className={cn('text-2xl font-bold font-display', aUtiliser.length > 0 ? 'text-sable-700' : 'text-gray-900')}>
              {aUtiliser.length}
            </p>
            <p className={cn('text-[11px] mt-0.5', aUtiliser.length > 0 ? 'text-sable-700' : 'text-gray-500')}>
              À utiliser vite
            </p>
          </div>
        </div>

        {/* CTA recette : agit sur les aliments cochés dans l'inventaire ci-dessous */}
        {items.length > 0 && (
          <div className="mb-6" data-tour="frigo-recettes">
            <button onClick={trouverRecettes} disabled={recherche || selectionValide.length === 0}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 min-h-[44px] text-sm font-semibold text-white bg-sauge-600 rounded-full hover:bg-sauge-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors">
              {recherche
                ? <><Loader2 className="w-4 h-4 animate-spin" /> On cherche dans ton frigo…</>
                : <><Sparkles className="w-4 h-4" />
                    {selectionValide.length === 0
                      ? 'Coche des aliments pour trouver des recettes'
                      : `Trouver des recettes avec ma sélection (${selectionValide.length})`}</>}
            </button>
            {erreurRecettes && (
              <p className="mt-3 bg-sable-50 border border-sable-200 rounded-2xl p-3 text-sm text-sable-700 text-center">
                {erreurRecettes}
              </p>
            )}
          </div>
        )}

        {/* Recettes proposées avec les aliments cochés */}
        {recettes && recettes.length > 0 && (
          <div className="mb-6">
            <h2 className="font-bold text-gray-900 text-lg mb-3">✨ {recettes.length} idées avec ta sélection</h2>
            <div className="grid sm:grid-cols-3 gap-4">
              {recettes.map((r, idx) => (
                <Link key={r.id} href={recetteHref(r)}
                  className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-lg hover:border-brand-200 transition-all group">
                  <div className="relative bg-brand-50 h-24 flex items-center justify-center">
                    <span className="text-4xl transition-transform duration-300 group-hover:scale-110" aria-hidden>🧑‍🍳</span>
                    <span className="absolute top-2 left-2 px-2 py-0.5 bg-white/90 rounded-full text-[11px] font-bold text-brand-600">
                      #{idx + 1} · {r.couverture}%
                    </span>
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900 text-sm mb-2 line-clamp-2 group-hover:text-brand-600 transition-colors">{r.titre}</h3>
                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {formatMinutes(r.temps_total)}</span>
                      {r.prix_portion != null && (
                        <span className="font-semibold text-sauge-700 bg-sauge-50 px-1.5 rounded-full">{formatPrix(r.prix_portion)}</span>
                      )}
                    </div>
                    {r.nb_manquants > 0 ? (
                      <p className="text-[11px] text-sable-600 flex items-start gap-1">
                        <ShoppingCart className="w-3 h-3 mt-0.5 shrink-0" />
                        <span>À acheter : {r.manquants.join(', ')}{r.nb_manquants > 4 ? '…' : ''}</span>
                      </p>
                    ) : (
                      <p className="text-[11px] text-sauge-600 font-medium">✅ Tout est déjà dans ton frigo !</p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
            <p className="text-center text-xs text-gray-500 mt-3">
              Une autre idée ? Change ta sélection, ou{' '}
              <button onClick={trouverRecettes} className="text-brand-600 font-medium hover:underline inline-flex items-center gap-1">
                <RefreshCw className="w-3 h-3" /> relance la recherche
              </button>
            </p>
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

        {/* Inventaire — groupé par rayon (nouveau design : lecture par famille
            au lieu d'une liste plate, qui devenait illisible passé 15 articles) */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-xs">
          <div className="flex items-center justify-between gap-3 mb-1">
            <h2 className="font-semibold text-gray-900 text-sm">
              Mon garde-manger <span className="text-gray-500 font-normal">({items.length})</span>
            </h2>
            {items.length > 0 && (
              selectionValide.length > 0 ? (
                <button onClick={toutDecocher}
                  className="text-xs text-gray-500 hover:text-red-500 transition-colors min-h-[32px]">
                  Tout décocher
                </button>
              ) : (
                <button onClick={toutSelectionner}
                  className="text-xs font-medium text-brand-600 hover:underline min-h-[32px]">
                  Tout cocher
                </button>
              )
            )}
          </div>
          {items.length > 0 && (
            <p className="text-[11px] text-gray-500 mb-4">Coche ce qu’il te reste pour obtenir des idées de recettes.</p>
          )}

          {items.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-4xl mb-2" aria-hidden>🧊</p>
              <p className="text-sm text-gray-500">Ton frigo est vide ici.</p>
              <p className="text-xs text-gray-500 mt-1 mb-4">
                Ajoute ce que tu as chez toi : le moteur en tiendra compte dès la prochaine génération.
              </p>
              <button onClick={() => setAjoutOuvert(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-brand-500 rounded-full hover:bg-brand-600 transition-colors">
                <Plus className="w-4 h-4" /> Ajouter un article
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {inventaireParRayon.map(groupe => (
                <div key={groupe.rayon}>
                  <p className="text-xs font-semibold text-gray-600 mb-2">
                    {groupe.label} <span className="text-gray-400 font-normal">({groupe.items.length})</span>
                  </p>
                  <ul className="divide-y divide-gray-50 rounded-xl border border-gray-50">
                    {groupe.items.map(item => (
                      <li key={item.id} className="px-3 py-2.5 flex items-center justify-between gap-3">
                        <button type="button" role="checkbox" aria-checked={selection.has(item.ingredient_id)}
                          onClick={() => basculerSelection(item.ingredient_id)}
                          aria-label={`Utiliser ${item.ingredient?.nom ?? 'cet aliment'} dans la recherche de recettes`}
                          className="flex items-center justify-center w-11 h-11 -ml-2 shrink-0">
                          <span className={cn(
                            'w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors',
                            selection.has(item.ingredient_id)
                              ? 'bg-brand-500 border-brand-500 text-white'
                              : 'border-gray-300 bg-white'
                          )}>
                            {selection.has(item.ingredient_id) && <Check className="w-3.5 h-3.5" />}
                          </span>
                        </button>
                        <div className="min-w-0 flex-1">
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
                          className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modale « Ajouter un article » — même patron que les autres modales de
          l'app (bottom-sheet mobile / centrée desktop, cf. WhyModal) : plus de
          formulaire toujours visible qui alourdissait la page en permanence. */}
      {ajoutOuvert && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
          role="dialog" aria-modal="true" aria-label="Ajouter un article au frigo">
          <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-xs" onClick={() => setAjoutOuvert(false)} aria-hidden />

          <div className="animate-sheet-in relative w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-xl border border-gray-100 max-h-[88vh] overflow-y-auto">

            <div className="sticky top-0 bg-white/95 backdrop-blur-sm px-5 pt-5 pb-3 border-b border-gray-100 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold tracking-[0.14em] uppercase text-brand-500">Garde-manger</p>
                <h3 className="font-display font-bold text-gray-900 leading-snug">Ajouter des articles</h3>
              </div>
              <button onClick={() => setAjoutOuvert(false)} aria-label="Fermer"
                className="p-1.5 rounded-full text-gray-500 hover:text-gray-600 hover:bg-gray-50 transition-colors shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 py-4">
              {/* Ajouts rapides : le garde-manger courant, par rayon, en un clic
                  qui coche/décoche l'aliment dans le panier ci-dessous. Croisés
                  avec le catalogue — on ne crée jamais d'ingrédient côté client. */}
              {groupesRapides.length > 0 ? (
                <div className="rounded-xl bg-gray-50/60 border border-gray-100 p-4">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 mb-3">
                    <Zap className="w-3.5 h-3.5 text-brand-500" />
                    Ajouts rapides
                    <span className="font-normal text-gray-500">— coche ce que tu as chez toi</span>
                  </p>
                  <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                    {groupesRapides.map(g => (
                      <GroupeAjoutsRapides
                        key={g.label}
                        label={g.label}
                        aliments={g.aliments}
                        frigoCles={frigoCles}
                        panierIds={panierIds}
                        onToggle={togglePanier}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500 py-4 text-center">Aucun aliment disponible pour le moment.</p>
              )}

              {/* Récap du panier : tout ce qui a été coché ci-dessus, avec une
                  quantité ajustable, avant validation groupée. */}
              {panier.length > 0 && (
                <div className="mt-4 rounded-xl border border-brand-100 bg-brand-50/40 p-4">
                  <p className="text-xs font-semibold text-gray-700 mb-3">
                    Sélection ({panier.length})
                  </p>
                  <ul className="space-y-2">
                    {panier.map(a => (
                      <li key={a.ingredient.id} className="flex items-center justify-between gap-3 bg-white rounded-xl border border-gray-100 px-3 py-2">
                        <span className="min-w-0 flex items-center gap-2 text-sm font-medium text-gray-800 truncate">
                          <span aria-hidden>{a.emoji}</span> {a.nom}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          <button onClick={() => ajusterQuantitePanier(a.ingredient.id, -stepPourUnite(a.unite))}
                            aria-label={`Diminuer la quantité de ${a.nom}`}
                            className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-50 border border-gray-200 text-gray-600 hover:border-brand-300 hover:text-brand-600 transition-colors">
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-xs font-semibold text-gray-700 w-16 text-center tabular-nums">
                            {a.quantite} {a.unite}
                          </span>
                          <button onClick={() => ajusterQuantitePanier(a.ingredient.id, stepPourUnite(a.unite))}
                            aria-label={`Augmenter la quantité de ${a.nom}`}
                            className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-50 border border-gray-200 text-gray-600 hover:border-brand-300 hover:text-brand-600 transition-colors">
                            <Plus className="w-3 h-3" />
                          </button>
                          <button onClick={() => retirerDuPanier(a.ingredient.id)}
                            aria-label={`Retirer ${a.nom} de la sélection`}
                            className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>

                  <button onClick={ajouterPanier} disabled={saving}
                    className="mt-3 w-full flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-brand-500 rounded-full hover:bg-brand-600 disabled:opacity-50 transition-colors">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Ajouter {panier.length} article{panier.length > 1 ? 's' : ''} au frigo
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
