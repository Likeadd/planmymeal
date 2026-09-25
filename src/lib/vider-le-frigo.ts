// ============================================================================
// Vider le frigo — chargement des candidats
//
// La route note TOUT le catalogue des plats rapides à chaque appel. C'est
// précisément le genre de requête qu'on écrit en une ligne et qui devient
// fausse en silence : PostgREST plafonne chaque réponse à 1 000 lignes.
//
// Mesuré sur la base réelle : 979 plats publics de 60 min ou moins. 979, soit
// **21 recettes de marge**. Personne ne verrait rien changer le jour où la
// 1 000ᵉ recette rapide arriverait — sinon 21 plats définitivement
// inaccessibles, une `couverture` calculée sur un catalogue tronqué, et un
// `nb_analysees` qui annonce ce qu'il a reçu, pas ce qu'il a examiné.
//
// Le module est volontairement sans dépendance à Next ni à Supabase côté
// serveur : la route et `scripts/verifier-colonnes.ts` exécutent donc
// EXACTEMENT le même code — un test qui recopierait la requête pourrait rester
// vert alors que la route casse.
// ============================================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/../supabase/database.types';
import { COLONNES_RECETTE_FRIGO, type RecetteFrigoEmbed } from '@/lib/db-rows';
// Même plafond PostgREST que le catalogue : une seule constante, deux modules.
import { PAGE } from '@/lib/catalogue';

/** Au-delà, la recette n'est plus « rapide » : elle n'est pas un candidat. */
export const TEMPS_MAX = 60;

/**
 * Tous les plats publics de `tempsMax` minutes ou moins, page par page.
 *
 * `order('id')` n'est pas décoratif : sur `id` (clé primaire, donc unique) il
 * donne un ordre **total**, et c'est ce qui garantit qu'une ligne ne peut pas
 * apparaître sur deux pages ni disparaître entre elles. Sans ordre stable,
 * PostgREST est libre de servir deux pages selon deux plans d'exécution
 * différents — et une recette serait manquée sans que rien ne le signale.
 */
export async function chargerPlatsRapides(
  supabase: SupabaseClient<Database>,
  tempsMax: number = TEMPS_MAX
): Promise<RecetteFrigoEmbed[]> {
  const lignes: RecetteFrigoEmbed[] = [];
  for (let debut = 0; ; debut += PAGE) {
    const { data, error } = await supabase
      .from('meals')
      .select(COLONNES_RECETTE_FRIGO)
      .eq('is_public', true)
      .eq('type_repas', 'plat')
      .lte('temps_preparation', tempsMax)
      .order('id')
      .range(debut, debut + PAGE - 1);
    if (error) throw new Error(error.message);

    const lot = (data ?? []) as unknown as RecetteFrigoEmbed[];
    lignes.push(...lot);
    if (lot.length < PAGE) break;
  }
  return lignes;
}
