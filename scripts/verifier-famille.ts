// ============================================================================
// VÉRIFICATION BOUT EN BOUT — profils famille
// Usage : npx tsx scripts/verifier-famille.ts
//
// Ne se contente pas de vérifier que les tables existent : fait tourner le VRAI
// moteur (`buildCandidates`) sur la vraie base, avec et sans membres, et
// compare. C'est le seul moyen de prouver que « interdire un aliment » retire
// réellement les recettes concernées du pool, et que « poids_famille = 0 »
// redonne exactement le planning d'avant.
//
// Ce que le script crée, il le supprime : les membres sont créés puis effacés,
// et `poids_famille` est sauvegardé puis restauré (même discipline que
// scripts/test-budget-rotation.ts). Aucune autre donnée n'est touchée.
// ============================================================================

import { config } from 'dotenv';
config({ path: '.env.local' });
config();

import { createClient } from '@supabase/supabase-js';
import type { Database } from '../supabase/database.types';
import { buildCandidates, type Candidate } from '../src/lib/rotation-engine';
import { alimentsInterdits, recettesVetees, type Famille } from '../src/lib/famille';

const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ─── Micro-framework d'assertions ───────────────────────────────────────────

let echecs = 0;

function verifier(nom: string, ok: boolean, detail = ''): void {
  if (!ok) echecs++;
  console.log(`  ${ok ? '✅' : '❌'}  ${nom}${detail ? `  ${detail}` : ''}`);
}

// ─── Lecture d'un « run » du moteur ─────────────────────────────────────────

interface Run {
  candidats: Candidate[];
  famille: Famille;
}

async function run(userId: string): Promise<Run> {
  const { candidats, famille } = await buildCandidates(userId, admin);
  return { candidats, famille };
}

const parId = (r: Run) => new Map(r.candidats.map(c => [c.meal.id, c]));

/** Combien de candidats utilisent cet ingrédient */
function nbCandidatsAvec(r: Run, ingredientId: number): number {
  return r.candidats.filter(c => (c.meal.ingredients ?? []).some(i => i.ingredient.id === ingredientId)).length;
}

function ingredientsDe(meal: { ingredients?: { ingredient: { id: number } }[] }): number[] {
  return (meal.ingredients ?? []).map(i => i.ingredient.id);
}

// ─── Script ─────────────────────────────────────────────────────────────────

async function main(): Promise<number> {
  // `order('id')` : sans ordre, PostgREST renvoie un profil arbitraire et le
  // script ne serait pas reproductible d'un lancement à l'autre.
  const { data: profil, error: profilError } = await admin
    .from('profiles').select('id, poids_famille, nb_personnes').not('email', 'is', null)
    .order('id').limit(1).maybeSingle();
  if (profilError || !profil) {
    console.error('❌ Aucun profil exploitable pour le test');
    return 1;
  }
  const userId = profil.id;
  const poidsOriginal = profil.poids_famille;
  console.log(`🔎 Profil ${userId.slice(0, 8)}… · poids_famille initial ${poidsOriginal}`);

  const membresCrees: number[] = [];

  /** Crée un membre et retient son id pour le nettoyage */
  async function creerMembre(
    nom: string, poids: number,
    aliments: { ingredient_id: number; relation: string }[],
    recettes: { meal_id: number; note?: number | null; ne_plus_proposer?: boolean }[]
  ): Promise<number> {
    const { data, error } = await admin.rpc('save_family_member', {
      p_user_id: userId, p_nom: nom, p_emoji: '👤', p_poids: poids,
      p_age: null, p_ingredients: aliments, p_preferences: recettes,
    });
    if (error || data == null) throw new Error(`save_family_member : ${error?.message ?? 'aucun id'}`);
    membresCrees.push(data);
    return data;
  }

  try {
    // ── 0. Le moteur voit-il tout le catalogue ? ──
    // PostgREST plafonne le nombre de lignes renvoyées par requête : si le
    // plafond est atteint, des recettes sont invisibles du moteur — et un foyer
    // qui filtre réduit encore ce pool. Autant le savoir.
    console.log('\n0. Catalogue visible par le moteur');
    const { count: totalCatalogue } = await admin.from('meals')
      .select('id', { count: 'exact', head: true })
      .eq('is_public', true).in('type_repas', ['plat', 'dessert']);
    const { data: pageCatalogue } = await admin.from('meals')
      .select('id').eq('is_public', true).in('type_repas', ['plat', 'dessert']);

    // Même technique que buildCandidates : avancer par pages d'id croissants
    const idsVus = new Set<number>();
    for (let page = 0; ; page++) {
      const { data } = await admin.from('meals')
        .select('id').eq('is_public', true).in('type_repas', ['plat', 'dessert'])
        .order('id').range(page * 1000, page * 1000 + 999);
      const lignes = (data ?? []) as { id: number }[];
      for (const l of lignes) idsVus.add(l.id);
      if (lignes.length < 1000) break;
    }

    verifier('une requête unique est bien plafonnée (référence du bug)',
      (pageCatalogue?.length ?? 0) < (totalCatalogue ?? 0),
      `${pageCatalogue?.length} reçues sur ${totalCatalogue} publiées`);
    verifier('la pagination atteint TOUT le catalogue',
      idsVus.size === totalCatalogue, `${idsVus.size} / ${totalCatalogue}`);

    // ── 0bis. Référence : le moteur SANS aucun membre ──
    console.log('\n0bis. Référence (foyer sans membre)');
    const base = await run(userId);
    verifier('le moteur produit des candidats', base.candidats.length > 0, `${base.candidats.length} recettes`);
    verifier('aucun membre chargé', base.famille.membres.length === 0);
    verifier('sans membre, les filtres famille sont vides',
      alimentsInterdits(base.famille).size === 0 && recettesVetees(base.famille).size === 0);

    // Cibles du test, choisies dans le pool réel
    const frequence = new Map<number, number>();
    for (const c of base.candidats) {
      for (const id of ingredientsDe(c.meal)) frequence.set(id, (frequence.get(id) ?? 0) + 1);
    }
    const [ingredientCible] = [...frequence].sort((a, b) => b[1] - a[1])[0];
    const nbAvecCible = nbCandidatsAvec(base, ingredientCible);
    // La recette cible est choisie HORS de l'aliment qui sera interdit : sinon
    // le filtre dur la retire du pool et les étapes 2 et 3 ne mesureraient plus
    // la mémoire du membre, mais l'absence de la recette.
    const poolSansCible = base.candidats.filter(c => !ingredientsDe(c.meal).includes(ingredientCible));
    const recetteCible = poolSansCible[Math.floor(poolSansCible.length / 2)];
    console.log(`   ingrédient cible #${ingredientCible} (présent dans ${nbAvecCible} candidats) · recette cible « ${recetteCible.meal.titre} »`);

    // ── 1. Exclusion dure : aliment interdit par un membre ──
    console.log('\n1. Aliment INTERDIT par un membre (allergie)');
    await creerMembre('Interdit', 3, [{ ingredient_id: ingredientCible, relation: 'interdit' }], []);
    const avecInterdit = await run(userId);

    verifier('le membre est chargé avec son interdit',
      alimentsInterdits(avecInterdit.famille).has(ingredientCible));
    verifier('plus AUCUN candidat ne contient l\'aliment interdit',
      nbCandidatsAvec(avecInterdit, ingredientCible) === 0,
      `${nbAvecCible} → ${nbCandidatsAvec(avecInterdit, ingredientCible)}`);
    verifier('le pool a bien diminué', avecInterdit.candidats.length < base.candidats.length,
      `${base.candidats.length} → ${avecInterdit.candidats.length}`);

    // ── 2. Mémoire par membre : une note fait baisser le score ──
    console.log('\n2. Mémoire d\'un membre : note 1/5 sur une recette');
    const { error: majErr } = await admin.rpc('save_family_member', {
      p_user_id: userId, p_nom: 'Interdit + note', p_emoji: '👤', p_poids: 3, p_age: null,
      p_membre_id: membresCrees[0],
      p_ingredients: [{ ingredient_id: ingredientCible, relation: 'interdit' }],
      p_preferences: [{ meal_id: recetteCible.meal.id, note: 1, ne_plus_proposer: false }],
    });
    verifier('la RPC accepte la mise à jour (remplacement complet)', !majErr, majErr?.message ?? '');

    const avecNote = await run(userId);
    const avant = parId(base).get(recetteCible.meal.id);
    const apres = parId(avecNote).get(recetteCible.meal.id);
    verifier('la recette notée 1/5 est chargée avec sa préférence',
      avecNote.famille.membres[0]?.recettes.get(recetteCible.meal.id)?.note === 1);
    verifier('son compromis familial est sous 1',
      (apres?.compromis ?? 1) < 1, `compromis ${apres?.compromis?.toFixed(3)}`);
    if (avant && apres) {
      verifier('son score a baissé', apres.score < avant.score,
        `${avant.score.toFixed(4)} → ${apres.score.toFixed(4)}`);
    }

    // ── 3. Veto pondéré : deux membres sur deux refusent ──
    console.log('\n3. Veto majoritaire du foyer (2 membres sur 2)');
    const membreB = await creerMembre('Second', 5, [], [
      { meal_id: recetteCible.meal.id, note: 1, ne_plus_proposer: true },
    ]);
    await admin.rpc('save_family_member', {
      p_user_id: userId, p_nom: 'Interdit + note', p_emoji: '👤', p_poids: 3, p_age: null,
      p_membre_id: membresCrees[0],
      p_ingredients: [{ ingredient_id: ingredientCible, relation: 'interdit' }],
      p_preferences: [{ meal_id: recetteCible.meal.id, note: 1, ne_plus_proposer: true }],
    });
    const avecVeto = await run(userId);
    verifier('le veto collectif est détecté', recettesVetees(avecVeto.famille).has(recetteCible.meal.id));
    verifier('la recette refusée par tous sort du pool',
      !parId(avecVeto).has(recetteCible.meal.id));

    // ── 4. Compromis : un membre qui aime est valorisé ──
    console.log('\n4. Compromis positif : un membre adore une recette');
    const recetteAimee = avecVeto.candidats.find(c => c.meal.id !== recetteCible.meal.id)!;
    await admin.rpc('save_family_member', {
      p_user_id: userId, p_nom: 'Second', p_emoji: '👤', p_poids: 5, p_age: null,
      p_membre_id: membreB,
      p_ingredients: [{ ingredient_id: ingredientsDe(recetteAimee.meal)[0] ?? ingredientCible, relation: 'aime' }],
      p_preferences: [{ meal_id: recetteAimee.meal.id, note: 5, ne_plus_proposer: false }],
    });
    const avecAime = await run(userId);
    const aimeApres = parId(avecAime).get(recetteAimee.meal.id);
    verifier('le compromis de la recette adorée est au-dessus de 1',
      (aimeApres?.compromis ?? 0) > 1, `compromis ${aimeApres?.compromis?.toFixed(3)}`);
    const avantAime = parId(base).get(recetteAimee.meal.id);
    if (avantAime && aimeApres) {
      verifier('son score a augmenté', aimeApres.score > avantAime.score,
        `${avantAime.score.toFixed(4)} → ${aimeApres.score.toFixed(4)}`);
    }

    // ── 5. poids_famille = 0 : retour EXACT au planning d'avant ──
    console.log('\n5. poids_famille = 0 → aucune influence');
    await admin.from('family_members').delete().in('id', membresCrees);
    membresCrees.length = 0;
    await creerMembre('Souple', 3, [{ ingredient_id: ingredientCible, relation: 'n_aime_pas' }], []);
    await admin.from('profiles').update({ poids_famille: 0 }).eq('id', userId);

    const neutre = await run(userId);
    verifier('aucun filtre dur ne subsiste', alimentsInterdits(neutre.famille).size === 0);
    verifier('le membre « souple » est bien chargé', neutre.famille.membres.length === 1);
    const identiques = base.candidats.length === neutre.candidats.length
      && base.candidats.every((c, i) => c.meal.id === neutre.candidats[i].meal.id
        && Math.abs(c.score - neutre.candidats[i].score) < 1e-9);
    verifier('à 0 %, les scores et l\'ordre sont IDENTIQUES à la référence', identiques,
      `${neutre.candidats.length} candidats`);

    // ── 6. Nettoyage ──
    console.log('\n6. Nettoyage');
    await admin.from('family_members').delete().in('id', membresCrees);
    membresCrees.length = 0;
    await admin.from('profiles').update({ poids_famille: poidsOriginal }).eq('id', userId);

    const { count } = await admin.from('family_members')
      .select('id', { count: 'exact', head: true }).eq('user_id', userId);
    verifier('plus aucun membre de test en base', (count ?? 0) === 0, `${count ?? 0} restant(s)`);

    const { data: apresNettoyage } = await admin.from('profiles')
      .select('poids_famille').eq('id', userId).maybeSingle();
    verifier('poids_famille restauré', apresNettoyage?.poids_famille === poidsOriginal,
      `${apresNettoyage?.poids_famille}`);

    const retour = await run(userId);
    verifier('le moteur retrouve la référence',
      retour.candidats.length === base.candidats.length, `${retour.candidats.length} candidats`);
  } catch (error) {
    console.error('\n💥 Échec inattendu :', error);
    echecs++;
  } finally {
    // Nettoyage garanti, même en cas d'erreur en cours de route
    if (membresCrees.length > 0) {
      await admin.from('family_members').delete().in('id', membresCrees);
    }
    await admin.from('profiles').update({ poids_famille: poidsOriginal }).eq('id', userId);
  }

  console.log('');
  if (echecs === 0) {
    console.log('🎉 Profils famille vérifiés de bout en bout sur la vraie base.');
    return 0;
  }
  console.log(`❌ ${echecs} vérification(s) en échec.`);
  return 1;
}

main().then(code => process.exit(code));
