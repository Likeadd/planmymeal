'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { getMondayWithOffset, JOURS_NOMS } from '@/lib/dates';
import { celebrate } from '@/lib/celebrate';
import { toRecettePlanning, COLONNES_RECETTE_PLANNING, type WeeklyPlanEmbed } from '@/lib/db-rows';
import { chargerSuggestionsSwap } from '@/lib/catalogue';
import {
  saveCachedWeek, loadCachedWeek, queuePendingToggle,
  loadPendingToggles, replacePendingToggles,
} from '@/lib/offline-cache';
import type { DayPlan, RecetteSwap, RepasSlot, TypeRepas } from '@/types';
import type { IntentionOptimisation } from '@/lib/rotation-engine';
import { DICT_FR } from '@/lib/i18n/fr';

interface ShoppingSection {
  rayon: string;
  label: string;
  items: { nom: string; quantite: string; ingredient_id: number; checked: boolean }[];
}

interface UseWeeklyPlanResult {
  days: DayPlan[];
  shoppingSections: ShoppingSection[];
  shoppingListId: number | null;
  planId: number | null;
  loading: boolean;
  regenerating: boolean;
  error: string;
  empty: boolean;
  semaineDebut: string;
  /** true = données servies depuis le cache local (hors ligne / réseau KO) */
  fromCache: boolean;
  /** Connectivité navigateur (bannière « mode hors ligne » sur le dashboard) */
  estEnLigne: boolean;
  /** true = la semaine a été générée en réutilisant des recettes récentes (cooldown levé) */
  fallbackUtilise: boolean;
  /** En fallback : cuisines peu servies récemment, mises en avant cette semaine */
  cuisinesDiversifiees: string[];
  /** Décompte de la semaine : repas / desserts (soir + midi) / restes — sert au toast de confirmation et aux légendes */
  recup: { repas: number; desserts: number; restes: number };
  /** Régénérer toute la semaine — `intention` incline la pondération du moteur (budget, temps, gaspillage) */
  regenerate: (intention?: IntentionOptimisation) => Promise<void>;
  /** Régénérer uniquement un repas (jour + créneau, desserts inclus) sans toucher au reste */
  regenerateMeal: (dayIndex: number, repas: RepasSlot) => Promise<void>;
  /** État de chargement par créneau, clé "jourIndex-repas" */
  regeneratingSlots: Record<string, boolean>;
  toggleShoppingItem: (rayon: string, nom: string) => void;
  /** Tout décocher la liste de courses (nouveau passage magasin) — 1 requête serveur */
  uncheckAllShoppingItems: () => void;
  /** Swap un repas sur un jour donné (dejeuner / diner / dessert / dessert midi) — liste de courses recalculée côté serveur */
  swapMeal: (dayIndex: number, repas: RepasSlot, newMealId: number) => Promise<void>;
  /** Déplacer un repas d'un jour à l'autre (desserts inclus ; dessert ↔ repas principal permis) */
  moveMeal: (fromDay: number, fromType: RepasSlot, toDay: number, toType: RepasSlot) => void;
  /** Marquer un repas comme cooked/skipped */
  markMealStatus: (mealId: number, status: 'cooked' | 'skipped') => Promise<void>;
  /** Toggle restes sur le dîner d'un jour : cuisiné ×2, mangé aussi le lendemain midi */
  toggleRestes: (jourDiner: number) => Promise<void>;
  /** Jour dont le toggle restes est en cours (bouton en loading) */
  restesToggling: number | null;
  /** Chercher des repas alternatifs pour un swap (créneau dessert → desserts uniquement) */
  fetchSwapSuggestions: (dayIndex: number, repas: RepasSlot, type?: TypeRepas | 'tous') => Promise<RecetteSwap[]>;
  /** Offset de la semaine affichée (0 = semaine en cours, -1 = précédente, +1 = suivante) */
  weekOffset: number;
  /** true = la semaine affichée est la semaine en cours */
  estSemaineCourante: boolean;
  /** Naviguer vers une semaine relative (borné entre WEEK_OFFSET_MIN et WEEK_OFFSET_MAX) */
  goToWeek: (offset: number) => void;
  /** Revenir à la semaine en cours */
  goToCurrentWeek: () => void;
}


/** Bornes de navigation : jusqu'à 12 semaines en arrière, 4 en avant */
export const WEEK_OFFSET_MIN = -12;
export const WEEK_OFFSET_MAX = 4;

// Libellés de rayons : dictionnaire i18n (lib/i18n/fr.ts) — plus de labels
// codés en dur dans le hook (fondation i18n, audit P0.4)
const RAYON_LABELS: Record<string, string> = DICT_FR.rayons;

export function useWeeklyPlan(initialOffset = 0): UseWeeklyPlanResult {
  const [days, setDays] = useState<DayPlan[]>([]);
  const [shoppingSections, setShoppingSections] = useState<ShoppingSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState('');
  const [empty, setEmpty] = useState(false);
  const [planId, setPlanId] = useState<number | null>(null);
  const [shoppingListId, setShoppingListId] = useState<number | null>(null);
  // Navigation semaine : offset relatif à la semaine en cours (0 = courante).
  // Changer l'offset change `semaineDebut` → `loadPlan` est recréé → l'effet
  // de chargement initial se rejoue sur la nouvelle semaine.
  const [weekOffset, setWeekOffset] = useState(() =>
    Math.min(WEEK_OFFSET_MAX, Math.max(WEEK_OFFSET_MIN, initialOffset))
  );
  const semaineDebut = useMemo(() => getMondayWithOffset(weekOffset), [weekOffset]);
  const [fallbackUtilise, setFallbackUtilise] = useState(false);
  const [cuisinesDiversifiees, setCuisinesDiversifiees] = useState<string[]>([]);
  const [regeneratingSlots, setRegeneratingSlots] = useState<Record<string, boolean>>({});
  const [restesToggling, setRestesToggling] = useState<number | null>(null);
  // Mode hors ligne : cache local + file de toggles en attente de synchro
  const [fromCache, setFromCache] = useState(false);
  const [estEnLigne, setEstEnLigne] = useState(true);

  const supabase = createBrowserClient();

  /** Récap de la semaine (repas / desserts / restes) : explique le résultat du
   *  moteur — « pourquoi certains soirs n'ont pas de dessert » devient une
   *  information affichée, pas une question laissée à l'utilisateur. */
  const recup = useMemo(() => {
    let repas = 0;
    let desserts = 0;
    let restes = 0;
    for (const d of days) {
      for (const m of [d.dejeuner, d.diner, d.dessert, d.dessertMidi]) {
        if (m) repas++;
      }
      if (d.dessert) desserts++;
      if (d.dessertMidi) desserts++;
      if (d.restesDe != null) restes++;
    }
    return { repas, desserts, restes };
  }, [days]);

  // Rejouer les toggles cochés hors ligne (retour du réseau / au chargement)
  const flushPendingToggles = useCallback(async () => {
    const pending = loadPendingToggles();
    if (pending.length === 0) return;
    const echecs: typeof pending = [];
    for (const t of pending) {
      const { error } = await supabase
        .from('shopping_list_items')
        .update({ checked: t.checked })
        .eq('list_id', t.listId)
        .eq('ingredient_id', t.ingredientId);
      if (error) echecs.push(t);
    }
    replacePendingToggles(echecs);
  }, [supabase]);

  // Connectivité : à chaque retour du réseau, on resynchronise les coches
  useEffect(() => {
    const upd = () => setEstEnLigne(navigator.onLine);
    upd();
    const onOnline = () => { upd(); void flushPendingToggles(); };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', upd);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', upd);
    };
  }, [flushPendingToggles]);

  // Charger le planning existant
  // NB : pas de setState AVANT le premier await (setState synchrone dans un
  // effet = rendus en cascade). `loading` est initialisé à true et chaque
  // branchement publie son résultat d'un bloc après les requêtes.
  const loadPlan = useCallback(async () => {
    const { data: plan, error: planError } = await supabase
      .from('weekly_plans')
      // `COLONNES_RECETTE_PLANNING` et non `*` : les instructions (≈1 ko par
      // recette) et les macros détaillées n'étaient téléchargées que pour finir
      // dans le cache localStorage sans jamais être affichées. Le type
      // `RecettePlanning` interdit désormais à une carte de les lire.
      .select(`id, semaine_debut, fallback_utilise, cuisines_diversifiees, plan_meals(jour_semaine, repas_type, meal_id, est_reste_de, meals!plan_meals_meal_id_fkey(${COLONNES_RECETTE_PLANNING}))`)
      .eq('is_active', true)
      .eq('semaine_debut', semaineDebut)
      .order('generated_at', { ascending: false })
      .limit(1)
      .single();

    if (planError || !plan) {
      if (planError?.code === 'PGRST116') {
        setEmpty(true);
        setDays([]);
        setShoppingSections([]);
        setPlanId(null);
        setShoppingListId(null);
      } else {
        // Réseau KO (supermarché, sous-sol...) → repli sur le cache local :
        // la liste de courses reste consultable et cocheable.
        const cached = loadCachedWeek(semaineDebut);
        if (cached) {
          setDays(cached.days as DayPlan[]);
          setShoppingSections(cached.sections as ShoppingSection[]);
          setPlanId(cached.planId);
          setShoppingListId(cached.shoppingListId);
          setFallbackUtilise(cached.fallbackUtilise);
          setCuisinesDiversifiees(cached.cuisinesDiversifiees);
          setFromCache(true);
          setEmpty(false);
          setError('');
          setLoading(false);
          return;
        }
        setError(planError?.message || 'Erreur lors du chargement');
      }
      setLoading(false);
      return;
    }

    setPlanId(plan.id);
    setFallbackUtilise(plan.fallback_utilise === true);
    setCuisinesDiversifiees(Array.isArray(plan.cuisines_diversifiees) ? plan.cuisines_diversifiees : []);

    // Transformer plan_meals en DayPlan[]
    const builtDays: DayPlan[] = JOURS_NOMS.map((jour, idx) => ({
      jour,
      jourIndex: idx,
      dejeuner: null,
      diner: null,
      dessert: null,
      dessertMidi: null,
    }));

    const planEmbed = plan as unknown as WeeklyPlanEmbed;
    for (const pm of planEmbed.plan_meals || []) {
      const dayIdx = pm.jour_semaine;
      const mealRaw = pm.meals;
      if (!mealRaw || dayIdx < 0 || dayIdx > 6) continue;

      // Normaliser meal_ingredients → ingredients pour le calcul du prix
      const meal = toRecettePlanning(mealRaw);

      if (pm.repas_type === 'dejeuner') {
        builtDays[dayIdx].dejeuner = meal;
        builtDays[dayIdx].restesDe = pm.est_reste_de ?? null;
      } else if (pm.repas_type === 'diner') {
        builtDays[dayIdx].diner = meal;
      } else if (pm.repas_type === 'dessert') {
        builtDays[dayIdx].dessert = meal;
      } else if (pm.repas_type === 'dessert_midi') {
        builtDays[dayIdx].dessertMidi = meal;
      }
    }

    setDays(builtDays);

    // Charger la liste de courses associée
    const { data: shopList } = await supabase
      .from('shopping_lists')
      .select('id')
      .eq('plan_id', plan.id)
      .eq('is_active', true)
      .limit(1)
      .single();

    setShoppingListId(shopList?.id || null);

    let sectionsResult: ShoppingSection[] = [];
    if (shopList) {
      const { data: items } = await supabase
        .from('shopping_list_items')
        .select('ingredient_id, quantite_totale, unite, rayon, checked, ingredients!inner(nom)')
        .eq('list_id', shopList.id)
        .order('rayon');

      if (items) {
        // Regrouper par rayon — clé = rayon BRUT (fruits_legumes…) : c'est lui
        // qui pilote le tri « parcours magasin » de la liste. Le libellé emoji
        // (RAYON_LABELS) n'est que de l'affichage.
        const sections = new Map<string, { rayon: string; label: string; items: { nom: string; quantite: string; ingredient_id: number; checked: boolean }[] }>();
        for (const item of items) {
          const r = item.rayon;
          const label = RAYON_LABELS[r] || r;
          if (!sections.has(r)) sections.set(r, { rayon: r, label, items: [] });
          sections.get(r)!.items.push({
            nom: item.ingredients?.nom || `Ingrédient #${item.ingredient_id}`,
            quantite: `${item.quantite_totale} ${item.unite}`,
            ingredient_id: item.ingredient_id,
            checked: item.checked,
          });
        }

        sectionsResult = Array.from(sections.values());
      }
    }
    setShoppingSections(sectionsResult);

    // ⭐ Write-through cache : dernier état connu → consultation hors ligne
    saveCachedWeek(semaineDebut, {
      days: builtDays,
      sections: sectionsResult,
      planId: plan.id,
      shoppingListId: shopList?.id || null,
      fallbackUtilise: plan.fallback_utilise === true,
      cuisinesDiversifiees: Array.isArray(plan.cuisines_diversifiees) ? plan.cuisines_diversifiees : [],
    });
    setFromCache(false);

    // Toggles cochés hors ligne lors d'une précédente visite → synchroniser
    void flushPendingToggles();

    setEmpty(false);
    setError('');
    setLoading(false);
  }, [semaineDebut, supabase, flushPendingToggles]);

  // Chargement initial (IIFE async : les setState de loadPlan sont tous après
  // le premier await → pas de rendu en cascade)
  useEffect(() => {
    void (async () => { await loadPlan(); })();
  }, [loadPlan]);

  // Régénérer — avec l'intention d'optimisation choisie au clic (audit UX) :
  // le moteur incline sa pondération (budget / temps / gaspillage) mais ne
  // remplace jamais les contraintes dures (allergies, régimes, vetos…).
  // useCallback : le dashboard arbore ce callback dans des effets de toast —
  // une identité stable évite les re-exécutions parasites.
  const regenerate = useCallback(async (intention?: IntentionOptimisation) => {
    setRegenerating(true);
    setError('');

    try {
      const res = await fetch('/api/generate-week', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ semaine_debut: semaineDebut, intention }),
      });

      if (!res.ok) {
        const { error: apiError } = await res.json();
        throw new Error(apiError || `Erreur ${res.status}`);
      }

      // Recharger le planning depuis la DB
      await loadPlan();
      // Célébration : la semaine est générée (roadmap animation n°6)
      celebrate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la génération');
    } finally {
      setRegenerating(false);
    }
  }, [semaineDebut, loadPlan]);

  // Régénérer uniquement un repas précis (le reste de la semaine est conservé)
  const regenerateMeal = useCallback(async (dayIndex: number, repas: RepasSlot) => {
    const key = `${dayIndex}-${repas}`;
    setRegeneratingSlots(prev => ({ ...prev, [key]: true }));
    setError('');

    try {
      const res = await fetch('/api/generate-week', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          semaine_debut: semaineDebut,
          slots: [{ jour_semaine: dayIndex, repas_type: repas }],
        }),
      });

      if (!res.ok) {
        const { error: apiError } = await res.json();
        throw new Error(apiError || `Erreur ${res.status}`);
      }

      // Recharger le planning depuis la DB
      await loadPlan();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la régénération');
    } finally {
      setRegeneratingSlots(prev => ({ ...prev, [key]: false }));
    }
  }, [semaineDebut, loadPlan]);

  // Toggle d'un item de la liste de courses (persisté en DB)
  const toggleShoppingItem = (sectionLabel: string, nom: string) => {
    setShoppingSections(prev => prev.map(s => {
      if (s.label !== sectionLabel) return s;
      return {
        ...s,
        items: s.items.map(it => {
          if (it.nom !== nom) return it;
          const newChecked = !it.checked;
          // Persister dans Supabase — hors ligne : file locale rejouée au
          // retour du réseau (flushPendingToggles), la coche reste visible.
          if (shoppingListId && it.ingredient_id) {
            if (!navigator.onLine) {
              queuePendingToggle({ listId: shoppingListId, ingredientId: it.ingredient_id, checked: newChecked });
            } else {
              supabase
                .from('shopping_list_items')
                .update({ checked: newChecked })
                .eq('list_id', shoppingListId)
                .eq('ingredient_id', it.ingredient_id)
                .then(({ error }) => { if (error) console.error('Erreur update checked:', error); });
            }
          }
          return { ...it, checked: newChecked };
        }),
      };
    }));
  };

  // Tout décocher la liste (mode magasin : on repasse pour un nouveau tour).
  // En ligne : UN SEUL UPDATE ciblé (list_id + checked=true) au lieu de N
  // toggles. Hors ligne : un toggle en file par item coché, rejoué au retour
  // du réseau (flushPendingToggles).
  const uncheckAllShoppingItems = useCallback(() => {
    setShoppingSections(prev => {
      if (shoppingListId && !navigator.onLine) {
        for (const s of prev) {
          for (const it of s.items) {
            if (it.checked) queuePendingToggle({ listId: shoppingListId, ingredientId: it.ingredient_id, checked: false });
          }
        }
      }
      return prev.map(s => ({ ...s, items: s.items.map(it => ({ ...it, checked: false })) }));
    });
    if (shoppingListId && navigator.onLine) {
      supabase
        .from('shopping_list_items')
        .update({ checked: false })
        .eq('list_id', shoppingListId)
        .eq('checked', true)
        .then(({ error }) => { if (error) console.error('Erreur uncheck all:', error); });
    }
    // supabase = singleton de createBrowserClient() → instance stable
  }, [shoppingListId, supabase]);

  // Toggle restes : "cuisiné le soir, mangé aussi le lendemain midi"
  const toggleRestes = useCallback(async (jourDiner: number) => {
    setRestesToggling(jourDiner);
    setError('');

    try {
      const res = await fetch('/api/generate-week', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          semaine_debut: semaineDebut,
          toggle_restes: true,
          jour_diner: jourDiner,
        }),
      });

      if (!res.ok) {
        const { error: apiError } = await res.json();
        throw new Error(apiError || `Erreur ${res.status}`);
      }

      await loadPlan();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur mode restes');
    } finally {
      setRestesToggling(null);
    }
  }, [semaineDebut, loadPlan]);

  // Swap un repas individuel (dejeuner / diner / dessert / dessert midi) via
  // l'API serveur : le planning ET la liste de courses sont recalculés côté
  // serveur (RPC transactionnelle), le snapshot budget est rafraîchi. Les
  // erreurs sont remontées au composant (toast) au lieu d'échouer en silence.
  const swapMeal = useCallback(async (dayIndex: number, repas: RepasSlot, newMealId: number): Promise<void> => {
    setError('');
    try {
      const res = await fetch('/api/swap-meal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          semaine_debut: semaineDebut,
          jour_semaine: dayIndex,
          repas_type: repas,
          meal_id: newMealId,
        }),
      });
      if (!res.ok) {
        const { error: apiError } = await res.json().catch(() => ({ error: `Erreur ${res.status}` }));
        throw new Error(apiError || `Erreur ${res.status}`);
      }
      // Recharge planning + liste de courses recalculée + cache hors ligne
      await loadPlan();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur lors du remplacement du repas';
      setError(message);
      throw err;
    }
  }, [semaineDebut, loadPlan]);

  // Déplacer un repas d'un jour à un autre (drag & drop) via l'API serveur :
  // la logique métier (permutation, rupture du lien restes) vit côté serveur,
  // la liste de courses est recalculée et le snapshot budget rafraîchi —
  // l'écriture directe navigateur laissait ces trois-là se désynchroniser.
  const moveMeal = async (
    fromDay: number, fromType: RepasSlot,
    toDay: number, toType: RepasSlot
  ) => {
    try {
      const res = await fetch('/api/move-meal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          semaine_debut: semaineDebut,
          from: { jour: fromDay, repas: fromType },
          to: { jour: toDay, repas: toType },
        }),
      });
      if (!res.ok) {
        const { error: apiError } = await res.json().catch(() => ({ error: `Erreur ${res.status}` }));
        throw new Error(apiError || `Erreur ${res.status}`);
      }
      // Recharge planning + liste de courses recalculée + cache hors ligne
      await loadPlan();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur lors du déplacement du repas';
      setError(message);
      // Rethrow : le dashboard affiche un toast d'erreur au geste (comme swapMeal)
      throw err;
    }
  };

  // Marquer un repas comme cooked/skipped via l'API serveur : la date
  // d'historique est « aujourd'hui à Paris » (fuseau de référence de l'app),
  // pas la date UTC du runtime — et la logique ne vit plus dans l'UI.
  const markMealStatus = async (mealId: number, status: 'cooked' | 'skipped') => {
    try {
      const res = await fetch('/api/meal-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meal_id: mealId, status }),
      });
      if (!res.ok) {
        const { error: apiError } = await res.json().catch(() => ({ error: `Erreur ${res.status}` }));
        throw new Error(apiError || `Erreur ${res.status}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du statut du repas');
    }

    // Feedback visuel local (affiché même si l'appel a échoué — recharge
    // ensuite l'état réel depuis la base)
    setDays(prev => prev.map(d => ({
      ...d,
      dejeuner: d.dejeuner?.id === mealId ? { ...d.dejeuner, _status: status } : d.dejeuner,
      diner: d.diner?.id === mealId ? { ...d.diner, _status: status } : d.diner,
    })) as DayPlan[]);

    // Recharger après 800ms pour montrer le feedback
    setTimeout(() => loadPlan(), 800);
  };

  // Navigation entre semaines (bornée) : on repasse en `loading` pour afficher
  // le squelette pendant le chargement de la semaine cible.
  const goToWeek = useCallback((offset: number) => {
    const clamped = Math.min(WEEK_OFFSET_MAX, Math.max(WEEK_OFFSET_MIN, offset));
    if (clamped === weekOffset) return;
    setLoading(true);
    setWeekOffset(clamped);
  }, [weekOffset]);
  const goToCurrentWeek = useCallback(() => goToWeek(0), [goToWeek]);
  const estSemaineCourante = weekOffset === 0;

  // Chercher des suggestions pour swap (hors repas déjà dans la semaine)
  const fetchSwapSuggestions = useCallback(async (
    dayIndex: number,
    repas: RepasSlot,
    type: TypeRepas | 'tous' = 'plat'
  ): Promise<RecetteSwap[]> => {
    // Créneau dessert (soir ou midi) → on ne propose que des desserts par défaut
    const estSlotDessert = repas === 'dessert' || repas === 'dessert_midi';
    const typeEffectif = estSlotDessert ? 'dessert' : type;
    const currentMeal = days[dayIndex]?.[repas === 'dessert_midi' ? 'dessertMidi' : repas];
    const excludeId = currentMeal?.id || -1;

    const usedIds = new Set<number>();
    days.forEach(d => {
      if (d.dejeuner) usedIds.add(d.dejeuner.id);
      if (d.diner) usedIds.add(d.diner.id);
    });

    // Le tirage vit dans `lib/catalogue.ts` : il doit porter sur TOUT le
    // catalogue (voir `chargerSuggestionsSwap`), pas sur les 30 premières
    // lignes que PostgREST renvoyait faute de `order`.
    return chargerSuggestionsSwap(supabase, {
      typeRepas: typeEffectif,
      exclureId: excludeId,
      exclus: usedIds,
    });
  }, [days, supabase]);

  return {
    days,
    shoppingSections,
    shoppingListId,
    planId,
    loading,
    regenerating,
    error,
    empty,
    semaineDebut,
    fromCache,
    estEnLigne,
    fallbackUtilise,
    cuisinesDiversifiees,
    recup,
    regenerate,
    regenerateMeal,
    regeneratingSlots,
    toggleShoppingItem,
    uncheckAllShoppingItems,
    swapMeal,
    moveMeal,
    markMealStatus,
    toggleRestes,
    restesToggling,
    fetchSwapSuggestions,
    weekOffset,
    estSemaineCourante,
    goToWeek,
    goToCurrentWeek,
  };
}