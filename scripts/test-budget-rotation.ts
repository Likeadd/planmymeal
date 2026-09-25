// ============================================================================
// TEST : pondération budget + scénario batch cooking du moteur de rotation
// Usage : npx tsx scripts/test-budget-rotation.ts
//
// Génère (sans sauvegarder) une semaine selon 3 scénarios de budget :
//   A. sans budget   B. budget serré (25 €)   C. budget confortable (150 €)
// puis compare le prix moyen par portion des 14 repas sélectionnés.
// Enfin, un scénario D active le batch cooking (jour par défaut) et vérifie
// la structure de la semaine (recettes partagées, desserts midi, restes).
// Read-only : aucun plan ni historique n'est modifié. Le budget et les flags
// batch du profil testé sont sauvegardés puis restaurés.
// ============================================================================

import { config } from 'dotenv';
config({ path: '.env.local' });
config();
import { createClient } from '@supabase/supabase-js';
import { generateWeeklyPlan } from '../src/lib/rotation-engine';
import { prixParPortion, prixRecette } from '../src/lib/budget';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const NB_RUNS = 5; // tirages par scénario (le pool est pondéré aléatoirement)

async function scenario(libelle: string, budget: number | null, userId: string, nbPersonnes: number) {
  // 1. Fixer le budget du profil (temporaire)
  const { error } = await (supabase as any).from('profiles').update({ budget_hebdo: budget }).eq('id', userId);
  if (error) throw error;

  const prixMoyens: number[] = [];
  let totalRecettesChiffrees = 0;

  for (let i = 0; i < NB_RUNS; i++) {
    const { days } = await generateWeeklyPlan(userId, '2026-01-05', supabase);
    const portions: number[] = [];
    let coutRecettes = 0;

    for (const d of days) {
      for (const meal of [d.dejeuner, d.diner]) {
        if (!meal) continue;
        const pp = prixParPortion(meal as any);
        if (pp != null) portions.push(pp);
        coutRecettes += prixRecette(meal as any).total;
      }
    }
    if (portions.length > 0) prixMoyens.push(portions.reduce((s, p) => s + p, 0) / portions.length);
    totalRecettesChiffrees = coutRecettes;
  }

  const avg = prixMoyens.reduce((s, p) => s + p, 0) / prixMoyens.length;
  const min = Math.min(...prixMoyens);
  const max = Math.max(...prixMoyens);

  console.log(`\n${libelle}`);
  console.log(`   Prix moyen / portion : ${avg.toFixed(2)} €  (min ${min.toFixed(2)} € · max ${max.toFixed(2)} € sur ${NB_RUNS} tirages)`);
  console.log(`   Coût recettes 14 repas (portions d'origine) : ~${totalRecettesChiffrees.toFixed(2)} €`);
  console.log(`   Estimation semaine pour ${nbPersonnes} pers. : ~${(totalRecettesChiffrees * (nbPersonnes / 2)).toFixed(2)} €`);

  return avg;
}

/**
 * Scénario batch cooking : active le flag du profil, génère une semaine et
 * vérifie la structure attendue (recettes partagées sur les 4 jours batch,
 * desserts du soir, desserts midi dont les jours batch en mode restes).
 * Retourne le prix moyen / portion pour la comparaison budget.
 */
async function scenarioBatch(userId: string, nbPersonnes: number) {
  const { error } = await (supabase as any)
    .from('profiles').update({ budget_hebdo: null, batch_cooking: true, batch_cooking_jour: 6 }).eq('id', userId);
  if (error) throw error;

  const prixMoyens: number[] = [];
  let echecs = 0;
  let dessertsSoirTotal = 0;
  let dessertsMidiTotal = 0;

  for (let i = 0; i < NB_RUNS; i++) {
    const { days } = await generateWeeklyPlan(userId, '2026-01-05', supabase);

    // ── Structure attendue ──
    // 1. Les 4 jours batch (dim + 3) partagent les mêmes recettes
    const batchDays = [6, 0, 1, 2];
    const recettesBatch = new Set<number>();
    for (const idx of batchDays) {
      const d = days[idx];
      for (const m of [d.dejeuner, d.diner]) if (m) recettesBatch.add(m.id);
    }
    if (recettesBatch.size > 4) {
      console.error(`   ❌ tirage ${i + 1} : ${recettesBatch.size} recettes distinctes sur 4 jours batch (attendu ≤ 4)`);
      echecs++;
    }

    // 2. Desserts du soir : 3 à 4 par semaine
    const nbDessertsSoir = days.filter(d => d.dessert != null).length;
    if (nbDessertsSoir < 3 || nbDessertsSoir > 4) {
      console.error(`   ❌ tirage ${i + 1} : ${nbDessertsSoir} desserts du soir (attendu 3-4)`);
      echecs++;
    }

    // 3. Desserts midi : ≤ 3, jamais deux fois le même
    const dessertsMidi = days.filter(d => d.dessertMidi != null).map(d => d.dessertMidi!.id);
    if (dessertsMidi.length > 3 || new Set(dessertsMidi).size !== dessertsMidi.length) {
      console.error(`   ❌ tirage ${i + 1} : desserts midi invalides (${dessertsMidi.join(', ')})`);
      echecs++;
    }
    dessertsSoirTotal += nbDessertsSoir;
    dessertsMidiTotal += dessertsMidi.length;

    // 4. Prix moyen / portion (14 repas principaux)
    const portions: number[] = [];
    for (const d of days) {
      for (const m of [d.dejeuner, d.diner]) {
        if (!m) continue;
        const pp = prixParPortion(m as any);
        if (pp != null) portions.push(pp);
      }
    }
    if (portions.length > 0) prixMoyens.push(portions.reduce((s, p) => s + p, 0) / portions.length);
  }

  const avg = prixMoyens.reduce((s, p) => s + p, 0) / prixMoyens.length;

  console.log(`\nD) Batch cooking (dimanche, sans budget)`);
  console.log(`   Prix moyen / portion : ${avg.toFixed(2)} €  (sur ${NB_RUNS} tirages)`);
  console.log(`   Semaine batch : 4 jours couverts (dim→mer) · desserts soir : ${(dessertsSoirTotal / NB_RUNS).toFixed(1)}/sem · desserts midi : ${(dessertsMidiTotal / NB_RUNS).toFixed(1)}/sem (moyenne)`);
  if (echecs === 0) {
    console.log('   ✅ Structure batch valide : recettes partagées ≤ 4, desserts soir 3-4, desserts midi ≤ 3 uniques.');
  } else {
    console.log(`   ❌ ${echecs} anomalie(s) de structure détectée(s) sur ${NB_RUNS} tirages.`);
  }

  return avg;
}

async function main() {
  console.log('🧪 Test de la pondération budget\n');

  // Utilisateur de test : premier profil trouvé
  const { data: profiles } = await (supabase as any)
    .from('profiles').select('id, budget_hebdo, nb_personnes, batch_cooking, batch_cooking_jour').limit(1);
  if (!profiles || profiles.length === 0) {
    console.error("❌ Aucun profil utilisateur trouvé — créez un compte d'abord.");
    process.exit(1);
  }
  const user = profiles[0];
  const nbPersonnes = user.nb_personnes || 2;
  console.log(`👤 Profil testé : ${user.id} (${nbPersonnes} pers.) — budget actuel : ${user.budget_hebdo ?? 'aucun'} · batch : ${user.batch_cooking ? `oui (jour ${user.batch_cooking_jour})` : 'non'}`);

  // Le cooldown de rotation (21 jours) peut bloquer toutes les recettes si
  // l'historique de test est dense → on retire temporairement les marqueurs
  // 'planned' (les feedbacks cooked/liked/disliked sont préservés).
  const { data: plannedRows } = await (supabase as any)
    .from('meal_history').select('id, user_id, meal_id, planned_date, status, rating, notes')
    .eq('user_id', user.id).eq('status', 'planned');
  console.log(`🧹 Retrait temporaire de ${plannedRows?.length ?? 0} marqueurs 'planned' (cooldown 21j)`);
  await (supabase as any).from('meal_history').delete()
    .eq('user_id', user.id).eq('status', 'planned');

  try {
    const sansBudget = await scenario('A) Sans budget (baseline)', null, user.id, nbPersonnes);
    const budgetSerré = await scenario(`B) Budget serré (25 € / semaine)`, 25, user.id, nbPersonnes);
    const budgetLarge = await scenario(`C) Budget confortable (150 € / semaine)`, 150, user.id, nbPersonnes);
    const batch = await scenarioBatch(user.id, nbPersonnes);

    const gain = ((sansBudget - budgetSerré) / sansBudget) * 100;
    const delta = ((budgetLarge - sansBudget) / sansBudget) * 100;

    console.log('\n─────────────────────────────────────────────────');
    console.log(`📊 Budget serré → prix moyen ${(gain >= 0 ? '-' : '+')}${Math.abs(gain).toFixed(0)}% vs sans budget`);
    console.log(`📊 Budget confortable → prix moyen ${delta >= 0 ? '+' : ''}${delta.toFixed(0)}% vs sans budget`);
    if (gain > 3) {
      console.log('✅ La pondération budget fonctionne : les recettes économiques sont bien favorisées.');
    } else {
      console.log('⚠️  Écart faible — vérifiez le facteur budget (src/lib/budget.ts).');
    }
    void batch;
  } finally {
    // 2. Toujours restaurer le budget, les flags batch ET les marqueurs 'planned'
    const { error: restoreErr } = await (supabase as any)
      .from('profiles').update({
        budget_hebdo: user.budget_hebdo ?? null,
        batch_cooking: user.batch_cooking ?? false,
        batch_cooking_jour: user.batch_cooking_jour ?? 6,
      }).eq('id', user.id);
    if (restoreErr) console.error('⚠️  Restauration du profil impossible :', restoreErr.message);
    else console.log(`\n♻️  Profil restauré (budget : ${user.budget_hebdo ?? 'aucun'} · batch : ${user.batch_cooking ? 'oui' : 'non'}).`);

    if (plannedRows && plannedRows.length > 0) {
      const { error: histErr } = await (supabase as any)
        .from('meal_history').insert(plannedRows);
      if (histErr) console.error('⚠️  Restauration de l\'historique impossible :', histErr.message);
      else console.log(`♻️  ${plannedRows.length} marqueurs 'planned' restaurés.`);
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
