// ============================================================================
// Nettoyage du catalogue de recettes (règles : src/lib/nettoyage-recettes.ts)
//
//   npx tsx scripts/nettoyer-recettes.ts               (aperçu, ne modifie rien)
//   npx tsx scripts/nettoyer-recettes.ts --appliquer   (écrit en base)
//
// 1. Titres : accords, élisions, mots répétés, « & » en série, majuscule
// 2. Instructions : consignes absurdes corrigées, ordre des modèles « pâtes »
// 3. Saison déduite des produits frais (95 % des recettes étaient « toutes »)
// 4. Cuisine « World healthy » (fourre-tout) recatégorisée
// 5. Description courte et factuelle (aucune recette n'en avait)
// 6. Calories aberrantes : portions recalculées (feijoada « légère » à 1 300 kcal,
//    dhal à 94 kcal) ; un « plat » trop léger devient une entrée
// 7. Variantes quasi identiques : 15 max par famille de titre — les autres
//    sont masquées (is_public = false), jamais celles déjà utilisées
// ============================================================================

import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });
import { createClient } from '@supabase/supabase-js';
import {
  nettoyerTitre, nettoyerInstructions, deduireSaison, recategoriserCuisine, genererDescription,
} from '../src/lib/nettoyage-recettes';

const APPLIQUER = process.argv.includes('--appliquer');
const MAX_PAR_FAMILLE = 15;
const KCAL_MAX = 1000, KCAL_CIBLE_HAUT = 650, KCAL_MIN_PLAT = 250, KCAL_CIBLE_BAS = 450;

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function tout<T>(table: string, cols: string, filtre?: (q: any) => any): Promise<T[]> { // eslint-disable-line @typescript-eslint/no-explicit-any
  let out: T[] = [];
  for (let o = 0; ; o += 1000) {
    let q = s.from(table).select(cols).range(o, o + 999);
    if (filtre) q = filtre(q);
    const { data, error } = await q;
    if (error) throw new Error(`${table} : ${error.message}`);
    out = out.concat((data ?? []) as T[]);
    if (!data || data.length < 1000) break;
  }
  return out;
}

interface Meal {
  id: number; titre: string; type_repas: string; cuisine: string | null; saison: string;
  temps_preparation: number; temps_cuisson: number | null; calories_par_portion: number | null;
  proteines: number | null; glucides: number | null; lipides: number | null; fibres: number | null;
  portions_par_defaut: number; instructions: string[] | null; description: string | null;
}

const norm = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();

(async () => {
  const meals = await tout<Meal>('meals',
    'id,titre,type_repas,cuisine,saison,temps_preparation,temps_cuisson,calories_par_portion,proteines,glucides,lipides,fibres,portions_par_defaut,instructions,description',
    q => q.eq('is_public', true));
  const mi = await tout<{ meal_id: number; ingredients: { nom: string } | null }>('meal_ingredients', 'meal_id, ingredients(nom)');
  const ingParMeal = new Map<number, string[]>();
  for (const l of mi) if (l.ingredients) ingParMeal.set(l.meal_id, [...(ingParMeal.get(l.meal_id) ?? []), l.ingredients.nom]);

  // Recettes déjà utilisées : jamais masquées (un planning en cours les affiche)
  const utilisees = new Set<number>([
    ...(await tout<{ meal_id: number | null }>('plan_meals', 'meal_id')).map(r => r.meal_id),
    ...(await tout<{ meal_id: number | null }>('meal_history', 'meal_id')).map(r => r.meal_id),
  ].filter((x): x is number => x != null));

  const stats = { titres: 0, instructions: 0, saisons: 0, cuisines: 0, descriptions: 0, portions: 0, versEntree: 0, masquees: 0 };
  const exemples: string[] = [];
  const patches = new Map<number, Record<string, unknown>>();
  const patch = (id: number, p: Record<string, unknown>) => patches.set(id, { ...(patches.get(id) ?? {}), ...p });

  for (const m of meals) {
    const ingredients = ingParMeal.get(m.id) ?? [];
    const titre = nettoyerTitre(m.titre);
    if (titre !== m.titre) { stats.titres++; patch(m.id, { titre }); if (exemples.length < 12) exemples.push(`${m.titre}  →  ${titre}`); }

    const instr = nettoyerInstructions(m.instructions ?? []);
    if (JSON.stringify(instr) !== JSON.stringify(m.instructions ?? [])) { stats.instructions++; patch(m.id, { instructions: instr }); }

    if (m.saison === 'toutes') {
      const saison = deduireSaison(titre, ingredients);
      if (saison !== 'toutes') { stats.saisons++; patch(m.id, { saison }); }
    }

    let cuisine = m.cuisine;
    if (m.cuisine === 'World healthy') { cuisine = recategoriserCuisine(titre); stats.cuisines++; patch(m.id, { cuisine }); }

    // Calories aberrantes → portions recalculées (le total de la recette ne change pas)
    let kcal = m.calories_par_portion;
    let type = m.type_repas;
    if (kcal != null && m.portions_par_defaut > 0 && (kcal > KCAL_MAX || (type === 'plat' && kcal < KCAL_MIN_PLAT))) {
      const total = kcal * m.portions_par_defaut;
      const cible = kcal > KCAL_MAX ? KCAL_CIBLE_HAUT : KCAL_CIBLE_BAS;
      const portions = Math.min(8, Math.max(1, Math.round(total / cible)));
      if (portions !== m.portions_par_defaut) {
        const f = m.portions_par_defaut / portions;
        const r1 = (v: number | null) => (v == null ? null : Math.round(v * f * 10) / 10);
        kcal = Math.round(kcal * f);
        stats.portions++;
        patch(m.id, { portions_par_defaut: portions, calories_par_portion: kcal, proteines: r1(m.proteines), glucides: r1(m.glucides), lipides: r1(m.lipides), fibres: r1(m.fibres) });
      }
      if (type === 'plat' && kcal < KCAL_MIN_PLAT) { type = 'entree'; stats.versEntree++; patch(m.id, { type_repas: 'entree' }); }
    }

    if (!m.description) {
      stats.descriptions++;
      patch(m.id, { description: genererDescription({ titre, type_repas: type, cuisine, temps: m.temps_preparation + (m.temps_cuisson || 0), kcal, ingredients }) });
    }
  }

  // Variantes quasi identiques : 15 max par famille (3 premiers mots du titre corrigé)
  const familles = new Map<string, Meal[]>();
  for (const m of meals) {
    const titre = (patches.get(m.id)?.titre as string) ?? m.titre;
    const cle = norm(titre).split(' ').slice(0, 3).join(' ');
    familles.set(cle, [...(familles.get(cle) ?? []), m]);
  }
  for (const [, membres] of familles) {
    if (membres.length <= MAX_PAR_FAMILLE) continue;
    // On garde les recettes utilisées, puis on diversifie par accompagnement (après la virgule)
    const gardees = membres.filter(m => utilisees.has(m.id));
    const vus = new Set(gardees.map(m => norm(m.titre).split(',')[1] ?? ''));
    for (const m of membres) {
      if (gardees.length >= MAX_PAR_FAMILLE) break;
      const acc = norm(m.titre).split(',')[1] ?? '';
      if (!gardees.includes(m) && !vus.has(acc)) { gardees.push(m); vus.add(acc); }
    }
    for (const m of membres) {
      if (gardees.length >= MAX_PAR_FAMILLE) break;
      if (!gardees.includes(m)) gardees.push(m);
    }
    for (const m of membres) if (!gardees.includes(m)) { stats.masquees++; patch(m.id, { is_public: false }); }
  }

  console.log(`${meals.length} recettes publiques analysées`);
  console.table(stats);
  console.log('Exemples de titres corrigés :\n  ' + exemples.join('\n  '));
  console.log(`${patches.size} recettes à mettre à jour`);
  if (!APPLIQUER) { console.log('\nAperçu seulement — relancez avec --appliquer pour écrire en base.'); return; }

  let ok = 0, ko = 0;
  const liste = [...patches.entries()];
  for (let i = 0; i < liste.length; i += 20) {
    await Promise.all(liste.slice(i, i + 20).map(async ([id, p]) => {
      const { error } = await s.from('meals').update(p).eq('id', id);
      if (error) { ko++; console.error(`#${id} : ${error.message}`); } else ok++;
    }));
  }
  console.log(`\n${ok} recettes mises à jour, ${ko} erreurs`);
})();
