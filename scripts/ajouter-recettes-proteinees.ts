// ============================================================================
// Ajoute les recettes riches en protéines (scripts/data/recettes-proteinees.ts)
//
//   npx tsx scripts/ajouter-recettes-proteinees.ts               (aperçu)
//   npx tsx scripts/ajouter-recettes-proteinees.ts --appliquer   (insère)
//   … --entrees : même chose avec scripts/data/recettes-entrees.ts
//
// Les macros sont CALCULÉES depuis la composition (lib/macros) ; une recette
// déjà présente (même titre) n'est pas réinsérée.
// ============================================================================

import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });
import { createClient } from '@supabase/supabase-js';
import { calculerMacros } from '../src/lib/macros';
import type { PoidsUnites } from '../src/lib/unites';
import { deduireSaison, genererDescription } from '../src/lib/nettoyage-recettes';
import { RECETTES_PROTEINEES } from './data/recettes-proteinees';
import { RECETTES_ENTREES } from './data/recettes-entrees';

const APPLIQUER = process.argv.includes('--appliquer');
const ENTREES = process.argv.includes('--entrees');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

interface Ing {
  id: number; nom: string; poids_unites: PoidsUnites | null;
  calories_pour_100g: number | null; proteines_pour_100g: number | null; glucides_pour_100g: number | null; lipides_pour_100g: number | null;
}

(async () => {
  const { data: ings, error } = await s.from('ingredients')
    .select('id, nom, poids_unites, calories_pour_100g, proteines_pour_100g, glucides_pour_100g, lipides_pour_100g');
  if (error) throw error;
  const parNom = new Map((ings as Ing[]).map(i => [i.nom.toLowerCase(), i]));

  const { data: existants } = await s.from('meals').select('titre');
  const titres = new Set((existants ?? []).map(m => m.titre.toLowerCase()));

  let ok = 0;
  for (const r of ENTREES ? RECETTES_ENTREES : RECETTES_PROTEINEES) {
    const manquants = r.ingredients.filter(([nom]) => !parNom.has(nom.toLowerCase())).map(([nom]) => nom);
    if (manquants.length) { console.error(`✗ ${r.titre} : ingrédients inconnus ${manquants.join(', ')}`); continue; }

    const lignes = r.ingredients.map(([nom, quantite, unite]) => {
      const i = parNom.get(nom.toLowerCase())!;
      const coef = i.calories_pour_100g == null ? null : {
        cal: i.calories_pour_100g, proteines: i.proteines_pour_100g ?? 0, glucides: i.glucides_pour_100g ?? 0, lipides: i.lipides_pour_100g ?? 0,
      };
      return { quantite, unite, poidsUnites: i.poids_unites, coefficients: coef };
    });
    const res = calculerMacros(lignes, r.portions);
    if (!res.ok) { console.error(`✗ ${r.titre} : macros incalculables (${res.raison} — ${res.detail})`); continue; }
    const m = res.macros;
    // Seuil protéines : seulement pour la série protéinée
    const seuil = ENTREES ? 0 : r.type === 'plat' ? 30 : 20;
    const statut = m.p >= seuil ? '✓' : '⚠';
    console.log(`${statut} ${r.titre} — ${Math.round(m.cal)} kcal, ${m.p.toFixed(1)} g protéines / portion`);
    if (m.p < seuil || titres.has(r.titre.toLowerCase()) || !APPLIQUER) continue;

    const noms = r.ingredients.map(([nom]) => nom);
    const { data: meal, error: e1 } = await s.from('meals').insert({
      titre: r.titre, type_repas: r.type, cuisine: r.cuisine, difficulte: r.difficulte,
      temps_preparation: r.prep, temps_cuisson: r.cuisson || null, portions_par_defaut: r.portions,
      conservation_jours: r.conservation, ustensiles: r.ustensiles, instructions: r.etapes,
      saison: deduireSaison(r.titre, noms),
      calories_par_portion: Math.round(m.cal), proteines: Math.round(m.p * 10) / 10,
      glucides: Math.round(m.g * 10) / 10, lipides: Math.round(m.l * 10) / 10, macros_verifiables: true,
      description: genererDescription({ titre: r.titre, type_repas: r.type, cuisine: r.cuisine, temps: r.prep + r.cuisson, kcal: m.cal, ingredients: noms }),
      is_public: true,
    }).select('id').single();
    if (e1 || !meal) { console.error(`  insertion impossible : ${e1?.message}`); continue; }

    const { error: e2 } = await s.from('meal_ingredients').insert(r.ingredients.map(([nom, quantite, unite, optionnel]) => ({
      meal_id: meal.id, ingredient_id: parNom.get(nom.toLowerCase())!.id, quantite, unite, est_optionnel: optionnel === true,
    })));
    if (e2) { console.error(`  ingrédients non insérés : ${e2.message}`); await s.from('meals').delete().eq('id', meal.id); continue; }
    ok++;
  }
  console.log(APPLIQUER ? `\n${ok} recettes ajoutées` : '\nAperçu — relancez avec --appliquer pour insérer.');
})();
