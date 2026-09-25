// ============================================================================
// recalculer-macros — recalculer les macros des recettes DÉJÀ en base
//
// Pourquoi un script séparé du seed : les 1 138 recettes de la base ne viennent
// pas toutes du même générateur (catalogue, desserts, recettes détaillées, et
// même une créée dans l'application). Un recalcul qui repasserait par les
// définitions d'un seul script laisserait les autres fausses.
//
// Celui-ci ne lit QUE la base — la composition réelle (`meal_ingredients`) et
// les coefficients de l'ingrédient — donc il couvre toute recette, quelle que
// soit son origine, et il est idempotent.
//
// Préalable : `seed-catalogue-1000.ts --ingredients --write`, sans quoi les
// coefficients et les poids unitaires sont absents et le recalcul refuse (il
// refuse au lieu d'écrire un total partiel : c'est tout l'intérêt).
//
// Usage :
//   npx tsx scripts/recalculer-macros.ts           (constat, aucune écriture)
//   npx tsx scripts/recalculer-macros.ts --write   (applique)
// ============================================================================

import { config } from 'dotenv';
config({ path: '.env.local' });
config();
import { createClient } from '@supabase/supabase-js';
import { calculerMacros, verifierPlausibilite, type LigneMacros, type RaisonRefus } from '../src/lib/macros';
import { uniteEstMasse, type PoidsUnites } from '../src/lib/unites';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url || !serviceKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis dans .env.local');
  process.exit(1);
}
const ECRIRE = process.argv.includes('--write');

/** Plafond d'une réponse PostgREST — au-delà, il faut paginer. */
const PAGE = 1000;

interface LigneIngredientBase {
  meal_id: number;
  quantite: number;
  unite: string;
  ingredients: {
    nom: string;
    poids_unites: PoidsUnites | null;
    calories_pour_100g: number | null;
    proteines_pour_100g: number | null;
    glucides_pour_100g: number | null;
    lipides_pour_100g: number | null;
  } | null;
}

const f = (n: number) => n.toLocaleString('fr-FR');
const signe = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1).replace('.', ',')} %`;

async function main() {
  const supabase = createClient(url, serviceKey);

  const SELECT =
    'meal_id, quantite, unite, ingredients(nom, poids_unites, calories_pour_100g, proteines_pour_100g, glucides_pour_100g, lipides_pour_100g)';

  // ⚠️ Ordre TOTAL obligatoire : plusieurs lignes partagent un `meal_id`, donc
  // trier sur lui seul ne définit pas d'ordre stable — deux pages peuvent alors
  // se chevaucher ou sauter une ligne. La clé primaire `(meal_id, ingredient_id)`
  // est le seul ordre total disponible.
  const lignes: LigneIngredientBase[] = [];
  for (let page = 0; ; page++) {
    const { data, error } = await supabase
      .from('meal_ingredients').select(SELECT)
      .order('meal_id').order('ingredient_id')
      .range(page * PAGE, page * PAGE + PAGE - 1);
    if (error) throw new Error(`chargement des compositions : ${error.message}`);
    const lot = (data ?? []) as unknown as LigneIngredientBase[];
    lignes.push(...lot);
    if (lot.length < PAGE) break;
  }

  // Recettes (paginées aussi : 1 138 lignes, au-dessus du plafond)
  const meals: {
    id: number; titre: string; portions_par_defaut: number | null;
    calories_par_portion: number | null; proteines: number | null;
    glucides: number | null; lipides: number | null;
  }[] = [];
  for (let page = 0; ; page++) {
    const { data, error } = await supabase
      .from('meals')
      .select('id, titre, portions_par_defaut, calories_par_portion, proteines, glucides, lipides')
      .order('id')
      .range(page * PAGE, page * PAGE + PAGE - 1);
    if (error) throw new Error(`chargement des recettes : ${error.message}`);
    const lot = data ?? [];
    meals.push(...lot);
    if (lot.length < PAGE) break;
  }

  // ── Couverture : quelle paire (ingrédient, unité) reste non convertible ? ──
  const sansPoids = new Map<string, number>();
  for (const l of lignes) {
    if (uniteEstMasse(l.unite)) continue;
    const poids = l.ingredients?.poids_unites?.[l.unite];
    if (!poids || poids <= 0) {
      const cle = `${l.ingredients?.nom ?? 'Embed rompu'} (${l.unite})`;
      sansPoids.set(cle, (sansPoids.get(cle) ?? 0) + 1);
    }
  }

  // ── Recalcul ──
  const parMeal = new Map<number, LigneIngredientBase[]>();
  for (const l of lignes) {
    const arr = parMeal.get(l.meal_id);
    if (arr) arr.push(l);
    else parMeal.set(l.meal_id, [l]);
  }

  const refus = new Map<RaisonRefus, number>();
  const exemplesRefus: string[] = [];
  /** Totaux calculables mais incroyables : on garde l'ancienne valeur et on les signale. */
  const implausibles: string[] = [];
  /** Recettes dont les macros ont été calculées ET jugées croyables (drapeau `macros_verifiables`) */
  const verifiees: number[] = [];
  /** Identifiants des recettes implausibles : leur drapeau doit être remis à false */
  const implausiblesIds: number[] = [];
  const aEcrire: { id: number; cal: number; p: number; g: number; l: number }[] = [];
  let inchangees = 0;
  const variations: number[] = [];
  // Suivi des plus fortes variations en VALEUR absolue (pas en % : une recette
  // à 40 kcal qui passe à 120 varie de +200 % sans que ce soit le sujet).
  let exempleHausse = { titre: '', avant: 0, apres: 0, delta: 0 };
  let exempleBaisse = { titre: '', avant: 0, apres: 0, delta: 0 };

  for (const meal of meals) {
    const lignesMeal = parMeal.get(meal.id) ?? [];
    const lignesMacros: LigneMacros[] = lignesMeal.map(l => {
      const i = l.ingredients;
      const coefficients = i
        && i.calories_pour_100g != null && i.proteines_pour_100g != null
        && i.glucides_pour_100g != null && i.lipides_pour_100g != null
        ? {
            cal: i.calories_pour_100g, proteines: i.proteines_pour_100g,
            glucides: i.glucides_pour_100g, lipides: i.lipides_pour_100g,
          }
        : null;
      return { quantite: l.quantite, unite: l.unite, poidsUnites: i?.poids_unites ?? null, coefficients };
    });

    const r = calculerMacros(lignesMacros, meal.portions_par_defaut ?? 0);
    if (!r.ok) {
      refus.set(r.raison, (refus.get(r.raison) ?? 0) + 1);
      if (exemplesRefus.length < 8) exemplesRefus.push(`#${meal.id} ${meal.titre} — ${r.detail}`);
      continue;
    }

    // Calculable n'est pas croyable : « Fish & chips maison » déclare 500 ml
    // d'huile de friture, que l'on achète sans la manger. Écrire le total
    // donnerait 2 825 kcal/portion — un plat lourd, donc écarté des jours
    // légers, mais pour une raison fausse. On refuse et on liste.
    const plausible = verifierPlausibilite(r.macros);
    if (!plausible.ok) {
      implausibles.push(`#${meal.id} ${meal.titre} — ${plausible.detail} (valeur conservée : ${meal.calories_par_portion ?? 'aucune'})`);
      implausiblesIds.push(meal.id);
      continue;
    }
    verifiees.push(meal.id);

    const avant = meal.calories_par_portion ?? 0;
    const apres = r.macros.cal;
    if (avant === apres
      && (meal.proteines ?? 0) === r.macros.p
      && (meal.glucides ?? 0) === r.macros.g
      && (meal.lipides ?? 0) === r.macros.l) {
      inchangees++;
      continue;
    }

    const delta = apres - avant;
    if (avant > 0) variations.push(delta / avant * 100);
    if (delta > exempleHausse.delta) exempleHausse = { titre: meal.titre, avant, apres, delta };
    if (delta < exempleBaisse.delta) exempleBaisse = { titre: meal.titre, avant, apres, delta };

    aEcrire.push({ id: meal.id, cal: apres, p: r.macros.p, g: r.macros.g, l: r.macros.l });
  }

  // ── Rapport ──
  console.log('\n═══ Recalcul des macros ═══\n');
  console.log(`  Recettes en base ............. ${f(meals.length)}`);
  console.log(`  Lignes d'ingrédients lues .... ${f(lignes.length)}`);
  console.log(`  Recettes recalculables ....... ${f(aEcrire.length + inchangees)}`);
  console.log(`  Déjà justes .................. ${f(inchangees)}`);
  console.log(`  À corriger ................... ${f(aEcrire.length)}`);

  if (sansPoids.size > 0) {
    console.log(`\n  ⚠️  paires (ingrédient, unité) sans poids déclaré : ${sansPoids.size}`);
    for (const [cle, n] of [...sansPoids].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
      console.log(`     • ${cle} — ${f(n)} lien(s)`);
    }
  } else {
    console.log('\n  ✅ toutes les unités non massiques ont un poids déclaré');
  }

  if (refus.size > 0) {
    console.log('\n  Recettes NON recalculées (refus explicites) :');
    for (const [raison, n] of [...refus].sort((a, b) => b[1] - a[1])) {
      console.log(`     • ${raison} : ${f(n)}`);
    }
    for (const e of exemplesRefus) console.log(`       ${e}`);
  }

  if (implausibles.length > 0) {
    console.log(`\n  ⚠️  Recettes NON recalculées (totaux implausibles) : ${implausibles.length}`);
    for (const e of implausibles.slice(0, 10)) console.log(`     • ${e}`);
    if (implausibles.length > 10) console.log(`     … et ${implausibles.length - 10} autres.`);
  }

  if (variations.length > 0) {
    const tri = [...variations].sort((a, b) => a - b);
    const med = tri[Math.floor(tri.length / 2)];
    const moyenne = tri.reduce((s, v) => s + v, 0) / tri.length;
    console.log(`\n  Variation des calories (${f(variations.length)} recettes) :`);
    console.log(`     médiane ${signe(med)}  ·  moyenne ${signe(moyenne)}  ·  min ${signe(tri[0])}  ·  max ${signe(tri[tri.length - 1])}`);
    console.log(`     plus forte hausse : ${exempleHausse.titre} — ${exempleHausse.avant} → ${exempleHausse.apres} kcal`);
    if (exempleBaisse.titre) {
      console.log(`     plus forte baisse : ${exempleBaisse.titre} — ${exempleBaisse.avant} → ${exempleBaisse.apres} kcal`);
    }
  }

  // Le drapeau de vérifiabilité : c'est lui qui autorise le moteur à se servir
  // des calories pour juger un plat « léger » (voir `scorePourSlot`).
  console.log(`\n  Drapeau macros_verifiables : ${f(verifiees.length)} à true, ${f(implausiblesIds.length)} à false`);

  if (!ECRIRE) {
    console.log('\n(dry-run — rien n’est écrit. Ajoutez `--write` pour appliquer.)\n');
    return;
  }

  let ecrites = 0;
  for (const m of aEcrire) {
    const { error } = await supabase.from('meals').update({
      calories_par_portion: m.cal, proteines: m.p, glucides: m.g, lipides: m.l,
    }).eq('id', m.id);
    if (error) console.log(`⚠️  #${m.id} : ${error.message}`);
    else ecrites++;
    if (ecrites % 200 === 0) console.log(`   … ${ecrites} recettes corrigées`);
  }

  // Marquage par lots : une liste de 1 100 identifiants dans une seule requête
  // dépasserait la longueur d'URL admise par PostgREST.
  let marquees = 0;
  for (let i = 0; i < verifiees.length; i += 200) {
    const lot = verifiees.slice(i, i + 200);
    const { error } = await supabase.from('meals').update({ macros_verifiables: true }).in('id', lot);
    if (error) console.log(`⚠️  marquage du lot ${i / 200 + 1} : ${error.message}`);
    else marquees += lot.length;
  }
  if (implausiblesIds.length > 0) {
    const { error } = await supabase.from('meals').update({ macros_verifiables: false }).in('id', implausiblesIds);
    if (error) console.log(`⚠️  dé-marquage : ${error.message}`);
  }

  console.log(`\n🎉 ${ecrites} recettes corrigées, ${inchangees} déjà justes, `
    + `${[...refus.values()].reduce((s, n) => s + n, 0)} refusées, ${implausibles.length} implausibles, `
    + `${marquees} marquées vérifiées.\n`);
}

main().catch(e => { console.error('Échec :', e instanceof Error ? e.message : e); process.exit(1); });
