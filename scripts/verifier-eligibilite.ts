// ============================================================================
// verifier-eligibilite — combien de recettes reste-t-il pour un profil
// allergique ?
//
// Question simple, réponse qui ne l'est pas : le catalogue public fait 1 122
// recettes, mais ce n'est PAS ce que le moteur propose. Chaque allergie retire
// toutes les recettes qui contiennent l'allergène, et une recette sans
// composition connue est désormais écartée d'office (motif
// `composition_inconnue`).
//
// Ce script rejoue le VRAI moteur : `chargerPoolMoteur` charge le pool avec la
// requête du moteur, `raisonExclusion` décide. Rien n'est recopié — sinon je
// vérifierais ma copie au lieu du code qui tourne.
//
// Ce qu'il mesure, pour chaque profil :
//   • plats et desserts ÉLIGIBLES (les deux viviers sont distincts) ;
//   • répartition par motif d'exclusion ;
//   • comparaison au seuil d'une semaine : `NB_REPAS_PRINCIPAUX` (14) et
//     `DESSERTS_MIDI_PAR_SEMAINE` (3). En dessous, le moteur entre dans son
//     filet de sécurité et relâche la rotation de 21 jours — donc la variété.
//
// Lecture seule. Usage : npx tsx scripts/verifier-eligibilite.ts
// ============================================================================

import { config } from 'dotenv';
config({ path: '.env.local' });
config();
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../supabase/database.types';
import type { RecetteMoteur } from '../src/types';
import { toRecetteMoteur } from '../src/lib/db-rows';
import {
  chargerPoolMoteur, raisonExclusion, versIngredientsRegime, isDessert,
  NB_REPAS_PRINCIPAUX, DESSERTS_MIDI_PAR_SEMAINE,
  type FiltresDurs, type MotifExclusion,
} from '../src/lib/rotation-engine';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url || !serviceKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL et SUPABASE_ROLE_KEY sont requis dans .env.local');
  process.exit(1);
}

/**
 * Allergènes courants → identifiants d'ingrédients RÉELS de la base.
 *
 * Liste volontairement curatée, pas une ontologie allergénique : les 14
 * allergènes à déclaration obligatoire, chacun réduit aux lignes qui existent
 * vraiment dans `ingredients`. Les identifiants sont figés ici pour que le
 * chiffre soit reproductible — les retrouver par recherche de nom donnerait un
 * résultat qui bouge avec le catalogue.
 */
const GROUPES: { nom: string; ids: number[]; contient: string }[] = [
  { nom: 'Arachide', ids: [131, 223], contient: 'Cacahuètes, beurre de cacahuète' },
  { nom: 'Fruits à coque', ids: [168, 175, 248, 187], contient: 'Amandes, noix, noix de cajou' },
  { nom: 'Gluten (blé)', ids: [44, 84, 123, 33, 159, 100, 238, 117, 237, 118, 16, 138, 195, 41, 157, 145, 236], contient: 'Farine, pains, pâtes, semoule, tortillas' },
  { nom: 'Produits laitiers', ids: [79, 48, 93, 205, 46, 174, 192], contient: 'Lait, beurre, crèmes, fromages frais' },
  { nom: 'Œuf', ids: [24, 113], contient: 'Œuf, jaune d’œuf' },
  { nom: 'Poisson', ids: [56, 11, 139, 42, 219, 233], contient: 'Saumon, cabillaud, thon' },
  { nom: 'Crustacés', ids: [129], contient: 'Crevettes' },
  { nom: 'Soja', ids: [14], contient: 'Sauce soja' },
  { nom: 'Moutarde', ids: [121], contient: 'Moutarde' },
  { nom: 'Sésame', ids: [214, 15], contient: 'Graines et huile de sésame' },
];

/** Profils combinés : deux foyers réels sur trois cumulent plusieurs contraintes. */
const COMBINES: { nom: string; de: string[] }[] = [
  { nom: 'Arachide + fruits à coque', de: ['Arachide', 'Fruits à coque'] },
  { nom: 'Gluten + lait + œuf', de: ['Gluten (blé)', 'Produits laitiers', 'Œuf'] },
  { nom: 'Les 10 allergènes', de: GROUPES.map(g => g.nom) },
];

/**
 * Compte indépendant, par la base : combien de recettes DU POOL contiennent au
 * moins un des ingrédients surveillés ?
 *
 * C'est une seconde implémentation de la même question, sans passer par
 * `raisonExclusion` : si les deux divergent, c'est que l'une des deux se trompe.
 *
 * ⚠️ Paginé : PostgREST plafonne à 1000 lignes, et un allergène courant
 * (gluten, lait) en dépasse le total. Une requête unique tronquerait en silence
 * et ferait passer la contre-vérification pour un succès.
 */
async function compterParLaBase(
  supabase: ReturnType<typeof createClient<Database>>,
  ids: number[],
  poolIds: Set<number>
): Promise<number> {
  const TAILLE_PAGE = 1000;
  const touches = new Set<number>();
  for (const id of ids) {
    for (let page = 0; ; page++) {
      const { data, error } = await supabase
        .from('meal_ingredients').select('meal_id')
        .eq('ingredient_id', id)
        .order('meal_id')
        .range(page * TAILLE_PAGE, page * TAILLE_PAGE + TAILLE_PAGE - 1);
      if (error) throw new Error(`lecture meal_ingredients : ${error.message}`);
      const lignes = data ?? [];
      for (const l of lignes) if (poolIds.has(l.meal_id)) touches.add(l.meal_id);
      if (lignes.length < TAILLE_PAGE) break;
    }
  }
  return touches.size;
}

const f = (n: number) => n.toLocaleString('fr-FR');
const pct = (n: number, total: number) => `${(n / total * 100).toFixed(1).replace('.', ',')} %`;

/** Filtres durs réduits à une allergie : le reste est vide, donc neutre. */
function filtresAllergie(ids: number[]): FiltresDurs {
  return {
    allergiesIds: new Set(ids),
    dislikesIds: new Set(),
    regimes: [],
    prixMax: null,
    alimentsInterditsFamille: new Set(),
    recettesVeteesFamille: new Set(),
    bannies: new Set(),
  };
}

interface Bilan {
  plats: number;
  desserts: number;
  exclus: number;
  motifs: Map<MotifExclusion, number>;
}

/** Exécute les règles dures du moteur sur le pool, comme `buildCandidates`. */
function analyser(repas: RecetteMoteur[], embeds: Map<number, Parameters<typeof versIngredientsRegime>[0]>, filtres: FiltresDurs): Bilan {
  const motifs = new Map<MotifExclusion, number>();
  let plats = 0, desserts = 0;
  for (const meal of repas) {
    const mi = embeds.get(meal.id) ?? [];
    const motif = raisonExclusion(meal, mi.map(i => i.ingredient_id), versIngredientsRegime(mi), filtres);
    if (motif) {
      motifs.set(motif, (motifs.get(motif) ?? 0) + 1);
      continue;
    }
    isDessert(meal) ? desserts++ : plats++;
  }
  return { plats, desserts, exclus: repas.length - plats - desserts, motifs };
}

async function main() {
  const supabase = createClient<Database>(url, serviceKey);

  const lignes = await chargerPoolMoteur(supabase);
  const embeds = new Map(lignes.map(l => [l.id, l.meal_ingredients ?? []]));
  const repas = lignes.map(toRecetteMoteur);

  // Le total de référence n'est PAS le nombre de recettes publiques : le moteur
  // ne charge que les plats et desserts servables en déjeuner/dîner.
  const { count: publiques } = await supabase
    .from('meals').select('id', { count: 'exact', head: true }).eq('is_public', true);

  console.log('\n═══ Éligibilité du moteur de rotation ═══\n');
  console.log(`  Catalogue public (toutes catégories) .......... ${f(publiques ?? 0)} recettes`);
  console.log(`  Pool du moteur (plats + desserts) ............. ${f(repas.length)} recettes`);
  const sansComposition = repas.filter(r => (embeds.get(r.id) ?? []).length === 0).length;
  console.log(`  Dont sans composition connue ................. ${f(sansComposition)}`);
  console.log(`  Seuil d'une semaine : ${NB_REPAS_PRINCIPAUX} plats, ${DESSERTS_MIDI_PAR_SEMAINE} desserts midi`);

  // ── Référence : aucun filtre ────────────────────────────────────────────────
  const neutre = analyser(repas, embeds, filtresAllergie([]));
  console.log(`\n── Aucune contrainte (aujourd'hui : 0 allergie déclarée en base) ──`);
  console.log(`  ${f(neutre.plats)} plats · ${f(neutre.desserts)} desserts · ${f(neutre.exclus)} exclus`);

  // ── Un allergène à la fois, contre-vérifié par la base ──────────────────────
  // `exclus` doit valoir (recettes du pool contenant l'allergène) + (recettes
  // sans composition lisible). Les deux termes sont sans recouvrement possible.
  const poolIds = new Set(repas.map(r => r.id));
  let divergences = 0;
  console.log('\n── Un allergène à la fois ──');
  console.log('  allergène               plats  desserts  retirées   base  accord');
  for (const g of GROUPES) {
    const b = analyser(repas, embeds, filtresAllergie(g.ids));
    const ignorees = b.motifs.get('composition_inconnue') ?? 0;
    const attendu = await compterParLaBase(supabase, g.ids, poolIds);
    const accord = b.exclus === attendu + ignorees;
    if (!accord) divergences++;
    const alerte = b.plats < NB_REPAS_PRINCIPAUX ? ' ⚠️' : '';
    console.log(`  ${g.nom.padEnd(22)} ${String(f(b.plats)).padStart(5)}  ${String(f(b.desserts)).padStart(6)}  ${String(f(b.exclus)).padStart(8)}  ${String(f(attendu)).padStart(5)}  ${accord ? '✅' : `❌ ${attendu + ignorees} attendu`}${alerte}`);
  }
  // Depuis que #109 a une composition, il n'y a plus AUCUN terme correctif : le
  // moteur exclut exactement les recettes que la base compte comme contenant
  // l'allergène. Si la règle « composition inconnue » redevient active (import
  // qui perd des liens), les deux colonnes se décaleront d'autant — et c'est
  // précisément ce que cette contre-vérification doit signaler.
  const correctif = analyser(repas, embeds, filtresAllergie([])).motifs.get('composition_inconnue') ?? 0;
  divergences === 0
    ? console.log(`  → les ${GROUPES.length} groupes concordent avec le comptage direct en base${correctif > 0 ? ` (dont +${correctif} « composition inconnue » chacun)` : ' (aucun terme correctif : tout le pool a une composition lisible)'}`)
    : console.log(`  ❌ ${divergences} groupe(s) divergent — le moteur et la base ne comptent pas la même chose`);

  // ── Profils combinés ────────────────────────────────────────────────────────
  console.log('\n── Profils combinés (foyers réels) ──');
  for (const c of COMBINES) {
    const ids = c.de.flatMap(nom => GROUPES.find(g => g.nom === nom)!.ids);
    const b = analyser(repas, embeds, filtresAllergie(ids));
    const alerte = b.plats < NB_REPAS_PRINCIPAUX ? ` ⚠️ ${b.plats} plats < ${NB_REPAS_PRINCIPAUX} → filet de sécurité, rotation 21 j relâchée` : '';
    console.log(`\n  ${c.nom} — ${f(ids.length)} ingrédients surveillés`);
    console.log(`    éligibles : ${f(b.plats)} plats · ${f(b.desserts)} desserts`);
    console.log(`    retirées  : ${f(b.exclus)} / ${f(repas.length)} (${pct(b.exclus, repas.length)})${alerte}`);
    const detail = [...b.motifs].sort((a, z) => z[1] - a[1]).map(([m, n]) => `${m} ${f(n)}`).join(' · ');
    console.log(`    motifs    : ${detail}`);
  }

  // ── Le poids de la règle « composition inconnue » ───────────────────────────
  // Sans cette règle, ces recettes seraient éligibles par défaut (aucune règle
  // de sécurité n'étant évaluable). Leur nombre EST donc le delta de la règle.
  console.log('\n── Ce que la règle « composition inconnue » retire ──');
  const severe = analyser(repas, embeds, filtresAllergie(COMBINES[2].de.flatMap(nom => GROUPES.find(g => g.nom === nom)!.ids)));
  const ignorees = severe.motifs.get('composition_inconnue') ?? 0;
  if (ignorees === 0) {
    console.log('  aucune recette : tout le pool a une composition lisible.');
    console.log(`  La règle ne réduit donc RIEN aujourd'hui. Elle est là pour la régression :`);
    console.log(`  avant la réparation du catalogue, ${f(455)} recettes publiques (45 % des plats)`);
    console.log(`  étaient dans ce cas, et un profil allergique les recevait sans pouvoir les vérifier.`);
  } else {
    console.log(`  écartées faute de composition lisible : ${f(ignorees)} recette(s)`);
    console.log(`  soit ${pct(ignorees, repas.length)} du pool — sans la règle, elles seraient servies par défaut.`);
    console.log(`  Rappel : avant la réparation du catalogue, ${f(455)} recettes publiques étaient dans ce cas`);
    console.log(`  (45 % des plats) — c'est l'ampleur que la règle couvre en cas de régression d'import.`);
  }

  console.log('\n═══ Fin ═══\n');
}

main().catch(e => {
  console.error('Échec :', e instanceof Error ? e.message : e);
  process.exit(1);
});
