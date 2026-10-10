// Stats du catalogue : répartition par type, rapidité et protéines (repérer les manques avant d'ajouter des recettes)
//   npx tsx scripts/stats-catalogue.ts [--ingredients]
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });
import { createClient } from '@supabase/supabase-js';

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

(async () => {
  if (process.argv.includes('--ingredients')) {
    const { data } = await s.from('ingredients').select('nom').order('nom').range(0, 999);
    console.log((data ?? []).map(i => i.nom).join(' | '));
    return;
  }
  const meals: { titre: string; type_repas: string; cuisine: string | null; temps_preparation: number; temps_cuisson: number | null }[] = [];
  for (let i = 0; ; i += 1000) {
    const { data } = await s.from('meals').select('titre, type_repas, cuisine, temps_preparation, temps_cuisson').eq('is_public', true).range(i, i + 999);
    if (!data?.length) break;
    meals.push(...data);
  }
  const compte = (f: (m: (typeof meals)[number]) => string) => {
    const c: Record<string, number> = {};
    for (const m of meals) { const k = f(m); c[k] = (c[k] ?? 0) + 1; }
    return Object.entries(c).sort((a, b) => b[1] - a[1]);
  };
  console.log('Total', meals.length);
  console.log('Types', compte(m => m.type_repas));
  console.log('Rapides ≤20 min par type', compte(m => (m.temps_preparation + (m.temps_cuisson ?? 0) <= 20 ? m.type_repas : 'x')).filter(x => x[0] !== 'x'));
  console.log('Cuisines', compte(m => m.cuisine ?? '—').slice(0, 40));
  const mots = ['poulet', 'dinde', 'boeuf|bœuf|steak', 'porc', 'veau', 'agneau', 'saumon', 'thon', 'cabillaud|colin|merlu', 'crevette', 'œuf|omelette', 'tofu', 'lentille', 'pois chiche', 'pâtes|spaghetti|penne|tagliatelle', 'riz', 'quinoa', 'boulgour', 'semoule', 'pomme de terre', 'wrap', 'salade', 'soupe|velouté', 'gratin', 'curry', 'bowl', 'poêlée|sauté', 'tarte|quiche', 'burger', 'pizza', 'omelette', 'moules', 'sardine|maquereau', 'dinde', 'jambon', 'chorizo|saucisse', 'champignon', 'courgette', 'aubergine', 'chou', 'épinard', 'patate douce', 'butternut|potimarron|courge'];
  console.log('Mots-clés dans les titres :', mots.map(w => `${w}:${meals.filter(m => new RegExp(w, 'i').test(m.titre)).length}`).join('  '));
})();
