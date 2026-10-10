// ============================================================================
// Ajoute les recettes originales de scripts/data/generateur-recettes.ts
//
//   npx tsx scripts/ajouter-recettes-generees.ts               (aperçu + stats)
//   npx tsx scripts/ajouter-recettes-generees.ts --appliquer   (insère)
//   … --classiques : plats classiques 100 % produits bruts (classiques-bruts.ts)
//   … --francaises : recettes françaises rédigées à la main (recettes-francaises.ts)
//   … --rapides : recettes simples et rapides, 25 min max (recettes-rapides.ts)
//   … --sportives : liste de classiques français + 500 repas sportifs à la française
//   … --complementaires : plats simples et rapides, gratins, mijotés, desserts… pour atteindre 10 000 recettes
//   … --equilibrees : petits-déjeuners, collations sportives et plats courants absents
//
// 1. Macros CALCULÉES depuis la composition (lib/macros).
// 2. Filtres : plat ≥ 20 g de protéines (≥ 16 g végétarien), 300–850 kcal ;
//    dessert ≥ 10 g de protéines, ≤ 480 kcal.
// 3. Doublons retirés : titre déjà présent, ou composition trop proche
//    (Jaccard ≥ 0,8 sur les ingrédients) d'une recette existante ou déjà
//    retenue dans ce lot.
// ============================================================================

import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });
import { createClient } from '@supabase/supabase-js';
import { calculerMacros } from '../src/lib/macros';
import type { PoidsUnites } from '../src/lib/unites';
import { deduireSaison, genererDescription } from '../src/lib/nettoyage-recettes';
import { genererRecettes, estVege } from './data/generateur-recettes';
import { genererClassiques, estVegeClassique } from './data/classiques-bruts';
import { RECETTES_FRANCAISES } from './data/recettes-francaises';
import { RECETTES_RAPIDES } from './data/recettes-rapides';
import { enrichirEtapes } from './data/detail-etapes';
import { RECETTES_FRANCAISES_LISTE } from './data/recettes-francaises-liste';
import { genererSportives } from './data/recettes-sportives';
import { RECETTES_EQUILIBREES } from './data/recettes-equilibrees';
import { genererEquilibrees } from './data/recettes-equilibrees-familles';
import { genererComplementaires } from './data/complementaires';
import { RECETTES_CLASSIQUES_ACCESSIBLES } from './data/recettes-classiques-accessibles';
import { FAMILLES_FRANCAISES, FAMILLES_FRANCAISES_2 } from './data/recettes-francaises-familles';

const APPLIQUER = process.argv.includes('--appliquer');
const FRANCAISES = process.argv.includes('--francaises');
const RAPIDES = process.argv.includes('--rapides');
const SPORTIVES = process.argv.includes('--sportives');
const EQUILIBREES = process.argv.includes('--equilibrees');
const COMPLEMENTAIRES = process.argv.includes('--complementaires');
/** Remplace les étapes des recettes DÉJÀ insérées (même titre) par les étapes actuelles du lot, détaillées */
const MAJ_ETAPES = process.argv.includes('--maj-etapes');
const CLASSIQUES = FRANCAISES || RAPIDES || SPORTIVES || EQUILIBREES || COMPLEMENTAIRES || process.argv.includes('--classiques');
/** Classiques : une protéine différente suffit à distinguer deux plats. */
const SEUIL_JACCARD = CLASSIQUES ? 0.85 : 0.8;
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

interface Ing {
  id: number; nom: string; poids_unites: PoidsUnites | null;
  calories_pour_100g: number | null; proteines_pour_100g: number | null; glucides_pour_100g: number | null; lipides_pour_100g: number | null;
}

/** Ingrédients « de fond » ignorés dans la comparaison (huile, ail, citron…) */
const NEUTRES = new Set(['Huile d’olive', 'Huile de tournesol', 'Ail', 'Citron', 'Citron vert', 'Oignon', 'Miel', 'Persil', 'Coriandre fraîche']);
const jaccard = (a: Set<number>, b: Set<number>) => {
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
};

(async () => {
  const { data: ings, error } = await s.from('ingredients')
    .select('id, nom, poids_unites, calories_pour_100g, proteines_pour_100g, glucides_pour_100g, lipides_pour_100g');
  if (error) throw error;
  const parNom = new Map((ings as Ing[]).map(i => [i.nom.toLowerCase(), i]));
  const neutresIds = new Set([...NEUTRES].map(n => parNom.get(n.toLowerCase())?.id).filter((x): x is number => x != null));
  const signature = (ids: number[]) => new Set(ids.filter(id => !neutresIds.has(id)));

  // Catalogue existant (titres + compositions) pour éviter les doublons
  const existants: { titre: string; type: string; sig: Set<number> }[] = [];
  for (let i = 0; ; i += 1000) {
    const { data } = await s.from('meals').select('titre, type_repas, meal_ingredients(ingredient_id)').range(i, i + 999);
    if (!data?.length) break;
    for (const m of data) existants.push({ titre: m.titre.toLowerCase(), type: m.type_repas, sig: signature((m.meal_ingredients ?? []).map(x => x.ingredient_id)) });
  }
  const titres = new Set(existants.map(e => e.titre));

  const recettes = COMPLEMENTAIRES ? genererComplementaires() : EQUILIBREES ? [...RECETTES_EQUILIBREES, ...genererEquilibrees()] : SPORTIVES ? [...RECETTES_FRANCAISES_LISTE, ...genererSportives(Number(process.env.NB_SPORTIVES ?? 760))] : RAPIDES ? [...RECETTES_RAPIDES, ...RECETTES_CLASSIQUES_ACCESSIBLES] : FRANCAISES ? [...RECETTES_FRANCAISES, ...FAMILLES_FRANCAISES, ...FAMILLES_FRANCAISES_2] : CLASSIQUES ? genererClassiques() : genererRecettes();
  if (MAJ_ETAPES) {
    // Même fusion des ingrédients répétés que pour l'insertion : la mise en place doit refléter la base
    const fusionner = (r: (typeof recettes)[number]) => {
      const f = new Map<string, (typeof r.ingredients)[number]>();
      for (const l of r.ingredients) {
        const k = l[0].toLowerCase(), deja = f.get(k);
        if (deja && deja[2] === l[2]) deja[1] += l[1]; else if (!deja) f.set(k, [...l] as typeof l);
      }
      return { ...r, ingredients: [...f.values()] };
    };
    const cibles = recettes.filter(r => titres.has(r.titre.toLowerCase()));
    let ok = 0, ko = 0;
    for (let i = 0; i < cibles.length; i += 10) {
      const res = await Promise.all(cibles.slice(i, i + 10).map(r => s.from('meals').update({ instructions: enrichirEtapes(fusionner(r)) }).eq('titre', r.titre).eq('is_public', true)));
      for (const x of res) x.error ? ko++ : ok++;
    }
    console.log(`${ok} recettes mises à jour (${ko} en erreur) sur ${recettes.length} du lot.`);
    return;
  }
  const retenues: { r: (typeof recettes)[number]; m: { cal: number; p: number; g: number; l: number }; sig: Set<number> }[] = [];
  const rejets: Record<string, number> = {};
  const rejet = (k: string) => { rejets[k] = (rejets[k] ?? 0) + 1; };
  const inconnus = new Set<string>();

  for (const r of recettes) {
    // Un même ingrédient listé deux fois (base + variante) est fusionné.
    const fusion = new Map<string, (typeof r.ingredients)[number]>();
    for (const l of r.ingredients) {
      const k = l[0].toLowerCase(), deja = fusion.get(k);
      if (deja && deja[2] === l[2]) deja[1] += l[1]; else if (!deja) fusion.set(k, [...l] as typeof l);
    }
    r.ingredients = [...fusion.values()];
    const manquants = r.ingredients.filter(([nom]) => !parNom.has(nom.toLowerCase())).map(([nom]) => nom);
    if (manquants.length) { manquants.forEach(n => inconnus.add(n)); rejet('ingrédient inconnu'); continue; }
    if (titres.has(r.titre.toLowerCase())) { rejet('titre existant'); continue; }

    const res = calculerMacros(r.ingredients.map(([nom, quantite, unite]) => {
      const i = parNom.get(nom.toLowerCase())!;
      return { quantite, unite, poidsUnites: i.poids_unites, coefficients: i.calories_pour_100g == null ? null : {
        cal: i.calories_pour_100g, proteines: i.proteines_pour_100g ?? 0, glucides: i.glucides_pour_100g ?? 0, lipides: i.lipides_pour_100g ?? 0 } };
    }), r.portions);
    if (!res.ok) { rejet(`macros : ${res.raison} (${res.detail})`); if (CLASSIQUES) console.log(`  ✗ ${r.titre} — ${res.detail}`); continue; }
    const m = res.macros;
    if (CLASSIQUES) {
      // Classiques : plats rassasiants (≥ 15 g de protéines, 10 g sans viande
      // ni poisson), entrées légères, desserts raisonnables.
      if (r.type === 'dessert' && m.cal > 600) { rejet('dessert trop calorique'); continue; }
      if (r.type === 'entree' && m.cal > 500) { rejet('entrée trop calorique'); continue; }
      if (r.type === 'plat') {
        if (m.p < (estVegeClassique(r) ? 10 : 15)) { rejet('pas assez de protéines'); continue; }
        if (m.cal < 250 || m.cal > 950) { rejet('calories hors cible'); continue; }
      }
    } else if (r.type === 'dessert') {
      if (m.p < 10 || m.cal > 480) { rejet('dessert hors cible'); continue; }
    } else {
      const minP = estVege(r) ? 16 : 20;
      if (m.p < minP) { rejet('pas assez de protéines'); continue; }
      if (m.cal < 300 || m.cal > 850) { rejet('calories hors cible'); continue; }
    }

    const sig = signature(r.ingredients.map(([nom]) => parNom.get(nom.toLowerCase())!.id));
    if (existants.some(e => e.type === r.type && jaccard(e.sig, sig) >= SEUIL_JACCARD)) { rejet('doublon du catalogue'); continue; }
    if (retenues.some(x => x.r.type === r.type && jaccard(x.sig, sig) >= SEUIL_JACCARD)) { rejet('doublon du lot'); continue; }
    retenues.push({ r, m, sig });
  }

  const parType = retenues.reduce<Record<string, number>>((a, x) => ({ ...a, [x.r.type]: (a[x.r.type] ?? 0) + 1 }), {});
  const moyP = retenues.filter(x => x.r.type === 'plat').reduce((a, x) => a + x.m.p, 0) / (parType.plat || 1);
  console.log(`Générées : ${recettes.length} — retenues : ${retenues.length}`, parType, `— protéines moyennes (plats) : ${moyP.toFixed(1)} g`);
  console.log('Rejets :', rejets);
  if (inconnus.size) console.log('Ingrédients inconnus :', [...inconnus].join(', '));
  if (!APPLIQUER) {
    for (const x of retenues.filter((_, i) => i % 400 === 0)) {
      console.log(`\n■ ${x.r.titre} — ${Math.round(x.m.cal)} kcal, ${x.m.p.toFixed(1)} g prot.`);
      x.r.etapes.forEach((e, i) => console.log(`  ${i + 1}. ${e}`));
    }
    console.log('\nAperçu — relancez avec --appliquer pour insérer.');
    return;
  }

  // Insertion par lots de 100
  let ok = 0;
  for (let i = 0; i < retenues.length; i += 100) {
    const lot = retenues.slice(i, i + 100);
    const { data: meals, error: e1 } = await s.from('meals').insert(lot.map(({ r, m }) => {
      const noms = r.ingredients.map(([nom]) => nom);
      return {
        titre: r.titre, type_repas: r.type, cuisine: r.cuisine, difficulte: r.difficulte,
        temps_preparation: r.prep, temps_cuisson: r.cuisson || null, portions_par_defaut: r.portions,
        conservation_jours: r.conservation, ustensiles: r.ustensiles, instructions: enrichirEtapes(r),
        saison: deduireSaison(r.titre, noms),
        calories_par_portion: Math.round(m.cal), proteines: Math.round(m.p * 10) / 10,
        glucides: Math.round(m.g * 10) / 10, lipides: Math.round(m.l * 10) / 10, macros_verifiables: true,
        description: genererDescription({ titre: r.titre, type_repas: r.type, cuisine: r.cuisine, temps: r.prep + r.cuisson, kcal: m.cal, ingredients: noms }),
        is_public: true,
      };
    })).select('id, titre');
    if (e1 || !meals) { console.error(`Lot ${i} : ${e1?.message}`); continue; }
    const idParTitre = new Map(meals.map(x => [x.titre, x.id]));
    const lignes = lot.flatMap(({ r }) => r.ingredients.map(([nom, quantite, unite, optionnel]) => ({
      meal_id: idParTitre.get(r.titre)!, ingredient_id: parNom.get(nom.toLowerCase())!.id, quantite, unite, est_optionnel: optionnel === true,
    })));
    const { error: e2 } = await s.from('meal_ingredients').insert(lignes);
    if (e2) { console.error(`Ingrédients lot ${i} : ${e2.message}`); await s.from('meals').delete().in('id', meals.map(x => x.id)); continue; }
    ok += meals.length;
    process.stdout.write(`\r${ok} / ${retenues.length}`);
  }
  console.log(`\n${ok} recettes ajoutées.`);
})();
