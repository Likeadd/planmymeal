// ============================================================================
// Nettoyage de la base (audit SQL du 13/10/2026) — sauvegarde puis suppression :
//   1. recettes PRIVÉES SANS PROPRIÉTAIRE (created_by null, jamais utilisées) ;
//   2. ingrédients utilisés par AUCUNE table (recette, frigo, allergie, courses…) ;
//   3. images orphelines du stockage `meal-images` (aucune recette ne les référence).
//
//   npx tsx scripts/nettoyer-base.ts              (aperçu, n'écrit rien)
//   npx tsx scripts/nettoyer-base.ts --appliquer  (sauvegarde dans backups/<date>/ puis supprime)
// ============================================================================

import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });
import { createClient } from '@supabase/supabase-js';
import { mkdirSync, writeFileSync } from 'node:fs';

const APPLIQUER = process.argv.includes('--appliquer');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  // 1. Recettes privées orphelines
  const { data: privees, error: e1 } = await s.from('meals')
    .select('*, meal_ingredients(*)').eq('is_public', false).is('created_by', null);
  if (e1) throw e1;
  const ids = (privees ?? []).map(m => m.id);
  const [{ data: plans }, { data: histo }, { data: prefs }] = await Promise.all([
    s.from('plan_meals').select('meal_id').in('meal_id', ids.length ? ids : [-1]),
    s.from('meal_history').select('meal_id').in('meal_id', ids.length ? ids : [-1]),
    s.from('user_meal_preferences').select('meal_id').in('meal_id', ids.length ? ids : [-1]),
  ]);
  const utilisees = new Set([...(plans ?? []), ...(histo ?? []), ...(prefs ?? [])].map(x => x.meal_id));
  const aSupprimer = (privees ?? []).filter(m => !utilisees.has(m.id));
  console.log(`Recettes privées sans propriétaire : ${ids.length} — à supprimer (jamais utilisées) : ${aSupprimer.length}`);

  // 2. Ingrédients sans aucune référence
  const { data: ings } = await s.from('ingredients').select('*').range(0, 999);
  const tables: [string, string][] = [['fridge_items', 'ingredient_id'], ['user_allergies', 'ingredient_id'],
    ['user_dislikes', 'ingredient_id'], ['shopping_list_items', 'ingredient_id'], ['user_prix_ingredients', 'ingredient_id'], ['family_member_ingredients', 'ingredient_id']];
  const utilisesAilleurs = new Set<number>(); // frigo, allergies, courses, prix, profils famille
  for (const [t, c] of tables) {
    for (let d = 0; ; d += 1000) {
      const { data } = await s.from(t).select(c).range(d, d + 999);
      (data ?? []).forEach(r => utilisesAilleurs.add((r as unknown as Record<string, number>)[c]));
      if ((data?.length ?? 0) < 1000) break;
    }
  }
  // Les recettes à supprimer comptent comme non utilisatrices
  const idsASup = new Set(aSupprimer.map(m => m.id));
  const utilisesParRecettesConservees = new Set<number>();
  for (let d = 0; ; d += 1000) {
    const { data } = await s.from('meal_ingredients').select('meal_id, ingredient_id').range(d, d + 999);
    (data ?? []).forEach(r => { if (!idsASup.has(r.meal_id)) utilisesParRecettesConservees.add(r.ingredient_id); });
    if ((data?.length ?? 0) < 1000) break;
  }
  const ingASup = (ings ?? []).filter(i => !utilisesParRecettesConservees.has(i.id) && !utilisesAilleurs.has(i.id));
  console.log(`Ingrédients sans aucune utilisation (après suppression des recettes) : ${ingASup.length} — ${ingASup.map(i => i.nom).join(', ')}`);

  // 3. Images du stockage
  const { data: fichiers } = await s.storage.from('meal-images').list('meals', { limit: 1000 });
  const { count: refs } = await s.from('meals').select('id', { count: 'exact', head: true }).not('image_url', 'is', null);
  console.log(`Images dans le stockage : ${fichiers?.length ?? 0} — recettes qui en référencent encore : ${refs ?? 0}`);

  if (!APPLIQUER) { console.log('\nAperçu — relancez avec --appliquer pour sauvegarder puis supprimer.'); return; }

  const dossier = `backups/${new Date().toISOString().slice(0, 10)}`;
  mkdirSync(dossier, { recursive: true });
  writeFileSync(`${dossier}/nettoyage-base-avant.json`, JSON.stringify({ meals: aSupprimer, ingredients: ingASup }));
  console.log(`Sauvegarde : ${dossier}/nettoyage-base-avant.json`);

  for (let i = 0; i < aSupprimer.length; i += 100) {
    const { error } = await s.from('meals').delete().in('id', aSupprimer.slice(i, i + 100).map(m => m.id));
    if (error) throw error;
  }
  console.log(`${aSupprimer.length} recettes supprimées.`);

  const idsIng = ingASup.map(i => i.id);
  for (let i = 0; i < idsIng.length; i += 50) {
    const { error } = await s.from('ingredients').delete().in('id', idsIng.slice(i, i + 50));
    if (error) console.error('Ingrédients non supprimés (références restantes) :', error.message);
  }

  if ((refs ?? 0) === 0 && fichiers?.length) {
    const { error } = await s.storage.from('meal-images').remove(fichiers.map(f => `meals/${f.name}`));
    console.log(error ? `Images : ${error.message}` : `${fichiers.length} images supprimées du stockage.`);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
