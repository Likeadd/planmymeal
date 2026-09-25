// ============================================================================
// SEED WORLD HEALTHY — PlanMyMeal
// Usage : npm run seed:world                (écrit dans Supabase, idempotent)
//         npx tsx scripts/seed-world-healthy.ts --dry   (aperçu sans écriture)
//
// OBJECTIF : +1000 recettes SAINES, MULTI-CULTURES, détaillées au même niveau
// que le catalogue existant (étapes chiffrées, ingrédients liés, macros
// vérifiées, temps, conservation, ustensiles).
//
// SOURCES DES DONNÉES (transparence — même politique que seed-catalogue-1000) :
//  • Sélection des plats : canon culinaire des cuisines considérées parmi les
//    plus saines du monde (classements « healthiest cuisines » : méditerranéenne,
//    japonaise, vietnamienne, indienne, coréenne, mexicaine traditionnelle,
//    libanaise/levantine, grecque, thaï, péruvienne, éthiopienne, marocaine…),
//    croisé avec des recettes « healthy » grand public (grillades, vapeur,
//    légumineuses, céréales complètes, bowls). Les recettes sont réécrites de
//    zéro en version allégée : pas de texte copié d'un site tiers (droits).
//  • Macros : coefficients pour 100 g issus des tables publiques CIQUAL/USDA,
//    calculés par la MÊME fonction `calculerMacros` que le reste du catalogue
//    (refus explicite si une unité n'est pas chiffrable).
//  • Prix : non seedés — calculés par le moteur budget de l'app.
//
// RÉUTILISE le garde-fou complet de seed-catalogue-1000 : unités autorisées,
// plafonds d'unité, rayons SQL, plausibilité des macros, vérification AVANT
// toute écriture, idempotence par titre normalisé.
// ============================================================================

import { config } from 'dotenv';
import type { SupabaseClient } from '@supabase/supabase-js';
import { calculerMacros, verifierPlausibilite, type LigneMacros } from '../src/lib/macros';

type Db = SupabaseClient;
const norm = (t: string) => t.replace(/[\u2019\u2018`]/g, "'");
config({ path: '.env.local' });
config();

// ─── Types (identiques au seed 1000) ────────────────────────────────────────
type Ing = { nom: string; q: number; u: string; r: string };
type Rec = {
  titre: string; type: 'dejeuner' | 'diner' | 'dessert';
  prep: number; cuisson?: number; difficulte: 'facile' | 'moyen';
  saison: 'toutes' | 'printemps' | 'ete' | 'automne' | 'hiver';
  cuisine: string; portions: number; conservation: number;
  ustensiles: string[]; instructions: string[]; ingredients: Ing[];
};

// ─── Nouveaux ingrédients world/healthy (absents du seed 1000) ─────────────
// Macros pour 100 g/ml [kcal, P, G, L] — CIQUAL/USDA, arrondies.
// Rayon ∈ liste SQL (schema-complet.sql : 10 rayons).
const ING_W: Record<string, { m: [number, number, number, number]; r: string; u?: string; ml?: boolean; poids?: Record<string, number> }> = {
  // Protéines maigres & poissons
  'Filet de dorade': { m: [96, 20, 0, 1.5], r: 'viande_poisson' },
  'Filet de tilapia': { m: [96, 20, 0, 2], r: 'viande_poisson' },
  'Filet de truite': { m: [140, 20, 0, 6], r: 'viande_poisson' },
  'Maquereau': { m: [160, 19, 0, 9], r: 'viande_poisson' },
  'Sardines (bte)': { m: [185, 22, 0, 10], r: 'conserves', u: 'boite', poids: { boite: 120 } },
  'Crevettes décortiquées (surg.)': { m: [85, 19, 0.5, 0.5], r: 'surgeles' },
  'Seitan': { m: [120, 24, 3, 1.5], r: 'frais' },
  'Tempeh': { m: [190, 19, 9, 11], r: 'frais' },
  'Edamame (surg.)': { m: [110, 11, 8, 4.5], r: 'surgeles' },
  'Filet de dinde maigre': { m: [105, 23, 0, 1.2], r: 'viande_poisson' },
  'Escalope de dinde': { m: [110, 22, 0, 1.5], r: 'viande_poisson', u: 'pcs', poids: { pcs: 140 } },
  'Cuisses de poulet sans peau': { m: [150, 20, 0, 7], r: 'viande_poisson', u: 'pcs', poids: { pcs: 150 } },
  'Haché de dinde 7 %': { m: [150, 20, 0, 7], r: 'viande_poisson' },
  'Bœuf maigre (filet)': { m: [130, 21, 0, 4.5], r: 'viande_poisson' },
  'Jambon de dinde': { m: [105, 18, 1, 2.5], r: 'viande_poisson', u: 'tranche', poids: { tranche: 30 } },
  'Saumon fumé (not. atlantique)': { m: [180, 22, 0, 10], r: 'viande_poisson' },

  // Légumineuses & associations (basses calories, riches en fibres)
  'Lentilles blondes': { m: [110, 8.5, 18, 0.4], r: 'epicerie_salee' },
  'Pois cassés': { m: [115, 8, 20, 0.6], r: 'epicerie_salee' },
  'Haricots noirs (bte)': { m: [115, 8, 20, 0.5], r: 'conserves', u: 'boite', poids: { boite: 250 } },
  'Haricots blancs (bte)': { m: [110, 8, 18, 0.5], r: 'conserves', u: 'boite', poids: { boite: 250 } },
  'Pois chiches secs': { m: [340, 21, 58, 5.5], r: 'epicerie_salee' },
  'Fèves (surg.)': { m: [80, 7, 11, 0.7], r: 'surgeles' },
  'Dhal de lentilles (bte)': { m: [90, 6, 14, 1], r: 'conserves', u: 'boite', poids: { boite: 400 } },

  // Céréales & féculents complets
  'Riz complet (basc.)': { m: [345, 7.5, 72, 2.8], r: 'epicerie_salee' },
  'Sarrasin': { m: [343, 13, 72, 3.4], r: 'epicerie_salee' },
  'Millet': { m: [378, 11, 73, 4.2], r: 'epicerie_salee' },
  'Orge perlé': { m: [352, 10, 78, 1.2], r: 'epicerie_salee' },
  'Riz jasmin': { m: [355, 7, 79, 0.6], r: 'epicerie_salee' },
  'Riz à risotto complet': { m: [345, 7.5, 72, 2.8], r: 'epicerie_salee' },
  'Pâtes complètes (penne)': { m: [340, 13, 68, 2.5], r: 'epicerie_salee' },
  'Pâtes de riz complet': { m: [350, 8, 76, 1.5], r: 'epicerie_salee' },
  'Nouilles soba complètes': { m: [340, 12, 67, 2], r: 'epicerie_salee' },
  'Boulgour gros calibre': { m: [342, 12, 76, 1.3], r: 'epicerie_salee' },
  'Épeautre': { m: [338, 13, 70, 2.5], r: 'epicerie_salee' },
  'Farine complète': { m: [340, 12, 68, 2.5], r: 'epicerie_salee' },
  'Farine de pois chiches': { m: [370, 21, 55, 6], r: 'epicerie_salee' },
  'Flocons d\u2019avoine complets': { m: [370, 13, 58, 7], r: 'epicerie_salee' },
  'Pain pita complet': { m: [240, 10, 46, 2], r: 'boulangerie', u: 'pcs', poids: { pcs: 75 } },
  'Tortilla de blé complète': { m: [280, 10, 47, 5], r: 'boulangerie', u: 'pcs', poids: { pcs: 55 } },
  'Pain de seigle': { m: [250, 8.5, 48, 1.5], r: 'boulangerie', u: 'tranche', poids: { tranche: 35 } },

  // Légumes world & frais
  'Blette': { m: [19, 1.8, 3.7, 0.2], r: 'fruits_legumes' },
  'Chou chinois': { m: [16, 1.2, 3.2, 0.2], r: 'fruits_legumes' },
  'Chou pak choï': { m: [13, 1.5, 2.2, 0.2], r: 'fruits_legumes' },
  'Chou frisé (kale)': { m: [35, 2.9, 3.4, 1.5], r: 'fruits_legumes' },
  'Céleri branche': { m: [16, 0.7, 3, 0.2], r: 'fruits_legumes', poids: { pcs: 100 } },
  'Fenouil': { m: [31, 1.2, 7.3, 0.2], r: 'fruits_legumes', poids: { pcs: 300 } },
  'Endive': { m: [17, 1.2, 3.3, 0.1], r: 'fruits_legumes', poids: { pcs: 150 } },
  'Radis': { m: [16, 0.7, 3.4, 0.1], r: 'fruits_legumes' },
  'Navet long (daikon)': { m: [18, 0.6, 4, 0.1], r: 'fruits_legumes', u: 'pcs', poids: { pcs: 500 } },
  'Pousses de soja': { m: [30, 3, 4, 0.2], r: 'fruits_legumes' },
  'Pousses de bambou (bte)': { m: [20, 2, 3, 0.3], r: 'conserves', u: 'boite', poids: { boite: 230 } },
  'Cœur de palmier (bte)': { m: [25, 2, 4, 0.3], r: 'conserves', u: 'boite', poids: { boite: 140 } },
  'Artichaut (bte)': { m: [50, 3, 9, 0.8], r: 'conserves', u: 'boite', poids: { boite: 200 } },
  'Cœurs de palmier': { m: [25, 2, 4, 0.3], r: 'conserves' },
  'Patate douce (surg. en dés)': { m: [86, 1.6, 20, 0.1], r: 'surgeles' },
  'Épinards surgelés': { m: [30, 3.5, 2, 0.5], r: 'surgeles' },
  'Brocolis surgelés': { m: [28, 2.6, 2.5, 0.4], r: 'surgeles' },
  'Mélanges de poissons (surg.)': { m: [95, 19, 0, 1.5], r: 'surgeles' },
  'Maïs doux (surg.)': { m: [85, 3, 18, 1], r: 'surgeles' },
  'Mâche en sachet': { m: [18, 2, 2, 0.3], r: 'fruits_legumes' },
  'Roquette en sachet': { m: [25, 2.6, 2, 0.7], r: 'fruits_legumes' },
  'Avocat mûr': { m: [160, 2, 4, 15], r: 'fruits_legumes', u: 'pcs', poids: { pcs: 200 } },
  'Tomates allongées': { m: [18, 0.9, 3.5, 0.2], r: 'fruits_legumes' },
  'Courgettes rondes': { m: [17, 1.2, 2, 0.3], r: 'fruits_legumes', u: 'pcs', poids: { pcs: 200 } },
  'Aubergines miniatures': { m: [20, 1, 4, 0.2], r: 'fruits_legumes', u: 'pcs', poids: { pcs: 120 } },
  'Grenailles': { m: [80, 2, 17, 0.2], r: 'fruits_legumes' },
  'Citronnelle': { m: [0, 0, 0, 0], r: 'fruits_legumes', u: 'pcs', poids: { pcs: 20 } },
  'Champignons shiitakés': { m: [34, 2.2, 6.8, 0.5], r: 'fruits_legumes' },
  'Champignons noirs déshydratés': { m: [290, 17, 60, 1], r: 'epicerie_salee' },
  'Banane plantain': { m: [120, 0.8, 31, 0.3], r: 'fruits_legumes', u: 'pcs', poids: { pcs: 250 } },
  'Okra': { m: [33, 2, 7, 0.2], r: 'fruits_legumes' },
  'Yautia (malanga)': { m: [90, 1.5, 22, 0.2], r: 'fruits_legumes' },
  'Chayote': { m: [19, 0.8, 4.5, 0.1], r: 'fruits_legumes', u: 'pcs', poids: { pcs: 300 } },
  'Yuzu (jus en bte)': { m: [30, 0.5, 7, 0.1], r: 'conserves', ml: true },
  'Lime (jus)': { m: [25, 0.4, 8, 0.1], r: 'fruits_legumes', ml: true },
  'Mangue (surg.)': { m: [60, 0.5, 14, 0.3], r: 'surgeles' },
  'Fruits de la passion': { m: [55, 1.5, 10, 0.5], r: 'fruits_legumes', u: 'pcs', poids: { pcs: 100 } },
  'Grenade': { m: [65, 1.2, 14, 0.6], r: 'fruits_legumes', u: 'pcs', poids: { pcs: 300 } },
  'Kumquat': { m: [65, 1.5, 16, 0.2], r: 'fruits_legumes', u: 'pcs', poids: { pcs: 30 } },
  'Papaye': { m: [40, 0.6, 9, 0.2], r: 'fruits_legumes', u: 'pcs', poids: { pcs: 700 } },
  'Litchis (bte)': { m: [70, 0.5, 17, 0.1], r: 'conserves', u: 'boite', poids: { boite: 250 } },
  'Dattes Medjool': { m: [280, 2, 75, 0.4], r: 'epicerie_sucree', u: 'pcs', poids: { pcs: 20 } },
  'Cannelle en bâton': { m: [0, 0, 0, 0], r: 'epices', u: 'pcs', poids: { pcs: 2 } },

  // Produits laitiers & alternatives
  'Yaourt grec 0 %': { m: [57, 10, 3.6, 0.2], r: 'frais', poids: { pcs: 125, cas: 20 } },
  'Kéfir nature': { m: [50, 3.5, 4.5, 1.5], r: 'frais', ml: true },
  'Ricotta': { m: [175, 11, 3, 13], r: 'frais' },
  'Ricotta légère': { m: [130, 10, 3, 8], r: 'frais' },
  'Mozzarella light': { m: [210, 22, 2, 12], r: 'frais' },
  'Labneh': { m: [150, 9, 4, 11], r: 'frais' },
  'Feta light': { m: [180, 14, 4, 12], r: 'frais' },
  'Parmesan 24 mois': { m: [392, 35, 0, 25], r: 'frais' },
  'Bûche de chèvre frais': { m: [150, 12, 1, 11], r: 'frais' },
  'Boisson d\u2019avoine': { m: [45, 0.5, 7, 1.5], r: 'boissons', ml: true },
  'Yaourt de coco': { m: [75, 1, 8, 4.5], r: 'frais', poids: { pcs: 125 } },

  // Épicerie salée world
  'Miso': { m: [190, 12, 26, 6], r: 'epicerie_salee', poids: { cas: 17 } },
  'Pâte de miso complet': { m: [180, 11, 25, 5], r: 'epicerie_salee', poids: { cas: 17 } },
  'Algue wakame séchée': { m: [150, 12, 40, 1], r: 'epicerie_salee', u: 'cas', poids: { cas: 3 } },
  'Algue nori': { m: [180, 30, 40, 1.5], r: 'epicerie_salee', u: 'pcs', poids: { pcs: 3 } },
  'Dashi en poudre': { m: [180, 20, 5, 8], r: 'epicerie_salee', u: 'cac', poids: { cac: 2 } },
  'Sauce sriracha': { m: [90, 1.5, 18, 1], r: 'epicerie_salee', u: 'cac', poids: { cac: 6 } },
  'Gochujang': { m: [170, 4, 30, 1], r: 'epicerie_salee', poids: { cas: 18 } },
  'Sauce hoisin': { m: [240, 1.5, 50, 3], r: 'epicerie_salee', poids: { cas: 18 } },
  'Sauce fish sauce': { m: [35, 5, 0, 0.3], r: 'epicerie_salee', poids: { cas: 16 } },
  'Nuoc-mâm': { m: [35, 5, 0, 0.3], r: 'epicerie_salee', poids: { cas: 16 } },
  'Sauce d\u2019huître': { m: [90, 2, 17, 0.5], r: 'epicerie_salee', poids: { cas: 16 } },
  'Pâte de curry rouge': { m: [100, 3, 8, 6], r: 'epicerie_salee', poids: { cas: 15 } },
  'Pâte de curry vert': { m: [95, 3, 7, 6], r: 'epicerie_salee', poids: { cas: 15 } },
  'Lait de coco léger': { m: [75, 1, 1.5, 7], r: 'conserves', ml: true },
  'Beurre de sésame (tahini complet)': { m: [595, 17, 21, 54], r: 'epicerie_salee', u: 'cas', poids: { cas: 15 } },
  'Harissa': { m: [80, 2, 5, 5.5], r: 'epicerie_salee', poids: { cac: 6, cas: 15 } },
  'Zaatar': { m: [220, 7, 30, 8], r: 'epices', poids: { cas: 9 } },
  'Dukkah': { m: [280, 9, 10, 22], r: 'epices', poids: { cas: 10 } },
  'Sumac': { m: [0, 0, 0, 0], r: 'epices', poids: { cac: 3, cas: 8 } },
  'Za\u2019atar': { m: [220, 7, 30, 8], r: 'epices', poids: { cas: 9 } },
  'Quatre-épices': { m: [0, 0, 0, 0], r: 'epices', u: 'cac', poids: { cac: 3 } },
  'Cinq-épices': { m: [0, 0, 0, 0], r: 'epices', u: 'cac', poids: { cac: 3 } },
  'Panch phoron': { m: [0, 0, 0, 0], r: 'epices', u: 'cac', poids: { cac: 3 } },
  'Piment chipotle en sauce': { m: [75, 1.5, 12, 1.5], r: 'epicerie_salee', poids: { cas: 15 } },
  'Haricots pinto (bte)': { m: [115, 7.5, 20, 0.5], r: 'conserves', u: 'boite', poids: { boite: 250 } },
  'Salsa tomate-verde': { m: [30, 1.2, 5.5, 0.3], r: 'conserves', poids: { cas: 16 } },
  'Tortillas de maïs nixtamalisées': { m: [230, 6, 48, 2], r: 'boulangerie', u: 'pcs', poids: { pcs: 45 } },
  'Farine de maïs nixtamalisée': { m: [365, 8, 76, 1.5], r: 'epicerie_salee' },
  'Couscous complet': { m: [335, 13, 66, 2], r: 'epicerie_salee' },
  'Câpres au vinaigre': { m: [20, 1.5, 1, 0.3], r: 'epicerie_salee', poids: { cas: 10 } },
  'Olives Kalamata': { m: [210, 1.2, 5, 21], r: 'epicerie_salee' },
  'Tomates séchées': { m: [215, 5, 25, 10], r: 'epicerie_salee' },
  'Pignons de pin torréfiés': { m: [629, 14, 13, 61], r: 'epicerie_salee' },
  'Noix de cajou non salées': { m: [553, 18, 30, 44], r: 'epicerie_salee' },
  'Graines de courge': { m: [560, 30, 11, 49], r: 'epicerie_salee' },
  'Graines de lin': { m: [530, 18, 29, 42], r: 'epicerie_salee' },
  'Levure maltée': { m: [360, 45, 35, 5], r: 'epicerie_salee', poids: { cas: 8 } },
  'Bouillon miso en poudre': { m: [180, 12, 26, 6], r: 'epicerie_salee', poids: { cac: 3 } },
  'Bouillon de légumes en cube': { m: [180, 8, 20, 8], r: 'epicerie_salee', poids: { pcs: 10 } },
  'Concentré de bouillon de légumes': { m: [60, 2, 6, 3], r: 'conserves', poids: { cas: 15 } },

  // Sucrants & aids healthy pour desserts
  'Sirop d\u2019agave': { m: [310, 0.1, 76, 0.2], r: 'epicerie_sucree', poids: { cas: 20 } },
  'Sucre de coco': { m: [375, 1, 94, 0], r: 'epicerie_sucree' },
  'Compote de pomme sans sucre': { m: [45, 0.3, 11, 0.1], r: 'epicerie_sucree', poids: { cas: 15 } },
  'Purée d\u2019amandes': { m: [610, 21, 19, 55], r: 'epicerie_sucree', poids: { cas: 16 } },
  'Purée de cacahuète': { m: [590, 26, 20, 50], r: 'epicerie_sucree', poids: { cas: 16 } },
  'Cacao non sucré': { m: [228, 20, 58, 14], r: 'epicerie_sucree', poids: { cas: 6 } },
  'Chocolat noir 70 %': { m: [590, 8, 45, 42], r: 'epicerie_sucree' },
  'Flocons d\u2019avoine pour porridge': { m: [370, 13, 58, 7], r: 'epicerie_salee' },
  'Chia graines': { m: [490, 17, 42, 31], r: 'epicerie_sucree' },
  'Baies de goji': { m: [330, 14, 66, 3], r: 'epicerie_sucree' },
  'Mangue séchée sans sucre': { m: [300, 2.5, 70, 1.5], r: 'epicerie_sucree' },
  'Coco râpée non sucrée': { m: [660, 7, 7, 65], r: 'epicerie_sucree' },
  'Bicarbonate de soude': { m: [0, 0, 0, 0], r: 'epicerie_salee', u: 'cac', poids: { cac: 4 } },
  'Vinaigre de riz': { m: [20, 0, 0.5, 0], r: 'epicerie_salee', u: 'cas', poids: { cas: 15 } },
  'Vinaigre de cidre': { m: [21, 0, 0.9, 0], r: 'epicerie_salee', u: 'cas', poids: { cas: 15 } },
  'Moutarde à l\u2019ancienne': { m: [66, 4, 4, 3.7], r: 'epicerie_salee', poids: { cas: 16 } },
  'Paprika doux fumé': { m: [0, 0, 0, 0], r: 'epices', poids: { cac: 3, cas: 8 } },
  'Curry Madras': { m: [0, 0, 0, 0], r: 'epices', poids: { cac: 3, cas: 8 } },
  'Garam masala maison': { m: [0, 0, 0, 0], r: 'epices', poids: { cac: 3, cas: 8 } },
  'Cardamome': { m: [0, 0, 0, 0], r: 'epices', poids: { cac: 2 } },
  'Cumin en poudre': { m: [0, 0, 0, 0], r: 'epices', poids: { cac: 3, cas: 8 } },
  'Origan séché': { m: [0, 0, 0, 0], r: 'epices', poids: { cac: 1, cas: 3 } },
  'Thym citron': { m: [0, 0, 0, 0], r: 'epices', u: 'botte', poids: { botte: 20 } },
  'Aneth frais': { m: [0, 0, 0, 0], r: 'fruits_legumes', u: 'botte', poids: { botte: 20 } },
  'Basilic thaï': { m: [0, 0, 0, 0], r: 'fruits_legumes', u: 'botte', poids: { botte: 25 } },
  'Menthe séchée': { m: [0, 0, 0, 0], r: 'epices', poids: { cac: 2, cas: 6 } },
  'Piment frais': { m: [40, 1.5, 9, 0.4], r: 'fruits_legumes', u: 'pcs', poids: { pcs: 10 } },
  'Gingembre râpé': { m: [80, 1.8, 18, 0.8], r: 'fruits_legumes', poids: { cas: 12 } },
  'Ail en purée': { m: [149, 6.4, 30, 0.2], r: 'fruits_legumes', poids: { cas: 10 } },
};

// ─── Ingrédients du seed 1000 REUTILISÉS (copie de leurs définitions — le
// script doit rester autoportant pour être lancé seul) ──────────────────────
const ING_BASE: Record<string, { m: [number, number, number, number]; r: string; u?: string; ml?: boolean; poids?: Record<string, number> }> = {
  'Filet de poulet': { m: [120, 22, 0, 3], r: 'viande_poisson' },
  'Filet de dinde': { m: [110, 23, 0, 2], r: 'viande_poisson' },
  'Pavé de saumon': { m: [200, 20, 0, 13], r: 'viande_poisson', u: 'pcs', poids: { pcs: 130 } },
  'Dos de cabillaud': { m: [80, 17, 0, 0.7], r: 'viande_poisson' },
  'Crevettes': { m: [85, 19, 0.5, 0.5], r: 'viande_poisson' },
  'Œuf': { m: [140, 12.5, 0.5, 10], r: 'frais', u: 'pcs', poids: { pcs: 60 } },
  'Tofu ferme': { m: [145, 15, 2, 8], r: 'frais' },
  'Pois chiches (bte)': { m: [160, 9, 27, 2.5], r: 'conserves' },
  'Lentilles vertes': { m: [115, 9, 20, 0.5], r: 'epicerie_salee' },
  'Lentilles corail': { m: [335, 24, 58, 1.1], r: 'epicerie_salee' },
  'Haricots rouges (bte)': { m: [130, 9, 23, 0.5], r: 'conserves' },
  'Feta': { m: [260, 14, 4, 21], r: 'frais' },
  'Mozzarella': { m: [250, 18, 2, 19], r: 'frais' },
  'Chèvre frais': { m: [190, 14, 2, 13], r: 'frais' },
  'Parmesan': { m: [392, 35, 0, 25], r: 'frais' },
  'Yaourt nature': { m: [60, 4, 5, 2.4], r: 'frais', poids: { pcs: 125 } },
  'Yaourt grec': { m: [120, 4, 4, 9], r: 'frais', poids: { pcs: 125, cas: 20 } },
  'Fromage blanc': { m: [70, 7.5, 4.5, 3], r: 'frais' },
  'Skyr': { m: [63, 11, 4, 0.5], r: 'frais' },
  'Pâtes penne': { m: [355, 12, 72, 1.5], r: 'epicerie_salee' },
  'Riz basmati': { m: [350, 7.5, 78, 0.7], r: 'epicerie_salee' },
  'Riz complet': { m: [345, 7.5, 72, 2.8], r: 'epicerie_salee' },
  'Quinoa': { m: [370, 14, 64, 6], r: 'epicerie_salee' },
  'Boulgour': { m: [342, 12, 76, 1.3], r: 'epicerie_salee' },
  'Semoule fine': { m: [360, 12, 73, 1], r: 'epicerie_salee' },
  'Nouilles de riz': { m: [360, 6, 82, 0.6], r: 'epicerie_salee' },
  'Nouilles soba': { m: [340, 11, 68, 1.5], r: 'epicerie_salee' },
  'Polenta': { m: [350, 8, 75, 0.6], r: 'epicerie_salee' },
  'Flocons d\u2019avoine': { m: [370, 13, 58, 7], r: 'epicerie_salee' },
  'Farine': { m: [350, 10, 72, 1.5], r: 'epicerie_salee' },
  'Courgette': { m: [17, 1.2, 2, 0.3], r: 'fruits_legumes', u: 'pcs', poids: { pcs: 250 } },
  'Aubergine': { m: [20, 1, 4, 0.2], r: 'fruits_legumes', u: 'pcs', poids: { pcs: 250 } },
  'Poivron rouge': { m: [25, 1, 5, 0.3], r: 'fruits_legumes', u: 'pcs', poids: { pcs: 150 } },
  'Tomate': { m: [18, 0.9, 3.5, 0.2], r: 'fruits_legumes', u: 'pcs', poids: { pcs: 120 } },
  'Tomates cerises': { m: [20, 1, 3.8, 0.2], r: 'fruits_legumes' },
  'Tomate concassée (bte)': { m: [30, 1.6, 5.5, 0.2], r: 'conserves' },
  'Oignon': { m: [40, 1.1, 9, 0.1], r: 'fruits_legumes', u: 'pcs', poids: { pcs: 80 } },
  'Oignon rouge': { m: [42, 1.1, 9.3, 0.1], r: 'fruits_legumes', u: 'pcs', poids: { pcs: 80 } },
  'Échalote': { m: [72, 2.5, 16, 0.1], r: 'fruits_legumes', u: 'pcs', poids: { pcs: 30 } },
  'Ail': { m: [149, 6.4, 30, 0.2], r: 'fruits_legumes', u: 'pcs', poids: { pcs: 5 } },
  'Carotte': { m: [38, 0.9, 8.5, 0.2], r: 'fruits_legumes', u: 'pcs', poids: { pcs: 80 } },
  'Poireau': { m: [30, 1.5, 6, 0.1], r: 'fruits_legumes', u: 'pcs', poids: { pcs: 150 } },
  'Champignons de Paris': { m: [22, 3, 1, 0.3], r: 'fruits_legumes' },
  'Épinards frais': { m: [23, 2.9, 1.4, 0.4], r: 'fruits_legumes' },
  'Brocoli': { m: [30, 2.4, 2, 0.4], r: 'fruits_legumes' },
  'Chou-fleur': { m: [25, 1.9, 2.5, 0.3], r: 'fruits_legumes', poids: { pcs: 800 } },
  'Haricots verts': { m: [25, 1.8, 4, 0.1], r: 'fruits_legumes' },
  'Petit pois (surg.)': { m: [70, 5, 10, 0.4], r: 'surgeles' },
  'Concombre': { m: [12, 0.6, 2.2, 0.1], r: 'fruits_legumes', u: 'pcs', poids: { pcs: 350 } },
  'Roquette': { m: [25, 2.6, 2, 0.7], r: 'fruits_legumes' },
  'Mâche': { m: [18, 2, 2, 0.3], r: 'fruits_legumes' },
  'Chou kale': { m: [35, 2.9, 3.4, 1.5], r: 'fruits_legumes' },
  'Chou rouge': { m: [31, 1.9, 5.6, 0.2], r: 'fruits_legumes' },
  'Avocat': { m: [160, 2, 4, 15], r: 'fruits_legumes', u: 'pcs', poids: { pcs: 200 } },
  'Pomme de terre': { m: [80, 2, 17, 0.2], r: 'fruits_legumes' },
  'Patate douce': { m: [86, 1.6, 20, 0.1], r: 'fruits_legumes', poids: { pcs: 250 } },
  'Courge butternut': { m: [45, 1, 12, 0.1], r: 'fruits_legumes' },
  'Citron': { m: [29, 1.1, 3, 0.3], r: 'fruits_legumes', u: 'pcs', poids: { pcs: 100 } },
  'Citron vert': { m: [30, 0.7, 3, 0.2], r: 'fruits_legumes', u: 'pcs', poids: { pcs: 60 } },
  'Pomme': { m: [52, 0.3, 12, 0.2], r: 'fruits_legumes', u: 'pcs', poids: { pcs: 150 } },
  'Banane': { m: [89, 1, 21, 0.3], r: 'fruits_legumes', u: 'pcs', poids: { pcs: 120 } },
  'Fraise': { m: [32, 0.7, 6.5, 0.3], r: 'fruits_legumes' },
  'Framboise': { m: [45, 1.2, 7, 0.6], r: 'fruits_legumes' },
  'Myrtilles': { m: [55, 0.7, 10, 0.3], r: 'fruits_legumes' },
  'Mangue': { m: [60, 0.8, 14, 0.4], r: 'fruits_legumes', u: 'pcs', poids: { pcs: 200 } },
  'Crème fraîche épaisse': { m: [300, 2.6, 3, 30], r: 'frais', ml: true },
  'Lait': { m: [47, 3.2, 4.6, 1.6], r: 'frais', ml: true },
  'Beurre': { m: [740, 0.8, 0.6, 82], r: 'frais' },
  'Lait de coco': { m: [180, 1.8, 3, 19], r: 'conserves', ml: true },
  'Bouillon de légumes': { m: [5, 0.3, 0.6, 0.1], r: 'epicerie_salee', ml: true },
  'Bouillon de volaille': { m: [6, 0.7, 0.4, 0.2], r: 'epicerie_salee', ml: true },
  'Huile d\u2019olive': { m: [884, 0, 0, 100], r: 'epicerie_salee', ml: true, poids: { cas: 13 } },
  'Huile de sésame': { m: [880, 0, 0, 100], r: 'epicerie_salee', u: 'cas', poids: { cas: 13 } },
  'Vinaigre balsamique': { m: [88, 0.5, 17, 0], r: 'epicerie_salee', ml: true, poids: { cas: 15 } },
  'Sauce soja': { m: [53, 8, 4, 0.1], r: 'epicerie_salee', ml: true, poids: { cas: 16, cac: 5 } },
  'Miel': { m: [304, 0.3, 82, 0], r: 'epicerie_sucree', poids: { cas: 20, cac: 7 } },
  'Moutarde': { m: [66, 4, 4, 3.7], r: 'epicerie_salee', poids: { cas: 16, cac: 5 } },
  'Concentré de tomate': { m: [82, 4.3, 15, 0.5], r: 'conserves' },
  'Olives noires': { m: [230, 1.6, 6, 23], r: 'epicerie_salee' },
  'Câpres': { m: [23, 2, 1, 0.7], r: 'epicerie_salee' },
  'Tahini': { m: [595, 17, 21, 54], r: 'epicerie_salee', poids: { cas: 15 } },
  'Sucre': { m: [400, 0, 100, 0], r: 'epicerie_sucree' },
  'Cacao en poudre': { m: [228, 20, 58, 14], r: 'epicerie_sucree' },
  'Amandes': { m: [579, 21, 22, 50], r: 'epicerie_sucree' },
  'Noisettes': { m: [628, 15, 17, 60], r: 'epicerie_sucree' },
  'Pignons de pin': { m: [629, 14, 13, 61], r: 'epicerie_sucree' },
  'Noix': { m: [650, 15, 14, 65], r: 'epicerie_sucree' },
  'Graines de chia': { m: [490, 17, 42, 31], r: 'epicerie_sucree' },
  'Datte': { m: [282, 2.5, 75, 0.4], r: 'epicerie_sucree', u: 'pcs', poids: { pcs: 8 } },
  'Basilic': { m: [0, 0, 0, 0], r: 'fruits_legumes', u: 'botte', poids: { botte: 30 } },
  'Persil': { m: [0, 0, 0, 0], r: 'fruits_legumes', u: 'botte', poids: { botte: 30 } },
  'Ciboulette': { m: [0, 0, 0, 0], r: 'fruits_legumes', u: 'botte', poids: { botte: 20 } },
  'Coriandre fraîche': { m: [0, 0, 0, 0], r: 'fruits_legumes', u: 'botte', poids: { botte: 30 } },
  'Menthe fraîche': { m: [0, 0, 0, 0], r: 'fruits_legumes', u: 'botte', poids: { botte: 25 } },
  'Thym': { m: [0, 0, 0, 0], r: 'epices' },
  'Romarin': { m: [0, 0, 0, 0], r: 'epices' },
  'Origan': { m: [0, 0, 0, 0], r: 'epices', u: 'cas', poids: { cas: 3, cac: 1 } },
  'Herbes de Provence': { m: [0, 0, 0, 0], r: 'epices', u: 'cas', poids: { cas: 3, cac: 1 } },
  'Curry en poudre': { m: [0, 0, 0, 0], r: 'epices', u: 'cas', poids: { cas: 8, cac: 3 } },
  'Cumin': { m: [0, 0, 0, 0], r: 'epices', u: 'cas', poids: { cas: 8, cac: 3 } },
  'Paprika fumé': { m: [0, 0, 0, 0], r: 'epices', u: 'cas', poids: { cas: 8, cac: 3 } },
  'Gingembre': { m: [80, 1.8, 18, 0.8], r: 'fruits_legumes', poids: { cas: 12 } },
  'Curcuma': { m: [0, 0, 0, 0], r: 'epices', u: 'cas', poids: { cas: 8, cac: 3 } },
  'Ras-el-hanout': { m: [0, 0, 0, 0], r: 'epices', u: 'cas', poids: { cas: 8 } },
  'Cannelle': { m: [0, 0, 0, 0], r: 'epices', u: 'pcs', poids: { pcs: 2, cac: 3, cas: 8 } },
  'Piment doux': { m: [0, 0, 0, 0], r: 'epices', u: 'cac', poids: { cac: 3 } },
  'Graines de sésame': { m: [573, 18, 23, 50], r: 'epicerie_salee', poids: { cas: 9, cac: 3 } },
  'Pains pita': { m: [275, 9, 55, 1.2], r: 'boulangerie', u: 'pcs', poids: { pcs: 90 } },
  'Tortillas de blé': { m: [310, 8, 51, 7], r: 'boulangerie', u: 'pcs', poids: { pcs: 60 } },
  'Levure chimique': { m: [0, 0, 0, 0], r: 'epicerie_salee', u: 'sachet', poids: { sachet: 11, cac: 4 } },
  'Thon au naturel': { m: [110, 25, 0, 1], r: 'conserves' },

  // ── Suite du seed 1000 (legumes, fruits, liquides, épicerie) ──
  'Betterave cuite': { m: [45, 1.7, 8, 0.2], r: 'fruits_legumes', u: 'pcs', poids: { pcs: 150 } },
  'Pousses de soja': { m: [30, 3, 4, 0.2], r: 'fruits_legumes' },
  'Fenouil': { m: [31, 1.2, 7.3, 0.2], r: 'fruits_legumes', poids: { pcs: 300 } },
  'Endive': { m: [17, 1.2, 3.3, 0.1], r: 'fruits_legumes', poids: { pcs: 150 } },
  'Ananas frais': { m: [52, 0.5, 12, 0.15], r: 'fruits_legumes', u: 'pcs', poids: { pcs: 1000 } },
  'Orange': { m: [47, 0.9, 12, 0.1], r: 'fruits_legumes', u: 'pcs', poids: { pcs: 180 } },
  'Raisins secs': { m: [299, 3, 79, 0.5], r: 'epicerie_sucree' },
  'Roquette en sachet': { m: [25, 2.6, 2, 0.7], r: 'fruits_legumes' },
  'Mâche en sachet': { m: [18, 2, 2, 0.3], r: 'fruits_legumes' },
  'Grenailles': { m: [80, 2, 17, 0.2], r: 'fruits_legumes' },
  'Cheddar': { m: [400, 25, 1.5, 33], r: 'frais', u: 'tranche', poids: { tranche: 20 } },
  'Pistaches non salées': { m: [560, 20, 28, 45], r: 'epicerie_sucree' },
  'Vinaigre de riz': { m: [20, 0, 0.5, 0], r: 'epicerie_salee', u: 'cas', poids: { cas: 15 } },
  'Arachide beurre': { m: [590, 26, 20, 50], r: 'epicerie_sucree', u: 'cas', poids: { cas: 16 } },
  'Navet long (daikon)': { m: [18, 0.6, 4, 0.1], r: 'fruits_legumes', u: 'pcs', poids: { pcs: 500 } },
  'Algue wakame séchée': { m: [150, 12, 40, 1], r: 'epicerie_salee', u: 'cas', poids: { cas: 3 } },
  'Oignon nouveau': { m: [30, 1.5, 6, 0.2], r: 'fruits_legumes', u: 'pcs', poids: { pcs: 40 } },
  'Cocoa non sucré': { m: [228, 20, 58, 14], r: 'epicerie_sucree', u: 'cas', poids: { cas: 6 } },

  // ── Extension coréenne / éthiopienne / turque ──
  'Pâte de gochujang': { m: [170, 4, 30, 1], r: 'epicerie_salee', poids: { cas: 18 } },
  'Berbere': { m: [0, 0, 0, 0], r: 'epices', poids: { cac: 3, cas: 8 } },
  'Kimchi (bte)': { m: [30, 1.5, 4, 0.5], r: 'conserves', poids: { boite: 300 } },
  'Pousses de soja fraîches': { m: [30, 3, 4, 0.2], r: 'fruits_legumes' },
  'Bibimbap riz complet': { m: [345, 7.5, 72, 2.8], r: 'epicerie_salee' },
  'Pain lafa': { m: [260, 8, 50, 2], r: 'boulangerie', u: 'pcs', poids: { pcs: 90 } },
  'Graines de nigelle': { m: [0, 0, 0, 0], r: 'epices', poids: { cac: 3, cas: 8 } },
  'Thym séché': { m: [0, 0, 0, 0], r: 'epices', poids: { cac: 2, cas: 6 } },
  'Bergamote séchée': { m: [0, 0, 0, 0], r: 'epices', poids: { cac: 2 } },
  'Yaourt turque': { m: [90, 5, 6, 5], r: 'frais', poids: { pcs: 200 } },
  'Pâte filo': { m: [300, 8, 62, 2], r: 'frais', u: 'pcs', poids: { pcs: 18 } },
  // Vietnam / Espagne / Brésil
  'Safran': { m: [0, 0, 0, 0], r: 'epices', poids: { pincee: 0.1, cac: 0.5 } },
  'Anis étoilé (badiane)': { m: [0, 0, 0, 0], r: 'epices', poids: { pcs: 0.7 } },
  'Maïs doux (bte)': { m: [86, 3, 19, 1.2], r: 'conserves', u: 'boite', poids: { boite: 200 } },
  'Pain de riz': { m: [282, 2, 65, 0.5], r: 'epicerie_salee', u: 'pcs', poids: { pcs: 16 } },
  'Filet de bœuf': { m: [150, 21, 0, 7], r: 'viande_poisson' },
  'Laitue': { m: [15, 1.3, 2.2, 0.2], r: 'fruits_legumes', u: 'pcs', poids: { pcs: 300 } },
  'Vinaigre de Xérès': { m: [19, 0, 0.4, 0], r: 'epicerie_salee', ml: true, poids: { cas: 15 } },
  'Pain complet': { m: [240, 9, 40, 3.5], r: 'boulangerie' },
  'Riz à paella': { m: [350, 7, 78, 0.7], r: 'epicerie_salee' },
  'Fécule de tapioca': { m: [380, 0.5, 90, 0.1], r: 'epicerie_salee' },
  'Farine de manioc': { m: [340, 1.5, 82, 0.5], r: 'epicerie_salee' },
  'Chuchu': { m: [19, 0.8, 4.5, 0.1], r: 'fruits_legumes', u: 'pcs', poids: { pcs: 300 } },
  'Huile de palme (dendê)': { m: [884, 0, 0, 100], r: 'epicerie_salee', ml: true, poids: { cas: 14 } },
  'Riz complet cuit': { m: [120, 2.6, 25, 1], r: 'epicerie_salee' },
  'Tofu soyeux': { m: [55, 5, 2, 3], r: 'frais' },
  'Cacahuètes': { m: [570, 26, 16, 49], r: 'epicerie_salee' },
  'Feuille de laurier': { m: [0, 0, 0, 0], r: 'epices', poids: { pcs: 0.2 } },
  'Poivron vert': { m: [20, 0.9, 4.5, 0.1], r: 'fruits_legumes', u: 'pcs', poids: { pcs: 150 } },
  // Japon / Éthiopie (familles complètes)
  'Feuille de nori': { m: [320, 30, 40, 2], r: 'epicerie_salee', u: 'pcs', poids: { pcs: 3 } },
  'Injera': { m: [230, 8, 48, 1.5], r: 'boulangerie', u: 'pcs', poids: { pcs: 180 } },
  'Mirin': { m: [140, 0.5, 33, 0], r: 'epicerie_salee', ml: true, poids: { cas: 15 } },
  'Riz à sushi': { m: [340, 6.5, 76, 0.8], r: 'epicerie_salee' },
  'Wasabi': { m: [0, 0, 0, 0], r: 'epices', poids: { cac: 5 } },
  'Chou blanc': { m: [25, 1.4, 5.8, 0.2], r: 'fruits_legumes' },
};

// ─── FUSION des deux tables : les poids d'unité deviennent POIDS_UNITES ─────
type IngDef = { m: [number, number, number, number]; r: string; u?: string; ml?: boolean };
const ING: Record<string, IngDef> = {};
const POIDS_UNITES: Record<string, Record<string, number>> = {};
for (const [nom, def] of Object.entries({ ...ING_BASE, ...ING_W })) {
  ING[nom] = { m: def.m, r: def.r, u: def.u, ml: def.ml };
  if (def.poids) POIDS_UNITES[nom] = def.poids;
}

// ─── Helpers (identiques au seed 1000) ──────────────────────────────────────
function I(nom: string, q: number, u?: string): Ing {
  const def = ING[nom];
  if (!def) throw new Error(`Ingrédient inconnu de la table : ${nom}`);
  return { nom, q, u: u ?? def.u ?? (def.ml ? 'ml' : 'g'), r: def.r };
}

function macros(ings: Ing[], portions: number) {
  const lignes: LigneMacros[] = ings.map(i => {
    const m = ING[i.nom].m;
    return {
      quantite: i.q,
      unite: i.u,
      poidsUnites: POIDS_UNITES[i.nom] ?? null,
      coefficients: { cal: m[0], proteines: m[1], glucides: m[2], lipides: m[3] },
    };
  });
  const r = calculerMacros(lignes, portions);
  if (!r.ok) throw new Error(`Macros impossibles (${r.raison}) : ${r.detail}`);
  const plausible = verifierPlausibilite(r.macros);
  if (!plausible.ok) throw new Error(`Macros implausibles : ${plausible.detail}`);
  return { cal: r.macros.cal, p: r.macros.p, g: r.macros.g, l: r.macros.l };
}

function rec(
  titre: string, type: Rec['type'], o: {
    prep: number; cuisson?: number; difficulte?: 'facile' | 'moyen';
    saison?: Rec['saison']; cuisine: string; portions?: number; conservation?: number;
    ustensiles: string[]; instructions: string[]; ingredients: Ing[];
  }
): Rec {
  return {
    titre, type, prep: o.prep, cuisson: o.cuisson, difficulte: o.difficulte ?? 'facile',
    saison: o.saison ?? 'toutes', cuisine: o.cuisine, portions: o.portions ?? 2,
    conservation: o.conservation ?? 2, ustensiles: o.ustensiles,
    instructions: o.instructions, ingredients: o.ingredients,
  };
}

const CAT = ['Couteau de chef', 'Saladier'];
const POELE = [...CAT, 'Poêle', 'Planche à découper'];
const CASS = [...CAT, 'Casserole', 'Passoire'];
const WOK = [...CAT, 'Wok', 'Planche à découper'];
const FOUR = [...CAT, 'Four', 'Plat à four'];

// ═════════════════════════ GÉNÉRATION ═══════════════════════════════════════
const OUT: Rec[] = [];
const seen = new Set<string>();

function fusionnerDoublons(ings: Ing[]): Ing[] {
  const parNom = new Map<string, Ing>();
  for (const ing of ings) {
    const deja = parNom.get(ing.nom);
    if (!deja) { parNom.set(ing.nom, { ...ing }); continue; }
    if (deja.u === ing.u) deja.q = Math.round((deja.q + ing.q) * 100) / 100;
  }
  return [...parNom.values()];
}

function push(r: Rec) {
  if (seen.has(r.titre)) return;
  seen.add(r.titre);
  OUT.push({ ...r, ingredients: fusionnerDoublons(r.ingredients) });
}
function cap(n: number) { return OUT.length >= n; }

// ─── Familles world healthy — chaque famille génère ses recettes ────────────

// 1. BUDDHA BOWLS / GRAIN BOWLS (150) — céréale + protéine + légumes + sauce
const CEREALES_BOWL: [string, number, string][] = [
  ['Quinoa', 120, 'Rincez le quinoa sous l\u2019eau froide puis cuisez-le 12 min dans 2 volumes d\u2019eau salée : les petits germes doivent apparaître. Égouttez, éventez à la fourchette.'],
  ['Riz complet', 150, 'Cuisez le riz complet 25 min dans un grand volume d\u2019eau bouillante salée, égouttez et laissez reposer 5 min couvert : les grains finissent de gonfler.'],
  ['Boulgour', 130, 'Versez le boulgour dans un saladier, couvrez à hauteur d\u2019eau bouillante (2 doigts au-dessus), couvez 15 min : il absorbe l\u2019eau et reste croquant. Égrainez à la fourchette.'],
  ['Sarrasin', 130, 'Cuisez le sarrasin 15 min à frémissement dans 2 volumes d\u2019eau salée, égouttez et rincez vite à l\u2019eau froide pour stopper la cuisson.'],
  ['Millet', 130, 'Faites revenir le millet 2 min à sec pour torréfier ses arômes, ajoutez 2,5 volumes d\u2019eau salée, cuisez 18 min à couvert hors du feu 5 min.'],
  ['Orge perlé', 140, 'Cuisez l\u2019orge perlé 25 min dans un grand volume d\u2019eau salée, égouttez : il doit rester légèrement ferme, comme un risotto al dente.'],
  ['Épeautre', 140, 'Cuisez l\u2019épeautre 30 min à frémissement dans un volume d\u2019eau salée, égouttez et assaisonnez encore tiède : il absorbe mieux les sauces chaudes.'],
  ['Couscous complet', 110, 'Versez le couscous complet dans un saladier, ajoutez le même volume d\u2019eau bouillante avec une pointe d\u2019huile, couvez 8 min puis égrainez à la fourchette.'],
];
const PROTEINES_BOWL: { n: string; ing: () => Ing[]; pe: string }[] = [
  { n: 'tofu rôti', ing: () => [I('Tofu ferme', 300)], pe: 'Pressez le tofu 10 min dans du papier absorbant, coupez en cubes, rôtissez 12 min au four à 200 °C avec 1 cas de sauce soja et une pincée de paprika fumé. Retournez à mi-cuisson : chaque face doit être dorée et ferme.' },
  { n: 'pois chiches croustillants', ing: () => [I('Pois chiches (bte)', 400)], pe: 'Égouttez et séchez soigneusement les pois chiches (c\u2019est le secret du croustillant). Rôtissez 18 min à 200 °C avec 1 cas d\u2019huile et du cumin, secouez la plaque à mi-cuisson.' },
  { n: 'œuf mollet', ing: () => [I('Œuf', 4)], pe: 'Plongez les œufs 6 min dans l\u2019eau bouillante à la cuillère, stoppez sous l\u2019eau froide 2 min, écalez délicatement : le blanc est ferme, le jaune coulant.' },
  { n: 'saumon rôti', ing: () => [I('Pavé de saumon', 2)], pe: 'Salez, poivrez le saumon, rôtissez 12 min au four à 200 °C : la chair doit se détacher en copeaux épais. Arrosez de citron à la sortie du four.' },
  { n: 'crevettes poêlées', ing: () => [I('Crevettes', 300)], pe: 'Poêlez les crevettes 4 min à feu vif avec ail et gingembre : elles sont prêtes quand elles se recroquevillent en « C ». Ne les laissez pas plus, elles durciraient.' },
  { n: 'tempeh grillé', ing: () => [I('Tempeh', 250)], pe: 'Vapeur 8 min pour attendrir le tempeh, puis grill 3 min de chaque côté avec 1 cas de sauce soja et une pointe de miel : surface caramélisée, cœur moelleux.' },
  { n: 'edamame & avocat', ing: () => [I('Edamame (surg.)', 200), I('Avocat', 1)], pe: 'Cuisez les edamame 5 min à l\u2019eau salée bouillante, égouttez. Tranchez l\u2019avocat en lamelles juste avant de servir pour éviter l\u2019oxydation.' },
  { n: 'dinde marinée', ing: () => [I('Filet de dinde', 400)], pe: 'Marinez la dinde 10 min dans 2 cas de yaourt grec, 1 cac de curcuma et l\u2019ail, puis grillez 6 min à la poêle très chaude : marinade dorée, cœur juteux.' },
  { n: 'lentilles vertes tièdes', ing: () => [I('Lentilles vertes', 200)], pe: 'Cuisez les lentilles vertes 22 min dans trois fois leur volume d\u2019eau non salée avec une feuille de laurier, égouttez, assaisonnez tiède à l\u2019huile et au vinaigre.' },
  { n: 'thon & œuf dur', ing: () => [I('Thon au naturel', 200), I('Œuf', 2)], pe: 'Égouttez le thon, émiettez-le à la fourchette. Œufs 9 min pour un dur ferme, écalez, coupez en quartiers : deux textures de protéines dans le même bol.' },
];
const LEGUMES_BOWL: { n: string; ing: () => Ing[]; pe?: string }[] = [
  { n: 'betterave & carotte râpées', ing: () => [I('Betterave cuite', 2), I('Carotte', 2)], pe: 'Râpez grossièrement la betterave cuite et la carotte : les copeaux épais gardent du croquant et ne détremperont pas le bol.' },
  { n: 'brocoli vapeur', ing: () => [I('Brocoli', 300)], pe: 'Vapeur 7 min : le brocoli doit rester vert vif et offrir une légère résistance à la pointe du couteau. Plongez-le aussitôt dans l\u2019eau glacée pour figer la couleur.' },
  { n: 'courgettes grillées', ing: () => [I('Courgette', 2)], pe: 'Tranchez les courgettes en deux dans la longueur, gril 6 min de chaque côté avec un filet d\u2019huile : stries marquées, cœur fondant.' },
  { n: 'chou kale massé', ing: () => [I('Chou kale', 200)], pe: 'Retirez les côtes du kale, déchirez en morceaux, massesez 2 min à la main avec une pincée de sel et un filet d\u2019huile : le volume diminue d\u2019un tiers et l\u2019amertume s\u2019adoucit.' },
  { n: 'épinards & fenouil poêlés', ing: () => [I('Épinards frais', 200), I('Fenouil', 1)], pe: 'Suez le fenouil émincé 8 min à feu doux, ajoutez les épinards 2 min en fin de cuisson : ils doivent juste tomber, pas noircir.' },
  { n: 'tomates rôties', ing: () => [I('Tomates cerises', 300)], pe: 'Rôtissez les tomates cerises 15 min à 200 °C avec thym et filet d\u2019huile : elles doivent se fissurer et confiser légèrement.' },
  { n: 'concombre & radis croquants', ing: () => [I('Concombre', 1), I('Radis', 150)], pe: 'Tranchez concombre et radis en rondelles fines (2 mm) à la mandoline, salez 5 min puis égouttez : ils rendent l\u2019excès d\u2019eau et restent croquants.' },
  { n: 'chou-fleur rôti au curcuma', ing: () => [I('Chou-fleur', 400)], pe: 'Détaillez le chou-fleur en bouquets réguliers, rôtissez 20 min à 210 °C avec curcuma et huile : bords caramélisés, cœur tendre.' },
];
const SAUCES_BOWL: { n: string; ing: () => Ing[]; pe: string }[] = [
  { n: 'tahini-citron', ing: () => [I('Tahini', 40), I('Citron', 1)], pe: 'Détendez le tahini avec 3 cas d\u2019eau froide et le jus de citron en fouettant : la sauce doit devenir claire et napper la cuillère. Assaisonnez sel et ail en purée.' },
  { n: 'sauce soja-gingembre', ing: () => [I('Sauce soja', 30), I('Gingembre', 10)], pe: 'Mélangez sauce soja, gingembre râpé, 1 cas de vinaigre de riz et 1 cac d\u2019huile de sésame : dressing salé-acide typique des bowls japonais.' },
  { n: 'yaourt-herbes', ing: () => [I('Yaourt nature', 150), I('Menthe fraîche', 0.5)], pe: 'Mélangez yaourt, menthe et persil ciselés, 1 cas de jus de citron, sel : sauce fraîche qui équilibre les céréales chaudes.' },
  { n: 'vinaigrette miso-sésame', ing: () => [I('Miso', 1, 'cas'), I('Vinaigre de riz', 1, 'cas')], pe: 'Fouettez le miso avec le vinaigre de riz, 1 cac de miel et 2 cas d\u2019huile neutre : umami doux qui enrobe chaque grain sans alourdir.' },
  { n: 'harissa yaourt', ing: () => [I('Yaourt nature', 150), I('Harissa', 1, 'cac')], pe: 'Incorporez la harissa cuillère par cuillère au yaourt et goûtez au fur et à mesure : la chaleur doit arriver en fin de bouche, pas brûler.' },
  { n: 'citron vert-coriandre', ing: () => [I('Citron vert', 2), I('Coriandre fraîche', 0.5)], pe: 'Émulsionnez le jus de citron vert avec 2 cas d\u2019huile et la coriandre hachée : sauce vive typique des ceviches, à verser au dernier moment.' },
];

function buildBowls(n: number) {
  for (const [cerea, q, cPe] of CEREALES_BOWL) for (const p of PROTEINES_BOWL) for (const l of LEGUMES_BOWL) {
    if (cap(n)) return;
    const sauce = SAUCES_BOWL[(OUT.length + CEREALES_BOWL.findIndex(c => c[0] === cerea)) % SAUCES_BOWL.length];
    const ings = [I(cerea, q), ...p.ing(), ...l.ing(), ...sauce.ing(), I('Huile d\u2019olive', 15, 'ml')];
    macros(ings, 2); // validation anticipée : une recette refusée ne rentre pas
    push(rec(`Bowl ${cerea} au ${p.n}, ${l.n}`, 'dejeuner', {
      prep: 20, cuisson: 20, difficulte: 'facile', cuisine: 'World healthy', conservation: 2,
      ustensiles: [...CASS, 'Plaque à four', 'Poêle'],
      instructions: [
        cPe,
        `Préparez les légumes : ${l.pe}`,
        `Préparez la protéine : ${p.pe}`,
        `Préparez la sauce : ${sauce.pe}`,
        'Dans deux bols profonds, répartissez d\u2019abord la céréale chaude en couche régulière.',
        'Disposez les légumes d\u2019un côté, la protéine de l\u2019autre : les couleurs se lisent et la sauce ne détrempe rien avant de servir.',
        'Nappez de sauce au centre, parsemez de graines de sésame ou de herbes fraîches ciselées.',
        'Servez aussitôt : le bol se déguste tiède-froid, le contraste fait partie de l\u2019équilibre.',
      ],
      ingredients: ings,
    }));
  }
}

// 2. DHAL & CURRY VÉGÉ (130) — lentilles/pois chiches + lait de coco léger
const LEGUMES_DHAL: [string, number, number, string][] = [
  ['Lentilles corail', 200, 15, 'Rincez les lentilles corail jusqu\u2019à ce que l\u2019eau soit claire, cuisez 15 min dans trois fois leur volume d\u2019eau avec le curcuma : elles doivent s\u2019écraser à la cuillère.'],
  ['Pois cassés', 200, 30, 'Cuisez les pois cassés 30 min dans un grand volume d\u2019eau non salée, écumez : ils s\u2019écrasent naturellement en purée grossière.'],
  ['Lentilles blondes', 200, 25, 'Cuisez les lentilles blondes 25 min à frémissement avec le laurier, salez seulement en fin de cuisson : la peau reste intacte.'],
  ['Pois chiches (bte)', 500, 0, 'Égouttez les pois chiches — pour la version sèche, trempés 12 h puis cuits 1 h : la texture doit être fondante sans s\u2019effriter.'],
  ['Haricots noirs (bte)', 1, 0, 'Égouttez et rincez les haricots noirs : ils cuisent déjà, ils n\u2019ont besoin que de s\u2019imprégner de la sauce 10 min.'],
];
const EPICES_DHAL: { n: string; ing: () => Ing[] }[] = [
  { n: 'curcuma-cumin', ing: () => [I('Curcuma', 1, 'cac'), I('Cumin', 1, 'cac')] },
  { n: 'garam masala', ing: () => [I('Garam masala maison', 1, 'cas')] },
  { n: 'curry Madras doux', ing: () => [I('Curry Madras', 1, 'cas')] },
  { n: 'coriandre-chaat', ing: () => [I('Coriandre fraîche', 1), I('Paprika doux fumé', 1, 'cac')] },
  { n: 'cardamome-cannelle', ing: () => [I('Cardamome', 0.5, 'cac'), I('Cannelle', 1, 'pcs')] },
];
const LIQUIDES_DHAL: { n: string; ing: () => Ing[] }[] = [
  { n: 'lait de coco léger', ing: () => [I('Lait de coco léger', 300, 'ml')] },
  { n: 'tomate', ing: () => [I('Tomate concassée (bte)', 400)] },
  { n: 'bouillon épinards', ing: () => [I('Bouillon de légumes', 300, 'ml'), I('Épinards surgelés', 200)] },
];

function buildDhal(n: number) {
  for (const [leg, q, cuissonLeg, legPe] of LEGUMES_DHAL) for (const e of EPICES_DHAL) for (const lq of LIQUIDES_DHAL) {
    if (cap(n)) return;
    const ings = [...e.ing(), I('Oignon', 1), I('Ail', 2, 'pcs'), I('Gingembre', 10), ...lq.ing(), I(leg, q), I('Citron', 0.5)];
    macros(ings, 4);
    push(rec(`Dhal de ${leg.toLowerCase()} ${e.n}, ${lq.n}`, 'diner', {
      prep: 15, cuisson: Math.max(20, cuissonLeg + 5), difficulte: 'facile', cuisine: 'Indienne', conservation: 3, portions: 4,
      ustensiles: [...CASS, 'Casserole à fond épais'],
      instructions: [
        'Chauffez 1 cas d\u2019huile à feu moyen dans une casserole à fond épais, ajoutez l\u2019oignon émincé et faites suer 5 min sans coloration : il doit devenir translucide et sucré.',
        'Ajoutez l\u2019ail écrasé et le gingembre râpé, cuisez 1 min : les arômes doivent chanter sans brûler (le brûlé rend le dhal amer).',
        legPe,
        cuissonLeg > 0 ? `Versez les lentilles, couvrez d\u2019eau à trois doigts, ajoutez les épices et cuisez ${cuissonLeg} min à frémissement doux, en remuant de temps en temps : la préparation épaissit vite au fond.` : 'Ajoutez les légumineuses égouttées et 150 ml d\u2019eau, laissez mijoter 15 min pour qu\u2019elles s\u2019imprègnent des épices.',
        `Incorporez ${lq.n} et laissez 10 min à découvert : la consistance doit rester « à la cuillère », jamais sèche.`,
        'Salez en fin de cuisson, pressez le demi-citron par-dessus : l\u2019acidité réveille les épices.',
        'Ciselez la coriandre fraîche et parsemez à la sortie du feu.',
        'Servez avec du riz basmati ou un pain pita complet tiède.',
      ],
      ingredients: ings,
    }));
  }
}

// 3. STIR-FRIES / WOK (120) — protéine maigre + légumes croquants, sauce légère
const PROTEINES_WOK: { n: string; ing: () => Ing[]; pe: string }[] = [
  { n: 'poulet', ing: () => [I('Filet de poulet', 400)], pe: 'Tranchez le poulet en lanières fines (5 mm) CONTRE le grain : c\u2019est ce qui garantit la tendreté à feu vif. Saisissez 4 min, réservez.' },
  { n: 'tofu', ing: () => [I('Tofu ferme', 350)], pe: 'Séchez bien le tofu, coupez en cubes et poêlez 8 min sans remuer au début : une croûte dorée doit se former avant de retourner.' },
  { n: 'crevettes', ing: () => [I('Crevettes', 400)], pe: 'Saisissez les crevettes 2 min par face à feu très vif, réservez : elles finiront dans la sauce 1 min, pas plus.' },
  { n: 'seitan', ing: () => [I('Seitan', 300)], pe: 'Émiettez grossièrement le seitan, saisissez 5 min à sec pour torréfier, réservez : il prendra la sauce en fin de parcours.' },
  { n: 'tempeh', ing: () => [I('Tempeh', 280)], pe: 'Tranchez le tempeh fin, cuisez 6 min à la vapeur puis saisissez 3 min avec 1 cas de sauce soja : surface caramélisée.' },
  { n: 'truite', ing: () => [I('Filet de truite', 350)], pe: 'Coupez la truite en cubes de 3 cm, saisissez 3 min face peau dessous puis 1 min de l\u2019autre : le centre doit rester rosé.' },
];
const LEGUMES_WOK: { n: string; ing: () => Ing[]; pe?: string }[] = [
  { n: 'pak choï', ing: () => [I('Chou pak choï', 300)], pe: 'Séparez les feuilles du pak choï, lavez-les, émincez les côtes (qui cuisent plus longtemps) et gardez les feuilles entières : ajoutez-les 2 min après les côtes.' },
  { n: 'brocoli & carotte', ing: () => [I('Brocoli', 250), I('Carotte', 2)], pe: 'Blanchissez le brocoli 3 min, égouttez. Carottes en bâtonnets fins (3 mm) : les deux doivent rester croquants, le wok finit le travail.' },
  { n: 'poivrons & oignon rouge', ing: () => [I('Poivron rouge', 2), I('Oignon rouge', 1)], pe: 'Tranchez poivrons en lanières de 1 cm et oignon rouge en quartiers : saisissez 4 min à feu vif, ils doivent blanchir en surface mais rester fermes.' },
  { n: 'shii-takés & pousses de soja', ing: () => [I('Champignons shiitakés', 200), I('Pousses de soja', 150)], pe: 'Saisissez les shiitakés émincés 3 min à sec pour concentrer l\u2019umami, ajoutez les pousses de soja 1 min en fin de parcours.' },
  { n: 'courgette & fenouil', ing: () => [I('Courgette', 2), I('Fenouil', 1)], pe: 'Demi-rondelles de courgette (1 cm), fenouil émincé fin : suivez cet ordre — fenouil 3 min, courgette 4 min ensuite.' },
  { n: 'chou chinois', ing: () => [I('Chou chinois', 400)], pe: 'Émincez le chou chinois en lanières de 1 cm, sautez 4 min à feu vif : il doit rester croquant et légèrement doré aux bords.' },
];
const SAUCES_WOK: { n: string; ing: () => Ing[]; pe?: string }[] = [
  { n: 'gingembre-citronnelle', ing: () => [I('Gingembre', 15), I('Citronnelle', 1)], pe: 'Mélangez 2 cas de sauce soja, 1 cas de vinaigre de riz, gingembre râpé et citronnelle ciselée, 1 cac de miel.' },
  { n: 'sriracha légère', ing: () => [I('Sauce sriracha', 2, 'cac')], pe: 'Diluez la sriracha avec 3 cas d\u2019eau et 1 cas de sauce soja : la chaleur reste franche mais la sauce n\u2019enrobe pas de gras.' },
  { n: 'gochujang miel', ing: () => [I('Gochujang', 15)], pe: 'Délayez le gochujang avec 2 cas d\u2019eau, 1 cac de sésame et 1 cac de miel : sucré-salé piquant coréen.' },
  { n: 'curry vert thaï', ing: () => [I('Pâte de curry vert', 15), I('Lait de coco léger', 150, 'ml')], pe: 'Faites revenir la pâte de curry 1 min à sec puis versez le lait de coco léger : la sauce épaissit doucement, 5 min.' },
  { n: 'hoisin-sésame', ing: () => [I('Sauce hoisin', 20)], pe: 'Mélangez la hoisin avec 2 cas d\u2019eau chaude et 1 cac d\u2019huile de sésame : brillance et umami sans friture.' },
  { n: 'citron-herbes', ing: () => [I('Citron', 1), I('Basilic thaï', 0.5)], pe: 'Pressez le citron hors du feu, ajoutez le basilic thaï ciselé et 1 cas d\u2019huile d\u2019olive : fraîcheur qui contre la cuisson vive.' },
];

function buildWok(n: number) {
  for (const p of PROTEINES_WOK) for (const l of LEGUMES_WOK) for (const s of SAUCES_WOK) {
    if (cap(n)) return;
    const ings = [...p.ing(), ...l.ing(), ...s.ing(), I('Huile de sésame', 10, 'ml'), I('Ail', 2, 'pcs')];
    macros(ings, 3);
    push(rec(`Wok de ${l.n} au ${p.n}, ${s.n}`, 'diner', {
      prep: 15, cuisson: 10, difficulte: 'facile', cuisine: 'Asiatique', conservation: 2,
      ustensiles: WOK,
      instructions: [
        'Chauffez le wok à VIDE 2 min à feu vif : une goutte d\u2019eau doit perler puis s\u2019évaporer aussitôt. C\u2019est la condition d\u2019une vraie saisie, pas d\u2019un mijotage.',
        `Préparez tous les ingrédients AVANT de commencer : ${l.pe}`,
        `Préparez la protéine : ${p.pe}`,
        `Préparez la sauce : ${s.pe}`,
        'Versez 1 cas d\u2019huile, attendez 15 s qu\u2019elle ondule, puis saisissez la protéine selon sa préparation. Réservez au chaud dans une assiette.',
        'Sans nettoyer le wok, ajoutez 1 cas d\u2019huile, l\u2019ail émincé 30 s puis les légumes selon leur ordre de cuisson. Remuez sans arrêt avec une spatule large.',
        'Retournez la protéine dans le wok, versez la sauce autour (pas dessus) : elle caramélise au contact du métal chaud.',
        '2 min de plus, une cuillère de graines de sésame, et servez immédiatement : un stir-fry attendu refroidit et rend de l\u2019eau.',
      ],
      ingredients: ings,
    }));
  }
}

// 4. SALADES MONDE (120) — graines, tahini, feta, agrumes
const BASES_SALADE: { n: string; ing: () => Ing[] }[] = [
  { n: 'lentilles vertes', ing: () => [I('Lentilles vertes', 200)] },
  { n: 'quinoa', ing: () => [I('Quinoa', 150)] },
  { n: 'boulgour', ing: () => [I('Boulgour', 150)] },
  { n: 'pois chiches', ing: () => [I('Pois chiches (bte)', 400)] },
  { n: 'sarrasin', ing: () => [I('Sarrasin', 150)] },
  { n: 'haricots blancs', ing: () => [I('Haricots blancs (bte)', 400)] },
];
const ACOMPA_SALADE: { n: string; ing: () => Ing[]; pe?: string }[] = [
  { n: 'tomates & concombre', ing: () => [I('Tomate', 3), I('Concombre', 1)] },
  { n: 'endives & grenade', ing: () => [I('Endive', 2), I('Grenade', 1)] },
  { n: 'roquette & betterave', ing: () => [I('Roquette', 100), I('Betterave cuite', 2)] },
  { n: 'fenouil & orange', ing: () => [I('Fenouil', 1), I('Orange', 2)] },
  { n: 'épinards & radis', ing: () => [I('Épinards frais', 150), I('Radis', 150)] },
  { n: 'courgettes grillées & menthe', ing: () => [I('Courgette', 2), I('Menthe fraîche', 0.5)] },
  { n: 'kale & cranberries', ing: () => [I('Chou kale', 200), I('Raisins secs', 50)] },
  { n: 'chou rouge & carotte', ing: () => [I('Chou rouge', 300), I('Carotte', 2)] },
];
const DRESSINGS_SALADE: { n: string; ing: () => Ing[]; pe?: string }[] = [
  { n: 'vinaigrette tahini-citron', ing: () => [I('Tahini', 30), I('Citron', 1)] },
  { n: 'yaourt-menthe', ing: () => [I('Yaourt nature', 120), I('Menthe fraîche', 0.5)] },
  { n: 'balsamique-miel', ing: () => [I('Vinaigre balsamique', 30), I('Miel', 10)] },
  { n: 'citron vert-coriandre', ing: () => [I('Citron vert', 2), I('Coriandre fraîche', 0.5)] },
  { n: 'moutarde à l\u2019ancienne', ing: () => [I('Moutarde à l\u2019ancienne', 15)] },
  { n: 'zaatar-huile d\u2019olive', ing: () => [I('Zaatar', 10), I('Huile d\u2019olive', 30, 'ml')] },
];

function buildSalades(n: number) {
  for (const b of BASES_SALADE) for (const a of ACOMPA_SALADE) for (const d of DRESSINGS_SALADE) {
    if (cap(n)) return;
    const ings = [...b.ing(), ...a.ing(), ...d.ing(), I('Huile d\u2019olive', 20, 'ml')];
    macros(ings, 3);
    push(rec(`Salade de ${b.n} au ${a.n}, ${d.n}`, 'dejeuner', {
      prep: 15, cuisson: b.n.includes('pois') ? 0 : 18, difficulte: 'facile', cuisine: 'World healthy', conservation: 2,
      ustensiles: [...CAT, 'Casserole', 'Fouet'],
      instructions: [
        'Cuisez la base si nécessaire (quinoa 12 min, boulgour en absorption 15 min, lentilles 22 min) puis laissez TIÉDIR : une céréale chaude flétrit les légumes crus.',
        `Préparez les légumes : ${a.pe ?? 'Lavez, essorez et tranchez les légumes en bouchées régulières.'}`,
        `Préparez la vinaigrette : ${d.pe ?? 'Fouettez la vinaigrette dans un bol séparé jusqu\u2019à émulsion.'}`,
        'Dans un grand saladier, mélangez la base tiède avec les légumes : la chaleur ouvre les pores et absorbe mieux l\u2019assaisonnement.',
        'Versez la moitié de la vinaigrette, mélangez délicatement à deux spatules.',
        'Goûtez, ajoutez le reste par petites touches : mieux vaut assaisonner deux fois que noyer la salade.',
        'Parsemez de graines (sésame, courge) ou d\u2019herbes fraîches au moment de servir pour le croquant.',
      ],
      ingredients: ings,
    }));
  }
}

// 5. SOUPES DU MONDE (110) — miso, tom yum light, harira, minestrone, pho light
const SOUPES: { nom: string; cuisine: string; ings: () => Ing[]; steps: string[] }[] = [
  {
    nom: 'Soupe miso aux algues et tofu', cuisine: 'Japonaise',
    ings: () => [I('Miso', 30), I('Bouillon de légumes', 800, 'ml'), I('Tofu ferme', 200), I('Algue wakame séchée', 10), I('Oignon nouveau', 2, 'pcs'), I('Navet long (daikon)', 150, 'g')],
    steps: [
      'Réhydratez le wakame 5 min dans un bol d\u2019eau froide : il triple de volume. Égouttez, ciselez.',
      'Portez le bouillon à frémissement (jamais à gros bouillon : le miso perdrait ses arômes), ajoutez le daikon en demi-lunes fines, cuisez 8 min.',
      'Détendez le miso dans une louche de bouillon tiède en fouettant, puis reversez dans la casserole HORS DU FEU.',
      'Ajoutez le tofu en cubes de 1 cm et le wakame, laissez réchauffer 2 min sans bouillir.',
      'Ciselez l\u2019oignon nouveau, parsemez au dernier moment.',
      'Goûtez : le miso sale naturellement, n\u2019ajoutez du sel qu\u2019après avoir goûté.',
    ],
  },
  {
    nom: 'Harira légère aux lentilles', cuisine: 'Marocaine',
    ings: () => [I('Lentilles blondes', 150), I('Tomate concassée (bte)', 400), I('Bouillon de légumes', 800, 'ml'), I('Céleri branche', 2, 'pcs'), I('Coriandre fraîche', 1), I('Cannelle', 1, 'pcs'), I('Curcuma', 1, 'cac')],
    steps: [
      'Faites suer céleri et oignon 5 min dans 1 cas d\u2019huile, ajoutez épices et tomate, cuisez 5 min : la sauce doit foncer et épaissir.',
      'Ajoutez lentilles et bouillon, frémissez 25 min à couvert.',
      'Vérifiez la cuisson des lentilles : fondantes mais entières.',
      'Ciselez coriandre et persil, ajoutez hors du feu.',
      'Servez avec un quartier de citron : la harira se boit aussi qu\u2019elle ne se mange.',
    ],
  },
  {
    nom: 'Minestrone complet léger', cuisine: 'Italienne',
    ings: () => [I('Haricots blancs (bte)', 1), I('Tomate concassée (bte)', 400), I('Bouillon de légumes', 900, 'ml'), I('Courgette', 1), I('Carotte', 2), I('Pâtes complètes (penne)', 100), I('Parmesan 24 mois', 40)],
    steps: [
      'Suez oignon, carotte et céleri 8 min à feu doux : c\u2019est le soffritto, base de tout minestrone. Ne le faites pas colorer.',
      'Ajoutez tomate et bouillon, frémissez 15 min.',
      'Incorporez haricots égouttés et pâtes complètes, cuisez 10 min (al dente).',
      'Ajoutez la courgette en dés 5 min avant la fin : elle reste entière.',
      'Servez avec parmesan râpé et un filet d\u2019huile d\u2019olive cru.',
    ],
  },
  {
    nom: 'Tom yum légère aux crevettes', cuisine: 'Thaïlandaise',
    ings: () => [I('Crevettes', 300), I('Bouillon de légumes', 800, 'ml'), I('Citronnelle', 2, 'pcs'), I('Gingembre', 20), I('Champignons shiitakés', 200), I('Citron vert', 2), I('Sauce fish sauce', 1, 'cas'), I('Piment frais', 1)],
    steps: [
      'Faites infuser citronnelle écrasée, gingembre tranché et piment dans le bouillon frémissant 10 min à couvert : c\u2019est la base aromatique.',
      'Filtrez grossièrement (ou laissez : question de goût) et remettez sur feu doux.',
      'Ajoutez shiitakés émincés, cuisez 5 min.',
      'Pochez les crevettes 3 min : elles rosissent et se recroquevillent.',
      'Hors du feu, pressez le citron vert et ajoutez la sauce poisson : l\u2019acidité ne doit pas bouillir.',
      'Parsemez de coriandre fraîche et servez brûlant.',
    ],
  },
  {
    nom: 'Soupe de patate douce et gingembre', cuisine: 'Afrique de l\u2019Ouest',
    ings: () => [I('Patate douce', 600, 'g'), I('Bouillon de légumes', 700, 'ml'), I('Lait de coco léger', 200, 'ml'), I('Gingembre', 20), I('Cumin', 1, 'cac'), I('Arachide beurre', 2, 'cas')],
    steps: [
      'Faites revenir oignon et gingembre 5 min, ajoutez cumin, cuisez 30 s.',
      'Ajoutez patate douce en cubes et bouillon, frémissez 20 min : la lame d\u2019un couteau doit s\u2019enfoncer sans résistance.',
      'Hors du feu, incorporez le beurre de cacahuète (2 cas) en fouettant : il lie et donne le côté crémeux sans crème.',
      'Mixez au plongeur jusqu\u2019à consistance veloutée.',
      'Rechauffez doucement sans faire bouillir (le beurre de cacahuète accrocherait au fond).',
      'Servez avec une pointe de coriandre et des graines de courge torréfiées.',
    ],
  },
];

function buildSoupes(n: number) {
  for (const s of SOUPES) {
    const variantes: { n: string; extra: () => Ing[] }[] = [
      { n: 'classique', extra: () => [] },
      { n: 'aux herbes fraîches', extra: () => [I('Coriandre fraîche', 1)] },
      { n: 'au lait de coco léger', extra: () => [I('Lait de coco léger', 150, 'ml')] },
      { n: 'au citron vert', extra: () => [I('Citron vert', 1)] },
      { n: 'aux graines torréfiées', extra: () => [I('Graines de courge', 40)] },
      { n: 'au curcuma', extra: () => [I('Curcuma', 1, 'cac')] },
      { n: 'au gingembre frais', extra: () => [I('Gingembre', 15)] },
      { n: 'au piment doux', extra: () => [I('Piment doux', 1, 'cac')] },
      { n: 'aux épinards', extra: () => [I('Épinards surgelés', 150)] },
      { n: 'aux pois chiches', extra: () => [I('Pois chiches (bte)', 400)] },
      { n: 'au quinoa', extra: () => [I('Quinoa', 100)] },
      { n: 'au fenouil', extra: () => [I('Fenouil', 1)] },
    ];
    for (const v of variantes) {
      if (cap(n)) return;
      const ings = [...s.ings(), ...v.extra()];
      macros(ings, 4);
      push(rec(`${s.nom} ${v.n}`, 'diner', {
        prep: 15, cuisson: 25, difficulte: 'facile', cuisine: s.cuisine, conservation: 3, portions: 4,
        ustensiles: [...CASS, 'Mixeur plongeant'],
        instructions: [
          ...s.steps,
          `Variante « ${v.n} » : incorporez les ingrédients additionnels 5 min avant la fin de cuisson (ou parsemez au service pour les herbes et graines).`,
          'Ajustez la consistance avec un peu d\u2019eau ou de bouillon : une soupe se goûte toujours plus épaisse le lendemain.',
        ],
        ingredients: ings,
      }));
    }
  }
}

// 6. GRATINS & FOURS LÉGERS (100) — légumes rôtis, moins de fromage, herbes
function buildFour(n: number) {
  const LEG_FOUR: [string, number, string | undefined, string][] = [
    ['Courge butternut', 600, 'g', 'Épluchez et détaillez la butternut en cubes de 3 cm : régularité = cuisson homogène.'],
    ['Aubergine', 2, 'pcs', 'Coupez l\u2019aubergine en cubes, faites-la dégorger 10 min avec du sel, séchez : elle boira moins d\u2019huile.'],
    ['Chou-fleur', 1, 'pcs', 'Détaillez le chou-fleur en bouquets réguliers, rincez, séchez bien : l\u2019humidité empêche la caramélisation.'],
    ['Patate douce', 3, 'pcs', 'Lavez les patates douces (gardez la peau : fibres), coupez en quartiers épais.'],
    ['Carotte', 6, 'pcs', 'Épluchez et coupez les carottes en biseaux épais (1,5 cm) : les coins caramélisent, le cœur reste tendre.'],
    ['Brocoli', 500, 'g', 'Bouquets de brocoli séchés soigneusement : l\u2019eau génère de la vapeur, l\u2019ennemi du rôti.'],
    ['Grenailles', 600, 'g', 'Coupez les grenailles en deux, côté plat contre la plaque : c\u2019est lui qui croustille.'],
  ];
  const PROTS_FOUR: { n: string; ing: () => Ing[] }[] = [
    { n: 'pois chiches croustillants', ing: () => [I('Pois chiches (bte)', 400)] },
    { n: 'filets de dorade', ing: () => [I('Filet de dorade', 4)] },
    { n: 'cuisses de poulet sans peau', ing: () => [I('Cuisses de poulet sans peau', 4)] },
    { n: 'tofu mariné', ing: () => [I('Tofu ferme', 350)] },
    { n: 'haché de dinde', ing: () => [I('Haché de dinde 7 %', 400)] },
    { n: 'tempeh', ing: () => [I('Tempeh', 300)] },
  ];
  const MARINADES_FOUR: { n: string; ing: () => Ing[] }[] = [
    { n: 'citron-thym', ing: () => [I('Citron', 1), I('Thym', 1)] },
    { n: 'harissa-miel', ing: () => [I('Harissa', 2, 'cas'), I('Miel', 1, 'cas')] },
    { n: 'paprika fumé-ail', ing: () => [I('Paprika doux fumé', 1, 'cac'), I('Ail', 3, 'pcs')] },
    { n: 'zaatar-oignon rouge', ing: () => [I('Zaatar', 2, 'cas'), I('Oignon rouge', 1)] },
    { n: 'miso-sésame', ing: () => [I('Miso', 1, 'cas'), I('Graines de sésame', 15)] },
    { n: 'sumac-oignon', ing: () => [I('Sumac', 2, 'cas'), I('Oignon', 1)] },
  ];
  for (const [leg, q, u, legPe] of LEG_FOUR) for (const p of PROTS_FOUR) for (const m of MARINADES_FOUR) {
    if (cap(n)) return;
    const ings = [I(leg, q, u), ...p.ing(), ...m.ing(), I('Huile d\u2019olive', 20, 'ml')];
    macros(ings, 4);
    push(rec(`${leg.charAt(0).toUpperCase() + leg.slice(1)} rôtis au four, ${p.n}, ${m.n}`, 'diner', {
      prep: 15, cuisson: 30, difficulte: 'facile', cuisine: 'World healthy', conservation: 3, portions: 4,
      ustensiles: FOUR,
      instructions: [
        `Préparez le légume : ${legPe}`,
        `Préchauffez le four à 210 °C. Mélangez dans un saladier l\u2019huile, le sel et la marinade (${m.n}).`,
        `Enrobez le légume et la protéine (${p.n}) de cette marinade, disposez en UNE couche sur une plaque : superposition = cuisson à la vapeur, pas de rôtissage.`,
        'Enfournez 30 min, retournez à mi-cuisson. Les bords doivent brunir : c\u2019est la caramélisation qui donne le goût, pas le gras.',
        'Vérifiez la protéine : pois chiches doivent claquer sous la dent, poisson se détacher à la fourchette, poulet atteindre 74 °C à cœur.',
        'Laissez reposer 3 min hors du four avant de servir : les jus se redistribuent.',
        'Parsemez d\u2019herbes fraîches et servez avec un quartier de citron.',
      ],
      ingredients: ings,
    }));
  }
}

// 7. TACOS / BOWLS MEXICAINS (90) — haricots, maïs nixtamalisé, salsa verde
function buildMexicain(n: number) {
  const PROTS_MEX: { n: string; ing: () => Ing[]; pe: string }[] = [
    { n: 'haricots noirs épicés', ing: () => [I('Haricots noirs (bte)', 2)], pe: 'Suez oignon et ail 5 min, ajoutez haricots, cumin et paprika fumé, écrasez grossièrement à la fourchette avec un peu d\u2019eau de cuisson : texture de « refried » sans friture.' },
    { n: 'poulet effiloché', ing: () => [I('Filet de poulet', 400)], pe: 'Pochez le poulet 15 min dans un bouillon frémissant avec ail et laurier, effilochez à deux fourchettes, puis saisissez 3 min avec la salsa pour l\u2019enrober.' },
    { n: 'crevettes à la plancha', ing: () => [I('Crevettes', 400)], pe: 'Marinez 10 min dans le jus de citron vert et le cumin, saisissez 4 min à feu très vif : extérieur coloré, cœur juteux.' },
    { n: 'haché de dinde', ing: () => [I('Haché de dinde 7 %', 400)], pe: 'Saisissez le haché 6 min à feu vif en émiettant, ajoutez épices et 3 cas d\u2019eau : la viande doit être dorée, pas grise.' },
    { n: 'tofu brouillé', ing: () => [I('Tofu ferme', 350)], pe: 'Émiettez le tofu à la main (texture d\u2019œuf brouillé), saisissez 6 min avec curcuma et cumin : couleur dorée sans gras ajouté.' },
  ];
  const GARNITURES_MEX: { n: string; ing: () => Ing[]; pe?: string }[] = [
    { n: 'salsa verde', ing: () => [I('Salsa tomate-verde', 100), I('Coriandre fraîche', 0.5)] },
    { n: 'chou rouge croquant', ing: () => [I('Chou rouge', 200), I('Citron vert', 1)] },
    { n: 'avocat & radis', ing: () => [I('Avocat', 1), I('Radis', 100)] },
    { n: 'maïs doux & cheddar', ing: () => [I('Maïs doux (surg.)', 150), I('Cheddar', 2, 'tranche')] },
    { n: 'pico de gallo', ing: () => [I('Tomate', 3), I('Oignon rouge', 0.5), I('Coriandre fraîche', 0.5)] },
    { n: 'chayote sautée', ing: () => [I('Chayote', 2)] },
  ];
  for (const p of PROTS_MEX) for (const g of GARNITURES_MEX) for (const tort of ['Tortillas de maïs nixtamalisées', 'Tortilla de blé complète'] as const) {
    if (cap(n)) return;
    const ings = [...p.ing(), ...g.ing(), I(tort, 6), I('Citron vert', 2), I('Coriandre fraîche', 0.5)];
    macros(ings, 3);
    push(rec(`Tacos ${p.n}, ${g.n}`, 'diner', {
      prep: 20, cuisson: 15, difficulte: 'facile', cuisine: 'Mexicaine', conservation: 2, portions: 3,
      ustensiles: POELE,
      instructions: [
        `Préparez la protéine : ${p.pe}`,
        `Préparez la garniture : ${g.pe ?? 'Lavez, égouttez et tranchez finement les éléments de la garniture.'}`,
        'Réchauffez les tortillas 30 s par face à sec dans une poêle très chaude (ou 20 s au micro-ondes empilées dans un torchon humide) : elles deviennent souples et parfumées.',
        'Garnissez chaque tortilla de 2 cas de protéine, ajoutez la garniture par-dessus.',
        'Pressez un quartier de citron vert par-dessus : l\u2019acidité est OBLIGATOIRE, c\u2019est elle qui assemble les saveurs mexicaines.',
        'Parsemez de coriandre fraîche et servez immédiatement, à la main.',
      ],
      ingredients: ings,
    }));
  }
}

// 8. POKE & CEVICHE (80) — poisson cru mariné, agrumes, avocat
function buildPoke(n: number) {
  const POISSONS_POKE: { n: string; ing: () => Ing[] }[] = [
    { n: 'saumon', ing: () => [I('Pavé de saumon', 300, 'g')] },
    { n: 'tilapia (ceviche)', ing: () => [I('Filet de tilapia', 400)] },
    { n: 'dorade (ceviche)', ing: () => [I('Filet de dorade', 400)] },
    { n: 'maquereau mariné', ing: () => [I('Maquereau', 300)] },
    { n: 'crevettes (poêlées)', ing: () => [I('Crevettes', 350)] },
  ];
  const BASES_POKE: { n: string; ing: () => Ing[] }[] = [
    { n: 'riz jasmin', ing: () => [I('Riz jasmin', 200)] },
    { n: 'quinoa', ing: () => [I('Quinoa', 150)] },
    { n: 'cauliflower rice', ing: () => [I('Chou-fleur', 400)] },
    { n: 'riz complet', ing: () => [I('Riz complet', 200)] },
  ];
  const TOPPINGS_POKE: { n: string; ing: () => Ing[]; pe?: string }[] = [
    { n: 'edamame & avocat', ing: () => [I('Edamame (surg.)', 150), I('Avocat', 1)] },
    { n: 'concombre & radis', ing: () => [I('Concombre', 1), I('Radis', 100)] },
    { n: 'mangue & oignon rouge', ing: () => [I('Mangue', 1), I('Oignon rouge', 0.5)] },
    { n: 'carotte & chou rouge', ing: () => [I('Carotte', 2), I('Chou rouge', 150)] },
    { n: 'algues & sésame', ing: () => [I('Algue wakame séchée', 10), I('Graines de sésame', 15)] },
  ];
  for (const p of POISSONS_POKE) for (const b of BASES_POKE) for (const t of TOPPINGS_POKE) {
    if (cap(n)) return;
    const ings = [...p.ing(), ...b.ing(), ...t.ing(), I('Sauce soja', 2, 'cas'), I('Citron vert', 2), I('Huile de sésame', 10, 'ml'), I('Gingembre', 10)];
    macros(ings, 2);
    const estCeviche = p.n.includes('ceviche');
    push(rec(`Poke bowl ${p.n}, ${b.n}, ${t.n}`, 'dejeuner', {
      prep: 25, cuisson: estCeviche ? 0 : 15, difficulte: 'moyen', cuisine: estCeviche ? 'Péruvienne' : 'Hawaïenne', conservation: 1,
      ustensiles: [...CAT, estCeviche ? 'Saladier' : 'Casserole'],
      instructions: [
        estCeviche
          ? 'CONGÉLEZ le poisson 24 h au préalable (règle sanitaire pour le cru), puis décongelez au réfrigérateur. Coupez en cubes de 1,5 cm.'
          : 'Coupez le poisson très frais en cubes réguliers de 1,5 cm, gardez-le au réfrigérateur jusqu\u2019au dressage.',
        `Préparez la base : ${b.n === 'cauliflower rice' ? 'Râpez le chou-fleur à la grosse râpe, poêlez 5 min à sec : il devient « riz » sans amidon.' : `Cuisez le ${b.n} selon les indications, puis laissez tiédir à découvert (un bol tiède réchauffe le poisson).`}`,
        `Préparez les toppings : ${t.pe ?? 'Tranchez finement tous les éléments et réservez-les séparément pour le dressage.'}`,
        'Marinez le poisson 10 min max dans sauce soja, jus de citron vert, gingembre râpé et huile de sésame : au-delà, l\u2019acidité « cuirait » la surface.',
        'Dressez : base au fond, poisson égoutté au centre, toppings autour par zones de couleur.',
        'Parsemez de graines de sésame et de coriandre, servez aussitôt avec un quartier de citron vert.',
      ],
      ingredients: ings,
    }));
  }
}

// 9. DÉJEUNERS EXPRESS (90) — wraps, tartines, œufs, yaourts garnis
function buildDejeuners(n: number) {
  const WRAPS_D: { n: string; ing: () => Ing[] }[] = [
    { n: 'houmous-légumes grillés', ing: () => [I('Pois chiches (bte)', 200), I('Tahini', 30), I('Courgette', 1)] },
    { n: 'dinde-avocat', ing: () => [I('Jambon de dinde', 4), I('Avocat', 1)] },
    { n: 'thon-yaourt-herbes', ing: () => [I('Thon au naturel', 150), I('Yaourt nature', 100), I('Ciboulette', 0.5)] },
    { n: 'falafel-tahini', ing: () => [I('Pois chiches secs', 150), I('Persil', 1), I('Tahini', 30)] },
    { n: 'ricotta-épinards', ing: () => [I('Ricotta légère', 150), I('Épinards surgelés', 150)] },
    { n: 'œuf dur-moutarde', ing: () => [I('Œuf', 3), I('Moutarde à l\u2019ancienne', 15)] },
  ];
  const BREADS_D: [string, number][] = [
    ['Pain pita complet', 2],
    ['Tortilla de blé complète', 2],
    ['Pain de seigle', 4],
  ];
  const CRUNCH_D: { n: string; ing: () => Ing[]; pe?: string }[] = [
    { n: 'roquette & concombre', ing: () => [I('Roquette en sachet', 50), I('Concombre', 0.5)] },
    { n: 'carotte râpée & radis', ing: () => [I('Carotte', 2), I('Radis', 80)] },
    { n: 'tomates cerises & menthe', ing: () => [I('Tomates cerises', 150), I('Menthe fraîche', 0.3)] },
    { n: 'chou rouge & citron', ing: () => [I('Chou rouge', 150), I('Citron', 0.5)] },
  ];
  for (const w of WRAPS_D) for (const [bread, nb] of BREADS_D) for (const c of CRUNCH_D) {
    if (cap(n)) return;
    const ings = [...w.ing(), I(bread, nb), ...c.ing(), I('Huile d\u2019olive', 10, 'ml')];
    macros(ings, 2);
    push(rec(`${bread} ${w.n}, ${c.n}`, 'dejeuner', {
      prep: 12, cuisson: 0, difficulte: 'facile', cuisine: 'World healthy', conservation: 1,
      ustensiles: CAT,
      instructions: [
        'Préparez la garniture principale : égouttez les éléments humides (thon, légumes grillés) — un wrap détrempé est un wrap raté.',
        w.n.includes('houmous') || w.n.includes('falafel')
          ? 'Mixez pois chiches, tahini, ail, jus de citron et un filet d\u2019eau : la texture doit être tartinable, pas liquide.'
          : 'Mélangez la garniture dans un bol, assaisonnez sel, poivre et une pointe de citron.',
        'Tartinez la base (pain pita ouvert, tortilla ou tranches de seigle) sur toute la surface : le lien humidifie chaque bouchée.',
        `Répartissez le croquant : ${c.pe ?? 'Disposez les légumes croquants en couche régulière.'}`,
        'Roulez serré (pour les wraps) ou assemblez en sandwich, puis coupez en biais : la garniture reste en place et la présentation est nette.',
        'Emballage à emporter : papier cuisson + un tour de ficelle, la garniture ne bouge pas.',
      ],
      ingredients: ings,
    }));
  }
}

// 10. DESSERTS SAINS (60) — fruits, chia, yaourt, peu de sucre ajouté
function buildDesserts(n: number) {
  const FRUITS_D: { n: string; ing: () => Ing[]; pe?: string }[] = [
    { n: 'mangue', ing: () => [I('Mangue', 2)] },
    { n: 'fruits rouges', ing: () => [I('Fraise', 200), I('Myrtilles', 150)] },
    { n: 'pomme-cannelle', ing: () => [I('Pomme', 3), I('Cannelle', 1, 'cac')] },
    { n: 'papaye-citron vert', ing: () => [I('Papaye', 1), I('Citron vert', 1)] },
    { n: 'grenade-orange', ing: () => [I('Grenade', 1), I('Orange', 2)] },
    { n: 'ananas-menthe', ing: () => [I('Ananas frais', 1), I('Menthe fraîche', 0.5)] },
  ];
  const CREMES_D: { n: string; ing: () => Ing[] }[] = [
    { n: 'yaourt grec', ing: () => [I('Yaourt grec 0 %', 300, 'g')] },
    { n: 'skyr', ing: () => [I('Skyr', 300)] },
    { n: 'pudding de chia au lait de coco léger', ing: () => [I('Chia graines', 50), I('Lait de coco léger', 300, 'ml')] },
    { n: 'fromage blanc vanillé', ing: () => [I('Fromage blanc', 300)] },
    { n: 'tofu soyeux cacao', ing: () => [I('Tofu ferme', 300), I('Cacao non sucré', 30)] },
  ];
  const TOPS_D: { n: string; ing: () => Ing[] }[] = [
    { n: 'amandes effilées', ing: () => [I('Amandes', 40)] },
    { n: 'graines de courge', ing: () => [I('Graines de courge', 40)] },
    { n: 'noix de coco râpée', ing: () => [I('Coco râpée non sucrée', 30)] },
    { n: 'miel & citron', ing: () => [I('Miel', 30), I('Citron', 0.5)] },
    { n: 'pistaches concassées', ing: () => [I('Pistaches non salées', 40)] },
  ];
  for (const f of FRUITS_D) for (const cr of CREMES_D) for (const t of TOPS_D) {
    if (cap(n)) return;
    const ings = [...f.ing(), ...cr.ing(), ...t.ing()];
    macros(ings, 4);
    const estPudding = cr.n.includes('chia');
    push(rec(`Coupe ${f.n}, ${cr.n}, ${t.n}`, 'dessert', {
      prep: estPudding ? 10 : 8, cuisson: 0, difficulte: 'facile', cuisine: 'World healthy', conservation: estPudding ? 3 : 1, portions: 4,
      ustensiles: estPudding ? [...CAT, 'Fouet', 'Bocaux'] : CAT,
      instructions: [
        estPudding
          ? 'La veille : fouettez les graines de chia avec le lait de coco léger et un peu de vanille. Laissez gonfler 4 h minimum au réfrigérateur (le mélange triple d\u2019épaisseur).'
          : 'Préparez la base crémeuse : fouettez-la 30 s pour la détendre, ajoutez une pointe de vanille ou de zeste de citron.',
        `Préparez les fruits : ${f.pe ?? 'Coupez les fruits en dés réguliers, arrosez-les de citron pour éviter l\u2019oxydation.'}`,
        'Dressez en verrines transparentes : une couche crémeuse, une couche de fruits — les strates font le plaisir des yeux.',
        `Parsemez le topping (${t.n}) AU DERNIER MOMENT : il doit rester croquant.`,
        estPudding
          ? 'Conservez au frais jusqu\u2019à 3 jours : le pudding de chia est même meilleur le lendemain.'
          : 'Dégustez aussitôt : une coupe de fruits attendue rend de l\u2019eau.',
      ],
      ingredients: ings,
    }));
  }
}

// 11. CORÉE (60) — bibimbap, kimchi, grillades maigres marinées
function buildCoreen(n: number) {
  const PROTS_K: { n: string; ing: () => Ing[]; pe: string }[] = [
    { n: 'boeuf mariné', ing: () => [I('Bœuf maigre (filet)', 400)], pe: 'Tranchez le bœuf très fin (3 mm, 20 min au congélateur facilitent le geste). Marinez 20 min dans sauce soja, miel, ail, gingembre et poire émincée. Saisissez 2 min à feu très vif : le bulgogi doit rester rosé au centre.' },
    { n: 'tofu poêlé', ing: () => [I('Tofu ferme', 350)], pe: 'Tranchez le tofu en pavés de 1,5 cm, séchez-les bien, poêlez 4 min par face jusqu’à croûte dorée, puis napez de sauce gochujang diluée hors du feu.' },
    { n: 'poulet mariné', ing: () => [I('Filet de poulet', 400)], pe: 'Marinez les lanières de poulet 20 min dans gochujang dilué, miel et ail. Grillez 5 min à feu vif : surface caramélisée, cœur cuit à 74 °C.' },
    { n: 'œufs (bibimbap)', ing: () => [I('Œuf', 4)], pe: 'Faites glisser un œuf au plat par bol au dernier moment : le jaune coulant est la « sauce » du bibimbap, on mélange tout ensemble.' },
  ];
  const LEG_K: { n: string; ing: () => Ing[]; pe: string }[] = [
    { n: 'épinards blanchis', ing: () => [I('Épinards frais', 200)], pe: 'Blanchissez 30 s dans l’eau bouillante, pressez fort pour extraire l’eau, assaisonnez sauce soja et huile de sésame : le namul doit être bien serré, jamais détrempé.' },
    { n: 'carottes sautées', ing: () => [I('Carotte', 2)], pe: 'Julienne de carottes sautée 3 min à feu vif : croquantes, légèrement dorées, assaisonnées sel + huile de sésame.' },
    { n: 'courgettes sautées', ing: () => [I('Courgette', 1)], pe: 'Demi-lunes de courgette sautées 4 min : elles doivent rester fermes, colorées sur une face.' },
    { n: 'champignons shiitakés', ing: () => [I('Champignons shiitakés', 150)], pe: 'Lamelles de shiitakés poêlées 5 min avec une pointe de sauce soja : umami concentré.' },
    { n: 'kimchi poêlé', ing: () => [I('Kimchi (bte)', 1)], pe: 'Kimchi ciselé et poêlé 4 min : l’acidité se concentre, le piment s’adoucit. Parfait pour les bols.' },
  ];
  const SAUCES_K: { n: string; ing: () => Ing[]; pe: string }[] = [
    { n: 'gochujang-sésame', ing: () => [I('Pâte de gochujang', 1, 'cas')], pe: 'Délayez le gochujang avec 2 cas d’eau, 1 cac de sésame grillé et 1 cac de miel : la sauce doit napper, pas noyer.' },
    { n: 'soja-ail-gingembre', ing: () => [I('Sauce soja', 2, 'cas')], pe: 'Mélangez sauce soja, ail râpé, gingembre râpé, 1 cac d’huile de sésame et 1 cas de poire émincée : la marinade bulgogi classique.' },
  ];
  for (const p of PROTS_K) for (const l of LEG_K) for (const s of SAUCES_K) {
    if (cap(n)) return;
    const ings = [I('Riz complet', 200), ...p.ing(), ...l.ing(), ...s.ing(), I('Huile de sésame', 10, 'ml'), I('Graines de sésame', 10)];
    macros(ings, 2);
    push(rec(`Bibimbap ${p.n}, ${l.n}, ${s.n}`, 'diner', {
      prep: 25, cuisson: 15, difficulte: 'moyen', cuisine: 'Coréenne', conservation: 2,
      ustensiles: [...POELE, 'Casserole'],
      instructions: [
        'Cuisez le riz complet 25 min, il doit rester grain à grain : c’est la base du bibimbap, jamais une bouillie.',
        `Préparez le légume namul : ${l.pe}`,
        `Préparez la protéine : ${p.pe}`,
        `Préparez la sauce : ${s.pe}`,
        'Dressez chaque bol : riz au centre, légumes et protéine disposés en rayons de couleur alternée — le bibimbap se juge d’abord aux yeux.',
        'Versez la sauce au centre, ajoutez les graines de sésame.',
        'Le convective mélange TOUT à la cuillère juste avant de manger : « bibimbap » signifie littéralement « riz mélangé ».',
      ],
      ingredients: ings,
    }));
  }
}

// 12. ÉTHIOPIE COMPLÈTE (48) — atakelt, kik alicha, gomen, fasolia, shiro, wots sur injera
function buildEthiopien(n: number) {
  const PLATS_ET: { n: string; ing: () => Ing[]; pe: string[]; parts: number; cuisson: number }[] = [
    { n: 'atakelt wot (chou, pomme de terre, carotte)', ing: () => [I('Chou blanc', 500), I('Pomme de terre', 400), I('Carotte', 2), I('Oignon', 2), I('Gingembre', 15), I('Curcuma', 1, 'cac'), I('Huile d’olive', 30, 'ml')], parts: 4, cuisson: 30, pe: [
      'Faites fondre les oignons émincés 15 min à feu doux SANS eau ni gras — c’est la base de presque tous les wots : ils doivent réduire de moitié et devenir confits.',
      'Ajoutez gingembre râpé et curcuma, 1 min à sec : l’épice doit fleurer, pas accrocher.',
      'Incorporez chou émincé, pommes de terre et carottes en gros cubes, 200 ml d’eau, couvez : 30 min à feu doux.',
      'Le plat doit être FONDANT mais pas en bouillie — les légumes gardent leur forme, baignés d’une sauce courte dorée.',
      'Salez en fin de cuisson, poivrez généreusement. Servez tiède sur injera : c’est le plat du jeûne orthodoxe, végétal par tradition.',
    ] },
    { n: 'kik alicha (pois cassés au curcuma)', ing: () => [I('Pois cassés', 300), I('Oignon', 2), I('Gingembre', 15), I('Curcuma', 1, 'cas'), I('Huile d’olive', 30, 'ml')], parts: 4, cuisson: 40, pe: [
      'Rincez les pois cassés jusqu’à eau claire, cuisez 30 min dans 3 volumes d’eau non salée : ils doivent s’écraser à la cuillère.',
      'Pendant ce temps, fondre les oignons 15 min à sec (technique éthiopienne), puis gingembre et curcuma.',
      'Versez les pois cuits avec un peu de leur eau dans la base dorée : le kik alicha doit être CRÉMEUX et jaune soleil, jamais sec.',
      'Mijotez 10 min à découvert pour lier, salez en fin.',
      'Le curcuma domine mais ne brûle pas : c’est la version douce du répertoire, opposée au misir wot rouge pimenté.',
    ] },
    { n: 'gomen (chou kale éthiopien)', ing: () => [I('Chou kale', 500), I('Oignon', 2), I('Ail', 4, 'pcs'), I('Gingembre', 15), I('Huile d’olive', 30, 'ml'), I('Citron', 1)], parts: 4, cuisson: 25, pe: [
      'Émincez le kale finement (lanières de 5 mm) après avoir retiré les côtes dures : en Éthiopie on le cisele presque comme une herbe.',
      'Faites fondre oignon 10 min, ajoutez ail et gingembre hachés, 2 min.',
      'Ajoutez le kale par brassées — il réduit énormément — avec 100 ml d’eau, couvez 20 min à feu doux.',
      'Le gomen doit rester VERT foncé et moelleux, avec du mordant : jamais olive et pâteux.',
      'Jus de citron hors du feu, salez. Servez chaud ou tiède : c’est l’accompagnement roi du plateau injera.',
    ] },
    { n: 'fasolia (haricots verts & carottes)', ing: () => [I('Haricots verts', 400), I('Carotte', 3), I('Oignon', 1), I('Tomate concassée (bte)', 200), I('Ail', 2, 'pcs'), I('Curcuma', 0.5, 'cac'), I('Huile d’olive', 20, 'ml')], parts: 4, cuisson: 20, pe: [
      'Saisissez oignon et ail 5 min, ajoutez carottes en julienne : 5 min encore.',
      'Haricots verts effilés et coupés en deux, tomate, curcuma, couvez 15 min : les légumes doivent rester CROQUANTS-tendres.',
      'Découvrez les 3 dernières minutes pour évaporer : la fasolia est sèche, pas en sauce.',
      'Salez, poivrez. Servez tiède : sa fraîcheur équilibre les wots épicés autour d’elle sur le plateau.',
    ] },
    { n: 'butichi (pois chiches à la tomate)', ing: () => [I('Pois chiches (bte)', 800), I('Tomate', 4), I('Oignon', 1), I('Gingembre', 10), I('Paprika doux fumé', 1, 'cac'), I('Huile d’olive', 20, 'ml'), I('Citron', 1)], parts: 4, cuisson: 15, pe: [
      'Faites fondre l’oignon 8 min, ajoutez gingembre et paprika 1 min.',
      'Tomates en dés, 8 min de cuisson jusqu’à obtenir une sauce confite.',
      'Pois chiches égouttés, 8 min : ils doivent s’imprégner sans s’écraser.',
      'Le butichi se sert TIÈDE ou froid — parfait en repas du midi, servi avec salade timatim et injera.',
    ] },
    { n: 'shiro wat crémeux (farine de pois chiches)', ing: () => [I('Farine de pois chiches', 180), I('Oignon', 2), I('Tomate concassée (bte)', 200), I('Ail', 3, 'pcs'), I('Berbere', 1, 'cas'), I('Huile d’olive', 30, 'ml')], parts: 4, cuisson: 20, pe: [
      'Délayez la farine de pois chiches dans 500 ml d’eau froide LISSE : le shiro rate si la farine s’agglutine.',
      'Faites fondre oignon, ail, tomate et berbere 10 min : la base doit être sombre et parfumée.',
      'Versez le mélange délayé en fouettant sur feu doux : en 8 min le shiro épaissit en velours — il doit napper la cuillère en couche épaisse.',
      'Salez, filet d’huile d’olive à cru. Le shiro est LE plat réconfort éthiopien : rapide, bon marché, profond.',
      'Servez brûlant sur injera frais — il s’y absorbe comme une crème.',
    ] },
  ];
  const EXTRA_ET: { n: string; ing: () => Ing[] }[] = [
    { n: 'salade timatim', ing: () => [I('Tomate', 3), I('Oignon', 0.5), I('Piment frais', 0.5), I('Citron', 1)] },
    { n: 'yaourt berbere frais', ing: () => [I('Yaourt nature', 200), I('Berbere', 0.5, 'cac')] },
    { n: 'avocat & citron', ing: () => [I('Avocat', 1), I('Citron', 0.5)] },
    { n: 'pois chiches croustillants', ing: () => [I('Pois chiches (bte)', 200)] },
    { n: 'tomates fraîches & sésame', ing: () => [I('Tomate', 2), I('Graines de sésame', 1, 'cas')] },
    { n: 'riz complet nature', ing: () => [I('Riz complet', 200)] },
  ];
  for (const p of PLATS_ET) for (const e of EXTRA_ET) {
    if (cap(n)) return;
    const ings = [...p.ing(), ...e.ing()];
    macros(ings, p.parts);
    push(rec(`${p.n.charAt(0).toUpperCase() + p.n.slice(1)}, ${e.n}`, 'diner', {
      prep: 20, cuisson: p.cuisson, difficulte: 'facile', cuisine: 'Éthiopienne', conservation: 3, portions: 4,
      ustensiles: [...CASS, 'Poêle à fond épais'],
      instructions: [
        ...p.pe,
        `Accompagnez de ${e.n} : sur un plateau éthiopien, chaque wot a son contrepoint frais ou croquant.`,
        'Mangez avec l’injera en guise de couvert — ou du riz complet si vous n’en trouvez pas.',
      ],
      ingredients: ings,
    }));
  }
  // Wots sur injera : 4 protéines × 4 services (24) — complément de la famille
  const WOTS: { n: string; ing: () => Ing[] }[] = [
    { n: 'misir wot de lentilles corail', ing: () => [I('Lentilles corail', 250), I('Oignon', 2), I('Tomate concassée (bte)', 200), I('Berbere', 2, 'cas')] },
    { n: 'wot de lentilles vertes', ing: () => [I('Lentilles vertes', 250), I('Oignon', 2), I('Berbere', 1.5, 'cas')] },
    { n: 'wot de haricots blancs (foul)', ing: () => [I('Haricots blancs (bte)', 2, 'boite'), I('Oignon', 2), I('Tomate concassée (bte)', 200), I('Berbere', 1, 'cas')] },
    { n: 'wot de pois chiches', ing: () => [I('Pois chiches (bte)', 800), I('Oignon', 2), I('Berbere', 1.5, 'cas')] },
  ];
  const SERVICES: { n: string; ing: () => Ing[] }[] = [
    { n: 'injera & tomates fraîches', ing: () => [I('Injera', 4, 'pcs'), I('Tomate', 2)] },
    { n: 'injera & avocat', ing: () => [I('Injera', 4, 'pcs'), I('Avocat', 1)] },
    { n: 'riz complet & gomen express', ing: () => [I('Riz complet', 250), I('Chou kale', 200)] },
    { n: 'injera & yaourt citronné', ing: () => [I('Injera', 4, 'pcs'), I('Yaourt nature', 150), I('Citron', 0.5)] },
  ];
  for (const w of WOTS) for (const s of SERVICES) {
    if (cap(n)) return;
    const ings = [...w.ing(), I('Gingembre', 10), I('Ail', 2, 'pcs'), I('Huile d’olive', 30, 'ml'), ...s.ing()];
    macros(ings, 4);
    push(rec(`Wot ${w.n}, ${s.n}`, 'diner', {
      prep: 15, cuisson: 30, difficulte: 'facile', cuisine: 'Éthiopienne', conservation: 3, portions: 4,
      ustensiles: [...CASS, 'Poêle à fond épais'],
      instructions: [
        'Faites fondre les oignons 15 min à feu doux sans eau ni gras : la caramélisation à sec est la signature des wots.',
        'Ajoutez ail, gingembre et berbere, 2 min à sec pour torréfier l’épice sans la brûler.',
        'Incorporez la légumineuse et 300 ml d’eau, mijotez 25 min à couvert : la sauce doit épaissir et foncer.',
        'Salez en fin de cuisson, laissez reposer 5 min hors du feu : le wot se tient alors sur l’injera.',
        `Servez avec ${s.n} — le repas éthiopien se partage depuis un plateau commun, chaque convive déchirant son morceau d’injera.`,
      ],
      ingredients: ings,
    }));
  }
}

// 12bis. JAPON COMPLET (48) — soba, nasu dengaku, teriyaki léger, sunomono, donburi
function buildJaponais(n: number) {
  const PLATS_J: { n: string; ing: () => Ing[]; pe: string[]; parts: number; cuisson: number; type: Rec['type'] }[] = [
    { n: 'nouilles soba au bouillon chaud', ing: () => [I('Nouilles soba', 300), I('Bouillon de légumes', 900, 'ml'), I('Sauce soja', 2, 'cas'), I('Mirin', 2, 'cas'), I('Gingembre', 10), I('Oignon nouveau', 3, 'pcs'), I('Épinards frais', 150)], parts: 4, cuisson: 12, type: 'dejeuner', pe: [
      'Faites frémir le bouillon avec soja, mirin et gingembre râpé 5 min : la base doit être salée-sucrée-umami, pas forte.',
      'Cuisez les soba 4 min AL DENTE (elles continuent de gonfler dans le bouillon), rincez à l’eau froide en frottant : c’est ce qui enlève l’amidon et donne leur fermeté.',
      'Pochez les épinards 30 s dans le bouillon, retirez-les.',
      'Réchauffez les nouilles 20 s dans le bouillon, servez dans de grands bols avec oignons nouveaux ciselés.',
      'Au Japon, on slurpe les soba brûlants : le bruit aère les nouilles et en exhale l’arôme de sarrasin.',
    ] },
    { n: 'aubergines glazées au miso (nasu dengaku)', ing: () => [I('Aubergine', 3), I('Miso', 2, 'cas'), I('Mirin', 2, 'cas'), I('Miel', 1, 'cas'), I('Graines de sésame', 1, 'cas'), I('Huile d’olive', 20, 'ml')], parts: 4, cuisson: 20, type: 'diner', pe: [
      'Coupez les aubergines en deux dans la longueur, entaillez la chair en croisillons SANS percer la peau, huilez.',
      'Rôtissez 18 min à 220 °C côté chair vers le haut : la chair doit devenir dorée et fondante.',
      'Mélangez miso, mirin et miel : la glaze doit être épaisse comme une pâte à tartiner.',
      'Étalez sur la chair chaude, grattez 3 min sous le gril — la glaze bouillonne et caramélise, NE BRÛLEZ PAS : le miso grillé devient amer.',
      'Sésame torréfié à cru dessus. Servez chaud, une demi-aubergine par personne avec du riz : le dengaku est un plat de fête.',
    ] },
    { n: 'poulet teriyaki léger', ing: () => [I('Filet de poulet', 500), I('Sauce soja', 3, 'cas'), I('Mirin', 3, 'cas'), I('Miel', 1, 'cas'), I('Gingembre', 10), I('Riz complet', 250), I('Brocoli', 300)], parts: 4, cuisson: 15, type: 'diner', pe: [
      'Saisissez les filets côté peau 7 min à feu moyen SANS gras : la peau rend sa propre graisse et devient croustillante.',
      'Retournez, 5 min. Réservez le poulet, essuyez l’excès de gras.',
      'Versez soja, mirin et miel dans la poêle chaude : réduisez 2 min jusqu’à consistance sirop qui nappe la cuillère — c’est LA sauce teriyaki, sans fécule ni sucre ajouté.',
      'Enrobez le poulet dans la glaze hors du feu : il laque en refroidissant.',
      'Tranchez, servez sur riz complet avec brocoli vapeur, sauce restante par-dessus.',
    ] },
    { n: 'salade de concombre sunomono', ing: () => [I('Concombre', 2), I('Vinaigre de riz', 3, 'cas'), I('Miel', 1, 'cas'), I('Sauce soja', 1, 'cac'), I('Graines de sésame', 1, 'cas'), I('Gingembre', 5)], parts: 4, cuisson: 0, type: 'dejeuner', pe: [
      'Tranchez le concombre EN FINES rondelles (2 mm à la mandoline), salez 10 min, pressez : il devient translucide et croquant.',
      'Dissolvez miel dans le vinaigre de riz avec soja et gingembre râpé : le sunomono-su doit être acidulé-doux, pas vinaigré.',
      'Mélangez au dernier moment, sésame dessus.',
      'Servez très frais en entrée : le sunomono « nettoie » le palais entre deux plats plus riches.',
    ] },
    { n: 'tofu grillé à la japonaise', ing: () => [I('Tofu ferme', 400), I('Sauce soja', 2, 'cas'), I('Mirin', 1, 'cas'), I('Gingembre', 10), I('Huile de sésame', 1, 'cas'), I('Chou pak choï', 300), I('Riz complet', 200)], parts: 4, cuisson: 12, type: 'diner', pe: [
      'Pressez le tofu 15 min entre deux planches : moins d’eau = meilleure saisie.',
      'Tranchez en 8 pavés, séchez-les, poêlez 5 min par face dans l’huile de sésame : croûte dorée obligatoire.',
      'Pak choï coupé en deux, saisi 3 min face coupée dans la même poêle.',
      'Glaze soja-mirin-gingembre versée en fin : elle réduit en 1 min et enrobe tout.',
      'Riz complet à côté, graines de sésame sur le tofu.',
    ] },
    { n: 'soupe miso aux champignons & wakame', ing: () => [I('Bouillon de légumes', 900, 'ml'), I('Miso', 2, 'cas'), I('Champignons shiitakés', 150), I('Algue wakame séchée', 8), I('Tofu ferme', 200), I('Oignon nouveau', 2, 'pcs')], parts: 4, cuisson: 12, type: 'dejeuner', pe: [
      'Faites frémir le bouillon avec les shiitakés émincés 8 min : ils libèrent leur umami boisé.',
      'Réhydratez le wakame 5 min dans un bol d’eau — il triple de volume, une petite poignée suffit.',
      'Hors du feu (PAS au-delà de 80 °C : les ferments du miso meurent bouillants), délayez le miso dans une louche de bouillon puis reversez.',
      'Cubes de tofu et wakame égoutté, 1 min pour réchauffer.',
      'Oignons nouveaux ciselés au fond des bols, soupe versée dessus : la soupe miso se boit à même le bol au petit-déjeuner au Japon.',
    ] },
  ];
  const EXTRA_J: { n: string; ing: () => Ing[] }[] = [
    { n: 'riz à sushi nature', ing: () => [I('Riz à sushi', 300), I('Vinaigre de riz', 2, 'cas')] },
    { n: 'edamame fleur de sel', ing: () => [I('Edamame (surg.)', 250)] },
    { n: 'concombre vinaigré', ing: () => [I('Concombre', 1), I('Vinaigre de riz', 1, 'cas')] },
    { n: 'feuille de nori croustillante', ing: () => [I('Feuille de nori', 2, 'pcs'), I('Sauce soja', 1, 'cac')] },
  ];
  for (const p of PLATS_J) for (const e of EXTRA_J) {
    if (cap(n)) return;
    const ings = [...p.ing(), ...e.ing()];
    macros(ings, p.parts);
    push(rec(`${p.n.charAt(0).toUpperCase() + p.n.slice(1)}, ${e.n}`, p.type, {
      prep: 20, cuisson: p.cuisson, difficulte: 'facile', cuisine: 'Japonaise', conservation: 2, portions: p.parts,
      ustensiles: p.cuisson > 0 ? [...POELE, 'Casserole'] : [...CAT, 'Passoire'],
      instructions: [
        ...p.pe,
        `Accompagnez de ${e.n} : un repas japonais compose toujours riz + soupe + pickles autour du plat principal.`,
        'Sauce soja et vinaigre de riz se dosent petit : la subtilité est la règle.',
      ],
      ingredients: ings,
    }));
  }
  // Donburi : 6 protéines × 4 garnitures (24)
  const PROT_J: { n: string; ing: () => Ing[]; pe: string }[] = [
    { n: 'saumon laqué', ing: () => [I('Pavé de saumon', 400, 'g'), I('Sauce soja', 2, 'cas'), I('Mirin', 2, 'cas'), I('Miel', 1, 'cas')], pe: 'Saisissez les pavés 3 min face peau, retournez 2 min, glaze versée en fin : elle laque en refroidissant. Vérifiez 55 °C à cœur : le saumon reste rosé, fondant.' },
    { n: 'poulet yakitori au four', ing: () => [I('Filet de poulet', 400), I('Sauce soja', 2, 'cas'), I('Mirin', 2, 'cas'), I('Miel', 1, 'cas'), I('Oignon nouveau', 2, 'pcs')], pe: 'Cubes de poulet enfilés sur piques (alternez avec l’oignon nouveau), glaze au pinceau, four gril 12 min en re-glazant à mi-cuisson : caramélisation tachetée.' },
    { n: 'bœuf sauté au gingembre', ing: () => [I('Filet de bœuf', 350), I('Gingembre', 20), I('Sauce soja', 2, 'cas'), I('Mirin', 1, 'cas')], pe: 'Tranches très fines sautées 90 s à feu max avec gingembre : elles doivent rester rosées — la poêle doit crépiter, sinon le bœuf bouit.' },
    { n: 'tofu croustillant à la sauce sésame', ing: () => [I('Tofu ferme', 350), I('Huile de sésame', 1, 'cas'), I('Graines de sésame', 2, 'cas'), I('Sauce soja', 2, 'cas')], pe: 'Cubes séchés poêlés 8 min sans y toucher : la croûte se forme seule. Sésame torréfié à sec pilé grossièrement + soja : sauce à verser au dressage.' },
    { n: 'tempeh glazé yuzu-soja', ing: () => [I('Tempeh', 280), I('Sauce soja', 2, 'cas'), I('Mirin', 1, 'cas'), I('Citron', 1)], pe: 'Tranches vapeur 6 min (elles s’ouvrent et absorbent la glaze), puis saisies 3 min par face avec la glaze soja-mirin-citron : caramélisées, acidulées.' },
    { n: 'œufs marinés ajitsuke', ing: () => [I('Œuf', 6), I('Sauce soja', 3, 'cas'), I('Mirin', 3, 'cas'), I('Vinaigre de riz', 1, 'cas')], pe: 'Œufs 6 min 30 (jaune coulant), choc glacé, écalage délicat, marinade 2 h minimum au frigo dans soja-mirin : le blanc prend teinte ambre, le jaune devient confit.' },
  ];
  const GARN_J: { n: string; ing: () => Ing[] }[] = [
    { n: 'riz & oignons nouveaux', ing: () => [I('Riz à sushi', 300), I('Oignon nouveau', 3, 'pcs')] },
    { n: 'riz & edamame', ing: () => [I('Riz à sushi', 300), I('Edamame (surg.)', 200)] },
    { n: 'riz & carottes kinpira', ing: () => [I('Riz à sushi', 300), I('Carotte', 2), I('Sauce soja', 1, 'cas')] },
    { n: 'riz & épinards sésame', ing: () => [I('Riz à sushi', 300), I('Épinards frais', 150), I('Graines de sésame', 1, 'cas')] },
  ];
  for (const pr of PROT_J) for (const g of GARN_J) {
    if (cap(n)) return;
    const ings = [...pr.ing(), ...g.ing()];
    macros(ings, 4);
    push(rec(`Donburi ${pr.n}, ${g.n}`, 'diner', {
      prep: 20, cuisson: 15, difficulte: 'facile', cuisine: 'Japonaise', conservation: 2, portions: 4,
      ustensiles: [...POELE, 'Casserole'],
      instructions: [
        'Cuisez le riz à sushi 15 min dans son volume d’eau, laissez reposer 10 min couvert HORS du feu : c’est le repos qui le rend brillant et collant juste comme il faut.',
        `Préparez la protéine : ${pr.pe}`,
        'Préparez la garniture : légumes sautés 4 min à feu vif (kinpira : julienne sautée soja-légèrement sucrée) ou blanchie selon le cas.',
        'Dressez le bol : riz en dôme, protéine posée dessus, garniture en éventail, un peu de la glaze de cuisson versée sur le riz.',
        'Graines de sésame à cru. Le donburi est un plat unique : tout se mélange à la cuillère au fur et à mesure.',
      ],
      ingredients: ings,
    }));
  }
}

// 13. TURQUIE (40) — köfte de lentilles, pilaf à l’épeautre, yaourt-menthe
function buildTurc(n: number) {
  const PLATS_T: { n: string; ing: () => Ing[]; pe: string[] }[] = [
    { n: 'köfte de lentilles', ing: () => [I('Lentilles corail', 200), I('Boulgour', 100), I('Oignon', 2), I('Cumin en poudre', 1, 'cas'), I('Paprika doux fumé', 1, 'cas'), I('Coriandre fraîche', 1)], pe: [
      'Cuisez les lentilles corail 12 min dans 2 volumes d’eau, égouttez en RESERVANT l’eau de cuisson.',
      'Versez le boulgour sur les lentilles chaudes égouttées, couvez 15 min : il gonfle dans la vapeur sans être cuit.',
      'Faites revenir l’oignon émincé 8 min avec cumin et paprika, mélangez au boulgour-lentilles.',
      'Façonnez des petites boules oblongues à la main humide : la pâte doit tenir sans œuf (l’amidon lie).',
      'Servez tiède sur des feuilles de salade, citron par-dessus.',
    ] },
    { n: 'pilaf d’épeautre', ing: () => [I('Épeautre', 250), I('Oignon', 1), I('Bouillon de légumes', 500, 'ml'), I('Tomates cerises', 200), I('Aneth frais', 1)], pe: [
      'Faites suer l’oignon 5 min, ajoutez l’épeautre, enrobez 2 min (comme un risotto).',
      'Versez le bouillon chaud à hauteur, cuisez 25 min à couvert à petit feu : le grain doit éclater légèrement.',
      'Incorporez les tomates cerises coupées en deux 5 min avant la fin.',
      'Reposez 10 min hors du feu couvert : le pilaf finit d’absorber.',
      'Égrainez à la fourchette avec l’aneth ciselé.',
    ] },
    { n: 'yaourt-menthe (çalıcalı)', ing: () => [I('Yaourt turque', 400), I('Concombre', 2), I('Menthe séchée', 2, 'cac'), I('Ail', 1, 'pcs'), I('Huile d’olive', 20, 'ml')], pe: [
      'Fouettez le yaourt turque avec l’ail écrasé et 2 cas d’eau glacée : il doit devenir coulant comme une crème.',
      'Ajoutez le concombre en petits dés, la menthe séchée émiettée, sel.',
      'Faites chauffer l’huile d’olive 30 s hors de coloration et versez-la PAR-DESSUS : la menthe craque et libère ses arômes (service à la turque).',
      'Réfrigérez 30 min : le çalıcalı se sert très frais.',
    ] },
    { n: 'poireaux à l’huile d’olive', ing: () => [I('Poireau', 3), I('Carotte', 2), I('Riz complet', 80), I('Huile d’olive', 40, 'ml'), I('Citron', 1)], pe: [
      'Émincez les poireaux en biseaux, lavez-les bien (le sable se cache entre les feuilles).',
      'Faites-les fondre 10 min avec les carottes en rondelles et l’huile d’olive : c’est un « zeytinyağlı », cuisinier à l’huile d’olive tiède, jamais brûlante.',
      'Ajoutez le riz et 150 ml d’eau, cuisez 20 min à couvert à feu très doux.',
      'Laissez tiédir : ce plat se mange tiède-froid, arrosé de citron au moment de servir.',
    ] },
  ];
  const EXTRA_T: { n: string; ing: () => Ing[] }[] = [
    { n: 'feta & tomates', ing: () => [I('Feta', 100), I('Tomate', 3)] },
    { n: 'œufs durs & olives', ing: () => [I('Œuf', 3), I('Olives noires', 60)] },
    { n: 'persil & sumac', ing: () => [I('Persil', 1), I('Sumac', 1, 'cas')] },
    { n: 'grenades & noisettes', ing: () => [I('Grenade', 1), I('Noisettes', 40)] },
  ];
  for (const p of PLATS_T) for (const e of EXTRA_T) {
    if (cap(n)) return;
    const ings = [...p.ing(), ...e.ing()];
    macros(ings, 4);
    push(rec(`${p.n.charAt(0).toUpperCase() + p.n.slice(1)}, ${e.n}`, 'diner', {
      prep: 20, cuisson: 25, difficulte: 'facile', cuisine: 'Turque', conservation: 3, portions: 4,
      ustensiles: [...POELE, 'Casserole'],
      instructions: [
        ...p.pe,
        `Accompagnez : disposez ${e.n} à côté ou par-dessus selon le plat — à la table turque, chaque assiette reçoit sa touche fraîche au dernier moment.`,
        'Servez avec du pain complet ou du boulgour si le plat ne contient pas déjà de céréale.',
      ],
      ingredients: ings,
    }));
  }
}

// 14. LIBAN (60) — mezzés, taboulé, falafels, chich taouk, kibbeh
function buildLibanais(n: number) {
  const PLATS_L: { n: string; ing: () => Ing[]; pe: string[]; parts: number }[] = [
    { n: 'taboulé libanais', ing: () => [I('Persil', 3), I('Boulgour', 100), I('Tomate', 4), I('Citron', 2), I('Menthe fraîche', 1), I('Huile d’olive', 40, 'ml')], parts: 4, pe: [
      'Lavez et SÉCHEZ parfaitement le persil, puis ciselez-le très finement au couteau : au Liban, le taboulé est plus vert de persil que de boulgour (ratio 3:1).',
      'Cuisez le boulgour fin 5 min à l’étouffée avec un peu d’eau, égrainez à la fourchette, laissez tiédir.',
      'Dés de tomates épépinées (les pépins rendent de l’eau), menthe ciselée.',
      'Assaisonnez au dernier moment : jus de citron, sel, huile d’olive — le taboulé assaisonné à l’avance flétrit.',
      'Servez frais avec des feuilles de laitue ou du pain pita : on le mange à la cuillère ou roulé.',
    ] },
    { n: 'houmous crémeux', ing: () => [I('Pois chiches (bte)', 800), I('Tahini', 60), I('Citron', 2), I('Ail', 2, 'pcs'), I('Cumin', 1, 'cac'), I('Huile d’olive', 30, 'ml')], parts: 6, pe: [
      'Mixez pois chiches, tahini, jus de citron, ail et cumin 2 min PLEINE PUISSANCE : le secret du houmous crémeux est un long mixage, pas des pois chiches entiers.',
      'Détendez avec 4-6 cas d’eau glacée jusqu’à la consistance d’une crème légère — il s’épaissit au frais.',
      'Salez, goûtez : l’équilibre tahini-citron doit être à égalité.',
      'Étalez dans une assiette creuse, creusez un puits, remplissez d’huile d’olive, parsemez de paprika et de pois chiches entiers.',
      'Servez à température ambiante avec du pain pita : sortez-le du frigo 20 min avant.',
    ] },
    { n: 'falafels au four', ing: () => [I('Pois chiches secs', 300), I('Persil', 2), I('Coriandre fraîche', 1), I('Oignon', 1), I('Ail', 3, 'pcs'), I('Cumin', 2, 'cac'), I('Levure chimique', 1, 'cac')], parts: 6, pe: [
      'TREMPEZ les pois chiches secs 12 h (jamais cuits : c’est le secret de la texture légère).',
      'Mixez avec herbes, oignon, ail et épices : la pâte doit être granuleuse, pas une purée — sinon les falafels deviennent denses.',
      'Ajoutez la levure chimique, réfrigérez la pâte 30 min : elle se tient mieux au façonnage.',
      'Façonnez des boulettes de 3 cm, posez-les sur plaque huilée, huilez le dessus.',
      'Four 210 °C, 25 min en retournant à mi-cuisson : croûte dorée sans friture.',
      'Servez avec sauce tahini-citron et crudités.',
    ] },
    { n: 'chich taouk', ing: () => [I('Filet de poulet', 600), I('Yaourt grec', 150), I('Citron', 2), I('Ail', 4, 'pcs'), I('Paprika doux fumé', 2, 'cac'), I('Origan', 1, 'cac'), I('Huile d’olive', 20, 'ml')], parts: 4, pe: [
      'Marinez les cubes de poulet 2 h minimum (jusqu’à une nuit) dans yaourt, citron, ail, paprika et origan : le yaourt attendrit la viande.',
      'Enfilez sur des piques en accordéon (serrez les cubes : ils restent juteux).',
      'Grillez 10-12 min en tournant régulièrement : surface dorée tachetée de brûlé léger, cœur à 74 °C.',
      'Laissez reposer 3 min sous une feuille de papier alu.',
      'Servez avec sauce à l’ail (toum léger) ou labneh, pain pita chaud.',
    ] },
    { n: 'kibbeh de lentilles', ing: () => [I('Lentilles blondes', 200), I('Boulgour gros calibre', 100), I('Oignon', 2), I('Cumin', 1, 'cac'), I('Paprika doux fumé', 1, 'cac'), I('Menthe fraîche', 0.5)], parts: 4, pe: [
      'Cuisez les lentilles 20 min, ajoutez le boulgour hors du feu, couvez 15 min : il gonfle dans la vapeur.',
      'Faites revenir les oignons émincés jusqu’à coloration dorée, mélangez au lentilles-boulgour avec épices.',
      'Mixez grossièrement (quelques morceaux doivent rester) et laissez tiédir : la pâte doit se façonnner.',
      'Formez des galettes ovales de 2 cm, dorez-les 4 min par face à la poêle avec 2 cas d’huile d’olive.',
      'Servez tiède avec yaourt-menthe.',
    ] },
    { n: 'mjedra (riz aux lentilles)', ing: () => [I('Riz basmati', 250), I('Lentilles blondes', 200), I('Oignon', 2), I('Cumin', 1, 'cac'), I('Huile d’olive', 30, 'ml')], parts: 4, pe: [
      'Cuisez les lentilles 20 min à frémissement (elles doivent rester entières), égouttez.',
      'Cuisez le riz basmati séparément : chaque grain doit rester distinct.',
      'Émincez finement les oignons et faites-les CARAMELISER 15 min à feu doux dans l’huile d’olive : ils doivent être confits, presque sucrés — c’est l’âme du mjedra.',
      'Mélangez riz, lentilles, moitié des oignons caramélisés, cumin, sel.',
      'Servez tiède ou froid, le reste des oignons posé en couronne dessus. Yaourt-menthe à côté : association sacrée au Liban.',
    ] },
    { n: 'baba ganoush au four', ing: () => [I('Aubergine', 3), I('Tahini', 50), I('Citron', 2), I('Ail', 2, 'pcs'), I('Persil', 1), I('Huile d’olive', 20, 'ml')], parts: 6, pe: [
      'Piquez les aubergines et faites-les GRILLER entières 40 min à 220 °C : la peau doit noircir et la chair s’effondrer — ce fumet ne s’obtient pas en cubes.',
      'Laissez tiédir, pelez, égouttez la chair 10 min dans une passoire (elle rend beaucoup d’eau).',
      'Écrasez à la fourchette (jamais au mixeur : la texture doit rester rustique), mélangez tahini, citron, ail, sel.',
      'Étalez dans une assiette creuse, puits d’huile d’olive, persil ciselé, grenadilles ou pignons torréfiés.',
      'Servez tiède avec du pain pita grillé.',
    ] },
    { n: 'fattouch', ing: () => [I('Pain pita complet', 2), I('Tomate', 3), I('Concombre', 1), I('Roquette', 100), I('Radis', 100), I('Citron', 2), I('Sumac', 2, 'cac'), I('Huile d’olive', 40, 'ml')], parts: 4, pe: [
      'Grillez le pain pita 3 min de chaque face à sec, cassez-le en morceaux : le fattouch se caractérise par son pain croustillant (pas frit).',
      'Coupez tomates, concombre et radis en petits dés, lavez et essorez la roquette.',
      'Fouettez vinaigrette : citron, sumac, ail écrasé, huile d’olive. Le sumac apporte l’acidité fruitée signature.',
      'Mélangez le tout AU DERNIER MOMENT : le pain doit croustiller sous la dent.',
      'Parsemez de menthe séchée et servez aussitôt.',
    ] },
  ];
  const EXTRA_L: { n: string; ing: () => Ing[] }[] = [
    { n: 'labneh & huile d’olive', ing: () => [I('Labneh', 250), I('Olives noires', 50), I('Huile d’olive', 20, 'ml')] },
    { n: 'feta & tomates', ing: () => [I('Feta', 100), I('Tomate', 3)] },
    { n: 'œufs durs & olives', ing: () => [I('Œuf', 3), I('Olives noires', 60)] },
    { n: 'grenades & menthe', ing: () => [I('Grenade', 1), I('Menthe fraîche', 0.5)] },
    { n: 'radis & sel fleur de sel', ing: () => [I('Radis', 200), I('Huile d’olive', 10, 'ml')] },
    { n: 'concombres au citron', ing: () => [I('Concombre', 1), I('Citron', 1)] },
  ];
  for (const p of PLATS_L) for (const e of EXTRA_L) {
    if (cap(n)) return;
    const ings = [...p.ing(), ...e.ing()];
    macros(ings, p.parts);
    push(rec(`${p.n.charAt(0).toUpperCase() + p.n.slice(1)}, ${e.n}`, p.n.includes('taboulé') || p.n.includes('fattouch') || p.n.includes('houmous') ? 'dejeuner' : 'diner', {
      prep: 20, cuisson: p.n.includes('chich taouk') ? 12 : p.n.includes('falafels') ? 25 : p.n.includes('kibbeh') ? 10 : 5, difficulte: 'facile', cuisine: 'Libanaise', conservation: 2,
      ustensiles: [...POELE, 'Casserole'],
      instructions: [
        ...p.pe,
        `Accompagnez de ${e.n} : le mezze libanais se compose toujours d’au moins 3 assiettes — c’est le partage qui fait le repas.`,
        'Pain pita chaud à côté : il remplace la fourchette.',
      ],
      ingredients: ings,
    }));
  }
}

// 15. GRÈCE (60) — salade grecque, moussaka légère, gyros, tzatziki, spanakopita
function buildGrec(n: number) {
  const PLATS_G: { n: string; ing: () => Ing[]; pe: string[]; parts: number; cuisson: number }[] = [
    { n: 'salade grecque horiatiki', ing: () => [I('Tomate', 4), I('Concombre', 1), I('Poivron rouge', 1), I('Oignon rouge', 0.5), I('Feta', 150), I('Olives Kalamata', 80), I('Origan', 2, 'cac'), I('Huile d’olive', 40, 'ml')], parts: 4, cuisson: 0, pe: [
      'Coupez tomates en quartiers GROS, concombre en demi-rondelles épaisses, poivron en lanières : l’horiatiki (« paysanne ») refuse la finesse, on morde chaque légume.',
      'Disposez en couches dans un plat : légumes, puis olives, puis la plaque de feta ENTIÈRE posée dessus (jamais émiettée à l’avance).',
      'Arrosez généreusement d’huile d’olive, saupoudrez d’origan séché — c’est l’assaisonnement entier, pas de vinaigrette.',
      'Une pincée de sel sur la feta uniquement : les légumes en rendent déjà.',
      'Servez à température ambiante avec du pain pour saucer le jus mêlé d’huile.',
    ] },
    { n: 'tzatziki au yaourt grec', ing: () => [I('Yaourt grec', 500), I('Concombre', 2), I('Ail', 3, 'pcs'), I('Aneth frais', 1), I('Citron', 1), I('Huile d’olive', 20, 'ml')], parts: 6, cuisson: 0, pe: [
      'Râpez le concombre GROSSEMENT, salez, laissez dégorger 10 min puis pressez FORTEMENT à la main : c’est l’étape qui empêche le tzatziki de rendre de l’eau.',
      'Mélangez yaourt grec, concombre pressé, ail râpé, aneth ciselé, jus de citron.',
      'Laissez reposer 1 h au frais : les saveurs se marient.',
      'Filet d’huile d’olive et une olive kalamata au centre au service.',
    ] },
    { n: 'gyros de dinde au four', ing: () => [I('Filet de dinde', 600), I('Yaourt grec', 100), I('Citron', 2), I('Ail', 4, 'pcs'), I('Origan', 2, 'cac'), I('Paprika doux fumé', 1, 'cac'), I('Pain pita complet', 4), I('Tomate', 3)], parts: 4, cuisson: 25, pe: [
      'Marinez les fines tranches de dinde 1 h dans yaourt, citron, ail, origan et paprika.',
      'Empilez les tranches sur une grille posée sur une plaque (comme une broche verticale would), four 220 °C, 25 min : les bords caramélisent.',
      'Laissez reposer 5 min puis coupez en fines lamelles.',
      'Garnissez les pitas tièdes : dinde, tomates en dés, tzatziki, oignon rouge émincé.',
      'Roulez dans du papier cuisson : les gyros se mangent à la main, debout, comme à Athènes.',
    ] },
    { n: 'moussaka légère de légumes', ing: () => [I('Aubergine', 3), I('Courgette', 2), I('Pois chiches (bte)', 400), I('Tomate concassée (bte)', 400), I('Oignon', 1), I('Cannelle', 1, 'pcs'), I('Origan', 1, 'cas'), I('Yaourt grec', 300), I('Œuf', 2), I('Parmesan', 40)], parts: 6, cuisson: 45, pe: [
      'Tranchez aubergines et courgettes dans la longueur (1 cm), faites-les RÔTIR 20 min à 210 °C avec un filet d’huile : elles doivent dorer, pas frire.',
      'Préparez la sauce : oignon sué, tomate, cannelle et origan, 15 min de mijotage. Incorporez les pois chiches écrasés (remplace la viande).',
      'Montage en couches : aubergines, sauce, courgettes, sauce, et en topping yaourt battu à l’œuf + parmesan (béchamel allégée).',
      'Four 190 °C, 45 min : le dessus doit dorer comme une béchamel classique.',
      'Reposez 15 min avant de couper : la moussaka se sert TIÈDE, jamais bouillante.',
    ] },
    { n: 'spanakopita aux épinards', ing: () => [I('Épinards frais', 500), I('Feta', 150), I('Oignon nouveau', 4, 'pcs'), I('Aneth frais', 1), I('Œuf', 3), I('Pâte filo', 8), I('Huile d’olive', 40, 'ml')], parts: 6, cuisson: 30, pe: [
      'Faites tomber les épinards 5 min, pressez-les TRÈS fort : l’excès d’eau détrempent la pâte filo.',
      'Mélangez épinards hachés, feta émiettée, oignons nouveaux ciselés, aneth, œufs.',
      'Huilez chaque feuille de filo au pinceau et empilez-en 4 au fond du plat, garniture, puis 4 feuilles pliées dessus, huilées.',
      'Scorez les losanges AU COUTEAU avant cuisson (jamais après : ça casse).',
      'Four 190 °C, 30 min : la filo doit sonner creux et doré.',
      'Laissez tiédir 10 min, servez en losanges tiède ou froid (parfait en pique-nique).',
    ] },
    { n: 'gemista (tomates farcies au riz)', ing: () => [I('Tomate', 6), I('Riz basmati', 200), I('Oignon', 1), I('Ail', 2, 'pcs'), I('Aneth frais', 1), I('Origan', 1, 'cas'), I('Huile d’olive', 40, 'ml')], parts: 6, cuisson: 50, pe: [
      'Coupez un chapeau à chaque tomate, videz-les à la cuillère en gardant la chair (pas les pépins).',
      'Faites suer oignon et ail, ajoutez le riz cru, la chair de tomate hachée, herbes : le riz doit nacrér 2 min.',
      'Farcissez les tomates aux 3/4 seulement (le riz gonfle), posez les chapeaux, arrosez d’huile.',
      'Four 180 °C, 50 min dans un plat avec 1 cm d’eau : les tomates doivent confire sans se rompre.',
      'Servez TIÈDE, jamais chaud : les gemista se dégustent à température ambiante, avec de la feta.',
    ] },
    { n: 'fasolada (soupe de haricots blancs)', ing: () => [I('Haricots blancs (bte)', 2, 'boite'), I('Tomate concassée (bte)', 400), I('Carotte', 2), I('Oignon', 1), I('Céleri branche', 2, 'pcs'), I('Persil', 1), I('Huile d’olive', 30, 'ml')], parts: 6, cuisson: 30, pe: [
      'Faites suer oignon, carottes en rondelles et céleri 8 min dans l’huile d’olive (généreuse : c’est un plat lathera).',
      'Ajoutez tomate, haricots égouttés, 500 ml d’eau. Mijotez 30 min à couvert, feu doux.',
      'La texture doit rester épaisse et rustique — écrasez quelques haricots à la cuillère pour lier.',
      'Hors du feu : persil ciselé, filet de citron, filet d’huile d’olive à cru.',
      'Servez avec du pain : la fasolada est le plat national paysan grec.',
    ] },
    { n: 'pilaki de haricots blancs', ing: () => [I('Haricots blancs (bte)', 2, 'boite'), I('Tomate concassée (bte)', 400), I('Carotte', 2), I('Oignon', 1), I('Ail', 3, 'pcs'), I('Persil', 1), I('Citron', 1), I('Huile d’olive', 30, 'ml')], parts: 6, cuisson: 30, pe: [
      'Faites suer oignon et carottes en rondelles 8 min dans l’huile d’olive (généreuse : c’est un plat « lathera », à l’huile).',
      'Ajoutez ail, tomate, haricots égouttés, 200 ml d’eau. Mijotez 25 min à couvert.',
      'La sauce doit rester liquide — on la saucera au pain.',
      'Hors du feu : persil ciselé et jus de citron.',
      'Servez tiède ou froid : les plats lathera se dégustent les deux.',
    ] },
  ];
  const EXTRA_G: { n: string; ing: () => Ing[] }[] = [
    { n: 'feta & olives', ing: () => [I('Feta', 100), I('Olives Kalamata', 60)] },
    { n: 'concombre & aneth', ing: () => [I('Concombre', 1), I('Aneth frais', 0.5)] },
    { n: 'grenades & noix', ing: () => [I('Grenade', 1), I('Noix', 40)] },
    { n: 'citron & origan frais', ing: () => [I('Citron', 1), I('Origan', 1, 'cas')] },
    { n: 'tomates cerises & basilic', ing: () => [I('Tomates cerises', 200), I('Menthe fraîche', 0.3)] },
    { n: 'yaourt grec & miel', ing: () => [I('Yaourt grec', 150)] },
  ];
  for (const p of PLATS_G) for (const e of EXTRA_G) {
    if (cap(n)) return;
    const ings = [...p.ing(), ...e.ing()];
    macros(ings, p.parts);
    const estEntree = p.n.includes('tzatziki') || p.n.includes('salade grecque');
    push(rec(`${p.n.charAt(0).toUpperCase() + p.n.slice(1)}, ${e.n}`, estEntree ? 'dejeuner' : 'diner', {
      prep: 20, cuisson: p.cuisson, difficulte: p.n.includes('spanakopita') || p.n.includes('moussaka') ? 'moyen' : 'facile', cuisine: 'Grecque', conservation: 2,
      ustensiles: p.cuisson > 0 ? [...FOUR, 'Casserole'] : [...CAT, 'Passoire'],
      instructions: [
        ...p.pe,
        `Finition : ${e.n} — posés au centre ou à côté, comme sur une table grecque où chaque assiette partage.`,
        'Huile d’olive grecque à cru en filet final : c’est l’assaisonnement, pas le gras.',
      ],
      ingredients: ings,
    }));
  }
}

// 16. VIÊT NAM (30) — pho, bún, nem cuốn, gà kho — herbes fraîches, bouillons clairs
function buildVietnamien(n: number) {
  const PLATS_V: { n: string; ing: () => Ing[]; pe: string[]; parts: number; cuisson: number; type: Rec['type'] }[] = [
    { n: 'pho de légumes aux épices', ing: () => [I('Bouillon de légumes', 1200, 'ml'), I('Anis étoilé (badiane)', 2, 'pcs'), I('Cannelle', 1, 'pcs'), I('Gingembre', 30), I('Nouilles de riz', 200), I('Champignons de Paris', 200), I('Carotte', 2), I('Chou chinois', 300), I('Basilic thaï', 1), I('Coriandre fraîche', 1), I('Citron vert', 2)], parts: 4, cuisson: 40, type: 'diner', pe: [
      'Faites griller le gingembre coupé en deux ET l’oignon face coupée contre la poêle brûlante 5 min sans matière grasse : ils doivent noircir — ce brun apporte la profondeur du pho.',
      'Torréifiez anis étoilé et cannelle 1 min à sec dans la marmite chaude : les huiles essentielles libèrent leur parfum.',
      'Versez le bouillon, ajoutez gingembre/oignon brûlés, frémissez À COUVERT 30 min : jamais d’ébullition, le bouillon doit rester clair comme du cristal.',
      'Filtrez, rectifiez le sel. Cuisez les nouilles de riz 4 min, rincez à l’eau froide (sinon elles collent).',
      'Pochez champignons émincés, carottes en tagliatelles et chou émincé 3 min dans le bouillon frémissant.',
      'Dressez : nouilles au fond du bol, légumes dessus, bouillon brûlant versé par-dessus, herbes fraîches généreuses et quartiers de citron vert — au Vietnam, les herbes ne sont pas une garniture mais la moitié du plat.',
    ] },
    { n: 'bún chay (vermicelles sautés)', ing: () => [I('Nouilles de riz', 250), I('Tofu ferme', 300), I('Carotte', 2), I('Concombre', 1), I('Laitue', 1), I('Menthe fraîche', 1), I('Coriandre fraîche', 1), I('Citron vert', 2), I('Sauce fish sauce', 2, 'cas')], parts: 4, cuisson: 10, type: 'dejeuner', pe: [
      'Pressez et cubez le tofu, saisissez 8 min jusqu’à croûte dorée.',
      'Cuisez les vermicelles de riz 4 min, rincez FROID, égouttez bien : la salade doit rester fraîche sous la garniture chaude.',
      'Préparez le nuoc cham léger : fish sauce, jus de citron vert, 1 cac de sucre, ail haché, piment — le sel-acide-sucré-pimenté doit se tenir en équilibre.',
      'Dressez en bols individuels : vermicelles, tofu chaud, julienne de carottes et concombre, laitue chiffonnée, montagne d’herbes fraîches.',
      'Versez le nuoc cham au moment de manger, mélangez tout : c’est un plat « build your own » dont chaque bouchée diffère.',
    ] },
    { n: 'ga i kho (poulet caramelisé)', ing: () => [I('Filet de poulet', 500), I('Sauce fish sauce', 2, 'cas'), I('Miel', 2, 'cas'), I('Gingembre', 20), I('Ail', 3, 'pcs'), I('Riz complet', 250), I('Brocoli', 300)], parts: 4, cuisson: 15, type: 'diner', pe: [
      'Marinez le poulet en cubes 20 min : fish sauce, miel, gingembre et ail hachés. Le fish sauce attendrit et sale en une seule étape.',
      'Faites caraméliser le miel seul dans la poêle 2 min jusqu’à couleur ambre — attention : il passe de l’ambre au brûlé en 10 secondes.',
      'Ajoutez le poulet mariné, saisissez 8 min à feu vif : la sauce doit laquer et enrober chaque cube.',
      'Servez sur riz complet avec le brocoli vapeur (7 min, vert vif) : le contraste sucré-salé du kho appelle une garniture neutre.',
      'Parsemez de coriandre et de piment frais émincé.',
    ] },
    { n: 'soupe miso-vietnamienne au tofu', ing: () => [I('Bouillon de légumes', 1000, 'ml'), I('Miso', 2, 'cas'), I('Tofu soyeux', 300), I('Pousses de soja', 150), I('Nouilles de riz', 150), I('Citronnelle', 2, 'pcs'), I('Gingembre', 15), I('Basilic thaï', 1)], parts: 4, cuisson: 15, type: 'dejeuner', pe: [
      'Faites infuser citronnelle fendue et gingembre écrasé dans le bouillon frémissant 10 min à couvert.',
      'Délayez le miso dans une louche de bouillon chaud (JAMAIS directement : il grumele et perd ses ferments au-delà de 80 °C), puis reversez.',
      'Ajoutez les cubes de tofu soyeux délicatement, 2 min : il ne doit pas se briser.',
      'Cuisez les nouilles à part, 4 min, et répartissez au fond des bols.',
      'Versez la soupe, ajoutez pousses de soja crues et basilic thaï : le contraste chaud-froid et croquant-fondant est le cœur du style vietnamien.',
    ] },
    { n: 'bo bún (bœuf mariné, vermicelles)', ing: () => [I('Filet de bœuf', 400), I('Nouilles de riz', 250), I('Laitue', 1), I('Carotte', 2), I('Citronnelle', 2, 'pcs'), I('Ail', 2, 'pcs'), I('Sauce fish sauce', 2, 'cas'), I('Citron vert', 2), I('Coriandre fraîche', 1)], parts: 4, cuisson: 6, type: 'diner', pe: [
      'Tranchez le bœuf TRÈS finement (10 min au congélateur facilitent la découpe) contre le grain.',
      'Marinez 15 min : citronnelle émincée, ail, fish sauce, 1 cas d’huile.',
      'Saisissez la viande 2 min à feu MAXIMUM en une seule couche : le sucré de la marinade caramélise, l’intérieur reste rosé.',
      'Dressez vermicelles, salade, carottes râpées et herbes dans les bols, bœuf chaud dessus.',
      'Nuoc cham versé au dernier moment ; mélangez avant de manger.',
    ] },
    { n: 'nem cuốn (rouleaux de printemps)', ing: () => [I('Pain de riz', 8), I('Crevettes', 200), I('Nouilles de riz', 100), I('Laitue', 1), I('Carotte', 2), I('Menthe fraîche', 1), I('Coriandre fraîche', 1), I('Citron vert', 2)], parts: 4, cuisson: 5, type: 'dejeuner', pe: [
      'Trempez chaque feuille de riz 3 secondes dans l’eau TIÈDE (pas plus : elle continue à ramollir pendant l’habillage).',
      'Cuisez les crevettes 3 min, coupez-les en deux dans la longueur : les roses posées à plat deviennent visibles à travers le riz translucide.',
      'Cuisez les vermicelles 3 min, rincez froid.',
      'Roulez : herbes d’abord (elles seront visibles), vermicelles, légumes, crevettes roses vers l’extérieur, rabats les deux côtés, roulez SERRÉ.',
      'Servez avec le nuoc cham : ces rouleaux sont un plat social — chacun roule les siens.',
    ] },
  ];
  const EXTRA_V: { n: string; ing: () => Ing[] }[] = [
    { n: 'nuoc cham maison', ing: () => [I('Sauce fish sauce', 2, 'cas'), I('Citron vert', 1), I('Ail', 1, 'pcs'), I('Piment frais', 1)] },
    { n: 'cacahuètes torréfiées', ing: () => [I('Cacahuètes', 40)] },
    { n: 'pousses de soja croquantes', ing: () => [I('Pousses de soja', 100)] },
    { n: 'oignon frit léger', ing: () => [I('Oignon', 1), I('Huile d’olive', 10, 'ml')] },
    { n: 'piment frais & basilic', ing: () => [I('Piment frais', 1), I('Basilic thaï', 0.5)] },
  ];
  for (const p of PLATS_V) for (const e of EXTRA_V) {
    if (cap(n)) return;
    const ings = [...p.ing(), ...e.ing()];
    macros(ings, p.parts);
    push(rec(`${p.n.charAt(0).toUpperCase() + p.n.slice(1)}, ${e.n}`, p.type, {
      prep: 25, cuisson: p.cuisson, difficulte: 'facile', cuisine: 'Vietnamienne', conservation: 2,
      ustensiles: p.cuisson > 0 ? [...POELE, 'Casserole'] : [...CAT, 'Passoire'],
      instructions: [
        ...p.pe,
        `Finition : ${e.n} — au Vietnam, chaque bol se personnalise à table : les condiments sont servis à part.`,
        'Le trio herbes fraîches + citron vert + piment est non négociable : c’est lui qui porte le plat.',
      ],
      ingredients: ings,
    }));
  }
}

// 17. ESPAGNE (30) — tortilla, gazpacho, paella de légumes, pisto
function buildEspagnol(n: number) {
  const PLATS_E: { n: string; ing: () => Ing[]; pe: string[]; parts: number; cuisson: number; type: Rec['type'] }[] = [
    { n: 'tortilla de patatas légère', ing: () => [I('Pomme de terre', 600), I('Œuf', 6), I('Oignon', 2), I('Huile d’olive', 40, 'ml'), I('Persil', 0.5)], parts: 4, cuisson: 25, type: 'dejeuner', pe: [
      'Tranchez les pommes de terre en rondelles fines (3 mm) et poêlez-les 15 min à feu doux dans l’huile avec les oignons émincés : elles doivent FONDRE, pas frire — c’est le secret d’une tortilla moelleuse.',
      'Égouttez le mélange, mélangez aux œufs battus, salez, laissez reposer 10 min : l’amidon lie.',
      'Versez dans une poêle antiadhésive bien chaude, cuisez 5 min à feu moyen en détachant les bords.',
      'Retournez avec une assiette (le geste classique espagnol) et finissez 4 min : l’intérieur doit rester BAVEUX.',
      'Laissez tiédir : la tortilla est meilleure tiède ou à température ambiante, coupée en parts comme un gâteau.',
    ] },
    { n: 'gazpacho andaluz', ing: () => [I('Tomate', 1000, 'g'), I('Concombre', 1), I('Poivron rouge', 1), I('Ail', 1, 'pcs'), I('Pain complet', 60), I('Vinaigre de Xérès', 2, 'cas'), I('Huile d’olive', 50, 'ml')], parts: 6, cuisson: 0, type: 'dejeuner', pe: [
      'Mixez tomates grossièrement coupées SANS la peau (elles doivent être mûres à point : le gazpacho ne pardonne pas l’acidité), concombre épépiné, poivron, ail et mie de pain trempée.',
      'Émulsionnez avec le vinaigre de Xérès, sel et huile d’olive EN DERNIER en filet : la texture doit être veloutée, pas mousseuse.',
      'Passez au chinois si vous voulez la version de restaurant, ou laissez rustique.',
      'Réfrigérez 2 h minimum : servi à 8-10 °C, jamais glacé, sinon les saveurs se ferment.',
      'Garnitures à part : dés de concombre, poivron haché, croûtons — chacun compose sa cuillérée.',
    ] },
    { n: 'paella de légumes au safran', ing: () => [I('Riz à paella', 300), I('Bouillon de légumes', 900, 'ml'), I('Poivron rouge', 1), I('Poivron vert', 1), I('Artichaut (bte)', 2), I('Haricots verts', 200), I('Tomate', 2), I('Safran', 1, 'pincee'), I('Paprika fumé', 1, 'cac'), I('Citron', 2)], parts: 4, cuisson: 25, type: 'diner', pe: [
      'Faites suer les poivrons en lanières et les artichauts en quartiers 8 min dans l’huile d’olive généreuse.',
      'Ajoutez la tomate râpée et le paprika, cuisez 3 min : la base sofrito doit être fondante et sombre.',
      'Versez le riz, enrobez 1 min, ajoutez bouillon brûlant infusé au safran. NE REMUEZ PLUS JAMAIS : c’est la règle absolue de la paella.',
      'Cuisez 18 min à feu moyen puis 2 min à feu vif pour créer le socarrat — la croûte caramélisée au fond, trésor de la paella.',
      'Reposez 5 min couvert d’un linge, servez directement dans la poêle avec les quartiers de citron.',
    ] },
    { n: 'pisto manchego', ing: () => [I('Courgette', 2), I('Poivron rouge', 1), I('Poivron vert', 1), I('Tomate', 4), I('Oignon', 1), I('Ail', 2, 'pcs'), I('Huile d’olive', 40, 'ml'), I('Œuf', 4)], parts: 4, cuisson: 30, type: 'diner', pe: [
      'Faites fondre oignon et ail 10 min à feu doux dans l’huile d’olive : ils doivent devenir transparents et sucrés.',
      'Ajoutez poivrons en dés, 10 min encore, puis courgettes en cubes et tomates concassées : cuisez 25 min à découvert — le pisto doit être CONFIT, pas bouilli (il réduit de moitié).',
      'Salez, poivrez, une pointe de cumin.',
      'Faites un œuf poêlé par personne dans une autre poêle : le jaune coulant est le lien du plat.',
      'Servez le pisto tiède, œuf posé dessus, pain grillé à côté : c’est un plat de village, généreux et rustique.',
    ] },
    { n: 'salmorejo cordobés', ing: () => [I('Tomate', 800, 'g'), I('Pain complet', 150), I('Ail', 1, 'pcs'), I('Vinaigre de Xérès', 1, 'cas'), I('Huile d’olive', 60, 'ml'), I('Œuf', 2)], parts: 4, cuisson: 0, type: 'dejeuner', pe: [
      'Mixez tomates mûres avec le pain (il épaissit le salmorejo, plus dense que le gazpacho), l’ail et le vinaigre.',
      'Ajoutez l’huile d’olive en filet pendant le mixage : l’émulsion doit devenir crémeuse et tenir sur la cuillère — orange pâle, jamais rose.',
      'Réfrigérez 1 h.',
      'Servez avec œufs durs émiettés et un filet d’huile à cru : à Cordoue, c’est LE déjeuner d’été.',
    ] },
    { n: 'espinacas con garbanzos', ing: () => [I('Épinards frais', 600), I('Pois chiches (bte)', 800), I('Ail', 4, 'pcs'), I('Cumin', 1, 'cac'), I('Paprika fumé', 1, 'cac'), I('Vinaigre de Xérès', 1, 'cas'), I('Huile d’olive', 30, 'ml')], parts: 4, cuisson: 15, type: 'diner', pe: [
      'Faites dorer les gousses d’ail entières 3 min dans l’huile, retirez-les.',
      'Hors du feu, ajoutez cumin et paprika dans l’huile chaude : ils fleurent en 10 secondes — pas plus.',
      'Remettez l’ail, ajoutez les épinards par brassées : elles réduisent en 4 min.',
      'Incorporez les pois chiches égouttés, cuisez 8 min : ils doivent dorer légèrement en surface.',
      'Le vinaigre de Xérès en fin de cuisson décolle les sucs et relève l’ensemble. Servez avec du pain : c’est un tapas de Séville.',
    ] },
  ];
  const EXTRA_E: { n: string; ing: () => Ing[] }[] = [
    { n: 'œuf poché', ing: () => [I('Œuf', 4)] },
    { n: 'feta & olives', ing: () => [I('Feta', 100), I('Olives noires', 50)] },
    { n: 'amandes torréfiées', ing: () => [I('Amandes', 50)] },
    { n: 'citron & persil', ing: () => [I('Citron', 1), I('Persil', 0.5)] },
    { n: 'paprika fumé à cru', ing: () => [I('Paprika fumé', 1, 'cac'), I('Huile d’olive', 10, 'ml')] },
  ];
  for (const p of PLATS_E) for (const e of EXTRA_E) {
    if (cap(n)) return;
    const ings = [...p.ing(), ...e.ing()];
    macros(ings, p.parts);
    push(rec(`${p.n.charAt(0).toUpperCase() + p.n.slice(1)}, ${e.n}`, p.type, {
      prep: 20, cuisson: p.cuisson, difficulte: 'facile', cuisine: 'Espagnole', conservation: 2,
      ustensiles: p.cuisson > 0 ? [...POELE, 'Casserole'] : [...CAT, 'Mixeur'],
      instructions: [
        ...p.pe,
        `Finition : ${e.n} — en Espagne, ces plats se servent au centre de la table et se partagent à la cuillère.`,
        'L’huile d’olive vierge extra est un ingrédient, pas un gras de cuisson : filet final obligatoire.',
      ],
      ingredients: ings,
    }));
  }
}

// 18. BRÉSIL (30) — feijoada légère, moqueca de légumes, pão de queijo, bolinho
function buildBresilien(n: number) {
  const PLATS_B: { n: string; ing: () => Ing[]; pe: string[]; parts: number; cuisson: number; type: Rec['type'] }[] = [
    { n: 'feijoada légère végétarienne', ing: () => [I('Haricots noirs (bte)', 3, 'boite'), I('Courge butternut', 400), I('Patate douce', 300), I('Oignon', 2), I('Ail', 4, 'pcs'), I('Feuille de laurier', 2, 'pcs'), I('Riz complet', 250), I('Orange', 2)], parts: 6, cuisson: 35, type: 'diner', pe: [
      'Faites suer oignon et ail 8 min, ajoutez la courge et la patate douce en cubes : elles imitent la viande par leur onctuosité.',
      'Ajoutez les haricots noirs égouttés avec leur jus de trempage (ou un peu d’eau), le laurier, cuisez 30 min à couvert : le bouillon doit épaissir — écrasez une louche de haricots pour lier naturellement.',
      'Salez EN FIN de cuisson (les haricots durcissent si salés trop tôt).',
      'Servez avec riz complet, farofa légère (farine de manioc torréfiée) et les quartiers d’orange : l’acidité de l’orange est TRADITIONNELLE avec la feijoada, elle équilibre la richesse.',
      'Collard greens sautés à l’ail en accompagnement pour la version complète.',
    ] },
    { n: 'moqueca de légumes au lait de coco', ing: () => [I('Courge butternut', 400), I('Poivron rouge', 1), I('Poivron vert', 1), I('Tomate', 3), I('Oignon', 1), I('Coriandre fraîche', 1), I('Lait de coco', 400, 'ml'), I('Citron vert', 2), I('Huile de palme (dendê)', 2, 'cas')], parts: 4, cuisson: 25, type: 'diner', pe: [
      'Marinez les cubes de courge 20 min : citron vert, ail, sel, coriandre hachée — la marinade de Bahia.',
      'Faites une lit de oignon, poivrons et tomates en rondelles DANS la casserole : la moqueca ne se remue pas, on secoue la casserole.',
      'Ajoutez la courge marinée, versez le lait de coco, cuisez 25 min à couvert sans remuer.',
      'La sauce doit lier toute seule, orange et brillante. Ajoutez l’huile de dendê en fin (son goût est puissant, 2 cas suffisent).',
      'Coriandre fraîche et citron vert au service, riz blanc complet à côté : la moqueca se mange dans son assiette creuse.',
    ] },
    { n: 'pão de queijo au fromage', ing: () => [I('Fécule de tapioca', 250), I('Lait', 200, 'ml'), I('Huile d’olive', 60, 'ml'), I('Œuf', 2), I('Parmesan', 100)], parts: 8, cuisson: 20, type: 'dejeuner', pe: [
      'Portez lait et huile à ébullition, versez sur la fécule de tapioca : c’est le « scalding » qui donne l’élasticité.',
      'Laissez tiédir 5 min (sinon les œufs cuisent), ajoutez œufs un à un puis le parmesan râpé : la pâte doit être collante mais tenir.',
      'Réfrigérez 30 min : elle se façonne mieux.',
      'Boules de 3 cm sur plaque, four 200 °C, 20 min : elles gonflent et creusent — c’est le signe de la pâte réussie.',
      'Mangez CHAUD : le pão de queijo refroidi perd sa magie. Café noir à côté, comme au Minas Gerais.',
    ] },
    { n: 'bolinho de arroz', ing: () => [I('Riz complet cuit', 400), I('Œuf', 2), I('Farine de manioc', 60), I('Oignon', 1), I('Persil', 1), I('Huile d’olive', 30, 'ml')], parts: 4, cuisson: 15, type: 'dejeuner', pe: [
      'Mélangez le riz cuit froid, œufs, oignon émincé, persil, farine de manioc, sel : la pâte doit tenir dans la main sans coller aux doigts.',
      'Façonnez des galettes de 6 cm, aplatissez-les.',
      'Poêlez 4 min par face dans l’huile bien chaude : croûte dorée, cœur moelleux — ils doivent chanter en touchant la poêle.',
      'Égouttez sur papier, servez tiède avec une sauce yaourt-citron vert et de la coriandre : c’est le street food de Rio.',
    ] },
    { n: 'soupe de maïs crémeuse (canjica salgada)', ing: () => [I('Maïs doux (bte)', 3, 'boite'), I('Lait de coco léger', 300, 'ml'), I('Oignon', 1), I('Ail', 2, 'pcs'), I('Bouillon de légumes', 500, 'ml'), I('Coriandre fraîche', 1)], parts: 4, cuisson: 20, type: 'dejeuner', pe: [
      'Faites suer oignon et ail 5 min, ajoutez le maïs égoutté, 5 min encore.',
      'Versez le bouillon, frémissez 10 min, puis mixez DIRECTEMENT dans la casserole avec le lait de coco : la texture doit être veloutée, pas liquide.',
      'Rectifiez sel, poivre, une pointe de piment.',
      'Servez avec coriandre fraîche et dés de poivron : cette soupe réconfortante est le goûter des rues de São Paulo.',
    ] },
    { n: 'salade de chuchu à la brésilienne', ing: () => [I('Chuchu', 3), I('Oignon rouge', 0.5), I('Coriandre fraîche', 1), I('Citron vert', 2), I('Huile d’olive', 20, 'ml')], parts: 4, cuisson: 15, type: 'dejeuner', pe: [
      'Pelez le chuchu (il rend un lait collant : gants ou huile sur les mains), coupez en cubes.',
      'Cuisez 12 min à la vapeur : il doit rester FERME, presque croquant — le chuchu trop cuit devient mou et fade.',
      'Laissez refroidir, mélangez oignon rouge émincé fin, coriandre, citron vert, huile.',
      'Servez frais en accompagnement : cette salade se retrouve à chaque déjeuner brésilien, la « salada » indispensable.',
    ] },
  ];
  const EXTRA_B: { n: string; ing: () => Ing[] }[] = [
    { n: 'farofa légère', ing: () => [I('Farine de manioc', 40), I('Oignon', 0.5), I('Huile d’olive', 10, 'ml')] },
    { n: 'quartiers d’orange', ing: () => [I('Orange', 2)] },
    { n: 'sauce yaourt-citron vert', ing: () => [I('Yaourt nature', 150), I('Citron vert', 1), I('Coriandre fraîche', 0.5)] },
    { n: 'avocat & citron vert', ing: () => [I('Avocat', 1), I('Citron vert', 1)] },
    { n: 'mangue épicée', ing: () => [I('Mangue', 1), I('Piment frais', 0.5)] },
  ];
  for (const p of PLATS_B) for (const e of EXTRA_B) {
    if (cap(n)) return;
    const ings = [...p.ing(), ...e.ing()];
    macros(ings, p.parts);
    push(rec(`${p.n.charAt(0).toUpperCase() + p.n.slice(1)}, ${e.n}`, p.type, {
      prep: 25, cuisson: p.cuisson, difficulte: 'facile', cuisine: 'Brésilienne', conservation: 2,
      ustensiles: p.cuisson > 0 ? [...POELE, 'Casserole'] : [...CAT, 'Passoire'],
      instructions: [
        ...p.pe,
        `Finition : ${e.n} — la table brésilienne sert toujours les accompagnements à part : chacun dose.`,
        'Citron vert + coriandre fraîche sont le duo aromatique national : présents dans presque chaque plat.',
      ],
      ingredients: ings,
    }));
  }
}

// ═════════════════════════════ ASSEMBLAGE ═══════════════════════════════════
const step = (label: string, target: number, fn: (n: number) => void) => {
  const before = OUT.length;
  fn(target);
  console.log(`   ${label.padEnd(12)} ${String(OUT.length - before).padStart(4)} recettes (cible ${target - before})`);
};
step('Bowls', 150, buildBowls);
step('Dhals', 280, buildDhal);
step('Woks', 400, buildWok);
step('Salades', 520, buildSalades);
step('Soupes', 630, buildSoupes);
step('Fours', 730, buildFour);
step('Tacos', 820, buildMexicain);
step('Poke', 900, buildPoke);
step('Déjeuners', 990, buildDejeuners);
step('Desserts', 1050, buildDesserts);
step('Corée', 1110, buildCoreen);
step('Éthiopie', 1158, buildEthiopien);
step('Turquie', 1190, buildTurc);
step('Liban', 1250, buildLibanais);
step('Grèce', 1310, buildGrec);
step('Viêt Nam', 1340, buildVietnamien);
step('Espagne', 1370, buildEspagnol);
step('Brésil', 1400, buildBresilien);
step('Japon', 1430, buildJaponais);

const TOTAL = OUT.length;

// ─── Garde-fous (copie conforme du seed 1000) ───────────────────────────────
const UNITES_AUTORISEES = ['g', 'ml', 'pcs', 'cac', 'cas', 'pincee', 'sachet', 'boite', 'botte', 'tranche'];
const PLAFOND_UNITE: Record<string, number> = { pcs: 24, cas: 12, cac: 8, botte: 3, sachet: 3, boite: 4, tranche: 20 };
const RAYONS_AUTORISEES = ['fruits_legumes', 'epicerie_salee', 'epicerie_sucree', 'frais', 'surgeles', 'viande_poisson', 'boissons', 'boulangerie', 'conserves', 'epices'];

function verifierRecettes(): string[] {
  const problemes: string[] = [];
  for (const r of OUT) {
    for (const ing of r.ingredients) {
      if (!UNITES_AUTORISEES.includes(ing.u)) problemes.push(`${r.titre} → ${ing.nom} : unité « ${ing.u} » refusée par la base`);
      if (ing.q <= 0) problemes.push(`${r.titre} → ${ing.nom} : quantité ${ing.q} refusée (doit être > 0)`);
      if (!RAYONS_AUTORISEES.includes(ing.r)) problemes.push(`${r.titre} → ${ing.nom} : rayon « ${ing.r} » refusé par la base`);
      const plafond = PLAFOND_UNITE[ing.u];
      if (plafond != null && ing.q > plafond) problemes.push(`${r.titre} → ${ing.nom} : ${ing.q} ${ing.u} dépasse le plafond ${plafond} — probablement des grammes écrits en « ${ing.u} »`);
    }
    if (r.ingredients.length === 0) problemes.push(`${r.titre} : aucune ingrédient`);
    if (r.instructions.length < 5) problemes.push(`${r.titre} : seulement ${r.instructions.length} étapes (minimum 5)`);
    try { macros(r.ingredients, r.portions); } catch (e) { problemes.push(`${r.titre} : ${(e as Error).message}`); }
  }
  return problemes;
}

function rapportProblemes(problemes: string[]): void {
  console.log(`\n❌ ${problemes.length} problème(s) détecté(s) :`);
  for (const p of problemes.slice(0, 20)) console.log(`   • ${p}`);
  if (problemes.length > 20) console.log(`   … et ${problemes.length - 20} autres.`);
}

// ─── Résolution & insertion des ingrédients ────────────────────────────────
async function resoudreIngredients(supabase: Db, r: Rec): Promise<Record<string, number>> {
  const noms = [...new Set(r.ingredients.map(i => i.nom))];
  const ids: Record<string, number> = {};
  const manquants: string[] = [];
  for (const nom of noms) {
    const { data, error } = await supabase.from('ingredients').select('id').eq('nom', nom).maybeSingle();
    if (error) throw new Error(error.message);
    if (data) ids[nom] = (data as { id: number }).id;
    else manquants.push(nom);
  }
  // Création des ingrédients manquants (rayon + macros depuis la table)
  for (const nom of manquants) {
    const def = ING[nom];
    const { data, error } = await supabase.from('ingredients').insert({
      nom, rayon: def.r, saison: 'toutes',
      calories_pour_100g: def.m[0], proteines_pour_100g: def.m[1],
      glucides_pour_100g: def.m[2], lipides_pour_100g: def.m[3],
    }).select('id').single();
    if (error) throw new Error(`Impossible de créer « ${nom} » : ${error.message}`);
    ids[nom] = (data as { id: number }).id;
  }
  return ids;
}

async function insererLiens(supabase: Db, mealId: number, titre: string, r: Rec, ids: Record<string, number>): Promise<number> {
  const liens = r.ingredients.map(i => ({
    meal_id: mealId, ingredient_id: ids[i.nom], quantite: i.q, unite: i.u,
  }));
  const { error } = await supabase.from('meal_ingredients').insert(liens);
  if (error) { console.log(`❌ liens ${titre} : ${error.message}`); return 0; }
  return liens.length;
}

// ─── Synchronisation des métadonnées d'ingrédients ────────────────────────
// Écrit les coefficients nutritionnels ET les poids unitaires de toutes les
// tables ci-dessus vers la base. SANS les poids persistés, le recalcul des
// macros refuse toute recette utilisant une unité non massique (cas, cac,
// pcs…) : le calcul est refusé plutôt que partiel — c'est le contrat.
async function synchroniserIngredients(ecrire: boolean) {
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const noms = [...new Set([...Object.keys(ING), ...Object.keys(POIDS_UNITES)])].sort();
  let maj = 0, majPoids = 0;
  const absents: string[] = [];
  const poidsNonDeclares: string[] = [];

  for (const nom of noms) {
    const { data: found, error: errLecture } = await supabase
      .from('ingredients').select('id').eq('nom', nom).maybeSingle();
    if (errLecture) throw new Error(errLecture.message);
    if (!found) { absents.push(nom); continue; }

    const def = ING[nom];
    const payload: Record<string, unknown> = {};
    if (def) {
      payload.calories_pour_100g = def.m[0];
      payload.proteines_pour_100g = def.m[1];
      payload.glucides_pour_100g = def.m[2];
      payload.lipides_pour_100g = def.m[3];
    }
    if (POIDS_UNITES[nom]) { payload.poids_unites = POIDS_UNITES[nom]; majPoids++; }
    if (Object.keys(payload).length === 0) continue;
    if (!ecrire) { maj++; continue; }

    const { error } = await supabase.from('ingredients').update(payload).eq('id', (found as { id: number }).id);
    if (error) console.log(`⚠️  ${nom} : ${error.message}`);
    else maj++;
  }

  // Même garde-fou que le seed 1000 : une unité par défaut non massique sans
  // poids rendrait chaque recette qui l'utilise incalculable.
  for (const [nom, def] of Object.entries(ING)) {
    if (def.u && !['g', 'ml'].includes(def.u) && !((POIDS_UNITES[nom]?.[def.u] ?? 0) > 0)) {
      poidsNonDeclares.push(`${nom} (unité par défaut « ${def.u} »)`);
    }
  }

  console.log(`\n📐 Métadonnées d'ingrédients ${ecrire ? 'écrites' : 'à écrire'} : ${maj} / ${noms.length}`);
  console.log(`   avec poids unitaires ........... : ${majPoids} ingrédient(s)`);
  if (absents.length > 0) {
    console.log(`   absents de la base (lancés le seed d'abord) : ${absents.length}`);
    for (const n of absents.slice(0, 10)) console.log(`     • ${n}`);
  }
  if (poidsNonDeclares.length > 0) {
    console.log(`   ⚠️  unités par défaut sans poids : ${poidsNonDeclares.length}`);
    for (const n of poidsNonDeclares.slice(0, 10)) console.log(`     • ${n}`);
  }
  if (!ecrire) console.log('\n(dry-run — rien n’est écrit. Ajoutez `--write` pour appliquer.)');
}

// ─── Écriture en base (ou dry-run) ──────────────────────────────────────────
async function seed() {
  const problemes = verifierRecettes();
  if (problemes.length > 0) {
    rapportProblemes(problemes);
    throw new Error('Écriture annulée : corrigez les ingrédients ci-dessus.');
  }

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // Idempotence : charger les titres existants (normalisés).
  // Pagination OBLIGATOIRE : PostgREST limite toute requête non paginée à 1000 lignes,
  // ce qui réinsérait des doublons une fois le catalogue passé le millième titre.
  const have = new Set<string>();
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from('meals').select('titre').range(from, from + PAGE - 1);
    if (error) throw error;
    for (const m of data ?? []) have.add(norm(m.titre));
    if (!data || data.length < PAGE) break;
  }

  let ajoutes = 0, ignores = 0;
  for (const r of OUT) {
    if (have.has(norm(r.titre))) { ignores++; continue; }

    const ingredientIds = await resoudreIngredients(supabase, r);
    const m = macros(r.ingredients, r.portions);

    const { data: mealData, error: mealErr } = await supabase.from('meals').insert({
      titre: r.titre, type_repas: r.type === 'dessert' ? 'dessert' : 'plat', temps_preparation: r.prep,
      temps_cuisson: r.cuisson ?? null, difficulte: r.difficulte,
      saison: r.saison, cuisine: r.cuisine,
      calories_par_portion: m.cal, proteines: m.p, glucides: m.g, lipides: m.l,
      macros_verifiables: true,
      instructions: r.instructions, portions_par_defaut: r.portions,
      conservation_jours: r.conservation, ustensiles: r.ustensiles, is_public: true,
    }).select('id').maybeSingle();

    if (!mealData) { console.log(`❌ ${r.titre} — ${mealErr?.message ?? 'erreur inconnue'}`); continue; }

    await insererLiens(supabase, mealData.id, r.titre, r, ingredientIds);
    ajoutes++;
    if (ajoutes % 100 === 0) console.log(`   … ${ajoutes} recettes insérées`);
  }
  console.log(`\n🎉 Terminé : ${ajoutes} recettes ajoutées, ${ignores} déjà présentes (ignorées).`);
}

// ─── Main ───────────────────────────────────────────────────────────────────
const DRY = process.argv.includes('--dry');
const INGREDIENTS = process.argv.includes('--ingredients');
const ECRIRE = process.argv.includes('--write');
if (INGREDIENTS) {
  synchroniserIngredients(ECRIRE).catch(e => { console.error(e); process.exit(1); });
} else if (DRY) {
  console.log(`\n📦 Catalogue WORLD HEALTHY : ${TOTAL} recettes détaillées.\n`);
  const byType = { dejeuner: 0, diner: 0, dessert: 0 } as Record<string, number>;
  const byCuisine = new Map<string, number>();
  OUT.forEach(r => {
    byType[r.type]++;
    byCuisine.set(r.cuisine, (byCuisine.get(r.cuisine) ?? 0) + 1);
  });
  console.log('   Par type :', byType);
  console.log('   Par cuisine :', [...byCuisine.entries()].map(([c, n]) => `${c} (${n})`).join(', '), '\n');
  console.log('Échantillon :');
  for (const t of [OUT[0], OUT[Math.floor(TOTAL / 4)], OUT[Math.floor(TOTAL / 2)], OUT[Math.floor(TOTAL * 3 / 4)], OUT[TOTAL - 1]]) {
    if (t) console.log(`   • ${t.titre}  [${t.type}, ${t.prep}+${t.cuisson ?? 0} min, ${t.cuisine}]`);
  }
  const problemes = verifierRecettes();
  problemes.length === 0
    ? console.log('\n✅ Toutes les recettes passent les contraintes de `meal_ingredients` et les plausibilités de macros.')
    : rapportProblemes(problemes);
  console.log('\nExemple complet (dry-run, rien n\u2019est écrit) :');
  const s = OUT[0];
  console.log(JSON.stringify({ ...s, macros: macros(s.ingredients, s.portions) }, null, 2));
} else {
  seed().catch(e => { console.error(e); process.exit(1); });
}
