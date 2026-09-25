// ============================================================================
// verifier-catalogue — le select allégé de /recettes tient-il ses promesses ?
//
// Une colonne mal orthographiée dans un select PostgREST ne casse pas le build :
// la réponse revient en erreur et la page affiche un catalogue vide. Ce script
// exécute donc la requête RÉELLE contre la vraie base — il importe
// `chargerCatalogue`, exactement la fonction qu'utilise la page.
//
// Lecture seule : aucune écriture, aucune donnée modifiée.
// Usage : npx tsx scripts/verifier-catalogue.ts
// ============================================================================

import { config } from 'dotenv';
config({ path: '.env.local' });
config();
import { createClient } from '@supabase/supabase-js';
import { chargerCatalogue, PAGE } from '../src/lib/catalogue';
import { toMealCatalogue } from '../src/lib/db-rows';
import { prixParPortion } from '../src/lib/budget';
import type { Database } from '../supabase/database.types';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

let echecs = 0;
const ok = (msg: string, detail = '') => console.log(`  ✅ ${msg}${detail ? `  ${detail}` : ''}`);
const ko = (msg: string, detail = '') => { echecs++; console.log(`  ❌ ${msg}${detail ? `  ${detail}` : ''}`); };
const titre = (n: string) => console.log(`\n${n}`);
const ko8 = (n: number) => `${Math.round(n / 1024)} ko`;

async function main() {
  const supabase = createClient<Database>(url, key, { auth: { persistSession: false } });

  // ─── 1. Le select réel est accepté et ramène TOUT le catalogue ─────────────
  titre('1. La requête réelle de la page');
  const t0 = Date.now();
  let lignes;
  try {
    lignes = await chargerCatalogue(supabase);
  } catch (e) {
    ko('la requête est REFUSÉE par PostgREST', `→ ${e instanceof Error ? e.message : e}`);
    console.log(`\n${'─'.repeat(60)}\n❌ 1 échec(s).`);
    process.exit(1);
  }
  ok('requête acceptée', `${lignes.length} recettes en ${Date.now() - t0} ms`);

  const { count } = await supabase
    .from('meals')
    .select('id', { count: 'exact', head: true })
    .eq('is_public', true);
  lignes.length === count
    ? ok('tout le catalogue public est chargé', `${count}/${count} (plafond PostgREST : ${PAGE})`)
    : ko('catalogue incomplet', `attendu ${count}, reçu ${lignes.length}`);

  const ids = new Set(lignes.map(l => l.id));
  ids.size === lignes.length
    ? ok('aucune recette en double (ordre total titre+id)')
    : ko(`${lignes.length - ids.size} doublon(s) — deux pages se chevauchent`);

  // ─── 2. Normalisation ─────────────────────────────────────────────────────
  titre('2. Normalisation des lignes');
  const meals = lignes.map(toMealCatalogue);
  const champsManquants = meals.filter(m => !m.titre || !m.type_repas || !m.portions_par_defaut).length;
  champsManquants === 0
    ? ok('titre, type et portions présents partout')
    : ko(`${champsManquants} recettes incomplètes`);
  const avecIng = meals.filter(m => m.ingredients.length > 0).length;
  ok('recettes avec ingrédients', `${avecIng}/${meals.length}`);

  // ─── 3. Les consommateurs de la page fonctionnent ─────────────────────────
  titre('3. Ce que la page fait de ces lignes');
  const chiffrables = meals.map(m => prixParPortion(m)).filter((p): p is number => p != null);
  chiffrables.length > 0
    ? ok('tri « le moins cher » opérationnel', `${chiffrables.length}/${meals.length} chiffrées`)
    : ko('aucune recette chiffrable : le tri par prix serait inerte');

  const cuisines = new Set(meals.map(m => m.cuisine).filter(Boolean));
  cuisines.size > 0 ? ok('filtre cuisine alimenté', `${cuisines.size} cuisines`) : ko('aucune cuisine');

  const equipements = new Set(meals.flatMap(m => m.ustensiles));
  equipements.size > 0 ? ok('filtre équipement alimenté', `${equipements.size} ustensiles`) : ko('aucun ustensile');

  // Les pastilles du foyer lisent l'id ET le nom de chaque ingrédient
  const sansNom = meals.filter(m => m.ingredients.some(i => !i.ingredient.nom || !i.ingredient.id)).length;
  sansNom === 0
    ? ok('chaque ingrédient porte id + nom (pastilles du foyer)', `${meals.reduce((s, m) => s + m.ingredients.length, 0)} lignes`)
    : ko(`${sansNom} recettes avec un ingrédient anonyme : pastilles aveugles`);

  // ─── 4. Gain réel, mesuré, à périmètre comparable ─────────────────────────
  titre('4. Gain face à l\'ancien select(\'*\')');
  const { data: brut, error: e2 } = await supabase
    .from('meals')
    .select('*')
    .eq('is_public', true)
    .order('titre')
    .order('id')
    .range(0, PAGE - 1);
  if (e2) ko('impossible de mesurer l\'ancien select', e2.message);
  else {
    const avant = Buffer.byteLength(JSON.stringify(brut), 'utf8');
    const apres = Buffer.byteLength(JSON.stringify(lignes), 'utf8');
    console.log(`     ancien : ${ko8(avant)} pour ${brut?.length} recettes (tronqué au plafond)`);
    console.log(`     allégé : ${ko8(apres)} pour ${lignes.length} recettes (catalogue complet)`);
    ok(`allègement`, `−${Math.round((1 - apres / avant) * 100)} % par recette, et +${lignes.length - (brut?.length ?? 0)} recettes atteintes`);
  }

  const instructions = lignes.some(l => 'instructions' in (l as object));
  instructions === false
    ? ok('`instructions` absent de la charge utile')
    : ko('`instructions` est encore téléchargé');

  console.log(`\n${'─'.repeat(60)}`);
  if (echecs === 0) console.log('✅ Tout est vert — le select allégé fonctionne sur la vraie base.');
  else console.log(`❌ ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch(err => { console.error('Erreur inattendue :', err); process.exit(1); });
