// ============================================================================
// Ajoute les plats simples du quotidien français (scripts/data/classiques-francais*.ts),
// marqués `classique` : le moteur les favorise selon le curseur Confort ↔ Découverte.
//
//   npx tsx scripts/ajouter-classiques-francais.ts               (aperçu)
//   npx tsx scripts/ajouter-classiques-francais.ts --appliquer   (insère)
//
// Crée d'abord les ingrédients manquants (quenelles, saucisse de Morteau…) et complète
// les poids de cuillère manquants (cas 15 g, cac 5 g). Les macros sont calculées depuis la
// composition. Une recette déjà présente (même titre) est seulement marquée `classique`.
// ============================================================================

import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });
import { createClient } from '@supabase/supabase-js';
import { calculerMacros } from '../src/lib/macros';
import type { PoidsUnites } from '../src/lib/unites';
import { deduireSaison, genererDescription } from '../src/lib/nettoyage-recettes';
import { CLASSIQUES_FRANCAIS, NOUVEAUX_INGREDIENTS } from './data/classiques-francais';

const APPLIQUER = process.argv.includes('--appliquer');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const POIDS_CUILLERE: Record<string, number> = { cas: 15, cac: 5, pincee: 0.5 };

interface Ing {
  id: number; nom: string; poids_unites: PoidsUnites | null;
  calories_pour_100g: number | null; proteines_pour_100g: number | null; glucides_pour_100g: number | null; lipides_pour_100g: number | null;
}

async function chargerIngredients() {
  const { data, error } = await s.from('ingredients')
    .select('id, nom, poids_unites, calories_pour_100g, proteines_pour_100g, glucides_pour_100g, lipides_pour_100g');
  if (error) throw error;
  return new Map((data as Ing[]).map(i => [i.nom.toLowerCase(), i]));
}

(async () => {
  let parNom = await chargerIngredients();

  // 1. Ingrédients manquants
  const aCreer = NOUVEAUX_INGREDIENTS.filter(i => !parNom.has(i.nom.toLowerCase()));
  if (aCreer.length) {
    console.log(`Ingrédients à créer : ${aCreer.map(i => i.nom).join(', ')}`);
    if (APPLIQUER) {
      const { error } = await s.from('ingredients').insert(aCreer);
      if (error) throw error;
      parNom = await chargerIngredients();
    }
  }

  // 2. Poids de cuillère manquants (sinon macros et prix incalculables)
  const complements = new Map<string, PoidsUnites>();
  for (const r of CLASSIQUES_FRANCAIS) {
    for (const [nom, , unite] of r.ingredients) {
      const i = parNom.get(nom.toLowerCase());
      if (!i || !(unite in POIDS_CUILLERE) || i.poids_unites?.[unite]) continue;
      const poids = { ...(complements.get(i.nom) ?? i.poids_unites ?? {}), [unite]: POIDS_CUILLERE[unite] };
      complements.set(i.nom, poids);
      i.poids_unites = poids;
    }
  }
  if (complements.size) {
    console.log(`Poids de cuillère ajoutés : ${[...complements.keys()].join(', ')}`);
    if (APPLIQUER) {
      for (const [nom, poids] of complements) {
        const { error } = await s.from('ingredients').update({ poids_unites: poids }).eq('nom', nom);
        if (error) throw error;
      }
    }
  }

  // Par lots de titres : un select global serait plafonné à 1 000 lignes par PostgREST
  const idParTitre = new Map<string, number>();
  const titres = CLASSIQUES_FRANCAIS.map(r => r.titre);
  for (let i = 0; i < titres.length; i += 100) {
    const { data, error } = await s.from('meals').select('id, titre').eq('is_public', true).in('titre', titres.slice(i, i + 100));
    if (error) throw error;
    for (const m of data ?? []) idParTitre.set(m.titre.toLowerCase(), m.id);
  }

  const vus = new Set<string>();
  let ajoutees = 0, marquees = 0, erreurs = 0;
  for (const r of CLASSIQUES_FRANCAIS) {
    const cle = r.titre.toLowerCase();
    if (vus.has(cle)) { console.error(`✗ doublon dans les données : ${r.titre}`); erreurs++; continue; }
    vus.add(cle);

    const manquants = r.ingredients.filter(([nom]) => !parNom.has(nom.toLowerCase())).map(([nom]) => nom);
    if (manquants.length) {
      if (APPLIQUER || !manquants.every(n => NOUVEAUX_INGREDIENTS.some(i => i.nom === n))) {
        console.error(`✗ ${r.titre} : ingrédients inconnus ${manquants.join(', ')}`); erreurs++;
      }
      continue;
    }

    const lignes = r.ingredients.map(([nom, quantite, unite]) => {
      const i = parNom.get(nom.toLowerCase())!;
      const coef = i.calories_pour_100g == null ? null : {
        cal: i.calories_pour_100g, proteines: i.proteines_pour_100g ?? 0, glucides: i.glucides_pour_100g ?? 0, lipides: i.lipides_pour_100g ?? 0,
      };
      return { quantite, unite, poidsUnites: i.poids_unites, coefficients: coef };
    });
    const res = calculerMacros(lignes, r.portions);
    if (!res.ok) { console.error(`✗ ${r.titre} : macros incalculables (${res.raison} — ${res.detail})`); erreurs++; continue; }
    const m = res.macros;

    const existant = idParTitre.get(cle);
    if (existant) {
      if (APPLIQUER) await s.from('meals').update({ classique: true }).eq('id', existant);
      marquees++;
      continue;
    }
    if (!APPLIQUER) { ajoutees++; continue; }

    const noms = r.ingredients.map(([nom]) => nom);
    const { data: meal, error: e1 } = await s.from('meals').insert({
      titre: r.titre, type_repas: 'plat', cuisine: r.cuisine, difficulte: r.difficulte,
      temps_preparation: r.prep, temps_cuisson: r.cuisson || null, portions_par_defaut: r.portions,
      conservation_jours: r.conservation, ustensiles: r.ustensiles, instructions: r.etapes,
      saison: deduireSaison(r.titre, noms),
      calories_par_portion: Math.round(m.cal), proteines: Math.round(m.p * 10) / 10,
      glucides: Math.round(m.g * 10) / 10, lipides: Math.round(m.l * 10) / 10, macros_verifiables: true,
      description: genererDescription({ titre: r.titre, type_repas: 'plat', cuisine: r.cuisine, temps: r.prep + r.cuisson, kcal: m.cal, ingredients: noms }),
      is_public: true, classique: true,
    }).select('id').single();
    if (e1 || !meal) { console.error(`  insertion impossible : ${e1?.message}`); erreurs++; continue; }

    const { error: e2 } = await s.from('meal_ingredients').insert(r.ingredients.map(([nom, quantite, unite, optionnel]) => ({
      meal_id: meal.id, ingredient_id: parNom.get(nom.toLowerCase())!.id, quantite, unite, est_optionnel: optionnel === true,
    })));
    if (e2) { console.error(`  ingrédients non insérés : ${e2.message}`); await s.from('meals').delete().eq('id', meal.id); erreurs++; continue; }
    ajoutees++;
  }
  console.log(`\n${CLASSIQUES_FRANCAIS.length} recettes — ${ajoutees} ${APPLIQUER ? 'ajoutées' : 'à ajouter'}, ${marquees} déjà présentes (marquées classiques), ${erreurs} en erreur`);
  if (!APPLIQUER) console.log('Aperçu — relancez avec --appliquer pour insérer.');
})();
