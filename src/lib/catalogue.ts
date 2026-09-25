// ============================================================================
// Catalogue de recettes — chargement partagé
//
// Un même select pour deux exigences :
//
// 1. Ne PAS sélectionner `instructions` (1 016 ko pour tout le catalogue) ni
//    les macros détaillées : la page n'affiche que le titre, le type, la
//    cuisine, la saison, le temps, les calories, les protéines, la difficulté
//    et la conservation. Le tri « le moins cher » se contente de
//    `prix_unitaire`. `proteines` sert au tri « le plus protéiné » — c'est le
//    SEUL champ macro que la page lit (un entier de données par recette, pas
//    une colonne d'affichage lourde).
// 2. Garder `meal_ingredients` + `ingredients` : indispensable aux pastilles du
//    foyer. Sans les ingrédients, une pastille ignorerait ce qu'un membre n'aime
//    pas et afficherait une couleur différente de celle du planning, sans le
//    moindre signe d'erreur. Le `nom` sert aux infobulles et à la recherche par
//    ingrédient, pas au chiffrage.
// 3. `saison` (recette) et `rayon` (ingrédient) : les filtres ajoutés au
//    catalogue en ont besoin — saison exacte, et règles de régime par rayon
//    (`recetteServable`, même source de vérité que le moteur).
//
// Le module est volontairement sans dépendance à Next ni à React : la page et
// `scripts/verifier-catalogue.ts` exécutent donc EXACTEMENT le même code.
// ============================================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/../supabase/database.types';
import type { RecetteSwap, TypeRepas } from '@/types';
import type { MealCatalogueEmbed, RecetteSwapEmbed } from '@/lib/db-rows';
import { toRecetteSwap } from '@/lib/db-rows';

export const SELECT_CATALOGUE = `
  id, titre, type_repas, cuisine, saison, ustensiles, difficulte,
  temps_preparation, temps_cuisson, calories_par_portion, proteines,
  conservation_jours, portions_par_defaut,
  meal_ingredients(quantite, unite, est_optionnel, ingredients(id, nom, rayon, prix_unitaire, unite_prix, poids_unites))
`;

/** Plafond d'une réponse PostgREST — au-delà, il faut paginer explicitement. */
export const PAGE = 1000;

/**
 * Charge TOUT le catalogue public.
 *
 * Deux exigences :
 *
 * 1. Paginer : PostgREST plafonne chaque réponse à 1000 lignes. Sans
 *    pagination, les 138 dernières recettes (11 % du catalogue) n'auraient
 *    jamais été affichées, alors que la page en annonce fièrement le nombre.
 *    Le second critère `order('id')` est indispensable : deux recettes peuvent
 *    porter le même titre, et un ordre non total ferait chevaucher deux pages
 *    — une recette en double, une autre jamais atteinte.
 * 2. Paralléliser : un compte exact d'abord (requête « head », aucun octet de
 *    données) donne le nombre de pages, puis toutes les pages partent EN
 *    MÊME TEMPS. L'ancienne boucle séquentielle ajoutait un aller-retour
 *    réseau par page de plus — le premier rendu de /recettes attendait deux
 *    RTT au lieu d'un.
 */
export async function chargerCatalogue(
  supabase: SupabaseClient<Database>
): Promise<MealCatalogueEmbed[]> {
  const { count, error: erreurCompte } = await supabase
    .from('meals')
    .select('id', { count: 'exact', head: true })
    .eq('is_public', true);
  if (!erreurCompte && count && count > 0) {
    const nbPages = Math.ceil(count / PAGE);
    const lots = await Promise.all(
      Array.from({ length: nbPages }, (_, page) =>
        supabase
          .from('meals')
          .select(SELECT_CATALOGUE)
          .eq('is_public', true)
          .order('titre')
          .order('id')
          .range(page * PAGE, (page + 1) * PAGE - 1)
      )
    );
    const lignes: MealCatalogueEmbed[] = [];
    for (const lot of lots) {
      if (lot.error) throw new Error(lot.error.message);
      lignes.push(...((lot.data ?? []) as unknown as MealCatalogueEmbed[]));
    }
    return lignes;
  }

  // Repli séquentiel : compte indisponible (quota, réseau instable…) → la
  // boucle historique reste correcte, seulement moins rapide.
  const lignes: MealCatalogueEmbed[] = [];
  for (let debut = 0; ; debut += PAGE) {
    const { data, error } = await supabase
      .from('meals')
      .select(SELECT_CATALOGUE)
      .eq('is_public', true)
      .order('titre')
      .order('id')
      .range(debut, debut + PAGE - 1);
    if (error) throw new Error(error.message);
    const lot = (data ?? []) as unknown as MealCatalogueEmbed[];
    lignes.push(...lot);
    if (lot.length < PAGE) break;
  }
  return lignes;
}

// ─── Suggestions de remplacement ────────────────────────────────────────────

/**
 * Colonnes de la modale de remplacement. Volontairement plus étroites que
 * celles du catalogue : `SwapModal` n'affiche ni type de repas, ni difficulté,
 * ni ustensiles, ni conservation, ni cuisine.
 */
export const SELECT_SUGGESTIONS = `
  id, titre, temps_preparation, temps_cuisson, calories_par_portion, portions_par_defaut,
  meal_ingredients(quantite, unite, est_optionnel, ingredients(id, nom, prix_unitaire, unite_prix, poids_unites))
`;

/** Vivier tiré avant filtrage des repas déjà planifiés. */
export const SUGGESTIONS_POOL = 30;
/** Suggestions réellement présentées dans la modale. */
export const SUGGESTIONS_AFFICHEES = 12;

/**
 * Tous les identifiants de recettes publics correspondant au filtre, ordonnés.
 *
 * C'est ce qui permet de tirer sur TOUT le catalogue. Passe par la pagination
 * pour la même raison que `chargerCatalogue` : PostgREST plafonne à 1000 lignes.
 * Les identifiants ne sont pas contigus (1 → 2958 pour 1138 recettes publiées),
 * donc tirer un id au hasard serait en plus un tirage avec rejet.
 */
export async function chargerIdsRecettes(
  supabase: SupabaseClient<Database>,
  { typeRepas = 'tous', exclureId = -1 }: { typeRepas?: TypeRepas | 'tous'; exclureId?: number } = {}
): Promise<number[]> {
  const ids: number[] = [];
  for (let debut = 0; ; debut += PAGE) {
    let requete = supabase
      .from('meals')
      .select('id')
      .eq('is_public', true)
      .order('id')
      .range(debut, debut + PAGE - 1);
    if (exclureId > 0) requete = requete.neq('id', exclureId);
    if (typeRepas !== 'tous') requete = requete.eq('type_repas', typeRepas);

    const { data, error } = await requete;
    if (error) throw new Error(error.message);
    const lot = (data ?? []) as { id: number }[];
    ids.push(...lot.map(l => l.id));
    if (lot.length < PAGE) break;
  }
  return ids;
}

/**
 * Tirage sans remise de `n` éléments (Fisher-Yates partiel).
 *
 * `aleatoire` est injectable : les tests peuvent ainsi vérifier l'absence de
 * biais de manière déterministe, plutôt que d'espérer une distribution.
 */
export function echantillonAleatoire<T>(
  elements: readonly T[],
  n: number,
  aleatoire: () => number = Math.random
): T[] {
  const copie = [...elements];
  const taille = Math.max(0, Math.min(n, copie.length));
  for (let i = 0; i < taille; i++) {
    const j = i + Math.floor(aleatoire() * (copie.length - i));
    const echange = Math.min(j, copie.length - 1);
    [copie[i], copie[echange]] = [copie[echange], copie[i]];
  }
  return copie.slice(0, taille);
}

/**
 * Vivier de suggestions pour remplacer un repas.
 *
 * Le point critique est le TIRAGE : l'ancienne requête demandait 30 lignes sans
 * `order`, donc PostgREST renvoyait toujours les mêmes 30 recettes (celles que
 * le moteur trouvait en premier) — le reste du catalogue, soit 1108 recettes,
 * ne pouvait JAMAIS être proposé. On tire donc d'abord sur tout le catalogue,
 * et on ne demande ensuite les détails que des recettes réellement tirées.
 *
 * Séquentiel par nécessité : on ne peut pas demander les détails avant de
 * connaître les identifiants tirés. Le surcoût est de deux requêtes d'identi-
 * fiants (~17 ko) contre une requête unique tronquée et biaisée auparavant.
 */
export async function chargerSuggestionsSwap(
  supabase: SupabaseClient<Database>,
  {
    typeRepas = 'plat',
    exclureId = -1,
    exclus = new Set<number>(),
    pool = SUGGESTIONS_POOL,
    affichees = SUGGESTIONS_AFFICHEES,
  }: {
    typeRepas?: TypeRepas | 'tous';
    exclureId?: number;
    /** Recettes déjà planifiées cette semaine : jamais reproposées */
    exclus?: Set<number>;
    pool?: number;
    affichees?: number;
  } = {}
): Promise<RecetteSwap[]> {
  const ids = await chargerIdsRecettes(supabase, { typeRepas, exclureId });
  const tirage = echantillonAleatoire(
    ids.filter(id => !exclus.has(id)),
    pool
  );
  if (tirage.length === 0) return [];

  const { data, error } = await supabase
    .from('meals')
    .select(SELECT_SUGGESTIONS)
    .in('id', tirage);
  if (error) throw new Error(error.message);

  const parId = new Map(
    ((data ?? []) as unknown as RecetteSwapEmbed[]).map(r => [r.id, toRecetteSwap(r)])
  );
  // L'ordre du tirage est déjà aléatoire et sans remise : les `affichees`
  // premières sont donc un échantillon uniforme, sans re-mélange inutile.
  return tirage
    .map(id => parId.get(id))
    .filter((r): r is RecetteSwap => r != null)
    .slice(0, affichees);
}
