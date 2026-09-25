// ============================================================================
// verifier-colonnes — les selects allégés tiennent-ils leurs promesses ?
//
// Une colonne mal orthographiée ne casse pas le build : PostgREST renvoie une
// erreur et l'écran reste vide. Et un champ oublié ne plante pas non plus : il
// s'affiche `undefined`. Ce script exécute donc les sélecteurs RÉELS contre la
// vraie base et vérifie, pour chacun, trois choses :
//
//   1. PostgREST les accepte ;
//   2. chaque champ que le TYPE déclare est réellement présent dans la réponse
//      (le contrat type ↔ base) ;
//   3. les champs lourds non affichés (`instructions`, macros, image...) ne sont
//      plus téléchargés — et de combien le poids baisse.
//
// Lecture seule. Utilise la clé service (comme `test-budget-rotation.ts`) pour
// traverser la RLS : le sélecteur testé est exactement celui du navigateur.
// Usage : npx tsx scripts/verifier-colonnes.ts
// ============================================================================

import { config } from 'dotenv';
config({ path: '.env.local' });
config();
import { createClient } from '@supabase/supabase-js';
import {
  COLONNES_RECETTE_PLANNING, COLONNES_RECETTE_FAVORI, COLONNES_RECETTE_RESUME,
  COLONNES_RECETTE_MOTEUR,
} from '../src/lib/db-rows';
import { SELECT_SUGGESTIONS } from '../src/lib/catalogue';
import { chargerPlatsRapides, TEMPS_MAX } from '../src/lib/vider-le-frigo';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

let echecs = 0;
const ok = (msg: string, detail = '') => console.log(`  ✅ ${msg}${detail ? `  ${detail}` : ''}`);
const ko = (msg: string, detail = '') => { echecs++; console.log(`  ❌ ${msg}${detail ? `  ${detail}` : ''}`); };
const titre = (n: string) => console.log(`\n${n}`);
const ko8 = (n: number) => `${Math.round(n / 1024)} ko`;
const poids = (v: unknown) => Buffer.byteLength(JSON.stringify(v ?? null), 'utf8');

/**
 * Contrat type ↔ base : les champs que chaque type applicatif DÉCLARE.
 * Si un champ listé ici manque dans la réponse, le type ment et l'écran
 * afficherait `undefined` — c'est le seul moyen de le détecter automatiquement.
 */
const CONTRAT: Record<string, string[]> = {
  planning: ['id', 'titre', 'temps_preparation', 'temps_cuisson', 'calories_par_portion', 'difficulte', 'ustensiles', 'portions_par_defaut', 'meal_ingredients'],
  favori: ['id', 'titre', 'type_repas', 'cuisine', 'difficulte', 'temps_preparation', 'temps_cuisson', 'calories_par_portion', 'conservation_jours', 'meal_ingredients'],
  resume: ['id', 'titre', 'temps_preparation', 'temps_cuisson', 'calories_par_portion'],
  moteur: ['id', 'titre', 'type_repas', 'saison', 'cuisine', 'conservation_jours', 'ustensiles', 'portions_par_defaut', 'difficulte', 'temps_preparation', 'temps_cuisson', 'calories_par_portion', 'meal_ingredients'],
  frigo: ['id', 'titre', 'cuisine', 'image_url', 'ustensiles', 'portions_par_defaut', 'difficulte', 'temps_preparation', 'temps_cuisson', 'calories_par_portion', 'meal_ingredients'],
};

/** Champs qu'aucun des écrans concernés n'affiche : ils ne doivent plus venir. */
const CHAMPS_RETIRES = ['instructions', 'image_url', 'description', 'proteines', 'glucides', 'lipides', 'fibres', 'saison', 'created_by', 'is_public'];

// Deux exceptions, et chacune est justifiée par le moteur :
//   • le moteur LIT `saison` (facteur saison du score) — c'est une donnée de
//     décision, pas d'affichage ;
//   • `/api/vider-le-frigo` renvoie `image_url` (champ de sa réponse).
const RETIRES_MOTEUR = CHAMPS_RETIRES.filter(c => c !== 'saison');
const RETIRES_FRIGO = CHAMPS_RETIRES.filter(c => c !== 'image_url');

function verifieContrat(nom: string, lignes: Record<string, unknown>[], retires: string[] = CHAMPS_RETIRES): void {
  if (lignes.length === 0) { ko(`aucune ligne à vérifier pour « ${nom} »`); return; }
  const echantillon = lignes.slice(0, 20);
  const attendus = CONTRAT[nom];

  const manquants = new Set<string>();
  for (const attendu of attendus) {
    if (echantillon.some(l => !(attendu in l))) manquants.add(attendu);
  }
  manquants.size === 0
    ? ok(`contrat type ↔ base respecté (${attendus.length} champs)`, `sur ${echantillon.length} lignes`)
    : ko(`champ(s) déclaré(s) mais absent(s) : ${[...manquants].join(', ')}`);

  const restants = retires.filter(c => echantillon.some(l => c in l));
  restants.length === 0
    ? ok('aucun champ lourd non affiché', retires.length + ' exclus')
    : ko(`champs encore téléchargés : ${restants.join(', ')}`);

  const ing = echantillon[0].meal_ingredients;
  if (Array.isArray(ing) && ing.length > 0) {
    const ligne = ing[0] as Record<string, unknown>;
    const emb = ligne.ingredients as Record<string, unknown> | null;
    // `poids_unites` est du même niveau que le prix : sans lui, toute ligne en
    // pièces ou en cuillères devient NON CHIFFRABLE (381 liens du catalogue).
    emb && 'nom' in emb && 'prix_unitaire' in emb && 'poids_unites' in emb
      ? ok('ingrédients complets (nom, prix, poids d\'unité)', `${ing.length} lignes sur la 1re recette`)
      : ko(`embed d'ingrédients incomplet (manque ${['nom', 'prix_unitaire', 'poids_unites'].filter(c => !emb || !(c in emb)).join(', ')})`);
  }
}

async function main() {
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false, persistSession2: false } as never });

  // ─── 1. Planning : la requête du dashboard et du planning ────────────────
  titre('1. Planning (useWeeklyPlan)');
  const { data: plans, error: errPlans } = await supabase
    .from('weekly_plans')
    .select(`id, semaine_debut, fallback_utilise, cuisines_diversifiees, plan_meals(jour_semaine, repas_type, meal_id, est_reste_de, meals!plan_meals_meal_id_fkey(${COLONNES_RECETTE_PLANNING}))`)
    .order('semaine_debut', { ascending: false })
    .limit(1);

  if (errPlans) {
    ko('le select allégé est REFUSÉ', `→ ${errPlans.message}`);
  } else {
    const plan = (plans ?? [])[0] as unknown as Record<string, unknown> | undefined;
    const crevettes = ((plan?.plan_meals ?? []) as { meals: Record<string, unknown> | null }[])
      .map(pm => pm.meals).filter((m): m is Record<string, unknown> => m != null);
    ok('select accepté', `${crevettes.length} repas dans la dernière semaine`);

    const { data: plansBruts } = await supabase
      .from('weekly_plans')
      .select('id, semaine_debut, fallback_utilise, cuisines_diversifiees, plan_meals(jour_semaine, repas_type, meal_id, est_reste_de, meals!plan_meals_meal_id_fkey(*, meal_ingredients(ingredient_id, quantite, unite, est_optionnel, ingredients(id, nom, rayon, prix_unitaire, unite_prix))))')
      .order('semaine_debut', { ascending: false })
      .limit(1);
    const avant = poids(plansBruts);
    const apres = poids(plans);
    console.log(`     ancien select('*') : ${ko8(avant)}`);
    console.log(`     allégé            : ${ko8(apres)}`);
    avant > apres
      ? ok('allègement', `−${Math.round((1 - apres / avant) * 100)} % (${ko8(avant - apres)} en moins), ×4 semaines en cache localStorage`)
      : ko('aucun gain');
    verifieContrat('planning', crevettes);
  }

  // ─── 2. Favoris ──────────────────────────────────────────────────────────
  titre('2. Favoris (useFavorites)');
  const { data: hist } = await supabase
    .from('meal_history').select('meal_id').eq('status', 'liked').limit(30);
  const ids = [...new Set((hist ?? []).map(h => h.meal_id))].filter((i): i is number => i != null);

  if (ids.length === 0) {
    console.log('     (aucun favori en base — contrat vérifié sur un échantillon du catalogue)');
    const { data: ech } = await supabase.from('meals').select(COLONNES_RECETTE_FAVORI).limit(5);
    verifieContrat('favori', (ech ?? []) as unknown as Record<string, unknown>[]);
  } else {
    const { data: lignes, error } = await supabase.from('meals').select(COLONNES_RECETTE_FAVORI).in('id', ids);
    if (error) ko('select refusé', error.message);
    else {
      ok('select accepté', `${lignes?.length ?? 0} favoris`);
      const { data: bruts } = await supabase.from('meals').select('*, meal_ingredients(ingredient_id, quantite, unite, est_optionnel, ingredients(id, nom, rayon, prix_unitaire, unite_prix))').in('id', ids);
      const a = poids(bruts); const b = poids(lignes);
      console.log(`     ancien : ${ko8(a)}   allégé : ${ko8(b)}`);
      b < a ? ok('allègement', `−${Math.round((1 - b / a) * 100)} %`) : ko('aucun gain');
      verifieContrat('favori', (lignes ?? []) as unknown as Record<string, unknown>[]);
    }
  }

  // ─── 3. Historique (toutes les semaines) ─────────────────────────────────
  titre('3. Historique du planning (usePlanningHistory)');
  const { data: histo, error: errHisto } = await supabase
    .from('weekly_plans')
    .select(`id, semaine_debut, generated_at, plan_meals(jour_semaine, repas_type, meal_id, meals!plan_meals_meal_id_fkey(${COLONNES_RECETTE_RESUME}))`);
  if (errHisto) ko('select refusé', errHisto.message);
  else {
    const resumes = (histo ?? []).flatMap(p =>
      ((p as unknown as { plan_meals: { meals: Record<string, unknown> | null }[] }).plan_meals ?? [])
        .map(pm => pm.meals).filter((m): m is Record<string, unknown> => m != null));
    ok('select accepté', `${histo?.length ?? 0} semaines, ${resumes.length} repas au total`);
    const { data: bruts } = await supabase
      .from('weekly_plans')
      .select('id, semaine_debut, generated_at, plan_meals(jour_semaine, repas_type, meal_id, meals!plan_meals_meal_id_fkey(*))');
    const a = poids(bruts); const b = poids(histo);
    console.log(`     ancien select('*') : ${ko8(a)}`);
    console.log(`     allégé            : ${ko8(b)}   ← sur TOUTES les semaines`);
    b < a ? ok('allègement', `−${Math.round((1 - b / a) * 100)} %`) : ko('aucun gain');
    verifieContrat('resume', resumes);
  }

  // ─── 4. Moteur de rotation : le pool entier, à chaque génération ─────────
  titre('4. Moteur de rotation (generateWeeklyPlan)');
  const chargerPool = async (select: string): Promise<Record<string, unknown>[]> => {
    const out: Record<string, unknown>[] = [];
    const TAILLE = 1000;
    for (let page = 0; ; page++) {
      const { data, error } = await supabase
        .from('meals').select(select)
        .eq('is_public', true).in('type_repas', ['plat', 'dessert'])
        .order('id')
        .range(page * TAILLE, page * TAILLE + TAILLE - 1);
      if (error) throw new Error(`select refusé : ${error.message}`);
      const lignes = (data ?? []) as unknown as Record<string, unknown>[];
      out.push(...lignes);
      if (lignes.length < TAILLE) break;
    }
    return out;
  };

  try {
    const pool = await chargerPool(COLONNES_RECETTE_MOTEUR);
    ok('select accepté', `${pool.length} recettes publiques (le pool complet du moteur)`);

    const bruts = await chargerPool('*, meal_ingredients(ingredient_id, quantite, unite, est_optionnel, ingredients(id, nom, rayon, prix_unitaire, unite_prix))');
    const a = poids(bruts); const b = poids(pool);
    console.log(`     ancien select('*') : ${ko8(a)}`);
    console.log(`     allégé            : ${ko8(b)}`);
    b < a ? ok('allègement', `−${Math.round((1 - b / a) * 100)} % (${ko8(a - b)} en moins) PAR GÉNÉRATION`) : ko('aucun gain');

    verifieContrat('moteur', pool, RETIRES_MOTEUR);

    // L'embed doit porter CE QUE LE MOTEUR LIT : `ingredient_id` (frigo,
    // allergies, dislikes) et `rayon` (règles de régime). Sans eux, les filtres
    // durs ne s'appliqueraient plus — en silence.
    const ligne = (pool.find(r => Array.isArray(r.meal_ingredients) && (r.meal_ingredients as unknown[]).length > 0)?.meal_ingredients as Record<string, unknown>[] | undefined)?.[0];
    if (!ligne) ko("aucune ligne d'ingrédient à vérifier");
    else {
      const ing = ligne.ingredients as Record<string, unknown> | null;
      const aId = 'ingredient_id' in ligne;
      const aRayon = ing != null && 'rayon' in ing;
      aId && aRayon
        ? ok('embed lisible par les filtres durs', 'ingredient_id + rayon + nom + prix')
        : ko(`embed incomplet : ${[!aId && 'ingredient_id', !aRayon && "ingredients.rayon"].filter(Boolean).join(', ')} manquant(s)`);
    }
  } catch (e) {
    ko('pool du moteur', e instanceof Error ? e.message : String(e));
  }

  // ─── 5. Vider le frigo ────────────────────────────────────────────────────
  titre('5. Vider le frigo (/api/vider-le-frigo)');
  try {
    // On exécute LE chargeur de la route, pas une copie de sa requête : une
    // copie pourrait rester verte alors que la route, elle, casse.
    const rapides = await chargerPlatsRapides(supabase);
    const lignes = rapides as unknown as Record<string, unknown>[];
    ok('chargeur accepté', `${lignes.length} plats de ${TEMPS_MAX} min ou moins`);

    // Le compte EXACT de la base : c'est la seule façon de prouver que la
    // pagination n'a rien laissé derrière elle. Sous le plafond de 1000 lignes
    // cette égalité est rassurante sans être décisive — c'est le test unitaire
    // (`tests/vider-le-frigo.test.ts`, client factice) qui sait échouer.
    const { count } = await supabase
      .from('meals').select('id', { count: 'exact', head: true })
      .eq('is_public', true).eq('type_repas', 'plat').lte('temps_preparation', TEMPS_MAX);
    lignes.length === count
      ? ok('aucune recette laissée de côté', `${lignes.length} = ${count} (compte exact de la base)`)
      : ko(`chargeur : ${lignes.length} lignes, base : ${count} → ${(count ?? 0) - lignes.length} inatteignable(s)`);
    console.log(`     marge avant le plafond PostgREST : ${1000 - (count ?? 0)} recettes (au-delà, seule la pagination sauve)`);

    const { data: bruts } = await supabase
      .from('meals')
      .select('*, meal_ingredients(ingredient_id, quantite, unite, est_optionnel, ingredients(id, nom, rayon, prix_unitaire, unite_prix))')
      .eq('is_public', true).eq('type_repas', 'plat').lte('temps_preparation', TEMPS_MAX);
    const a = poids(bruts); const b = poids(rapides);
    console.log(`     ancien select('*') : ${ko8(a)}`);
    console.log(`     allégé            : ${ko8(b)}`);
    b < a ? ok('allègement', `−${Math.round((1 - b / a) * 100)} % (${ko8(a - b)} en moins) PAR APPEL`) : ko('aucun gain');

    verifieContrat('frigo', lignes, RETIRES_FRIGO);
  } catch (e) {
    ko('vider le frigo', e instanceof Error ? e.message : String(e));
  }

  // ─── 6. Fiche recette (/recette/[id]) ────────────────────────────────────
  // Deux questions distinctes : la fiche télécharge-t-elle trop, et surtout
  // retrouve-t-elle TOUTES les recettes qu'elle prétend ouvrir ?
  titre('6. Fiche recette (/recette/[id])');
  try {
    const pool = await chargerPool('id, meal_ingredients(ingredient_id)');
    const sansIngredient = pool.filter(r => ((r.meal_ingredients as unknown[] | null) ?? []).length === 0);
    const avecIngredient = pool.find(r => ((r.meal_ingredients as unknown[] | null) ?? []).length > 0);
    sansIngredient.length === 0
      ? ok('recettes publiques sans ingrédient', `0 sur ${pool.length} — composition complète`)
      : console.log(`     recettes publiques sans ingrédient : ${sansIngredient.length} sur ${pool.length} (${Math.round(sansIngredient.length / pool.length * 100)} %)`);

    // Hypothèse testée ici, et RÉFUTÉE : `ingredients!inner(...)` est une
    // jointure INTERNE, on pouvait donc croire que PostgREST ne renverrait QUE
    // les recettes ayant au moins un ingrédient — rendant les autres invisibles
    // de la fiche. En réalité le `!inner` porte sur l'embed IMBRIQUÉ (dans
    // `meal_ingredients`), pas sur `meals` : la recette reste ouvrable et la
    // page affiche son état vide. C'est vérifié ci-dessous sur un témoin, pour
    // que personne n'ait à refaire le raisonnement.
    if (sansIngredient.length === 0) {
      console.log('     (aucune recette sans ingrédient : pas de témoin à tester)');
    } else {
      const temoin = sansIngredient[0].id as number;
      const { data: interne, error: errInterne } = await supabase
        .from('meals').select('id, titre, meal_ingredients(quantite, unite, est_optionnel, ingredients!inner(*))')
        .eq('id', temoin).maybeSingle();
      const { data: gauche, error: errGauche } = await supabase
        .from('meals').select('id, titre, meal_ingredients(quantite, unite, est_optionnel, ingredients(*))')
        .eq('id', temoin).maybeSingle();

      interne && !errInterne
        ? ok(`recette #${temoin} (sans ingrédient) reste ouvrable en jointure interne`)
        : ko(`recette #${temoin} est INVISIBLE de la fiche (jointure !inner) — ${errInterne?.code ?? 'aucune erreur'}, et ${sansIngredient.length} recettes sont dans ce cas`);
      gauche && !errGauche
        ? ok(`recette #${temoin} ouvrable en jointure gauche`, `${((gauche.meal_ingredients as unknown[] | null) ?? []).length} ligne(s) d'ingrédient (état vide affiché)`)
        : ko(`même en jointure gauche, recette #${temoin} reste introuvable`);
    }

    // ─── Ce que la fiche télécharge, et le verdict ─────────────────────────
    //
    // Mesure, pas opinion : on recharge la même recette en `select('*')` et en
    // colonnes explicites, et on regarde ce qui disparaît. Le résultat est
    // DÉLIBÉRÉMENT un constat, pas une assertion : la conclusion de cet audit
    // est qu'un type dédié ici serait du code en plus pour du poids en moins
    // négligeable — et `toMeal` apporte un comportement qu'on ne veut pas
    // perdre (voir la décision ci-dessous).
    if (avecIngredient) {
      const id = avecIngredient.id as number;
      const { data: actuelle } = await supabase
        .from('meals').select('*, meal_ingredients(quantite, unite, est_optionnel, ingredients!inner(*))')
        .eq('id', id).maybeSingle();
      const { data: allegee } = await supabase
        .from('meals')
        .select('id, titre, description, type_repas, temps_preparation, temps_cuisson, difficulte, saison, cuisine, calories_par_portion, proteines, glucides, lipides, fibres, conservation_jours, ustensiles, instructions, portions_par_defaut, meal_ingredients(quantite, unite, est_optionnel, ingredients(id, nom, prix_unitaire, unite_prix))')
        .eq('id', id).maybeSingle();

      const a = poids(actuelle); const b = poids(allegee);
      console.log(`     fiche réelle (recette #${id}) : ${ko8(a)}`);
      console.log(`       dont \`instructions\` : ${ko8(poids((actuelle as { instructions?: unknown } | null)?.instructions))} — AFFICHÉES par la page, elles restent`);
      console.log(`       non lues (created_by, is_public, 9 colonnes d'ingrédient) : ${a - b} octets`);
      console.log(`     → décision : pas de type dédié pour la fiche. ${ko8(a - b)} sur ${ko8(a)}, contre`);
      console.log('       543 ko pour /recettes et 1 160 ko pour /api/vider-le-frigo. Surtout, `toMeal`');
      console.log('       affiche « Ingrédient #N » sur un embed rompu là où `normaliserIngredients`');
      console.log('       le ferait DISPARAÎTRE de la liste — sur une fiche, la transparence vaut mieux.');
    }
  } catch (e) {
    ko('fiche recette', e instanceof Error ? e.message : String(e));
  }

  // ─── 7. Recettes sans ingrédient : l'impact sur la semaine en cours ──────
  // Constat, pas assertion : c'est un défaut de DONNÉES (import), documenté
  // dans le README. Il s'affiche à chaque exécution pour qu'il ne s'oublie pas
  // — et le jour où il tombe à zéro, cette ligne le prouve.
  titre('7. Recettes sans ingrédient — impact sur la semaine planifiée');
  try {
    const { data: plans } = await supabase
      .from('weekly_plans').select('id, semaine_debut')
      .order('semaine_debut', { ascending: false }).limit(1);
    const plan = (plans ?? [])[0] as unknown as { id: number; semaine_debut: string } | undefined;

    if (!plan) {
      console.log('     (aucune semaine planifiée en base)');
    } else {
      const { data: pm } = await supabase.from('plan_meals').select('meal_id').eq('plan_id', plan.id).not('meal_id', 'is', null);
      const ids = (pm ?? []).map(l => l.meal_id as number);
      const { data: liens } = await supabase.from('meal_ingredients').select('meal_id').in('meal_id', ids);
      const avecLiens = new Set((liens ?? []).map(l => l.meal_id));
      const orphelins = ids.filter(i => !avecLiens.has(i));

      const { data: listes } = await supabase.from('shopping_lists').select('id').eq('plan_id', plan.id);
      const listIds = (listes ?? []).map(l => l.id);
      const { count: lignes } = listIds.length
        ? await supabase.from('shopping_list_items').select('ingredient_id', { count: 'exact', head: true }).in('list_id', listIds)
        : { count: 0 };

      const pct = Math.round(orphelins.length / Math.max(1, ids.length) * 100);
      console.log(`     semaine du ${plan.semaine_debut} : ${orphelins.length} des ${ids.length} repas sans ingrédient (${pct} %)`);
      if (orphelins.length === 0) {
        ok('aucun repas planifié sans ingrédient', `${lignes ?? 0} lignes de courses, toutes justifiées`);
      } else {
        console.log(`     → ces repas n'apportent AUCUNE des ${lignes ?? 0} lignes de la liste de courses ;`);
        console.log('       le moteur les écarte dès qu\'un profil déclare une allergie, un régime ou un');
        console.log('       aliment interdit (motif `composition_inconnue`) — `tests/recettes-sans-ingredient.test.ts`');
        console.log('     ⚠️  défaut de DONNÉES (import) — réparable par `seed-catalogue-1000.ts --repair`');
      }
    }
  } catch (e) {
    console.log(`     (section ignorée : ${e instanceof Error ? e.message : String(e)})`);
  }

  // ─── 8. Rappel : suggestions (vérifiées par verifier-suggestions) ────────
  titre('8. Suggestions de remplacement (rappel)');
  const { error: errSug } = await supabase.from('meals').select(SELECT_SUGGESTIONS).limit(1);
  errSug ? ko('select refusé', errSug.message) : ok('select accepté (voir verifier-suggestions.ts pour le tirage)');

  console.log(`\n${'─'.repeat(60)}`);
  if (echecs === 0) console.log('✅ Tout est vert — chaque select est accepté, complet et plus léger.');
  else console.log(`❌ ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch(err => { console.error('Erreur inattendue :', err); process.exit(1); });
