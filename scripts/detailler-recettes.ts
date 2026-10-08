// ============================================================================
// Détaille TOUTES les recettes du catalogue : ajoute à chacune une « Mise en
// place » précise (chaque ingrédient avec sa quantité exacte, personnes,
// ustensiles, temps) en première étape, puis le service et la conservation à
// la fin (voir scripts/data/detail-etapes.ts).
//
//   npx tsx scripts/detailler-recettes.ts               (aperçu, ne modifie rien)
//   npx tsx scripts/detailler-recettes.ts --appliquer   (sauvegarde puis met à jour)
//
// Sûr à relancer : une recette dont la première étape commence déjà par
// « Mise en place » est ignorée. Les anciennes étapes sont sauvegardées dans
// backups/<date>/instructions-avant-detail.json avant toute écriture.
// ============================================================================

import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });
import { createClient } from '@supabase/supabase-js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { enrichirEtapes } from './data/detail-etapes';
import type { RecetteSaisie } from './data/recettes-proteinees';

const APPLIQUER = process.argv.includes('--appliquer');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const PAGE = 500;

interface Ligne { ingredient_id: number; quantite: number; unite: string; est_optionnel: boolean | null }
interface Meal {
  id: number; titre: string; type_repas: string; temps_preparation: number; temps_cuisson: number | null;
  portions_par_defaut: number; conservation_jours: number | null; ustensiles: string[] | null; instructions: string[] | null;
  meal_ingredients: Ligne[] | null;
}

(async () => {
  const { data: ings, error: e0 } = await s.from('ingredients').select('id, nom').range(0, 999);
  if (e0) throw e0;
  const nomParId = new Map((ings ?? []).map(i => [i.id, i.nom]));

  const { count } = await s.from('meals').select('id', { count: 'exact', head: true }).eq('is_public', true);
  const repas: Meal[] = [];
  for (let n = 0; n * PAGE < (count ?? 0); n++) {
    const { data, error } = await s.from('meals')
      .select('id, titre, type_repas, temps_preparation, temps_cuisson, portions_par_defaut, conservation_jours, ustensiles, instructions, meal_ingredients(ingredient_id, quantite, unite, est_optionnel)')
      .eq('is_public', true).order('id').range(n * PAGE, (n + 1) * PAGE - 1);
    if (error) throw error;
    repas.push(...(data as unknown as Meal[]));
  }

  const aMettreAJour: { id: number; titre: string; avant: string[]; apres: string[] }[] = [];
  let dejaFait = 0, sansIngredients = 0;
  for (const m of repas) {
    const avant = m.instructions ?? [];
    if (avant[0]?.startsWith('Mise en place')) { dejaFait++; continue; }
    const lignes = m.meal_ingredients ?? [];
    if (lignes.length === 0 || avant.length === 0) { sansIngredients++; continue; }
    const r: RecetteSaisie = {
      titre: m.titre, type: m.type_repas as RecetteSaisie['type'], cuisine: '', prep: m.temps_preparation, cuisson: m.temps_cuisson ?? 0,
      difficulte: 'facile', portions: m.portions_par_defaut || 2, conservation: m.conservation_jours ?? 0, ustensiles: m.ustensiles ?? [],
      ingredients: lignes.map(l => [nomParId.get(l.ingredient_id) ?? 'Ingrédient', l.quantite, l.unite, l.est_optionnel === true]),
      etapes: avant,
    };
    aMettreAJour.push({ id: m.id, titre: m.titre, avant, apres: enrichirEtapes(r) });
  }

  console.log(`${repas.length} recettes publiques — à détailler : ${aMettreAJour.length}, déjà détaillées : ${dejaFait}, ignorées (sans ingrédient ou sans étape) : ${sansIngredients}`);
  for (const x of aMettreAJour.filter((_, i) => i % Math.max(1, Math.floor(aMettreAJour.length / 3)) === 0).slice(0, 3)) {
    console.log(`\n■ ${x.titre}`);
    x.apres.forEach((e, i) => console.log(`  ${i + 1}. ${e}`));
  }
  if (!APPLIQUER) { console.log('\nAperçu — relancez avec --appliquer pour mettre à jour.'); return; }

  // Sauvegarde AVANT écriture
  const dossier = `backups/${new Date().toISOString().slice(0, 10)}`;
  mkdirSync(dossier, { recursive: true });
  writeFileSync(`${dossier}/instructions-avant-detail.json`, JSON.stringify(aMettreAJour.map(x => ({ id: x.id, titre: x.titre, instructions: x.avant }))));
  console.log(`Sauvegarde : ${dossier}/instructions-avant-detail.json`);

  let ok = 0, ko = 0;
  for (let i = 0; i < aMettreAJour.length; i += 10) {
    const lot = aMettreAJour.slice(i, i + 10);
    const res = await Promise.all(lot.map(x => s.from('meals').update({ instructions: x.apres }).eq('id', x.id)));
    for (const r of res) r.error ? ko++ : ok++;
    process.stdout.write(`\r${ok + ko} / ${aMettreAJour.length}`);
  }
  console.log(`\n${ok} recettes détaillées, ${ko} en erreur.`);
})();
