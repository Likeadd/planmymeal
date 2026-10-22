// ============================================================================
// Importe les recettes du dossier markdown/ (une recette par fichier .md).
//
//   npx tsx scripts/importer-markdown.ts               (aperçu)
//   npx tsx scripts/importer-markdown.ts --appliquer   (insère)
//
// Macros reprises du fichier (macros_verifiables = false : non recalculées depuis la
// composition). Recette déjà présente (même titre) ignorée. Ingrédients inconnus créés
// sans macros ni prix. Images non importées.
// ============================================================================

import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });
import { readdirSync, readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { deduireSaison, genererDescription } from '../src/lib/nettoyage-recettes';

const APPLIQUER = process.argv.includes('--appliquer');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const norm = (t: string) =>
  t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, ' ').replace(/\s+/g, ' ').trim().replace(/s$/, '');

const RAYONS: [string, RegExp][] = [
  ['epices', /\b(sel|poivre|cannelle|curcuma|paprika|cumin|piment|epice|arome|vanille|sucralose|stevia|thym|origan|basilic sec|muscade|curry)/],
  ['fruits_legumes', /\b(pomme|poire|banane|fraise|framboise|myrtille|citron|orange|clementine|tomate|oignon|ail|carotte|courgette|aubergine|poivron|champignon|salade|epinard|brocoli|chou|patate|pomme de terre|avocat|concombre|persil|ciboulette|coriandre|menthe|mangue|ananas|kiwi|fruit|legume|haricot vert|echalote|citrouille|potiron|mais)/],
  ['viande_poisson', /\b(poulet|boeuf|porc|dinde|jambon|lardon|bacon|saumon|thon|cabillaud|crevette|viande|steak|canard|veau|agneau|saucisse|poisson|merguez)/],
  ['frais', /\b(oeuf|lait|yaourt|skyr|fromage|creme|beurre|mozzarella|parmesan|emmental|feta|ricotta|cottage|burrata|blanc)/],
  ['boulangerie', /\b(pain|tortilla|wrap|bagel|brioche|baguette|pate feuilletee|pate brisee|galette)/],
  ['surgeles', /surgel/],
  ['boissons', /\b(eau|vin|jus|biere|cafe|the )/],
  ['conserves', /\b(conserve|boite|coulis|concentre)/],
  ['epicerie_sucree', /\b(sucre|miel|sirop|chocolat|cacao|confiture|farine|levure|proteine en poudre|whey|biscuit|speculoos)/],
];
const rayonDe = (nom: string) => RAYONS.find(([, re]) => re.test(norm(nom)))?.[0] ?? 'epicerie_salee';

const UNITES: [RegExp, string, number][] = [
  [/^kg\b/, 'g', 1000], [/^g\b/, 'g', 1], [/^ml\b/, 'ml', 1], [/^cl\b/, 'ml', 10], [/^l\b/, 'ml', 1000],
  [/^cuill[eè]res? [àa] soupe/, 'cas', 1], [/^cuill[eè]res? [àa] caf[eé]/, 'cac', 1], [/^cuill[eè]res?\b/, 'cas', 1],
  [/^pinc[ée]es?/, 'pincee', 1], [/^tranches?/, 'tranche', 1], [/^sachets?/, 'sachet', 1],
  [/^(bo[iî]tes?|conserves?)/, 'boite', 1], [/^bottes?/, 'botte', 1],
];

interface Ligne { nom: string; quantite: number; unite: string; optionnel: boolean }

function parseIngredient(brut: string): Ligne | null {
  let t = brut.replace(/^[-\s]+/, '').trim();
  if (!t || /^(sel|poivre|sel et poivre)( .*)?$/i.test(t) || /^pinc[ée]e de sel/i.test(t)) return null;
  const m = t.match(/^(\d+(?:[.,]\d+)?(?:\/\d+)?)\s*(.*)$/);
  let quantite = 1, unite = 'pcs', optionnel = true, reste = t;
  if (m) {
    optionnel = false;
    quantite = m[1].includes('/') ? eval(m[1]) : parseFloat(m[1].replace(',', '.'));
    reste = m[2];
    const u = UNITES.find(([re]) => re.test(reste.toLowerCase()));
    if (u) { unite = u[1]; quantite *= u[2]; reste = reste.replace(u[0], '').trim(); }
  }
  const nom = reste.replace(/\(.*?\)/g, ' ').replace(/^(de |d'|d’|du |des |de la |de l'|de l’)/i, '').replace(/\s+/g, ' ').replace(/[,;:].*$/, '').trim();
  if (!nom || nom.length > 80 || !(quantite > 0)) return null;
  return { nom: nom.charAt(0).toUpperCase() + nom.slice(1), quantite: Math.round(quantite * 100) / 100, unite, optionnel };
}

const minutes = (t?: string) => {
  if (!t) return 0;
  const h = t.match(/(\d+)\s*h/), mn = t.match(/(\d+)\s*min/);
  return (h ? +h[1] * 60 : 0) + (mn ? +mn[1] : 0) || (parseInt(t, 10) || 0);
};

function typeRepas(cats: string[]) {
  const a = (re: RegExp) => cats.some(c => re.test(c));
  if (a(/^(Petit déjeuner|Brunch)/)) return 'petit_dejeuner';
  if (a(/^(Dessert|Glace|Cheesecake|Snack sucré|Bowl Cake|Boulangerie|Gourmandises)/)) return 'dessert';
  if (a(/^(Snack salé|Boisson|Sauce)/)) return 'snack';
  if (a(/^(Soupe|Accompagnement)/)) return 'entree';
  return 'plat';
}
const CUISINES: Record<string, string> = { Asiatique: 'Asiatique', Italien: 'Italien', Grec: 'Grec', 'Cuisine des îles': 'Îles', 'Amérique Centrale': 'Mexicain' };

interface Recette {
  titre: string; type: string; cuisine: string | null; prep: number; cuisson: number; portions: number;
  kcal: number; p: number; g: number; l: number; ingredients: Ligne[]; etapes: string[];
}

function lire(fichier: string): Recette | null {
  const txt = readFileSync(`markdown/${fichier}`, 'utf8');
  const titre = txt.match(/^# (.+)$/m)?.[1].trim();
  const champ = (n: string) => txt.match(new RegExp(`\\*\\*${n} :\\*\\* (.+)`))?.[1].trim();
  const nut = champ('Valeurs nutritionnelles')?.match(/(\d+(?:[.,]\d+)?) kcal · (\d+(?:[.,]\d+)?) prot\S* · (\d+(?:[.,]\d+)?) gluc\S* · (\d+(?:[.,]\d+)?) lip/);
  // Plusieurs sections possibles : « ## Ingrédients — Pour le biscuit : »
  const section = (n: string) => txt.split(/^## /m).filter(b => b.startsWith(n)).map(b => b.slice(b.indexOf('\n'))).join('\n');
  const ings = section('Ingrédients').split('\n').filter(l => l.startsWith('-')).map(parseIngredient).filter((x): x is Ligne => !!x);
  const etapes = section('Étapes').split('\n').filter(l => /^\d+\./.test(l.trim())).map(l => l.replace(/^\d+\.\s*/, '').trim());
  if (!titre || !nut || !ings.length || !etapes.length) return null;
  const f = (x: string) => parseFloat(x.replace(',', '.'));
  const cats = (champ('Catégories') ?? '').split(',').map(c => c.trim());
  const temps = minutes(champ('Temps')), cuisson = minutes(champ('Cuisson'));
  return {
    titre, type: typeRepas(cats), cuisine: cats.map(c => CUISINES[c]).find(Boolean) ?? null,
    prep: Math.max(temps - cuisson, 5), cuisson, portions: parseInt(champ('Portions') ?? '1', 10) || 1,
    kcal: f(nut[1]), p: f(nut[2]), g: f(nut[3]), l: f(nut[4]), ingredients: ings, etapes,
  };
}

async function toutCharger<T>(table: string, cols: string): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await s.from(table).select(cols).range(from, from + 999);
    if (error) throw error;
    out.push(...(data as T[]));
    if (data.length < 1000) return out;
  }
}

(async () => {
  const existants = new Set((await toutCharger<{ titre: string }>('meals', 'titre')).map(m => m.titre.toLowerCase()));
  const idParNom = new Map((await toutCharger<{ id: number; nom: string }>('ingredients', 'id, nom')).map(i => [norm(i.nom), i.id]));

  const aImporter: Recette[] = [];
  let illisibles = 0, deja = 0;
  for (const f of readdirSync('markdown').filter(f => f.endsWith('.md') && f !== 'README.md')) {
    const r = lire(f);
    if (!r) { illisibles++; console.error(`✗ illisible : ${f}`); continue; }
    if (existants.has(r.titre.toLowerCase())) { deja++; continue; }
    existants.add(r.titre.toLowerCase());
    aImporter.push(r);
  }

  const nouveaux = new Map<string, string>();
  for (const r of aImporter) for (const i of r.ingredients) if (!idParNom.has(norm(i.nom)) && !nouveaux.has(norm(i.nom))) nouveaux.set(norm(i.nom), i.nom);
  console.log(`${aImporter.length} à importer, ${deja} déjà présentes, ${illisibles} illisibles, ${nouveaux.size} ingrédients à créer`);
  if (!APPLIQUER) { console.log('Aperçu — relancez avec --appliquer.'); return; }

  const liste = [...nouveaux.values()].map(nom => ({ nom, rayon: rayonDe(nom) }));
  for (let i = 0; i < liste.length; i += 200) {
    const { data, error } = await s.from('ingredients').upsert(liste.slice(i, i + 200), { onConflict: 'nom', ignoreDuplicates: true }).select('id, nom');
    if (error) throw error;
    for (const d of data ?? []) idParNom.set(norm(d.nom), d.id);
  }
  // Doublons de casse/forme ignorés par l'upsert : on relit
  for (const i of await toutCharger<{ id: number; nom: string }>('ingredients', 'id, nom')) idParNom.set(norm(i.nom), i.id);

  let ok = 0, erreurs = 0;
  for (const r of aImporter) {
    const noms = r.ingredients.map(i => i.nom);
    const { data: meal, error: e1 } = await s.from('meals').insert({
      titre: r.titre, type_repas: r.type, cuisine: r.cuisine, difficulte: 'facile',
      temps_preparation: r.prep, temps_cuisson: r.cuisson || null, portions_par_defaut: r.portions,
      conservation_jours: 3, ustensiles: [], instructions: r.etapes, saison: deduireSaison(r.titre, noms),
      calories_par_portion: Math.round(r.kcal), proteines: r.p, glucides: r.g, lipides: r.l, macros_verifiables: false,
      description: genererDescription({ titre: r.titre, type_repas: r.type, cuisine: r.cuisine, temps: r.prep + r.cuisson, kcal: r.kcal, ingredients: noms }),
      is_public: true,
    }).select('id').single();
    if (e1 || !meal) { console.error(`✗ ${r.titre} : ${e1?.message}`); erreurs++; continue; }
    // Un même ingrédient deux fois dans une recette violerait la clé primaire : on fusionne
    const lignes = new Map<number, { meal_id: number; ingredient_id: number; quantite: number; unite: string; est_optionnel: boolean }>();
    for (const i of r.ingredients) {
      const id = idParNom.get(norm(i.nom))!;
      if (!lignes.has(id)) lignes.set(id, { meal_id: meal.id, ingredient_id: id, quantite: i.quantite, unite: i.unite, est_optionnel: i.optionnel });
    }
    const { error: e2 } = await s.from('meal_ingredients').insert([...lignes.values()]);
    if (e2) { console.error(`✗ ${r.titre} ingrédients : ${e2.message}`); await s.from('meals').delete().eq('id', meal.id); erreurs++; continue; }
    ok++;
  }
  console.log(`${ok} recettes ajoutées, ${erreurs} en erreur`);
})();
