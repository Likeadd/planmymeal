// ============================================================================
// Audit des dosages : quantité de chaque ingrédient PAR PORTION, comparée à
// la distribution de ce même ingrédient dans tout le catalogue et à des
// bornes culinaires (huile, sel/épices, féculents, protéines…).
//
//   npx tsx scripts/audit-dosages.ts            (rapport)
//   npx tsx scripts/audit-dosages.ts --json f   (exporte les lignes suspectes)
// ============================================================================

import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });
import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'node:fs';
import { grammes, poidsUnitesDe } from '../src/lib/unites';

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export interface Ligne {
  mealId: number; titre: string; type: string; portions: number;
  ingredientId: number; nom: string; rayon: string | null; quantite: number; unite: string;
  gPortion: number | null;
}

export async function chargerLignes(): Promise<Ligne[]> {
  const { data: ings } = await s.from('ingredients').select('id, nom, rayon, poids_unites').range(0, 999);
  const parId = new Map((ings ?? []).map(i => [i.id, i]));
  const { data: dernier } = await s.from('meals').select('id').order('id', { ascending: false }).limit(1);
  const max = dernier?.[0]?.id ?? 0;
  const lignes: Ligne[] = [];
  const fenetres: number[] = [];
  for (let d = 0; d <= max; d += 500) fenetres.push(d);
  let i = 0;
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (i < fenetres.length) {
      const d = fenetres[i++];
      let data = null;
      for (let essai = 0; essai < 3 && !data; essai++) {
        const r = await s.from('meals')
          .select('id, titre, type_repas, portions_par_defaut, meal_ingredients(ingredient_id, quantite, unite)')
          .eq('is_public', true).gte('id', d).lt('id', d + 500);
        if (r.error) { if (essai === 2) throw new Error(JSON.stringify(r.error)); } else data = r.data;
      }
      for (const m of data ?? []) {
        const portions = m.portions_par_defaut || 2;
        for (const l of m.meal_ingredients ?? []) {
          const ing = parId.get(l.ingredient_id);
          const g = grammes(l.quantite, l.unite, poidsUnitesDe(ing?.poids_unites));
          lignes.push({
            mealId: m.id, titre: m.titre, type: m.type_repas, portions,
            ingredientId: l.ingredient_id, nom: ing?.nom ?? '?', rayon: ing?.rayon ?? null,
            quantite: l.quantite, unite: l.unite, gPortion: g == null ? null : g / portions,
          });
        }
      }
    }
  }));
  return lignes;
}

const quantile = (xs: number[], q: number) => {
  const t = [...xs].sort((a, b) => a - b);
  return t[Math.min(t.length - 1, Math.floor(q * t.length))];
};

if (process.argv[1]?.endsWith('audit-dosages.ts')) {
  (async () => {
    const lignes = await chargerLignes();
    console.log(`${lignes.length} lignes, ${new Set(lignes.map(l => l.mealId)).size} recettes`);
    console.log('Non convertibles en grammes :', lignes.filter(l => l.gPortion == null).length);

    // Statistiques par ingrédient (g / portion), plats uniquement
    const parIng = new Map<string, number[]>();
    for (const l of lignes) if (l.gPortion != null && l.type === 'plat') {
      (parIng.get(l.nom) ?? parIng.set(l.nom, []).get(l.nom)!).push(l.gPortion);
    }
    const stats = [...parIng.entries()].filter(([, v]) => v.length >= 20).map(([nom, v]) => ({
      nom, n: v.length, p5: quantile(v, 0.05), med: quantile(v, 0.5), p95: quantile(v, 0.95), max: Math.max(...v),
    })).sort((a, b) => b.n - a.n);
    console.log('\nnom | n | p5 | médiane | p95 | max  (g/portion, plats)');
    for (const x of stats) console.log(`${x.nom} | ${x.n} | ${x.p5.toFixed(1)} | ${x.med.toFixed(1)} | ${x.p95.toFixed(1)} | ${x.max.toFixed(1)}`);

    const fichier = process.argv[process.argv.indexOf('--json') + 1];
    if (process.argv.includes('--json') && fichier) writeFileSync(fichier, JSON.stringify(lignes));
  })();
}
