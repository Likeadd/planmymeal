// ============================================================================
// Correction des dosages du catalogue public (quantités par portion).
//
//   npx tsx scripts/corriger-dosages.ts              (aperçu, n'écrit rien)
//   npx tsx scripts/corriger-dosages.ts --appliquer  (sauvegarde puis corrige)
//   puis : npx tsx scripts/recalculer-macros.ts --write
//
// Règles, dans l'ordre :
//  A. unités sans poids (« 1 boîte », « 1 c. à soupe » d'épice) → grammes ;
//  B. pièces saisies en grammes (« Oignon 1 g », « Courgette 2 g ») → poids réel ;
//  C. nombre de portions incohérent : recette prévue pour plusieurs personnes mais
//     déclarée « 1 portion » (velouté avec 800 g de légumes pour 1) → portions
//     recalculées d'après la masse solide par portion des recettes du même type ;
//  D. desserts trop riches par part (gâteau en 4 parts à 700 kcal) → plus de parts ;
//  E. plafonds culinaires par portion (huile, ail, épices, sauces, protéines,
//     féculents…) : la quantité est ramenée au plafond.
// Les étapes sont mises à jour : « Mise en place » régénérée, et les quantités
// citées dans le texte remplacées quand elles désignent l'ingrédient corrigé.
// Sauvegarde intégrale avant écriture : backups/<date>/dosages-avant.json
// ============================================================================

import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });
import { createClient } from '@supabase/supabase-js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { grammes, poidsUnitesDe, type PoidsUnites } from '../src/lib/unites';
import { enrichirEtapes } from './data/detail-etapes';
import type { RecetteSaisie } from './data/recettes-proteinees';

const APPLIQUER = process.argv.includes('--appliquer');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

interface Ligne { ingredient_id: number; quantite: number; unite: string; est_optionnel: boolean | null }
interface Meal {
  id: number; titre: string; type_repas: string; portions_par_defaut: number; calories_par_portion: number | null;
  temps_preparation: number; temps_cuisson: number | null; conservation_jours: number | null;
  ustensiles: string[] | null; instructions: string[] | null; meal_ingredients: Ligne[];
}
interface Ing { id: number; nom: string; poids_unites: PoidsUnites | null }

// ─── Référentiels ────────────────────────────────────────────────────────────

/** Contenu d'une boîte standard (g) */
const BOITE: Record<string, number> = {
  'Tomate concassée (bte)': 400, 'Haricots rouges (bte)': 400, 'Pois chiches (bte)': 400, 'Haricots blancs (bte)': 400,
  'Haricots noirs (bte)': 400, 'Maïs (bte)': 285, 'Maïs doux (bte)': 285, 'Thon au naturel': 140, 'Sardines (bte)': 115, 'Lait de coco': 400,
};

/** Poids d'une pièce (g) pour les légumes saisis « en pièces » avec l'unité g */
const PIECE: Record<string, number> = {
  Concombre: 300, Oignon: 100, 'Oignon rouge': 100, 'Poivron rouge': 150, 'Poivron jaune': 150, 'Poivron vert': 150,
  Fenouil: 250, Tomate: 120, Carotte: 100, Courgette: 200, Aubergine: 250, Échalote: 30, 'Filet de dorade': 120,
  Endive: 120, Poireau: 150, Framboise: 5,
};

const SOUPE = /velouté|potage|soupe|bouillon|pho |ramen|gaspacho|minestrone|harira|chorba|bisque/i;
const LIQUIDES = /^(Bouillon|Lait|Eau|Vin |Lait de coco|Crème liquide|Jus )/;

const EPICES = new Set(['Cumin', 'Paprika', 'Paprika fumé', 'Paprika doux fumé', 'Curcuma', 'Curry en poudre', 'Curry Madras', 'Garam masala',
  'Ras-el-hanout', 'Cannelle', 'Cardamome', 'Herbes de Provence', 'Origan', 'Thym', 'Berbere', 'Piment doux', 'Gingembre en poudre',
  'Menthe séchée', 'Anis étoilé (badiane)']);

/** Plafonds par portion (g ou ml). Fonction : null = pas de plafond. */
function plafond(nom: string, type: string, titre: string): number | null {
  const plat = type === 'plat' || type === 'entree';
  if (/^Huile d’olive$|^Huile de tournesol$/.test(nom)) return plat ? 15 : 25;
  if (nom === 'Huile de sésame') return 8;
  if (nom === 'Huile de friture') return null;
  if (nom === 'Ail') return 10;
  if (EPICES.has(nom)) return 4;
  if (nom === 'Sumac' || nom === 'Zaatar') return 6;
  if (nom === 'Safran') return 0.2;
  if (nom === 'Sauce soja') return 20;
  if (nom === 'Sauce nuoc mam') return 12;
  if (nom === 'Harissa' || nom === 'Sauce sriracha' || nom === 'Tabasco') return 10;
  if (nom === 'Gochujang' || nom === 'Miso' || nom === 'Pâte de curry vert') return 20;
  if (/^Vinaigre/.test(nom) || nom === 'Mirin') return 15;
  if (/^Moutarde/.test(nom)) return 15;
  if (nom === 'Concentré de tomate') return 15;
  if (nom === 'Pesto' || nom === 'Tahini' || nom === 'Sauce hoisin' || nom === 'Sauce barbecue' || nom === 'Ketchup' || nom === 'Mayonnaise') return 35;
  if (plat && (nom === 'Miel' || nom === 'Sirop d\'érable')) return 15;
  if (plat && nom === 'Sucre') return 10;
  if (plat && nom === 'Farine' && !/pizza|pâte|gnocchi|crêpe|galette|beignet|cake|quiche|tarte|fish|pané|tempura|pancake|blini|naan|chapati|wrap|fajitas|tortilla|pita|pain|bao|empanada|samoussa|raviol|dumpling|gyoza|nems/i.test(titre)) return 30;
  if (/^(Persil|Coriandre fraîche|Menthe fraîche|Basilic|Basilic thaï|Aneth|Aneth frais|Ciboulette)$/.test(nom)) return 15;
  if (nom === 'Gingembre' || nom === 'Citronnelle') return 20;
  if (nom === 'Citron' || nom === 'Citron vert') return 100;
  if (/^(Cacahuètes|Amandes|Noix|Noisettes|Noix de cajou|Pistaches non salées|Graines de sésame|Pignons de pin|Graines de courge)$/.test(nom)) return 35;
  if (nom === 'Parmesan' || nom === 'Parmesan 24 mois') return 30;
  if (/^(Feta|Chèvre frais|Mozzarella|Halloumi|Emmental|Comté|Gruyère râpé|Fromage râpé|Cheddar|Reblochon|Brie|Camembert)$/.test(nom)) return 120;
  if (/^Bouillon/.test(nom)) return 500;
  if (/^(Lait de coco|Lait de coco léger)$/.test(nom)) return 200;
  if (/^Crème/.test(nom)) return 100;
  if (/^(Yaourt|Fromage blanc|Skyr|Labneh)/.test(nom)) return 200;
  if (nom === 'Œuf') return plat ? 180 : 120;
  if (nom === 'Saumon fumé') return 120;
  if (nom === 'Moules') return 600;
  if (/^Cuisses de poulet|^Pilons de poulet|Poulet entier/.test(nom)) return 350;
  if (/^(Filet|Pavé|Dos|Escalope|Steak|Bœuf|Faux-filet|Rumsteck|Veau|Épaule|Échine|Côte|Rôti|Magret|Crevettes|Gambas|Calamars|Colin|Merlan|Truite|Sole|Bar \(|Maquereau|Sardines fraîches|Noix de Saint-Jacques|Saumon frais|Thon au naturel|Tofu|Tempeh|Seitan|Haché|Viande hachée|Saucisse|Merguez|Agneau)/.test(nom)) return 250;
  if (/cuit$/.test(nom)) return plat ? 250 : null;
  if (/^(Riz|Pâtes|Spaghetti|Tagliatelles|Macaroni|Quinoa|Boulgour|Semoule|Lentilles|Pois cassés|Épeautre|Millet|Sarrasin|Nouilles|Crozets|Flocons d’avoine)/.test(nom)) return 130;
  if (/^Tomate concassée/.test(nom)) return 300;
  return plat ? 400 : null; // légumes et autres ingrédients d'un plat
}

// ─── Chargement ──────────────────────────────────────────────────────────────

async function charger() {
  const { data: ings } = await s.from('ingredients').select('id, nom, poids_unites').range(0, 999);
  const parId = new Map((ings as Ing[]).map(i => [i.id, i]));
  const { data: dernier } = await s.from('meals').select('id').order('id', { ascending: false }).limit(1);
  const max = dernier?.[0]?.id ?? 0;
  const meals: Meal[] = [];
  const fen: number[] = [];
  for (let d = 0; d <= max; d += 400) fen.push(d);
  let k = 0;
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (k < fen.length) {
      const d = fen[k++];
      for (let essai = 0; ; essai++) {
        const r = await s.from('meals')
          .select('id, titre, type_repas, portions_par_defaut, calories_par_portion, temps_preparation, temps_cuisson, conservation_jours, ustensiles, instructions, meal_ingredients(ingredient_id, quantite, unite, est_optionnel)')
          .eq('is_public', true).gte('id', d).lt('id', d + 400);
        if (!r.error) { meals.push(...(r.data as unknown as Meal[])); break; }
        if (essai >= 2) throw new Error(r.error.message);
      }
    }
  }));
  return { meals, parId };
}

const quantile = (xs: number[], q: number) => { const t = [...xs].sort((a, b) => a - b); return t[Math.floor(q * (t.length - 1))]; };
const arrondir = (g: number) => (g >= 100 ? Math.round(g / 10) * 10 : g >= 20 ? Math.round(g / 5) * 5 : g >= 3 ? Math.round(g) : Math.round(g * 10) / 10);

// ─── Corrections ─────────────────────────────────────────────────────────────

(async () => {
  const { meals, parId } = await charger();
  const nom = (id: number) => parId.get(id)?.nom ?? '?';
  const g = (l: Ligne) => grammes(l.quantite, l.unite, poidsUnitesDe(parId.get(l.ingredient_id)?.poids_unites));

  // Médianes par ingrédient (g/portion, plats) pour repérer les pièces saisies en grammes
  const parIng = new Map<string, number[]>();
  for (const m of meals) if (m.type_repas === 'plat') for (const l of m.meal_ingredients) {
    const x = g(l); if (x != null) (parIng.get(nom(l.ingredient_id)) ?? parIng.set(nom(l.ingredient_id), []).get(nom(l.ingredient_id))!).push(x / (m.portions_par_defaut || 2));
  }
  const med = new Map([...parIng].map(([k, v]) => [k, quantile(v, 0.5)]));

  const compteur: Record<string, number> = {};
  const note = (k: string) => { compteur[k] = (compteur[k] ?? 0) + 1; };
  type Modif = { id: number; avant: Meal; lignes: Ligne[]; portions: number; changees: { nom: string; avant: string; apres: string; unite: string; ancienne: number }[]; raisons: Set<string> };
  const modifs: Modif[] = [];

  for (const m of meals) {
    const lignes = m.meal_ingredients.map(l => ({ ...l }));
    const changees: Modif['changees'] = [];
    const raisons = new Set<string>();
    let portions = m.portions_par_defaut || 2;
    const fixer = (l: Ligne, q: number, unite: string, raison: string) => {
      const avant = `${l.quantite} ${l.unite}`;
      changees.push({ nom: nom(l.ingredient_id), avant, apres: `${q} ${unite}`, unite: l.unite, ancienne: l.quantite });
      l.quantite = q; l.unite = unite; raisons.add(raison); note(raison);
    };

    // A. unités sans poids
    for (const l of lignes) {
      if (g(l) != null) continue;
      const n = nom(l.ingredient_id);
      if (l.unite === 'boite' && BOITE[n]) fixer(l, l.quantite * BOITE[n], 'g', 'A boîte → g');
      else if (l.unite === 'cac') fixer(l, l.quantite * 2, 'g', 'A c. à café → g');
      else if (l.unite === 'cas') fixer(l, l.quantite * 6, 'g', 'A c. à soupe → g');
    }

    // B. pièces saisies en grammes
    for (const l of lignes) {
      const n = nom(l.ingredient_id);
      const x = g(l);
      if (l.unite !== 'g' || x == null || l.quantite > 8 || !PIECE[n]) continue;
      const mediane = med.get(n) ?? 0;
      if (mediane >= 15 && x / portions < mediane / 12) fixer(l, l.quantite * PIECE[n], 'g', 'B pièces saisies en g');
    }

    modifs.push({ id: m.id, avant: m, lignes, portions, changees, raisons });
  }

  // C. portions : masse solide par portion vs médiane du type
  const solide = (mo: Modif) => mo.lignes.reduce((acc, l) => {
    const x = g(l); return acc + (x == null || LIQUIDES.test(nom(l.ingredient_id)) ? 0 : x);
  }, 0);
  const medType = new Map<string, number>();
  for (const type of new Set(modifs.map(mo => mo.avant.type_repas))) {
    medType.set(type, quantile(modifs.filter(mo => mo.avant.type_repas === type).map(mo => solide(mo) / mo.portions), 0.5));
  }
  for (const mo of modifs) {
    const ref = medType.get(mo.avant.type_repas)!;
    const parPortion = solide(mo) / mo.portions;
    // Soupes : on compte un bol de 450 g, liquides compris (le bouillon fait la soupe)
    const soupe = SOUPE.test(mo.avant.titre);
    const total = mo.lignes.reduce((acc, l) => acc + (g(l) ?? 0), 0);
    if (mo.portions <= 2 && (soupe ? total / mo.portions > 1.9 * 450 : parPortion > 1.9 * ref)) {
      const cible = soupe ? total / 450 : solide(mo) / ref;
      const nouvelles = [1, 2, 4, 6, 8].reduce((a, b) => (Math.abs(b - cible) < Math.abs(a - cible) ? b : a));
      if (nouvelles > mo.portions) { mo.portions = nouvelles; mo.raisons.add('C portions'); note('C portions'); }
    }
    // D. desserts trop riches par part
    const kcal = mo.avant.calories_par_portion ?? 0;
    if (mo.avant.type_repas === 'dessert' && kcal > 650 && mo.portions >= 2) {
      mo.portions = Math.min(12, Math.ceil((mo.portions * kcal / 380) / 2) * 2);
      mo.raisons.add('D parts de dessert'); note('D parts de dessert');
    }
  }

  // C bis. recette « pour 1-2 » dont PLUSIEURS ingrédients de structure (protéine,
  // féculent, légumes, bouillon…) dépassent le plafond : ce sont les portions qui
  // sont fausses, pas les quantités → on augmente les portions au lieu de couper.
  for (const mo of modifs) {
    if (mo.portions > 2) continue;
    const facteurs = mo.lignes.map(l => {
      const cap = plafond(nom(l.ingredient_id), mo.avant.type_repas, mo.avant.titre);
      const x = g(l);
      return cap != null && cap >= 130 && x != null ? x / mo.portions / cap : 0;
    }).filter(f => f > 1.15);
    if (facteurs.length >= 2) {
      const cible = mo.portions * Math.min(...facteurs);
      const nouvelles = [2, 4, 6, 8].find(p => p >= cible) ?? 8;
      if (nouvelles > mo.portions) { mo.portions = nouvelles; mo.raisons.add('C portions'); note('C portions (structure)'); }
    }
  }

  // E. plafonds par portion
  for (const mo of modifs) {
    for (const l of mo.lignes) {
      const n = nom(l.ingredient_id);
      const x = g(l);
      const cap = plafond(n, mo.avant.type_repas, mo.avant.titre);
      if (x == null || cap == null || x / mo.portions <= cap * 1.0001) continue;
      const cibleG = cap * mo.portions;
      if (l.unite === 'g' || l.unite === 'ml') {
        const q = arrondir(cibleG);
        mo.changees.push({ nom: n, avant: `${l.quantite} ${l.unite}`, apres: `${q} ${l.unite}`, unite: l.unite, ancienne: l.quantite });
        l.quantite = q;
      } else {
        const poids = poidsUnitesDe(parId.get(l.ingredient_id)?.poids_unites)?.[l.unite] ?? 1;
        const q = Math.max(0.5, Math.floor((cibleG / poids) * 2) / 2);
        if (q >= l.quantite) continue;
        mo.changees.push({ nom: n, avant: `${l.quantite} ${l.unite}`, apres: `${q} ${l.unite}`, unite: l.unite, ancienne: l.quantite });
        l.quantite = q;
      }
      mo.raisons.add('E plafond'); note(`E plafond ${n}`);
    }
  }

  const aEcrire = modifs.filter(mo => mo.raisons.size > 0);
  console.log(`${meals.length} recettes analysées — ${aEcrire.length} à corriger`);
  console.log(Object.entries(compteur).sort((a, b) => b[1] - a[1]).map(([k, v]) => `  ${k} : ${v}`).join('\n'));
  if (process.argv.includes('--detail')) {
    const filtre = process.argv[process.argv.indexOf('--detail') + 1];
    for (const mo of aEcrire.filter(mo => [...mo.raisons].some(r => r.startsWith(filtre)) || mo.changees.some(c => c.nom === filtre)).slice(0, 40)) {
      console.log(`#${mo.id} ${mo.avant.titre} [${mo.avant.type_repas}] p ${mo.avant.portions_par_defaut}→${mo.portions} solide ${Math.round(solide(mo))} g | ${mo.changees.map(c => `${c.nom} ${c.avant}→${c.apres}`).join(' ; ')}`);
    }
    return;
  }
  for (const mo of aEcrire.filter((_, i) => i % Math.max(1, Math.floor(aEcrire.length / 12)) === 0).slice(0, 12)) {
    console.log(`\n■ #${mo.id} ${mo.avant.titre} (${[...mo.raisons].join(', ')})`);
    if (mo.portions !== mo.avant.portions_par_defaut) console.log(`   portions ${mo.avant.portions_par_defaut} → ${mo.portions}`);
    for (const c of mo.changees) console.log(`   ${c.nom} : ${c.avant} → ${c.apres}`);
  }

  // ─── Étapes : mise en place régénérée + quantités citées ───
  let citeesRemplacees = 0;
  const nouvellesEtapes = (mo: Modif): string[] | null => {
    const etapes = [...(mo.avant.instructions ?? [])];
    if (etapes.length === 0) return null;
    for (const c of mo.changees) {
      if (c.unite !== 'g' && c.unite !== 'ml') continue;
      const ancien = String(c.ancienne).replace('.', ',');
      const motCle = c.nom.toLowerCase().split(/[ (’']/)[0].slice(0, 5);
      const re = new RegExp(`(^|[^\\d,])${ancien.replace(/[.,]/g, '[.,]')} ?${c.unite}\\b(?=[^.;]{0,40}${motCle})`, 'i');
      const nouveau = c.apres.split(' ')[0].replace('.', ',');
      for (let i = 1; i < etapes.length; i++) {
        if (re.test(etapes[i])) { etapes[i] = etapes[i].replace(re, `$1${nouveau} ${c.unite}`); citeesRemplacees++; }
      }
    }
    if (etapes[0]?.startsWith('Mise en place')) {
      const r: RecetteSaisie = {
        titre: mo.avant.titre, type: mo.avant.type_repas as RecetteSaisie['type'], cuisine: '', prep: mo.avant.temps_preparation,
        cuisson: mo.avant.temps_cuisson ?? 0, difficulte: 'facile', portions: mo.portions, conservation: 0,
        ustensiles: mo.avant.ustensiles ?? [], etapes: [],
        ingredients: mo.lignes.map(l => [nom(l.ingredient_id), l.quantite, l.unite, l.est_optionnel === true]),
      };
      etapes[0] = enrichirEtapes(r)[0];
    }
    return etapes;
  };
  const instructions = new Map(aEcrire.map(mo => [mo.id, nouvellesEtapes(mo)]));
  console.log(`\nQuantités citées dans les étapes et remplacées : ${citeesRemplacees}`);

  if (!APPLIQUER) { console.log('\nAperçu — relancez avec --appliquer pour corriger.'); return; }

  const dossier = `backups/${new Date().toISOString().slice(0, 10)}`;
  mkdirSync(dossier, { recursive: true });
  writeFileSync(`${dossier}/dosages-avant.json`, JSON.stringify(aEcrire.map(mo => ({
    id: mo.id, portions: mo.avant.portions_par_defaut, instructions: mo.avant.instructions, lignes: mo.avant.meal_ingredients,
  }))));
  console.log(`Sauvegarde : ${dossier}/dosages-avant.json`);

  let ok = 0, ko = 0;
  for (let i = 0; i < aEcrire.length; i += 8) {
    await Promise.all(aEcrire.slice(i, i + 8).map(async mo => {
      try {
        for (const l of mo.lignes) {
          const orig = mo.avant.meal_ingredients.find(o => o.ingredient_id === l.ingredient_id)!;
          if (orig.quantite === l.quantite && orig.unite === l.unite) continue;
          const { error } = await s.from('meal_ingredients').update({ quantite: l.quantite, unite: l.unite })
            .eq('meal_id', mo.id).eq('ingredient_id', l.ingredient_id);
          if (error) throw error;
        }
        const maj: Record<string, unknown> = {};
        if (mo.portions !== mo.avant.portions_par_defaut) maj.portions_par_defaut = mo.portions;
        const etapes = instructions.get(mo.id);
        if (etapes) maj.instructions = etapes;
        if (Object.keys(maj).length) {
          const { error } = await s.from('meals').update(maj).eq('id', mo.id);
          if (error) throw error;
        }
        ok++;
      } catch (e) {
        ko++; console.error(`#${mo.id} : ${e instanceof Error ? e.message : JSON.stringify(e)}`);
      }
    }));
    process.stdout.write(`\r${ok + ko} / ${aEcrire.length}`);
  }
  console.log(`\n${ok} recettes corrigées, ${ko} en erreur. Lancez maintenant : npx tsx scripts/recalculer-macros.ts --write`);
})();
