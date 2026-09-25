// ============================================================================
// SEED CATALOGUE 1000+ — PlanMyMeal
// Usage : npm run seed:catalogue          (écrit dans Supabase, idempotent)
//         npx tsx scripts/seed-catalogue-1000.ts --dry   (aperçu sans écriture)
//
// SOURCES DES DONNÉES (transparence) :
//  • Recettes : canon culinaire classique du home-cooking (préparations
//    standards françaises, italiennes, asiatiques, méditerranéennes…) —
//    combinatoire CURATÉE : chaque famille ne combine que des accords
//    compatibles (pas de saumon dans un tajine, etc.). Aucun texte copié
//    d'un site tiers (Marmiton & co) pour des raisons de droits.
//  • Macros : valeurs moyennes de composition alimentaire (tables publiques
//    type Ciqual/ANSES), arrondies, calculées depuis les quantités brutes.
//  • Prix : non seedés — calculés par le moteur budget de l'app comme pour
//    les recettes existantes.
// Détail identique aux seeds existants : 8-10 étapes chiffrées (°C, minutes,
// tailles de coupe), ustensiles, conservation, portions, liens ingrédients.
// ============================================================================

import { config } from 'dotenv';
import type { SupabaseClient } from '@supabase/supabase-js';
import { calculerMacros, verifierPlausibilite, type LigneMacros } from '../src/lib/macros';
import { uniteEstMasse } from '../src/lib/unites';

/** Client Supabase (schéma libre : le script ne dépend pas des types générés) */
type Db = SupabaseClient;
/** Plafond d'une réponse PostgREST — au-delà, il faut paginer explicitement. */
const PAGE = 1000;
/** Titres comparés sans se soucier des apostrophes typographiques. */
const norm = (t: string) => t.replace(/[\u2019\u2018`]/g, "'");
config({ path: '.env.local' });
config();

// ─── Types ──────────────────────────────────────────────────────────────────
type Ing = { nom: string; q: number; u: string; r: string };
type Rec = {
  titre: string; type: 'dejeuner' | 'diner' | 'dessert';
  prep: number; cuisson?: number; difficulte: 'facile' | 'moyen';
  saison: 'toutes' | 'printemps' | 'ete' | 'automne' | 'hiver';
  cuisine: string; portions: number; conservation: number;
  ustensiles: string[]; instructions: string[]; ingredients: Ing[];
};

// ─── Table ingrédients : macros pour 100 g/ml [kcal, P, G, L] + rayon + unité
type IngDef = { m: [number, number, number, number]; r: string; u?: string; ml?: boolean };
const ING: Record<string, IngDef> = {
  // Viandes & poissons
  'Filet de poulet': { m: [120, 22, 0, 3], r: 'viande_poisson' },
  'Filet de dinde': { m: [110, 23, 0, 2], r: 'viande_poisson' },
  'Bœuf haché 5 %': { m: [150, 20, 0, 7], r: 'viande_poisson' },
  'Filet mignon de porc': { m: [130, 21, 0, 5], r: 'viande_poisson' },
  'Pavé de saumon': { m: [200, 20, 0, 13], r: 'viande_poisson' },
  'Dos de cabillaud': { m: [80, 17, 0, 0.7], r: 'viande_poisson' },
  'Crevettes': { m: [85, 19, 0.5, 0.5], r: 'viande_poisson' },
  'Saumon fumé': { m: [180, 22, 0, 10], r: 'viande_poisson' },
  'Lardons fumés': { m: [330, 14, 0, 30], r: 'viande_poisson' },
  'Jambon blanc': { m: [110, 19, 1, 3], r: 'viande_poisson' },
  'Chorizo': { m: [290, 20, 2, 23], r: 'viande_poisson' },
  'Thon au naturel': { m: [110, 25, 0, 1], r: 'conserves' },
  'Épaule d\u2019agneau': { m: [280, 25, 0, 20], r: 'viande_poisson' },
  // Œufs & végé
  'Œuf': { m: [140, 12.5, 0.5, 10], r: 'frais', u: 'pcs' },
  'Tofu ferme': { m: [145, 15, 2, 8], r: 'frais' },
  'Pois chiches (bte)': { m: [160, 9, 27, 2.5], r: 'conserves' },
  'Lentilles vertes': { m: [115, 9, 20, 0.5], r: 'epicerie_salee' },
  'Lentilles corail': { m: [335, 24, 58, 1.1], r: 'epicerie_salee' },
  'Haricots rouges (bte)': { m: [130, 9, 23, 0.5], r: 'conserves' },
  // Fromages
  'Feta': { m: [260, 14, 4, 21], r: 'frais' },
  'Mozzarella': { m: [250, 18, 2, 19], r: 'frais' },
  'Chèvre frais': { m: [190, 14, 2, 13], r: 'frais' },
  'Parmesan': { m: [392, 35, 0, 25], r: 'frais' },
  'Gruyère râpé': { m: [400, 29, 0, 31], r: 'frais' },
  'Comté': { m: [410, 29, 1, 33], r: 'frais' },
  'Halloumi': { m: [320, 22, 2, 25], r: 'frais' },
  // Féculents
  'Pâtes penne': { m: [355, 12, 72, 1.5], r: 'epicerie_salee' },
  'Spaghetti': { m: [355, 12, 72, 1.5], r: 'epicerie_salee' },
  'Tagliatelles': { m: [360, 12, 71, 2], r: 'epicerie_salee' },
  'Fusilli': { m: [355, 12, 72, 1.5], r: 'epicerie_salee' },
  'Rigatoni': { m: [355, 12, 72, 1.5], r: 'epicerie_salee' },
  'Riz basmati': { m: [350, 7.5, 78, 0.7], r: 'epicerie_salee' },
  'Riz complet': { m: [345, 7.5, 72, 2.8], r: 'epicerie_salee' },
  'Riz arborio': { m: [345, 7, 77, 0.8], r: 'epicerie_salee' },
  'Quinoa': { m: [370, 14, 64, 6], r: 'epicerie_salee' },
  'Boulgour': { m: [342, 12, 76, 1.3], r: 'epicerie_salee' },
  'Semoule fine': { m: [360, 12, 73, 1], r: 'epicerie_salee' },
  'Nouilles de riz': { m: [360, 6, 82, 0.6], r: 'epicerie_salee' },
  'Nouilles chinoises': { m: [380, 13, 71, 4], r: 'epicerie_salee' },
  'Nouilles soba': { m: [340, 11, 68, 1.5], r: 'epicerie_salee' },
  'Polenta': { m: [350, 8, 75, 0.6], r: 'epicerie_salee' },
  'Flocons d\u2019avoine': { m: [370, 13, 58, 7], r: 'epicerie_salee' },
  'Farine': { m: [350, 10, 72, 1.5], r: 'epicerie_salee' },
  'Levure chimique': { m: [0, 0, 0, 0], r: 'epicerie_salee', u: 'sachet' },
  // Légumes
  'Courgette': { m: [17, 1.2, 2, 0.3], r: 'fruits_legumes' },
  'Aubergine': { m: [20, 1, 4, 0.2], r: 'fruits_legumes' },
  'Poivron rouge': { m: [25, 1, 5, 0.3], r: 'fruits_legumes' },
  'Tomate': { m: [18, 0.9, 3.5, 0.2], r: 'fruits_legumes' },
  'Tomates cerises': { m: [20, 1, 3.8, 0.2], r: 'fruits_legumes' },
  'Tomate concassée (bte)': { m: [30, 1.6, 5.5, 0.2], r: 'conserves' },
  'Oignon': { m: [40, 1.1, 9, 0.1], r: 'fruits_legumes' },
  'Oignon rouge': { m: [42, 1.1, 9.3, 0.1], r: 'fruits_legumes' },
  'Échalote': { m: [72, 2.5, 16, 0.1], r: 'fruits_legumes' },
  'Ail': { m: [149, 6.4, 30, 0.2], r: 'fruits_legumes', u: 'pcs' },
  'Carotte': { m: [38, 0.9, 8.5, 0.2], r: 'fruits_legumes' },
  'Poireau': { m: [30, 1.5, 6, 0.1], r: 'fruits_legumes' },
  'Champignons de Paris': { m: [22, 3, 1, 0.3], r: 'fruits_legumes' },
  'Épinards frais': { m: [23, 2.9, 1.4, 0.4], r: 'fruits_legumes' },
  'Brocoli': { m: [30, 2.4, 2, 0.4], r: 'fruits_legumes' },
  'Chou-fleur': { m: [25, 1.9, 2.5, 0.3], r: 'fruits_legumes' },
  'Haricots verts': { m: [25, 1.8, 4, 0.1], r: 'fruits_legumes' },
  'Petit pois (surg.)': { m: [70, 5, 10, 0.4], r: 'surgeles' },
  'Maïs (bte)': { m: [86, 3, 19, 1.2], r: 'conserves' },
  'Concombre': { m: [12, 0.6, 2.2, 0.1], r: 'fruits_legumes' },
  'Roquette': { m: [25, 2.6, 2, 0.7], r: 'fruits_legumes' },
  'Mâche': { m: [18, 2, 2, 0.3], r: 'fruits_legumes' },
  'Chou kale': { m: [35, 2.9, 3.4, 1.5], r: 'fruits_legumes' },
  'Chou rouge': { m: [31, 1.9, 5.6, 0.2], r: 'fruits_legumes' },
  'Avocat': { m: [160, 2, 4, 15], r: 'fruits_legumes', u: 'pcs' },
  'Pomme de terre': { m: [80, 2, 17, 0.2], r: 'fruits_legumes' },
  'Patate douce': { m: [86, 1.6, 20, 0.1], r: 'fruits_legumes' },
  'Courge butternut': { m: [45, 1, 12, 0.1], r: 'fruits_legumes' },
  // Fruits
  'Citron': { m: [29, 1.1, 3, 0.3], r: 'fruits_legumes', u: 'pcs' },
  'Pomme': { m: [52, 0.3, 12, 0.2], r: 'fruits_legumes', u: 'pcs' },
  'Poire': { m: [55, 0.4, 12, 0.1], r: 'fruits_legumes', u: 'pcs' },
  'Banane': { m: [89, 1, 21, 0.3], r: 'fruits_legumes', u: 'pcs' },
  'Fraise': { m: [32, 0.7, 6.5, 0.3], r: 'fruits_legumes' },
  'Framboise': { m: [45, 1.2, 7, 0.6], r: 'fruits_legumes' },
  'Myrtilles': { m: [55, 0.7, 10, 0.3], r: 'fruits_legumes' },
  'Mangue': { m: [60, 0.8, 14, 0.4], r: 'fruits_legumes', u: 'pcs' },
  'Ananas frais': { m: [52, 0.5, 12, 0.15], r: 'fruits_legumes', u: 'pcs' },
  'Fruits rouges': { m: [45, 1, 8, 0.4], r: 'fruits_legumes' },
  // Crèmerie & liquides (ml)
  'Crème fraîche épaisse': { m: [300, 2.6, 3, 30], r: 'frais', ml: true },
  'Crème liquide': { m: [340, 2.4, 3, 36], r: 'frais', ml: true },
  'Lait': { m: [47, 3.2, 4.6, 1.6], r: 'frais', ml: true },
  'Beurre': { m: [740, 0.8, 0.6, 82], r: 'frais' },
  'Yaourt nature': { m: [60, 4, 5, 2.4], r: 'frais', u: 'pcs' },
  'Fromage blanc': { m: [70, 7.5, 4.5, 3], r: 'frais' },
  'Skyr': { m: [63, 11, 4, 0.5], r: 'frais' },
  'Lait de coco': { m: [180, 1.8, 3, 19], r: 'conserves', ml: true },
  'Bouillon de légumes': { m: [5, 0.3, 0.6, 0.1], r: 'epicerie_salee', ml: true },
  'Bouillon de volaille': { m: [6, 0.7, 0.4, 0.2], r: 'epicerie_salee', ml: true },
  'Vin blanc sec': { m: [80, 0.1, 2, 0], r: 'boissons', ml: true },
  'Vin rouge': { m: [85, 0.1, 2.5, 0], r: 'boissons', ml: true },
  // Épicerie
  'Huile d\u2019olive': { m: [884, 0, 0, 100], r: 'epicerie_salee', ml: true },
  'Vinaigre balsamique': { m: [88, 0.5, 17, 0], r: 'epicerie_salee', ml: true },
  'Sauce soja': { m: [53, 8, 4, 0.1], r: 'epicerie_salee', ml: true },
  'Miel': { m: [304, 0.3, 82, 0], r: 'epicerie_sucree' },
  'Moutarde': { m: [66, 4, 4, 3.7], r: 'epicerie_salee' },
  'Concentré de tomate': { m: [82, 4.3, 15, 0.5], r: 'conserves' },
  'Olives noires': { m: [230, 1.6, 6, 23], r: 'epicerie_salee' },
  'Câpres': { m: [23, 2, 1, 0.7], r: 'epicerie_salee' },
  'Tahini': { m: [595, 17, 21, 54], r: 'epicerie_salee' },
  'Sucre': { m: [400, 0, 100, 0], r: 'epicerie_sucree' },
  'Sucre vanillé': { m: [400, 0, 100, 0], r: 'epicerie_sucree', u: 'sachet' },
  'Chocolat noir pâtissier': { m: [546, 6, 61, 31], r: 'epicerie_sucree' },
  'Cacao en poudre': { m: [228, 20, 58, 14], r: 'epicerie_sucree' },
  'Noix de cajou': { m: [553, 18, 30, 44], r: 'epicerie_sucree' },
  'Amandes': { m: [579, 21, 22, 50], r: 'epicerie_sucree' },
  'Noisettes': { m: [628, 15, 17, 60], r: 'epicerie_sucree' },
  'Pignons de pin': { m: [629, 14, 13, 61], r: 'epicerie_sucree' },
  'Noix': { m: [650, 15, 14, 65], r: 'epicerie_sucree' },
  'Beurre de cacahuète': { m: [590, 26, 20, 50], r: 'epicerie_sucree' },
  'Graines de chia': { m: [490, 17, 42, 31], r: 'epicerie_sucree' },
  'Pâte brisée': { m: [350, 6, 42, 17], r: 'frais', u: 'pcs' },
  'Pâte feuilletée': { m: [400, 7, 42, 22], r: 'frais', u: 'pcs' },
  'Biscuits à la cuillère': { m: [380, 9, 72, 6], r: 'epicerie_sucree' },
  'Spéculoos': { m: [440, 5, 65, 18], r: 'epicerie_sucree' },
  'Gélatine': { m: [335, 85, 0, 0], r: 'epicerie_sucree', u: 'pcs' },
  'Datte': { m: [282, 2.5, 75, 0.4], r: 'epicerie_sucree' },
  'Rhum': { m: [230, 0, 0, 0], r: 'boissons', ml: true },
  // Herbes & épices (macros ~0)
  'Basilic': { m: [0, 0, 0, 0], r: 'fruits_legumes', u: 'botte' },
  'Persil': { m: [0, 0, 0, 0], r: 'fruits_legumes', u: 'botte' },
  'Ciboulette': { m: [0, 0, 0, 0], r: 'fruits_legumes', u: 'botte' },
  'Coriandre fraîche': { m: [0, 0, 0, 0], r: 'fruits_legumes', u: 'botte' },
  'Menthe fraîche': { m: [0, 0, 0, 0], r: 'fruits_legumes', u: 'botte' },
  'Thym': { m: [0, 0, 0, 0], r: 'epices' },
  'Romarin': { m: [0, 0, 0, 0], r: 'epices' },
  'Origan': { m: [0, 0, 0, 0], r: 'epices' },
  'Herbes de Provence': { m: [0, 0, 0, 0], r: 'epices' },
  'Curry en poudre': { m: [0, 0, 0, 0], r: 'epices' },
  'Cumin': { m: [0, 0, 0, 0], r: 'epices' },
  'Paprika fumé': { m: [0, 0, 0, 0], r: 'epices' },
  'Gingembre': { m: [80, 1.8, 18, 0.8], r: 'fruits_legumes' },
  'Curcuma': { m: [0, 0, 0, 0], r: 'epices' },
  'Ras-el-hanout': { m: [0, 0, 0, 0], r: 'epices' },
  'Cannelle': { m: [0, 0, 0, 0], r: 'epices' },
  'Piment doux': { m: [0, 0, 0, 0], r: 'epices' },
  'Graines de sésame': { m: [573, 18, 23, 50], r: 'epicerie_salee' },
  'Gousse de vanille': { m: [0, 0, 0, 0], r: 'epicerie_sucree', u: 'pcs' },
  'Café soluble': { m: [0, 0, 0, 0], r: 'epicerie_sucree', u: 'cas' },
  'Raisins secs': { m: [299, 3, 79, 0.5], r: 'epicerie_sucree' },
  'Orange': { m: [47, 0.9, 12, 0.1], r: 'fruits_legumes', u: 'pcs' },
  'Noix de coco': { m: [354, 3.3, 15, 33], r: 'epicerie_sucree' },
  'Pépites de chocolat': { m: [500, 5, 65, 25], r: 'epicerie_sucree' },
  'Pains pita': { m: [275, 9, 55, 1.2], r: 'boulangerie', u: 'pcs' },
  'Pains burger': { m: [290, 8, 52, 4], r: 'boulangerie', u: 'pcs' },
  'Tortillas de blé': { m: [310, 8, 51, 7], r: 'boulangerie', u: 'pcs' },
  'Pain de campagne': { m: [270, 9, 52, 2], r: 'boulangerie', u: 'tranche' },

  // ── Ingrédients des AUTRES seeds (desserts, pâtes, recettes détaillées) ──
  //
  // Ces 107 noms existaient en base mais dans AUCUNE table du générateur : les
  // autres scripts les déclarent avec leurs macros écrites à la main par
  // recette, sans coefficients pour 100 g. Le recalcul lisant la base refusait
  // donc leurs recettes (`coefficients_manquants`) — et une recette refusée
  // garde ses calories d'AVANT le calcul conscient de l'unité, donc
  // sous-estimées.
  //
  // Ce n'est pas un détail cosmétique : les ingrédients concernés ne sont pas
  // des aromates mais le corps du plat — riz, poulet, viande hachée, lardons,
  // pâtes, pains, fromages, conserves. 95 recettes (8 % du catalogue, dont 85
  // sous le seuil « léger ») voyaient leur total amputé d'un ingrédient entier,
  // ce qui les faisait passer pour légères et les FAVORISAIT sur les jours
  // déclarés légers. Les rayons reproduisent ceux déjà stockés en base : la
  // synchronisation n'écrit que les coefficients, mais un seed à blanc doit
  // recréer les mêmes lignes.
  //
  // Convention conservée de la section précédente : aromates et herbes fraîches
  // à [0, 0, 0, 0] (leur contribution est négligeable à l'échelle d'une
  // portion, et leur donner un coefficient juste mais inutile suggérerait une
  // précision qui n'existe pas).
  //
  // Sources : valeurs usuelles pour 100 g/ml (CIQUAL/USDA). Conserves : poids
  // égoutté pour légumes et poisson, net pour les tomates concassées.

  // Viandes & poissons
  'Agneau (épaule)': { m: [230, 18, 0, 17], r: 'viande_poisson' },
  'Bacon': { m: [280, 15, 1, 24], r: 'viande_poisson', u: 'tranche' },
  'Blanc de poulet': { m: [110, 23, 0, 1.5], r: 'viande_poisson' },
  'Blanc de poulet cuit': { m: [145, 28, 0, 3], r: 'viande_poisson' },
  'Bœuf à braiser': { m: [190, 20, 0, 12], r: 'viande_poisson' },
  'Côte de porc': { m: [230, 25, 0, 14], r: 'viande_poisson', u: 'pcs' },
  'Échine de porc': { m: [240, 20, 0, 18], r: 'viande_poisson' },
  'Escalope de veau': { m: [110, 21, 0, 2.5], r: 'viande_poisson', u: 'pcs' },
  'Faux-filet': { m: [180, 21, 0, 10], r: 'viande_poisson', u: 'pcs' },
  'Filet de cabillaud': { m: [75, 17, 0, 0.7], r: 'viande_poisson' },
  'Gambas': { m: [85, 18, 0.5, 1], r: 'viande_poisson' },
  'Lardons': { m: [280, 15, 1, 24], r: 'viande_poisson' },
  'Magret de canard': { m: [200, 22, 0, 12], r: 'viande_poisson' },
  'Merguez': { m: [300, 16, 1, 26], r: 'viande_poisson', u: 'pcs' },
  'Moules': { m: [80, 12, 3, 2], r: 'viande_poisson', u: 'boite' },
  'Pilons de poulet': { m: [180, 19, 0, 11], r: 'viande_poisson', u: 'pcs' },
  'Poulet entier': { m: [180, 20, 0, 11], r: 'viande_poisson', u: 'pcs' },
  'Rôti de porc': { m: [200, 22, 0, 12], r: 'viande_poisson' },
  'Rumsteck': { m: [130, 22, 0, 4.5], r: 'viande_poisson' },
  'Saucisse de Toulouse': { m: [290, 15, 1, 25], r: 'viande_poisson', u: 'pcs' },
  'Saumon frais': { m: [200, 20, 0, 13], r: 'viande_poisson' },
  'Steak haché': { m: [200, 19, 0, 13], r: 'viande_poisson', u: 'pcs' },
  'Veau (épaule)': { m: [150, 20, 0, 7], r: 'viande_poisson' },
  'Viande hachée (bœuf)': { m: [180, 19, 0, 11], r: 'viande_poisson' },

  // Crèmerie
  'Chantilly': { m: [320, 2, 22, 26], r: 'frais', ml: true },
  'Cheddar': { m: [400, 25, 1.5, 33], r: 'frais', u: 'tranche' },
  'Crème fraîche': { m: [300, 2.4, 3, 30], r: 'frais', u: 'cas' },
  'Feuilles de brick': { m: [300, 8, 62, 2], r: 'frais', u: 'pcs' },
  'Fromage frais': { m: [130, 8, 4, 10], r: 'frais' },
  'Jaune d\'œuf': { m: [320, 16, 3.5, 27], r: 'frais', u: 'pcs' },
  'Mascarpone': { m: [400, 5, 3, 42], r: 'frais' },
  'Reblochon': { m: [330, 22, 0.5, 27], r: 'frais', u: 'pcs' },
  'Yaourt grec': { m: [120, 4, 4, 9], r: 'frais' },

  // Fruits & légumes
  'Betterave cuite': { m: [45, 1.7, 8, 0.2], r: 'fruits_legumes', u: 'pcs' },
  'Cerise': { m: [60, 1, 14, 0.3], r: 'fruits_legumes' },
  'Citron vert': { m: [30, 0.7, 3, 0.2], r: 'fruits_legumes', u: 'pcs' },
  'Clémentine': { m: [45, 0.9, 10, 0.2], r: 'fruits_legumes', u: 'pcs' },
  'Gingembre frais': { m: [80, 1.8, 16, 0.8], r: 'fruits_legumes' },
  'Melon': { m: [35, 0.8, 8, 0.2], r: 'fruits_legumes', u: 'pcs' },
  'Navet': { m: [28, 0.9, 5, 0.1], r: 'fruits_legumes', u: 'pcs' },
  'Pêche': { m: [40, 0.9, 9, 0.1], r: 'fruits_legumes', u: 'pcs' },
  'Poivron': { m: [30, 1, 6, 0.3], r: 'fruits_legumes', u: 'pcs' },
  'Poivron vert': { m: [25, 1, 5, 0.3], r: 'fruits_legumes', u: 'pcs' },
  'Potiron': { m: [25, 1, 5, 0.1], r: 'fruits_legumes' },
  'Raisin': { m: [70, 0.7, 17, 0.4], r: 'fruits_legumes' },
  'Salade': { m: [15, 1.2, 2, 0.2], r: 'fruits_legumes', u: 'pcs' },
  'Salade romaine': { m: [17, 1.2, 2.5, 0.3], r: 'fruits_legumes', u: 'pcs' },
  'Salade verte': { m: [15, 1.2, 2, 0.2], r: 'fruits_legumes', u: 'pcs' },
  'Aneth': { m: [0, 0, 0, 0], r: 'epices', u: 'botte' },
  'Basilic frais': { m: [0, 0, 0, 0], r: 'fruits_legumes', u: 'botte' },
  'Menthe': { m: [0, 0, 0, 0], r: 'fruits_legumes', u: 'botte' },
  'Persil frais': { m: [0, 0, 0, 0], r: 'fruits_legumes', u: 'botte' },

  // Épicerie salée
  'Bouillon de bœuf': { m: [0, 0, 0, 0], r: 'epicerie_salee', ml: true },
  'Cacahuètes': { m: [590, 26, 12, 49], r: 'epicerie_salee' },
  'Chapelure': { m: [380, 12, 72, 5], r: 'epicerie_salee' },
  'Crozets': { m: [350, 12, 71, 1.5], r: 'epicerie_salee' },
  'Feuilles de lasagne': { m: [350, 12, 70, 1.5], r: 'epicerie_salee' },
  'Gnocchis': { m: [150, 4, 31, 0.5], r: 'epicerie_salee' },
  'Huile de friture': { m: [900, 0, 0, 100], r: 'epicerie_salee', ml: true },
  'Huile de sésame': { m: [880, 0, 0, 100], r: 'epicerie_salee', u: 'cas' },
  'Huile de tournesol': { m: [900, 0, 0, 100], r: 'epicerie_salee', ml: true },
  'Levure boulangère': { m: [320, 40, 30, 6], r: 'epicerie_salee', u: 'sachet' },
  'Macaroni': { m: [350, 12, 72, 1.5], r: 'epicerie_salee' },
  'Mayonnaise': { m: [700, 1.5, 3, 76], r: 'epicerie_salee', u: 'cas' },
  'Olives vertes': { m: [145, 1, 4, 15], r: 'epicerie_salee' },
  'Pâtes (fussili)': { m: [350, 12, 71, 1.5], r: 'epicerie_salee' },
  'Pâtes (penne)': { m: [350, 12, 71, 1.5], r: 'epicerie_salee' },
  'Pâtes (tagliatelles)': { m: [350, 12, 71, 1.5], r: 'epicerie_salee' },
  'Pesto': { m: [450, 5, 6, 45], r: 'epicerie_salee', u: 'cas' },
  'Riz': { m: [350, 7, 78, 0.6], r: 'epicerie_salee' },
  'Riz à sushi': { m: [350, 6.5, 78, 0.5], r: 'epicerie_salee' },
  'Riz Arborio': { m: [350, 7, 78, 0.5], r: 'epicerie_salee' },
  'Riz rond': { m: [350, 7, 78, 0.6], r: 'epicerie_salee' },
  'Sauce nuoc mam': { m: [35, 5, 4, 0], r: 'epicerie_salee', u: 'cas' },
  'Semoule': { m: [360, 12, 73, 1.5], r: 'epicerie_salee' },

  // Épicerie sucrée
  'Biscuits cuillère': { m: [380, 8, 72, 6], r: 'epicerie_sucree' },
  'Chocolat noir': { m: [550, 7, 45, 35], r: 'epicerie_sucree' },
  'Granola': { m: [450, 10, 60, 18], r: 'epicerie_sucree' },
  'Poudre d’amandes': { m: [600, 22, 8, 52], r: 'epicerie_sucree' },
  'Pruneaux': { m: [240, 2, 60, 0.4], r: 'epicerie_sucree' },
  'Sirop d\'érable': { m: [260, 0, 65, 0], r: 'epicerie_sucree', u: 'cas' },

  // Épices
  'Garam masala': { m: [0, 0, 0, 0], r: 'epices', u: 'cac' },
  'Laurier': { m: [0, 0, 0, 0], r: 'epices', u: 'pcs' },
  'Paprika': { m: [0, 0, 0, 0], r: 'epices', u: 'cac' },
  'Ras el hanout': { m: [0, 0, 0, 0], r: 'epices', u: 'cac' },
  'Vanille': { m: [0, 0, 0, 0], r: 'epices', u: 'pcs' },

  // Boissons
  'Café': { m: [0, 0, 0, 0], r: 'boissons', ml: true },
  'Vin blanc': { m: [80, 0.1, 2.5, 0], r: 'boissons', ml: true },

  // Boulangerie
  'Galette de sarrasin': { m: [200, 6, 35, 3], r: 'boulangerie', u: 'pcs' },
  'Pain': { m: [270, 9, 52, 2], r: 'boulangerie', u: 'tranche' },
  'Pain burger': { m: [280, 9, 52, 4], r: 'boulangerie', u: 'pcs' },
  'Pain complet': { m: [250, 10, 45, 3], r: 'boulangerie', u: 'tranche' },
  'Pain de mie': { m: [280, 8, 50, 4], r: 'boulangerie', u: 'tranche' },
  'Pain pita': { m: [275, 9, 55, 2], r: 'boulangerie', u: 'pcs' },
  'Tortilla de blé': { m: [310, 8, 50, 8], r: 'boulangerie', u: 'pcs' },
  'Tortilla de maïs': { m: [300, 8, 60, 3], r: 'boulangerie', u: 'pcs' },
  'Wrap / tortilla': { m: [310, 8, 52, 7], r: 'boulangerie', u: 'pcs' },

  // Conserves
  'Haricots rouges': { m: [105, 7, 17, 0.5], r: 'conserves', u: 'boite' },
  'Maïs': { m: [90, 3, 18, 1], r: 'conserves', u: 'boite' },
  'Pois chiches': { m: [130, 7, 20, 2.5], r: 'conserves', u: 'boite' },
  'Ratatouille (préparée)': { m: [60, 1.2, 6, 3.5], r: 'conserves' },
  'Thon en boîte': { m: [165, 25, 0, 7], r: 'conserves', u: 'boite' },
  'Tomates concassées': { m: [30, 1.2, 4.5, 0.3], r: 'conserves', u: 'boite' },

  // Surgelés
  'Fruits rouges surgelés': { m: [50, 1, 10, 0.5], r: 'surgeles' },
  'Glace vanille': { m: [200, 3.5, 24, 11], r: 'surgeles', ml: true },
  'Petits pois': { m: [80, 5.5, 12, 0.5], r: 'surgeles' },
  'Sorbet mangue': { m: [130, 0.5, 32, 0.2], r: 'surgeles', ml: true },
};

// ─── Poids d'une unité non massique, par ingrédient ────────────────────────
//
// Les coefficients ci-dessus sont « pour 100 g ». Sans ce barème, une quantité
// en PIÈCES était multipliée telle quelle par un coefficient pour 100 g : les
// 3 œufs et les 4 poires d'un clafoutis pesaient 7 g, et ses calories étaient
// sous-estimées d'environ 35 % — assez pour qu'il reçoive le bonus du « plat
// léger » dans le score. 1 706 des 6 806 liens de la base (25 %) sont dans ce
// cas.
//
// Le poids est porté par l'INGRÉDIENT, pas par l'unité : un « cas » de miel
// (20 g) et un « cas » d'huile (13 g) ne pèsent pas pareil, et un « cas » de
// curry (8 g) n'a rien à voir avec l'un ou l'autre. Une unité absente d'ici
// rend la recette NON CHIFFRABLE (voir `lib/unites.ts`) : c'est volontaire, on
// ne comble jamais un trou par une estimation au jugé.
//
// Sources : poids moyens usuels (CIQUAL/USDA pour les aliments, poids net des
// conserves vendues, poids moyen d'une pièce de fruits ou légume calibré). Ces
// valeurs sont des ordres de grandeur — leur but est de supprimer un facteur de
// 60 sur les ingrédients en pièces, pas de prétendre à la précision d'une
// balance de laboratoire.
//
// Convention pour les conserves : poids égoutté pour les légumes et le poisson
// (c'est ce qu'on mange, et ce que compte la nutrition), poids net pour les
// tomates concassées et le lait de coco (on utilise tout le contenu).
type PoidsParUnite = Record<string, number>;
const POIDS_UNITES: Record<string, PoidsParUnite> = {
  // ── pcs : une pièce ──
  'Ail': { pcs: 5 },                    // une gousse
  'Ananas frais': { pcs: 1000 },        // un ananas (les recettes utilisent 0.5)
  'Aubergine': { pcs: 250 },
  'Avocat': { pcs: 200 },
  'Banane': { pcs: 120 },
  'Betterave cuite': { pcs: 150 },
  'Cannelle': { pcs: 2, cac: 3, cas: 8 },  // pcs = un bâton
  'Carotte': { pcs: 80 },
  'Chou-fleur': { pcs: 800 },           // une tête
  'Citron': { pcs: 100 },
  'Citron vert': { pcs: 60 },
  'Clémentine': { pcs: 70 },
  'Concombre': { pcs: 350 },
  'Côte de porc': { pcs: 200 },
  'Courgette': { pcs: 250 },
  'Datte': { pcs: 8 },                  // une datte
  'Escalope de veau': { pcs: 120 },
  'Faux-filet': { pcs: 180 },
  'Feuilles de brick': { pcs: 15 },     // une feuille
  'Galette de sarrasin': { pcs: 80 },
  'Gélatine': { pcs: 2 },               // une feuille
  'Gousse de vanille': { pcs: 3 },
  // Apostrophe DROITE : c'est la forme réellement présente en base pour cet
  // ingrédient (vérifié sur les octets, pas à l'œil). La même vérification a
  // montré que « Huile d’olive » et « Sirop d'érable », eux, ne s'écrivent pas
  // avec la même apostrophe — d'où deux lignes d'ingrédient pour l'huile, depuis
  // fusionnées (voir README).
  "Jaune d'œuf": { pcs: 18 },
  'Laurier': { pcs: 0.2 },              // une feuille (coefficients nuls : sans effet)
  'Mangue': { pcs: 200 },
  'Melon': { pcs: 800 },
  'Merguez': { pcs: 60 },
  'Navet': { pcs: 150 },
  'Œuf': { pcs: 60 },
  'Oignon': { pcs: 80 },
  'Orange': { pcs: 180 },
  'Pain burger': { pcs: 80 },
  'Pains burger': { pcs: 80 },
  'Pain pita': { pcs: 90 },
  'Pains pita': { pcs: 90 },
  'Pâte brisée': { pcs: 230 },          // un rouleau
  'Pâte feuilletée': { pcs: 230 },
  'Pavé de saumon': { pcs: 130 },
  'Pêche': { pcs: 150 },
  'Pilons de poulet': { pcs: 120 },
  'Poire': { pcs: 170 },
  'Poireau': { pcs: 150 },
  'Poivron': { pcs: 150 },
  'Poivron rouge': { pcs: 150 },
  'Poivron vert': { pcs: 150 },
  'Pomme': { pcs: 150 },
  'Poulet entier': { pcs: 1300 },
  'Reblochon': { pcs: 450 },            // une meule
  'Salade': { pcs: 300 },
  'Salade romaine': { pcs: 300 },
  'Salade verte': { pcs: 250 },
  'Saucisse de Toulouse': { pcs: 100 },
  'Steak haché': { pcs: 125 },
  'Tomate': { pcs: 120 },
  'Tortilla de blé': { pcs: 60 },
  'Tortillas de blé': { pcs: 60 },
  'Tortilla de maïs': { pcs: 40 },
  'Wrap / tortilla': { pcs: 60 },
  'Vanille': { pcs: 2 },                // une gousse
  'Yaourt grec': { pcs: 125, cas: 20 }, // pcs = un pot
  'Yaourt nature': { pcs: 125 },

  // ── cas : une cuillère à soupe ──
  'Café soluble': { cas: 3 },
  'Crème fraîche': { cas: 20 },
  'Cumin': { cas: 8, cac: 3 },
  'Curcuma': { cas: 8, cac: 3 },
  'Curry en poudre': { cas: 8, cac: 3 },
  'Garam masala': { cac: 3 },
  'Herbes de Provence': { cas: 3, cac: 1 },
  'Huile d’olive': { cas: 13 },
  'Huile de sésame': { cas: 13 },
  'Mayonnaise': { cas: 20 },
  'Miel': { cas: 20, cac: 7 },
  'Moutarde': { cas: 16, cac: 5 },
  'Origan': { cas: 3 },
  'Paprika': { cac: 3 },
  'Paprika fumé': { cas: 8 },
  'Pesto': { cas: 16 },
  'Piment doux': { cac: 3 },
  'Ras el hanout': { cac: 3 },
  'Ras-el-hanout': { cas: 8 },
  'Sauce nuoc mam': { cas: 16 },
  'Sauce soja': { cas: 16 },
  "Sirop d'érable": { cas: 20 },
  'Tahini': { cas: 15 },
  'Vinaigre balsamique': { cas: 15 },

  // ── botte : un bouquet d'herbes fraîches ──
  'Aneth': { botte: 20 },
  'Basilic': { botte: 30 },
  'Basilic frais': { botte: 30 },
  'Ciboulette': { botte: 20 },
  'Coriandre fraîche': { botte: 30 },
  'Menthe': { botte: 25 },
  'Menthe fraîche': { botte: 25 },
  'Persil': { botte: 30 },
  'Persil frais': { botte: 30 },

  // ── tranche ──
  'Bacon': { tranche: 15 },
  'Cheddar': { tranche: 20 },
  'Jambon blanc': { tranche: 40 },
  'Pain': { tranche: 30 },
  'Pain complet': { tranche: 30 },
  'Pain de campagne': { tranche: 40 },
  'Pain de mie': { tranche: 25 },

  // ── sachet ──
  'Levure boulangère': { sachet: 8 },
  'Levure chimique': { sachet: 11 },
  'Sucre vanillé': { sachet: 8 },

  // ── boite : poids ÉGOUTTÉ pour les légumes et le poisson, net sinon ──
  'Haricots rouges': { boite: 250 },
  'Pois chiches': { boite: 250 },
  'Maïs': { boite: 150 },
  'Moules': { boite: 280 },
  'Thon en boîte': { boite: 140 },
  'Tomates concassées': { boite: 400 },
  'Lait de coco': { boite: 400 },
};

function I(nom: string, q: number, u?: string): Ing {
  const def = ING[nom];
  if (!def) throw new Error(`Ingrédient inconnu de la table : ${nom}`);
  return { nom, q, u: u ?? def.u ?? (def.ml ? 'ml' : 'g'), r: def.r };
}
// Normalise un retour Ing | Ing[] en tableau : les familles de recettes mélangent
// les deux formes (un protein seul vs une paire base+sauce) et tsx ne typecheck pas.
const one = (x: Ing | Ing[]): Ing[] => (Array.isArray(x) ? x : [x]);

// ─── Macros & helpers ───────────────────────────────────────────────────────
/**
 * Macros par portion, unités converties.
 *
 * Délègue à `lib/macros.ts` — la même fonction que le recalcul des recettes
 * déjà en base, pour que les deux ne puissent pas diverger. Elle REFUSE la
 * recette plutôt que de rendre un total partiel quand une unité n'a pas de
 * poids ou qu'un ingrédient n'a pas de coefficients : un total partiel est
 * indistinguable d'un total juste, une erreur se voit.
 */
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
  // Un total juste peut être un plat faux (huile de friture comptée comme
  // mangée) : on refuse ici plutôt que de publier 2 825 kcal/portion.
  const plausible = verifierPlausibilite(r.macros);
  if (!plausible.ok) throw new Error(`Macros implausibles : ${plausible.detail}`);
  return { cal: r.macros.cal, p: r.macros.p, g: r.macros.g, l: r.macros.l };
}

/** Coefficients nutritionnels d'un ingrédient, pour les colonnes de `ingredients` */
function nutritionPour100g(nom: string) {
  const m = ING[nom].m;
  return {
    calories_pour_100g: m[0],
    proteines_pour_100g: m[1],
    glucides_pour_100g: m[2],
    lipides_pour_100g: m[3],
  };
}
const H = 'Huile d\u2019olive', O = 'Oignon', A = 'Ail';

function rec(
  titre: string, type: Rec['type'], o: {
    prep: number; cuisson?: number; difficulte?: 'facile' | 'moyen';
    saison?: Rec['saison']; cuisine: string; portions?: number; conservation?: number;
    ustensiles: string[]; instructions: string[]; ingredients: Ing[];
  }
): Rec {
  return {
    titre, type, prep: o.prep, cuisson: o.cuisson, difficulte: o.difficulte ?? 'facile',
    saison: o.saison ?? 'toutes', cuisine: o.cuisine, portions: o.portions ?? 4,
    conservation: o.conservation ?? 2, ustensiles: o.ustensiles,
    instructions: o.instructions, ingredients: o.ingredients,
  };
}

const HU = 'Faites chauffer 2 cas d\u2019huile d\u2019olive';
const CAT = ['Couteau de chef', 'Saladier'];
const POELE = [...CAT, 'Poêle', 'Planche à découper'];
const CASS = [...CAT, 'Casserole', 'Passoire'];
const FOUR = [...CAT, 'Four', 'Plat à rôtir'];

// ═════════════════════════════ FAMILLES ═════════════════════════════════════
const OUT: Rec[] = [];
const seen = new Set<string>();

/**
 * Fusionne les ingrédients répétés dans une recette.
 *
 * L'huile d'olive de la base et celle de la vinaigrette sont le MÊME
 * ingrédient : la base refuse deux fois la même paire (clé primaire
 * `meal_id+ingredient_id`), et ce qu'on achète, c'est la somme. Ce n'est pas
 * cosmétique : l'insertion des liens se faisait en un lot par recette, donc
 * un doublon faisait échouer le lot ENTIER — 90 recettes se sont retrouvées
 * en base sans le moindre ingrédient.
 *
 * Unités différentes → on garde la première occurrence : les additionner
 * donnerait un nombre faux (1 cas + 10 g ne fait pas 11).
 */
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

// ── 1. PÂTES (130) — 5 formes × 8 sauces × 8 ajouts ─────────────────────────
const PATES = ['Pâtes penne', 'Spaghetti', 'Tagliatelles', 'Fusilli', 'Rigatoni'];
const PATE_N: Record<string, string> = { 'Pâtes penne': 'penne', Spaghetti: 'spaghetti', Tagliatelles: 'tagliatelles', Fusilli: 'fusilli', Rigatoni: 'rigatoni' };
const SAUCES_P = [
  { n: 'sauce tomate-basilic', ing: () => [I('Tomate concassée (bte)', 400), I(A, 2, 'pcs'), I('Basilic', 0.5)], c: 'Italienne' },
  { n: 'pesto maison', ing: () => [I('Basilic', 1), I('Pignons de pin', 30), I('Parmesan', 40), I(A, 1, 'pcs')], c: 'Italienne' },
  { n: 'crème & parmesan', ing: () => [I('Crème liquide', 200), I('Parmesan', 50)], c: 'Italienne' },
  { n: 'huile d\u2019olive, ail & piment', ing: () => [I(A, 3, 'pcs'), I('Piment doux', 1, 'cac')], c: 'Italienne' },
  { n: 'crème & champignons', ing: () => [I('Crème fraîche épaisse', 150), I('Champignons de Paris', 250)], c: 'Française' },
  { n: 'tomates cerises confites', ing: () => [I('Tomates cerises', 300), I(A, 2, 'pcs'), I('Origan', 1, 'cas')], c: 'Italienne' },
  { n: 'bolognaise végétarienne', ing: () => [I('Tomate concassée (bte)', 400), I('Lentilles corail', 100), I('Concentré de tomate', 30)], c: 'Italienne' },
  { n: 'citron & fromage frais', ing: () => [I('Citron', 1), I('Fromage blanc', 150)], c: 'Italienne' },
] as const;
const ADDS_P = [
  { n: 'poulet grillé', ing: () => [I('Filet de poulet', 450)], pe: 'Coupez les filets de poulet en dés de 2 cm, salez, poivrez, puis faites-les dorer 6-7 min à feu vif dans la poêle. Réservez.', m: [120, 22, 0, 3] },
  { n: 'crevettes', ing: () => [I('Crevettes', 400)], pe: 'Décortiquez les crevettes si besoin. Ajoutez-les 3 min en fin de cuisson de la sauce : elles sont cuites dès qu\u2019elles rosissent et se recroquevillent.', m: [85, 19, 0.5, 0.5] },
  { n: 'lardons', ing: () => [I('Lardons fumés', 180)], pe: 'Faites revenir les lardons 5 min à sec dans la poêle chaude (pas d\u2019huile nécessaire), ils doivent être dorés et légèrement croustillants.', m: [330, 14, 0, 30] },
  { n: 'saumon fumé', ing: () => [I('Saumon fumé', 250)], pe: 'Coupez le saumon fumé en lanières. Incorporez-le hors du feu en toute fin, la chaleur des pâtes suffit à le parfumer sans le dessécher.', m: [180, 22, 0, 10] },
  { n: 'pois chiches rôtis', ing: () => [I('Pois chiches (bte)', 400)], pe: 'Égouttez et séchez les pois chiches, rôtissez-les 10 min à la poêle avec 1 cas d\u2019huile et une pincée de paprika jusqu\u2019à ce qu\u2019ils croquent.', m: [160, 9, 27, 2.5] },
  { n: 'chorizo', ing: () => [I('Chorizo', 150)], pe: 'Tranchez le chorizo en rondelles de 5 mm et faites-le revenir 4 min : il rend son huile rouge qui parfume toute la sauce.', m: [290, 20, 2, 23] },
  { n: 'tofu grillé', ing: () => [I('Tofu ferme', 350)], pe: 'Pressez le tofu dans du papier absorbant 10 min, coupez en cubes et saisissez 6 min à la poêle avec 1 cas de sauce soja jusqu\u2019à coloration dorée.', m: [145, 15, 2, 8] },
  { n: 'jambon', ing: () => [I('Jambon blanc', 250)], pe: 'Coupez le jambon en lanières épaisses et ajoutez-le en fin de cuisson, 2 min suffisent à le réchauffer sans le durcir.', m: [110, 19, 1, 3] },
] as const;

function buildPates(n: number) {
  for (const pa of PATES) for (const s of SAUCES_P) for (const a of ADDS_P) {
    if (cap(n)) return;
    const ings = [I(pa, 400), I(H, 20, 'ml'), ...a.ing(), ...s.ing()];
    macros(ings, 4); // garde-fou : lève si les macros sont incohérentes
    push(rec(`Pâtes ${PATE_N[pa]} au ${a.n}, ${s.n}`, 'diner', {
      prep: 15, cuisson: 15, difficulte: 'facile', cuisine: s.c, conservation: 2,
      ustensiles: [...CASS, 'Poêle', 'Râpe'],
      instructions: [
        `Portez un grand volume d\u2019eau salée (10 g de sel par litre) à ébullition pour cuire les ${PATE_N[pa]}.`,
        a.pe,
        'Émincez l\u2019ail (et les oignons/légumes de la sauce) finement au couteau de chef pendant que l\u2019eau chauffe.',
        `${HU} dans une grande poêle, ajoutez les éléments de la sauce (${s.n}) et laissez mijoter 8-10 min à feu moyen : la sauce doit napper la cuillère. (Variante : 12 min à 180°C à l\u2019air fryer pour les tomates.)`,
        `Cuisez les ${PATE_N[pa]} al dente selon le paquet, généralement 9-11 min. Gardez une louche d\u2019eau de cuisson avant d\u2019égoutter.`,
        'Versez les pâtes égouttées dans la poêle de sauce, hors du feu.',
        'Ajoutez un filet d\u2019eau de cuisson et faites « sauter » 1 min à feu vif : l\u2019amidon lie la sauce aux pâtes.',
        'Goûtez, ajustez sel, poivre et un filet d\u2019huile d\u2019olive cru.',
        'Servez immédiatement avec parmesan râpé à la râpe et basilic ou persil ciselé.',
      ],
      ingredients: ings,
    }));
  }
}

// ── 2. RIZ & GRAINS (84) ────────────────────────────────────────────────────
const GRAINS = ['Riz basmati', 'Riz complet', 'Quinoa', 'Boulgour', 'Semoule fine'];
const GRAIN_N: Record<string, string> = { 'Riz basmati': 'riz basmati', 'Riz complet': 'riz complet', Quinoa: 'quinoa', Boulgour: 'boulgour', 'Semoule fine': 'semoule' };
const RPREPS: { n: string; wok?: boolean; froid?: boolean; ing: () => Ing[]; c: string }[] = [
  { n: 'sauté aux légumes', wok: true, ing: () => [I('Carotte', 2), I('Petit pois (surg.)', 150), I(O, 1), I('Sauce soja', 30, 'ml')], c: 'Asiatique' },
  { n: 'pilaf aux herbes', ing: () => [I('Bouillon de légumes', 500, 'ml'), I('Persil', 0.5), I('Échalote', 2)], c: 'Française' },
  { n: 'bowl méditerranéen', ing: () => [I('Tomates cerises', 200), I('Concombre', 0.5), I('Feta', 100), I('Olives noires', 60)], c: 'Méditerranéenne' },
  { n: 'salade tiède au citron', ing: () => [I('Citron', 1), I(H, 20, 'ml'), I('Herbes de Provence', 1, 'cas')], c: 'Française', froid: true },
  { n: 'curry doux au lait de coco', ing: () => [I('Lait de coco', 200, 'ml'), I('Curry en poudre', 1, 'cas'), I('Épinards frais', 150)], c: 'Indienne' },
] as const;
const ADDS_R = [
  { n: 'poulet', ing: () => [I('Filet de poulet', 400)], pe: 'Dés de 2 cm saisis 6-7 min à feu vif (8 min au wok en remuant constamment).' },
  { n: 'crevettes', ing: () => [I('Crevettes', 350)], pe: 'Ajoutées 3 min en fin de cuisson, cuites dès qu\u2019elles rosissent.' },
  { n: 'tofu', ing: () => [I('Tofu ferme', 300)], pe: 'Cubes pressés saisis 6 min avec 1 cas de sauce soja.' },
  { n: 'pois chiches', ing: () => [I('Pois chiches (bte)', 400)], pe: 'Rôtis 8 min à la poêle avec paprika et cumin.' },
  { n: 'œuf mollet', ing: () => [I('Œuf', 4)], pe: 'Cuits 6 min dans l\u2019eau bouillante, refroidis à l\u2019eau glacée, écalés puis coupés en deux.' },
  { n: 'feta', ing: () => [I('Feta', 150)], pe: 'Émiettée au moment de servir, jamais cuite.' },
] as const;

function buildGrains(n: number) {
  for (const gr of GRAINS) for (const p of RPREPS) for (const a of ADDS_R) {
    if (cap(n)) return;
    const base = p.n.includes('pilaf') ? I(gr, 300) : I(gr, 300);
    const ings = [base, I(H, 20, 'ml'), ...p.ing(), ...a.ing()];
    macros(ings, 4); // garde-fou : lève si les macros sont incohérentes
    push(rec(`${GRAIN_N[gr]} ${p.n} au ${a.n}`, p.froid ? 'dejeuner' : 'diner', {
      prep: 15, cuisson: 20, difficulte: 'facile', cuisine: p.c, conservation: 3,
      ustensiles: p.wok ? [...CAT, 'Wok', 'Casserole'] : [...CASS, 'Poêle'],
      instructions: [
        `Rincez le ${GRAIN_N[gr]} à la passoire jusqu\u2019à eau claire, puis cuisez-le selon le paquet (12-18 min à petit feu couvert pour un grain qui reste croquant).`,
        `Pendant ce temps, préparez le ${a.n} : ${a.pe}`,
        'Épluchez et découpez les légumes en dés réguliers de 1,5 cm au couteau de chef (cuisson homogène).',
        p.wok
          ? `Faites chauffer 1 cas d\u2019huile dans un wok très chaud, sautez les légumes 4-5 min en remuant constamment : ils doivent rester croquants.`
          : `${HU} dans une sauteuse, faites suer les légumes 5-6 min à feu moyen avec une pincée de sel.`,
        'Incorporerez la garniture de sauce et laissez réduisez 3-4 min : la préparation doit rester humide sans baigner.',
        `Ajoutez le ${a.n} préparé et le grain égoutté, mélangez 1-2 min à feu vif pour que les saveurs se lient.`,
        'Hors du feu, goûtez et rectifiez l\u2019assaisonnement (citron, herbes fraîches ciselées).',
        p.froid ? 'Laissez tiédir 10 min puis servez tiède ou froid, après 30 min au frais c\u2019est encore meilleur.' : 'Servez bien chaud, parsemé d\u2019herbes fraîches.',
      ],
      ingredients: ings,
    }));
  }
}

// ── 3. RÔTIS AU FOUR (140) — protéines × garnitures × marinades ─────────────
const PROTS_F = [
  { n: 'Filets de poulet', i: () => I('Filet de poulet', 500), t: [22, 200], c: 'Française' },
  { n: 'Cuisses de poulet', i: () => I('Filet de poulet', 600), t: [35, 200], c: 'Française' },
  { n: 'Filet de dinde', i: () => I('Filet de dinde', 500), t: [22, 200], c: 'Française' },
  { n: 'Pavés de saumon', i: () => I('Pavé de saumon', 480), t: [14, 200], c: 'Nordique' },
  { n: 'Dos de cabillaud', i: () => I('Dos de cabillaud', 480), t: [16, 190], c: 'Française' },
  { n: 'Filet mignon de porc', i: () => I('Filet mignon de porc', 500), t: [28, 190], c: 'Française' },
  { n: 'Tofu ferme', i: () => I('Tofu ferme', 400), t: [20, 200], c: 'Asiatique' },
  { n: 'Épaule d\u2019agneau', i: () => I('Épaule d\u2019agneau', 600), t: [50, 180], c: 'Orientale' },
] as const;
const GARNI_F = [
  { n: 'patates douces', i: () => [I('Patate douce', 600)] },
  { n: 'pommes de terre', i: () => [I('Pomme de terre', 700)] },
  { n: 'légumes du soleil', i: () => [I('Courgette', 2), I('Poivron rouge', 1), I('Aubergine', 1)] },
  { n: 'courge butternut', i: () => [I('Courge butternut', 600)] },
  { n: 'carottes & pommes de terre', i: () => [I('Carotte', 4), I('Pomme de terre', 400)] },
  { n: 'brocoli', i: () => [I('Brocoli', 500)] },
];
const MARINADES_F: { n: string; i: () => Ing[]; c?: string }[] = [
  { n: 'herbes de Provence & citron', i: () => [I('Herbes de Provence', 1, 'cas'), I('Citron', 1), I(H, 20, 'ml')] },
  { n: 'miel-soja-sésame', i: () => [I('Miel', 30), I('Sauce soja', 30, 'ml'), I('Graines de sésame', 10)], c: 'Asiatique' },
  { n: 'paprika fumé & ail', i: () => [I('Paprika fumé', 1, 'cas'), I(A, 3, 'pcs'), I(H, 20, 'ml')], c: 'Espagnole' },
  { n: 'curry doux & yaourt', i: () => [I('Yaourt nature', 100, 'g'), I('Curry en poudre', 1, 'cas')], c: 'Indienne' },
  { n: 'moutarde-miel', i: () => [I('Moutarde', 20), I('Miel', 20)], c: 'Française' },
  { n: 'cumin & coriandre', i: () => [I('Cumin', 1, 'cas'), I('Coriandre fraîche', 0.5)], c: 'Orientale' },
];

function buildFour(n: number) {
  for (const p of PROTS_F) for (const g of GARNI_F) for (const m of MARINADES_F) {
    if (cap(n)) return;
    const c = m.c ?? p.c;
    const ings = [...one(p.i()), ...one(g.i()), ...one(m.i()), I(H, 15, 'ml')];
    macros(ings, 4); // garde-fou : lève si les macros sont incohérentes
    const [tmin, tdeg] = p.t;
    push(rec(`${p.n} rôti ${m.n} & ${g.n}`, 'diner', {
      prep: 15, cuisson: tmin + 8, difficulte: 'facile', cuisine: c, conservation: 3,
      ustensiles: [...FOUR, 'Économe'],
      instructions: [
        `Sortez la protéine du frigo 20 min avant (cuisson homogène) et préchauffez le four à ${tdeg}°C (${tdeg - 20}°C chaleur tournante).`,
        `Épluchez et coupez ${g.n} en cubes de 3 cm à l\u2019économe et au couteau de chef, dans un saladier.`,
        'Préparez la marinade dans un bol : mélangez les ingrédients cités avec 1 cas d\u2019huile, sel et poivre.',
        `Enrobez généreusement la protéine de marinade au pinceau (dessus et dessous) et laissez reposer le temps de préparer la garniture.`,
        `Disposez le tout dans un plat à rôtir tapissé de papier cuisson, la protéine au centre, ${g.n} autour, arrosés du reste d\u2019huile.`,
        `Enfournez ${tmin} min à ${tdeg}°C : remuez la garniture à mi-cuisson et arrosez la protéine avec son jus.`,
        `Vérifiez la cuisson à la pointe du couteau : les cubes de ${g.n} doivent être fondants. (Variante air fryer : 15 min à 200°C pour la garniture seule.)`,
        'Sortez du four, couvrez de papier alu 5-8 min : les jus se redistribuent et tout reste juteux.',
        'Servez avec persil ou coriandre ciselé et un quartier de citron.',
      ],
      ingredients: ings,
    }));
  }
}

// ── 4. POÊLÉS (120) ─────────────────────────────────────────────────────────
const PROTS_P = [
  { n: 'poulet', i: () => I('Filet de poulet', 450) },
  { n: 'dinde', i: () => I('Filet de dinde', 450) },
  { n: 'bœuf haché', i: () => I('Bœuf haché 5 %', 450) },
  { n: 'porc', i: () => I('Filet mignon de porc', 450) },
  { n: 'crevettes', i: () => I('Crevettes', 400) },
  { n: 'saumon', i: () => I('Pavé de saumon', 450) },
  { n: 'tofu', i: () => I('Tofu ferme', 350) },
  { n: 'pois chiches', i: () => I('Pois chiches (bte)', 400) },
] as const;
const SAUCES_P2 = [
  { n: 'crème-moutarde', i: () => [I('Crème fraîche épaisse', 150), I('Moutarde', 15)], c: 'Française' },
  { n: 'tomate-basilic', i: () => [I('Tomate concassée (bte)', 400), I('Basilic', 0.5)], c: 'Italienne' },
  { n: 'soja-gingembre-miel', i: () => [I('Sauce soja', 40, 'ml'), I('Gingembre', 15), I('Miel', 20)], c: 'Asiatique' },
  { n: 'citron & persil', i: () => [I('Citron', 1), I('Persil', 0.5)], c: 'Française' },
  { n: 'curry-coco', i: () => [I('Lait de coco', 200, 'ml'), I('Curry en poudre', 1, 'cas')], c: 'Indienne' },
  { n: 'paprika-crème', i: () => [I('Paprika fumé', 1, 'cas'), I('Crème fraîche épaisse', 150)], c: 'Espagnole' },
] as const;
const ACC_P = [
  { n: 'riz basmati', i: () => I('Riz basmati', 300) },
  { n: 'semoule', i: () => I('Semoule fine', 300) },
  { n: 'pommes de terre sautées', i: () => I('Pomme de terre', 600) },
  { n: 'pâtes penne', i: () => I('Pâtes penne', 350) },
  { n: 'quinoa', i: () => I('Quinoa', 300) },
] as const;

function buildPoeles(n: number) {
  for (const p of PROTS_P) for (const s of SAUCES_P2) for (const a of ACC_P) {
    if (cap(n)) return;
    const ings = [...one(p.i()), ...one(s.i()), ...one(a.i()), I(H, 20, 'ml'), I(O, 1)];
    macros(ings, 4); // garde-fou : lève si les macros sont incohérentes
    push(rec(`Poêlé de ${p.n} ${s.n} & ${a.n}`, 'diner', {
      prep: 15, cuisson: 25, difficulte: 'facile', cuisine: s.c, conservation: 3,
      ustensiles: [...POELE, 'Casserole'],
      instructions: [
        `Lancez la cuisson du ${a.n} selon le paquet (12-18 min) dans une casserole d\u2019eau salée bouillante.`,
        `Émincez l\u2019oignon et l\u2019ail au couteau de chef. ${p.n === 'pois chiches' ? 'Égouttez et séchez les pois chiches.' : `Découpez le ${p.n} en morceaux réguliers de 2 cm, salez, poivre.`}`,
        `${HU} dans une grande poêle, faites colorer l\u2019oignon 3 min puis réservez.`,
        `Saisissez le ${p.n} 6-8 min à feu vif en remuant : il doit être doré sur toutes les faces (pas besoin d\u2019être à cœur pour le poulet fin, 74°C au thermomètre sinon).`,
        'Remettez l\u2019oignon, ajoutez les éléments de la sauce et laissez mijoter 5-6 min à feu moyen.',
        'Goûtez et rectifiez : la sauce doit napper la viande sans la noyer.',
        `Égouttez le ${a.n} et mélangez-le 1 min dans la poêle pour qu\u2019il s\u2019imprègne.`,
        'Servez bien chaud, parsemé d\u2019herbes fraîches ciselées.',
      ],
      ingredients: ings,
    }));
  }
}

// ── 5. WOK & NOODLES (80) ───────────────────────────────────────────────────
const NOODLES = ['Nouilles de riz', 'Nouilles chinoises', 'Nouilles soba'] as const;
const WPROT = [
  { n: 'poulet', i: () => I('Filet de poulet', 400) },
  { n: 'crevettes', i: () => I('Crevettes', 350) },
  { n: 'tofu', i: () => I('Tofu ferme', 300) },
  { n: 'bœuf', i: () => I('Bœuf haché 5 %', 400) },
  { n: 'porc', i: () => I('Filet mignon de porc', 400) },
] as const;
const WSAUCE = [
  { n: 'légumes croquants sauce soja-gingembre', i: () => [I('Carotte', 2), I('Poivron rouge', 1), I('Chou rouge', 200), I('Sauce soja', 40, 'ml'), I('Gingembre', 15)] },
  { n: 'thaï au lait de coco & curry', i: () => [I('Lait de coco', 200, 'ml'), I('Curry en poudre', 1, 'cas'), I('Poivron rouge', 1), I('Petit pois (surg.)', 100)] },
  { n: 'satay au beurre de cacahuète', i: () => [I('Beurre de cacahuète', 40), I('Sauce soja', 30, 'ml'), I('Citron', 0.5), I('Concombre', 0.5)] },
  { n: 'sésame & citron', i: () => [I('Graines de sésame', 15), I('Citron', 1), I('Sauce soja', 30, 'ml'), I('Brocoli', 250)] },
  { n: 'teriyaki maison', i: () => [I('Sauce soja', 40, 'ml'), I('Miel', 25), I('Gingembre', 10), I('Oignon rouge', 1)] },
] as const;

function buildWok(n: number) {
  for (const no of NOODLES) for (const p of WPROT) for (const s of WSAUCE) {
    if (cap(n)) return;
    const ings = [I(no, 320), ...one(p.i()), ...one(s.i()), I(H, 20, 'ml'), I(A, 2, 'pcs')];
    macros(ings, 4); // garde-fou : lève si les macros sont incohérentes
    push(rec(`Wok de ${no.toLowerCase()} au ${p.n}, ${s.n}`, 'diner', {
      prep: 15, cuisson: 12, difficulte: 'facile', cuisine: 'Asiatique', conservation: 2,
      ustensiles: [...CAT, 'Wok', 'Casserole'],
      instructions: [
        `Faites tremper / cuire les nouilles selon le paquet (souvent 4-8 min), égouttez et rincez à l\u2019eau froide pour stopper la cuisson.`,
        `Découpez le ${p.n} en fines lamelles ou dés (cuisson flash au wok). Émincez ail et gingembre très finement.`,
        'Coupez tous les légumes en julienne ou dés fins de taille homogène : au wok tout cuit en quelques minutes.',
        'Préparez la sauce dans un bol à part (mélangez les ingrédients cités) — au wok on n\u2019a pas le temps de mesurer.',
        'Faites chauffer le wok à feu vif jusqu\u2019à ce qu\u2019il fume légèrement, versez 1 cas d\u2019huile.',
        `Saisissez le ${p.n} 3-4 min en remuant constamment, réservez.`,
        'Ajoutez 1 cas d\u2019huile puis les légumes : 3-4 min de sauté permanent, ils doivent rester croquants et brillants.',
        'Rendez les nouilles et la sauce au wok, 2 min de sautés à feu vif : tout doit s\u2019enrober et s\u2019évaporer presque à sec.',
        'Rajoutez le ' + p.n + ', parsemez de graines de sésame et de coriandre, servez immédiatement dans les bols chauds.',
      ],
      ingredients: ings,
    }));
  }
}

// ── 6. MIJOTÉS / CURRY / TAJINE (45) — combos curatés ───────────────────────
function buildMijotes(n: number) {
  const combos: Rec[] = [];
  const curry = (p: { n: string; i: Ing[]; step: string } ) => {
    const ings = [I(O, 2), I(A, 2, 'pcs'), I('Gingembre', 15), I('Curry en poudre', 1, 'cas'), I('Curcuma', 1, 'cac'), I('Lait de coco', 400, 'ml'), I('Tomate concassée (bte)', 200), ...p.i, I('Coriandre fraîche', 0.5), I('Citron', 0.5)];
    macros(ings, 4); // garde-fou : lève si les macros sont incohérentes
    return rec(`Curry de ${p.n} au lait de coco`, 'diner', {
      prep: 15, cuisson: 30, difficulte: 'facile', cuisine: 'Indienne', conservation: 4,
      ustensiles: [...CAT, 'Cocotte', 'Passoire'],
      instructions: [
        'Émincez oignon, ail et gingembre au couteau de chef : c\u2019est la base aromatique du curry.',
        'Faites suer l\u2019oignon 4 min dans une cocotte avec 2 cas d\u2019huile, sans colorer.',
        'Ajoutez ail, gingembre, curry et curcuma : torréfiez 30 s en remuant, les épices doivent embaumer la cuisine (brûlées = amères).',
        'Versez la tomate concassée et le lait de coco, portez à frémissement.',
        p.step,
        'Laissez mijoter 20-25 min à petit feu couvert : la sauce épaissit et prend une belle couleur dorée.',
        'Goûtez : ajustez sel, un trait de citron pour l\u2019acidité, éventuellement une pincée de sucre si l\u2019acidité de la tomate domine.',
        'Parsemez de coriandre fraîche et servez avec du riz basmati.',
      ],
      ingredients: ings,
    });
  };
  combos.push(curry({ n: 'poulet', i: [I('Filet de poulet', 450)], step: 'Ajoutez les dés de poulet et enrobez-les de sauce.' }));
  combos.push(curry({ n: 'cabillaud', i: [I('Dos de cabillaud', 450)], step: 'Posez les pavés de cabillaud dans la sauce frémissante, couvrez : 10 min de pochage doux suffisent, ne remuez pas (le poisson s\u2019émietterait).' }));
  combos.push(curry({ n: 'crevettes', i: [I('Crevettes', 400)], step: 'Ajoutez les crevettes décortiquées 5 min avant la fin : elles cuisent en un rien de temps.' }));
  combos.push(curry({ n: 'patate douce & épinards', i: [I('Patate douce', 500), I('Épinards frais', 200)], step: 'Ajoutez les cubes de patate douce, couvrez 18 min, puis incorporez les épinards 3 min (ils tombent presque instantanément).' }));
  combos.push(curry({ n: 'pois chiches', i: [I('Pois chiches (bte)', 480)], step: 'Ajoutez les pois chiches égouttés et laissez-les s\u2019imprégner 15 min à petit feu.' }));
  combos.push(curry({ n: 'lentilles corail', i: [I('Lentilles corail', 250)], step: 'Versez les lentilles rincées directement dans la sauce avec 200 ml d\u2019eau : comptez 20 min, elles s\u2019écrasent légèrement et lient le curry.' }));

  const tajine = (p: { n: string; i: Ing[]; step: string }, extra: { n: string; i: Ing[] }) => {
    const ings = [I(O, 2), I('Ras-el-hanout', 1, 'cas'), I('Miel', 15), ...p.i, ...extra.i, I('Bouillon de volaille', 300, 'ml'), I('Amandes', 40), I('Persil', 0.5)];
    macros(ings, 4); // garde-fou : lève si les macros sont incohérentes
    return rec(`Tajine de ${p.n} ${extra.n}`, 'diner', {
      prep: 20, cuisson: 45, difficulte: 'moyen', cuisine: 'Orientale', conservation: 4,
      ustensiles: [...CAT, 'Cocotte'],
      instructions: [
        'Faites blondir les oignons émincés 5 min dans la cocotte avec 2 cas d\u2019huile.',
        'Ajoutez le ras-el-hanout, torréfiez 30 s : les épices doivent chanter sans brûler.',
        p.step,
        `Ajoutez ${extra.n}, le miel et le bouillon chaud à mi-hauteur des ingrédients.`,
        'Couvrez et laissez mijoter 40 min à feu très doux : la viande doit se détendre à la cuillère.',
        'Découvrez les 10 dernières minutes pour faire réduire la sauce en sirop brillant.',
        'Torréfiez les amandes 4 min à sec dans une poêle : elles doivent dorer sans noircir.',
        'Servez parsemé d\u2019amandes et de persil, avec de la semoule fine.',
      ],
      ingredients: ings,
    });
  };
  combos.push(tajine({ n: 'poulet', i: [I('Filet de poulet', 500)], step: 'Saisissez les morceaux de poulet 5 min dans la cocotte, ils doivent être dorés sur toutes les faces.' }, { n: 'abricots & amandes', i: [I('Carotte', 2)] }));
  combos.push(tajine({ n: 'agneau', i: [I('Épaule d\u2019agneau', 500)], step: 'Faites dorer les cubes d\u2019agneau 6-8 min, par petites quantités, pour saisir sans faire rendre l\u2019eau.' }, { n: 'pruneaux & sésame', i: [I('Patate douce', 300)] }));
  combos.push(tajine({ n: 'légumes', i: [I('Courge butternut', 400), I('Carotte', 3)], step: 'Ajoutez les légumes en gros cubes et enrobez-les des épices 3 min avant de mouiller.' }, { n: 'pois chiches & citron', i: [I('Pois chiches (bte)', 300)] }));

  const dahl = (leg: { n: string; i: Ing }) => {
    const ings = [I('Lentilles corail', 280), I('Lait de coco', 200, 'ml'), I(O, 1), I(A, 2, 'pcs'), I('Curcuma', 1, 'cas'), I('Cumin', 1, 'cas'), leg.i, I('Épinards frais', 100)];
    macros(ings, 4); // garde-fou : lève si les macros sont incohérentes
    return rec(`Dahl de lentilles corail au ${leg.n}`, 'diner', {
      prep: 10, cuisson: 30, difficulte: 'facile', cuisine: 'Indienne', conservation: 4,
      ustensiles: [...CAT, 'Casserole', 'Passoire'],
      instructions: [
        'Rincez les lentilles corail à la passoire jusqu\u2019à ce que l\u2019eau soit claire.',
        'Faites suer l\u2019oignon et l\u2019ail 4 min dans une casserole avec 2 cas d\u2019huile.',
        'Ajoutez curcuma et cumin, torréfiez 30 s en remuant.',
        'Versez les lentilles, le lait de coco et 400 ml d\u2019eau, portez à frémissement.',
        `Ajoutez ${leg.n} et laissez cuire 22-25 min à petit feu : les lentilles doivent s\u2019écraser à la cuillère.`,
        'Incorporez les épinards 3 min avant la fin, ils fondent dans la chaleur résiduelle.',
        'Salez en fin de cuisson (les lentilles durcissent si on sale trop tôt) et servez avec du riz.',
      ],
      ingredients: ings,
    });
  };
  combos.push(dahl({ n: 'patate douce', i: I('Patate douce', 300) }));
  combos.push(dahl({ n: 'chou-fleur', i: I('Chou-fleur', 400) }));
  combos.push(dahl({ n: 'courge butternut', i: I('Courge butternut', 350) }));  const chili = (p: { n: string; i: Ing[]; step: string } ) => {
    const ings = [I(O, 2), I('Poivron rouge', 2), I('Tomate concassée (bte)', 800), I('Haricots rouges (bte)', 480), I('Cumin', 1, 'cas'), I('Paprika fumé', 1, 'cas'), I('Piment doux', 1, 'cac'), ...p.i];
    macros(ings, 4); // garde-fou : lève si les macros sont incohérentes
    return rec(`Chili de ${p.n}`, 'diner', {
      prep: 15, cuisson: 35, difficulte: 'facile', cuisine: 'Mexicaine', conservation: 4,
      ustensiles: [...CAT, 'Cocotte', 'Ouverture-boîte'],
      instructions: [
        'Émincez oignons et poivrons au couteau de chef.',
        'Faites-les suer 5 min dans la cocotte avec 2 cas d\u2019huile.',
        p.step,
        'Ajoutez épices (cumin, paprika fumé, piment doux) : torréfiez 30 s.',
        'Versez les tomates concassées, écrasez grossièrement à la cuillère en bois.',
        `Ajoutez les haricots rouges égouttés et laissez mijoter 25 min à couvert, en remuant de temps en temps : le chili doit être épais, jamais sec.`,
        'Goûtez et ajustez : plus de piment pour les audacieux, une pointe de cacao ou de sucre pour arrondir l\u2019acidité.',
        'Servez avec du riz, de la crème fraîche et du fromage râpé.',
      ],
      ingredients: ings,
    });
  };
  combos.push(chili({ n: 'bœuf', i: [I('Bœuf haché 5 %', 500)], step: 'Ajoutez le bœuf haché et émiettez-le à la cuillère en bois : 6-8 min jusqu\u2019à ce qu\u2019il soit bien doré (pas gris).' }));
  combos.push(chili({ n: 'légumes', i: [I('Courge butternut', 400), I('Maïs (bte)', 200)], step: 'Ajoutez les cubes de butternut et le maïs, enrobez des sucs 3 min.' }));
  combos.push(chili({ n: 'tofu', i: [I('Tofu ferme', 400)], step: 'Émiettez le tofu à la main et saisissez-le 6 min pour le dorer avant d\u2019ajouter les épices.' }));

  for (const c of combos) { if (cap(n)) return; push(c); }
}

// ── 7. SOUPES & VELOUTÉS (40) ───────────────────────────────────────────────
const SOUP_VEG = [
  { n: 'courgettes', i: () => I('Courgette', 800) },
  { n: 'tomates', i: () => I('Tomate concassée (bte)', 800) },
  { n: 'courge butternut', i: () => I('Courge butternut', 800) },
  { n: 'poireaux & pommes de terre', i: () => [I('Poireau', 2), I('Pomme de terre', 400)] },
  { n: 'champignons', i: () => I('Champignons de Paris', 600) },
  { n: 'petit pois & menthe', i: () => [I('Petit pois (surg.)', 600), I('Menthe fraîche', 0.5)] },
  { n: 'carottes', i: () => I('Carotte', 700) },
  { n: 'brocoli', i: () => I('Brocoli', 700) },
  { n: 'chou-fleur', i: () => I('Chou-fleur', 700) },
  { n: 'tomates & lentilles corail', i: () => [I('Tomate concassée (bte)', 800), I('Lentilles corail', 180)] },
] as const;
const SOUP_STYLES: { n: string; extra: () => Ing[]; s: string; mix: boolean; froid?: boolean }[] = [
  { n: 'velouté à la crème', extra: () => [I('Crème fraîche épaisse', 100)], s: 'hiver', mix: true },
  { n: 'potage rustique', extra: () => [I('Pomme de terre', 200)], s: 'hiver', mix: false },
  { n: 'soupe épicée au lait de coco', extra: () => [I('Lait de coco', 150, 'ml'), I('Curry en poudre', 1, 'cas')], s: 'toutes', mix: true },
  { n: 'soupe froide d\u2019été', extra: () => [I('Menthe fraîche', 0.5), I('Citron', 0.5)], s: 'ete', mix: true, froid: true },
];

function buildSoupes(n: number) {
  for (const v of SOUP_VEG) for (const st of SOUP_STYLES) {
    if (cap(n)) return;
    const vi = v.i();
    const ings = [...(Array.isArray(vi) ? vi : [vi]), I(O, 1), I(A, 1, 'pcs'), I('Bouillon de légumes', 700, 'ml'), ...st.extra()];
    macros(ings, 4); // garde-fou : lève si les macros sont incohérentes
    const base = `Soupe ${st.n.includes('froide') ? 'froide' : ''} de ${v.n} ${st.n}`.replace('Soupe  de', 'Soupe de');
    push(rec(base, 'diner', {
      prep: 15, cuisson: 30, difficulte: 'facile', cuisine: 'Française', saison: st.s === 'ete' ? 'ete' : 'hiver',
      conservation: 4, portions: 4,
      ustensiles: [...CAT, 'Casserole', 'Mixeur'],
      instructions: [
        'Épluchez et coupez les légumes en morceaux réguliers (la taille compte : une cuisson homogène = un mixage lisse).',
        'Faites suer l\u2019oignon émincé 4 min dans une casserole avec 1 cas d\u2019huile, sans colorer.',
        'Ajoutez les légumes, l\u2019ail écrasé, et mouillez au bouillon à hauteur.',
        st.mix
          ? 'Couvrez et laissez cuire 25 min à petit feu : les légumes doivent s\u2019écraser à la fourchette.'
          : 'Couvrez et laissez frémir 30 min : les légumes restent en morceaux, le bouillon doit être parfumé.',
        st.mix ? 'Mixez au mixeur plongeant directement dans la casserole, 1-2 min, jusqu\u2019à une texture parfaitement veloutée.' : 'Goûtez le bouillon et rectifiez l\u2019assaisonnement.',
        st.froid ? 'Laissez tiédir puis réfrigérez 2 h minimum : cette soupe se déguste bien fraîche.' : 'Incorporez la finition (crème ou lait de coco) hors du feu, sans faire bouillir après ajout.',
        'Goûtez une dernière fois : un velouté réussi est toujours un peu plus salé qu\u2019on ne croit.',
        'Servez avec des croûtons dorés au four et un filet d\u2019huile d\u2019olive.',
      ],
      ingredients: ings,
    }));
  }
}

// ── 8. TARTE / QUICHE / CAKE SALÉ (45) ──────────────────────────────────────
const TART_GARNISH = [
  { n: 'poireaux & comté', i: () => [I('Poireau', 2), I('Comté', 120)] },
  { n: 'courgettes & chèvre', i: () => [I('Courgette', 3), I('Chèvre frais', 120)] },
  { n: 'épinards & feta', i: () => [I('Épinards frais', 300), I('Feta', 120)] },
  { n: 'champignons & gruyère', i: () => [I('Champignons de Paris', 400), I('Gruyère râpé', 120)] },
  { n: 'tomates & moutarde', i: () => [I('Tomate', 4), I('Moutarde', 20)] },
  { n: 'lardons & oignons', i: () => [I('Lardons fumés', 180), I(O, 2)] },
  { n: 'saumon fumé & aneth', i: () => [I('Saumon fumé', 200)], c: 'Nordique' },
  { n: 'courge butternut & sauge', i: () => [I('Courge butternut', 500)] },
  { n: 'poivrons & feta', i: () => [I('Poivron rouge', 2), I('Feta', 120)] },
] as const;
const TART_FMT = [
  { n: 'quiche', pate: 'Pâte brisée', app: 'Quiche', lorr: true },
  { n: 'tarte fine', pate: 'Pâte feuilletée', app: 'Tarte fine' },
  { n: 'tourte', pate: 'Pâte brisée', app: 'Tourte' },
] as const;

function buildTartes(n: number) {
  for (const f of TART_FMT) for (const g of TART_GARNISH) {
    if (cap(n)) return;
    const ings = [I(f.pate, 1), ...g.i(), I('Œuf', 3), I('Crème fraîche épaisse', 200), I('Lait', 100, 'ml'), I('Gruyère râpé', 60)];
    macros(ings, 6); // garde-fou : lève si les macros sont incohérentes
    push(rec(`${f.app} ${g.n}`, 'diner', {
      prep: 20, cuisson: 40, difficulte: 'moyen', cuisine: 'Française', conservation: 3, portions: 6,
      ustensiles: [...CAT, 'Four', 'Moule à manqué', 'Rouleau à pâtisserie'],
      instructions: [
        'Préchauffez le four à 190°C (170°C chaleur tournante).',
        `Étalez la ${f.pate.toLowerCase()} au rouleau sur un plan légèrement fariné, foncez le moule, piquez le fond à la fourchette.`,
        'Précuisez le fond 10 min à blanc (papier cuisson + billes ou légumes secs) : il restera croustillant malgré la garniture humide.',
        'Pendant ce temps, préparez la garniture : faites revenir les légumes 8-10 min pour chasser leur eau de végétation (sinon la pâte détrempée).',
        'Battez les œufs en omelette avec la crème, le lait, sel, poivre et une pincée de muscade.',
        `Répartissez ${g.n} sur le fond précuit, versez l\u2019appareil œufs-crème par-dessus, parsemez de gruyère.`,
        `Enfournez 35-40 min à 190°C : la lame d\u2019un couteau doit ressortir propre et le dessus doit être joliment doré.`,
        'Laissez tiédir 10 min avant de démouler : la quiche se tient mieux tiède que brûlante.',
        'Servez avec une salade verte vinaigrée.',
      ],
      ingredients: ings,
    }));
  }
}

// ── 9. SALADES & BOWLS (120) ────────────────────────────────────────────────
const SAL_BASE: { n: string; i: () => Ing; cuit?: boolean }[] = [
  { n: 'roquette', i: () => I('Roquette', 150) },
  { n: 'mâche', i: () => I('Mâche', 150) },
  { n: 'quinoa', i: () => I('Quinoa', 250), cuit: true },
  { n: 'boulgour', i: () => I('Boulgour', 250), cuit: true },
  { n: 'semoule', i: () => I('Semoule fine', 250), cuit: true },
  { n: 'riz complet', i: () => I('Riz complet', 250), cuit: true },
  { n: 'pâtes froides', i: () => I('Fusilli', 300) },
  { n: 'lentilles vertes', i: () => I('Lentilles vertes', 300), cuit: true },
];
const SAL_PROT = [
  { n: 'feta & olives', i: () => [I('Feta', 150), I('Olives noires', 60)] },
  { n: 'poulet grillé', i: () => I('Filet de poulet', 350) },
  { n: 'saumon fumé', i: () => I('Saumon fumé', 250) },
  { n: 'thon', i: () => I('Thon au naturel', 240) },
  { n: 'œuf dur', i: () => I('Œuf', 5) },
  { n: 'crevettes', i: () => I('Crevettes', 300) },
  { n: 'pois chiches rôtis', i: () => I('Pois chiches (bte)', 400) },
  { n: 'tofu mariné', i: () => I('Tofu ferme', 300) },
] as const;
const SAL_DRESS: { n: string; i: () => Ing[]; c?: string }[] = [
  { n: 'vinaigrette balsamique', i: () => [I('Vinaigre balsamique', 30, 'ml'), I(H, 40, 'ml'), I('Moutarde', 5)] },
  { n: 'citron & herbes', i: () => [I('Citron', 1), I(H, 40, 'ml'), I('Herbes de Provence', 1, 'cas')] },
  { n: 'yaourt-menthe', i: () => [I('Yaourt nature', 150, 'g'), I('Menthe fraîche', 0.3), I('Citron', 0.5)] },
  { n: 'avocat & citron', i: () => [I('Avocat', 1), I('Citron', 0.5), I(H, 20, 'ml')] },
  { n: 'soja-sésame-miel', i: () => [I('Sauce soja', 30, 'ml'), I('Graines de sésame', 10), I('Miel', 15)], c: 'Asiatique' },
];

function buildSalades(n: number) {
  for (const b of SAL_BASE) for (const p of SAL_PROT) for (const d of SAL_DRESS) {
    if (cap(n)) return;
    const ings = [...one(b.i()), ...one(p.i()), ...one(d.i()), I('Tomates cerises', 200), I('Concombre', 0.5)];
    macros(ings, 4); // garde-fou : lève si les macros sont incohérentes
    push(rec(`Salade ${b.n} au ${p.n}, ${d.n}`, 'dejeuner', {
      prep: 15, cuisson: b.cuit ? 15 : 0, difficulte: 'facile', cuisine: d.c ?? 'Méditerranéenne',
      conservation: 2, portions: 4, ustensiles: [...CAT, 'Casserole', 'Presse-agrume'],
      instructions: [
        b.cuit ? `Cuisez ${b.n} selon le paquet, égouttez et laissez tiédir à plat sur une assiette (il ne doit pas continuer à cuire dans sa vapeur).` : 'Lavez et essorez soigneusement les feuilles : une salade mouillée dilue la vinaigrette.',
        `Préparez le ${p.n} : ${p.n === 'poulet grillé' ? 'saisissez les filets 6-7 min à la poêle puis tranchez-les finement après 5 min de repos.' : p.n === 'œuf dur' ? 'cuisez les œufs 9 min dans l\u2019eau bouillante, refroidissez à l\u2019eau glacée, écalez, coupez en quartiers.' : p.n === 'crevettes' ? 'pochez les crevettes 3 min dans l\u2019eau bouillante salée, égouttez.' : 'émiettez, tranchez ou disposez tel quel selon l\u2019ingrédient.'}`,
        'Coupez tomates cerises en deux et concombre en dés : la garniture doit tenir dans la fourchette.',
        `Préparez la vinaigrette ${d.n} dans un bol : émulsionnez énergiquement à la fourchette, elle doit blanchir légèrement.`,
        'Assaisonnez le contenant (base + légumes) avec la moitié de la vinaigrette, mélangez à la main ou à deux cuillères.',
        'Répartissez dans les assiettes, disposez le ' + p.n + ' harmonieusement par-dessus.',
        'Arrosez du reste de vinaigrette juste avant de servir.',
        b.cuit ? 'Servez tiède ou après 30 min au frais : cette salade se prête très bien au meal prep du dimanche.' : 'Servez immédiatement, les feuilles doivent rester croquantes.',
      ],
      ingredients: ings,
    }));
  }
}

// ── 10. GRATINS (27) ────────────────────────────────────────────────────────
const GRAT_BASE = [
  { n: 'pommes de terre', i: () => I('Pomme de terre', 900) },
  { n: 'courgettes', i: () => I('Courgette', 800) },
  { n: 'chou-fleur', i: () => I('Chou-fleur', 800) },
  { n: 'brocoli', i: () => I('Brocoli', 800) },
  { n: 'patates douces', i: () => I('Patate douce', 900) },
  { n: 'épinards', i: () => I('Épinards frais', 600) },
] as const;
const GRAT_BIND = [
  { n: 'béchamel & gruyère', i: () => [I('Lait', 500, 'ml'), I('Beurre', 40), I('Farine', 40), I('Gruyère râpé', 120)] },
  { n: 'crème & comté', i: () => [I('Crème liquide', 300, 'ml'), I('Comté', 150)] },
  { n: 'crème & chèvre', i: () => [I('Crème liquide', 300, 'ml'), I('Chèvre frais', 130)] },
] as const;

function buildGratins(n: number) {
  for (const b of GRAT_BASE) for (const bd of GRAT_BIND) {
    if (cap(n)) return;
    const ings = [...one(b.i()), ...one(bd.i()), I(A, 1, 'pcs')];
    macros(ings, 6); // garde-fou : lève si les macros sont incohérentes
    push(rec(`Gratin de ${b.n} ${bd.n}`, 'diner', {
      prep: 20, cuisson: 45, difficulte: 'facile', cuisine: 'Française', saison: 'hiver', conservation: 3, portions: 6,
      ustensiles: [...CAT, 'Four', 'Casserole', 'Fouet', 'Moule à gratin', 'Râpe'],
      instructions: [
        'Préchauffez le four à 180°C.',
        `Pare et découpez ${b.n} en tranches ou fleurettes de 1 cm d\u2019épaisseur (cuisson régulière).`,
        'Précuisez-les 8 min dans l\u2019eau bouillante salée : ils continueront de cuire au four sans rester croquants.',
        bd.n.startsWith('béchamel')
          ? 'Préparez la béchamel : faites fondre le beurre, ajoutez la farine, cuisez 1 min en fouettant, puis versez le lait froid progressivement en fouettant jusqu\u2019à épaississement (2-3 min).'
          : 'Portez la crème à frémissement avec l\u2019ail écrasé, une pincée de muscade, sel et poivre, puis retirez du feu.',
        'Égouttez soigneusement les légumes et disposez-les dans le moule à gratin.',
        'Nappez de la préparation crémeuse, parsemez généreusement de fromage râpé ou émietté.',
        'Enfournez 40-45 min : le dessus doit être doré avec des taches brun foncé (réaction de gratin).',
        'Laissez reposer 10 min avant de servir : le gratin se tient au lieu de couler.',
      ],
      ingredients: ings,
    }));
  }
}

// ── 11. WRAPS / BURGERS / PITAS (40) ────────────────────────────────────────
const WRAP_FILL = [
  { n: 'poulet croustillant', i: () => I('Filet de poulet', 450), c: 'Américaine' },
  { n: 'bœuf', i: () => I('Bœuf haché 5 %', 450), c: 'Américaine' },
  { n: 'thon & yaourt', i: () => I('Thon au naturel', 240), c: 'Française' },
  { n: 'falafels', i: () => I('Pois chiches (bte)', 480), c: 'Orientale' },
  { n: 'halloumi grillé', i: () => I('Halloumi', 300), c: 'Méditerranéenne' },
  { n: 'crevettes & avocat', i: () => I('Crevettes', 350), c: 'Méditerranéenne' },
] as const;
const WRAP_FMT = ['wrap', 'pita', 'burger maison', 'tacos'] as const;

function buildWraps(n: number) {
  for (const f of WRAP_FILL) for (const fmt of WRAP_FMT) {
    if (cap(n)) return;
    const pain = fmt === 'pita' ? 'Pains pita' : fmt === 'burger maison' ? 'Pains burger' : 'Tortillas de blé';
    ING[pain] = ING[pain] ?? { m: [280, 9, 50, 5], r: 'boulangerie', u: 'pcs' };
    const ings = [I(pain, 4), ...one(f.i()), I('Yaourt nature', 100, 'g'), I('Mâche', 100), I('Tomate', 2)];
    macros(ings, 4); // garde-fou : lève si les macros sont incohérentes
    push(rec(`${fmt[0].toUpperCase()}${fmt.slice(1)} au ${f.n}`, 'dejeuner', {
      prep: 20, cuisson: 15, difficulte: 'facile', cuisine: f.c, conservation: 1, portions: 4,
      ustensiles: [...POELE, 'Four'],
      instructions: [
        `Préparez la garniture ${f.n} : ${f.n === 'falafels' ? 'mixez les pois chiches égouttés avec ail, persil, cumin et farine, façonnez des boulettes aplaties et faites-les dorer 4 min de chaque côté à la poêle dans 1 cm d\u2019huile.' : f.n === 'halloumi grillé' ? 'tranchez le halloumi en 8 et saisissez-le 2 min de chaque côté à la poêle sèche : il doit être doré et grésillant.' : f.n === 'poulet croustillant' ? 'enrobez les escalopes de chapelure après un passage dans l\u2019œuf battu puis la farine, et faites-les dorer 4 min de chaque côté dans 5 mm d\u2019huile chaud.' : f.n === 'bœuf' ? 'formez 4 steaks de 2 cm, salez-les juste avant de les saisir 3 min de chaque côté à feu vif.' : 'cuisez ou préparez la protéine comme indiqué sur son emballage.'}`,
        'Préparez la sauce : yaourt, ail pressé, jus de citron, sel, poivre. Elle doit être crémeuse et acidulée.',
        'Lavez et essorez la salade, coupez les tomates en rondelles fines.',
        fmt === 'burger maison' ? 'Ouvrez les pains et faites-les toaster 2 min face coupée contre la poêle chaude ou au four à 180°C.' : 'Réchauffez les pains 30 s au four ou à la poêle : un pain tiède change tout.',
        'Garnissez : sauce au fond, salade, protéine, tomates, sauce encore au-dessus.',
        'Refermez le wrap en roulant serré (rentrez les bords), ou assemblez le burger / la pita.',
        'Coupez en deux en biais — c\u2019est plus joli et plus facile à tenir.',
        'Dégustez immédiatement, accompagné de crudités ou de frites au four.',
      ],
      ingredients: ings,
    }));
  }
}

// ── 12. ŒUFS & FRITTATAS (23) ───────────────────────────────────────────────
const OMEU_VEG = [
  { n: 'champignons', i: () => I('Champignons de Paris', 300) },
  { n: 'épinards & chèvre', i: () => [I('Épinards frais', 250), I('Chèvre frais', 100)] },
  { n: 'poivrons & feta', i: () => [I('Poivron rouge', 2), I('Feta', 100)] },
  { n: 'tomates & basilic', i: () => [I('Tomates cerises', 250), I('Basilic', 0.3)] },
  { n: 'courgettes & menthe', i: () => [I('Courgette', 2), I('Menthe fraîche', 0.3)] },
  { n: 'poireaux & comté', i: () => [I('Poireau', 1), I('Comté', 80)] },
] as const;

function buildOeufs(n: number) {
  for (const v of OMEU_VEG) {
    if (cap(n)) return;
    const fi = [I('Œuf', 8), ...one(v.i()), I('Gruyère râpé', 60), I(H, 20, 'ml')];
    macros(fi, 4); // garde-fou : lève si les macros sont incohérentes
    push(rec(`Frittata ${v.n}`, 'dejeuner', {
      prep: 10, cuisson: 20, difficulte: 'facile', cuisine: 'Italienne', conservation: 3, portions: 4,
      ustensiles: [...CAT, 'Poêle allant au four', 'Fouet', 'Four'],
      instructions: [
        'Battez les œufs au fouet avec sel, poivre et le fromage râpé : l\u2019appareil doit être homogène et mousseux.',
        `Faites revenir ${v.n} 6-8 min dans une poêle allant au four avec 1 cas d\u2019huile : l\u2019eau de végétation doit s\u2019évaporer.`,
        'Versez les œufs battus sur la garniture, inclinez la poêle pour bien répartir.',
        'Cuisez 5 min à feu doux : les bords prennent, le centre reste liquide.',
        'Parsemez de fromage puis glissez sous le gril du four 4-5 min à 220°C : la surface doit gonfler et dorer.',
        'Vérifiez la lame de couteau : elle doit ressortir sèche au centre.',
        'Laissez tiédir 5 min puis coupez en parts comme un gâteau : la frittata se sert chaude, tiède ou froide.',
        'Accompagnez d\u2019une salade verte pour un déjeuner complet.',
      ],
      ingredients: fi,
    }));
  }
  const omelettes = [
    { n: 'nature aux fines herbes', i: () => [I('Persil', 0.3), I('Ciboulette', 0.3)] },
    { n: 'au fromage', i: () => I('Gruyère râpé', 60) },
    { n: 'aux champignons', i: () => I('Champignons de Paris', 200) },
    { n: 'à la tomate & mozzarella', i: () => [I('Tomates cerises', 150), I('Mozzarella', 100)] },
  ] as const;
  for (const o of omelettes) {
    if (cap(n)) return;
    const ings = [I('Œuf', 6), ...one(o.i()), I('Beurre', 20)];
    macros(ings, 3); // garde-fou : lève si les macros sont incohérentes
    push(rec(`Omelette ${o.n}`, 'dejeuner', {
      prep: 5, cuisson: 6, difficulte: 'facile', cuisine: 'Française', conservation: 1, portions: 3,
      ustensiles: [...CAT, 'Poêle', 'Fouet'],
      instructions: [
        'Cassez les œufs dans un saladier, battez-les à la fourchette avec sel et poivre — pas de blanc/jaune séparés, une omelette rustique se bat grossièrement.',
        'Faites mousser le beurre dans une poêle antiadhésive à feu moyen-vif : il doit chantonner sans brunir.',
        'Versez les œufs. Laissez prendre 30 s puis, avec une spatule, ramenez les bords vers le centre en inclinant la poêle pour que le liquide s\u2019écoule dessous.',
        'Quand l\u2019omelette est encore baveuse au centre (c\u2019est la clé), ajoutez la garniture au milieu.',
        'Pliez en deux ou en trois, glissez-la sur le bord de l\u2019assiette : le dessus doit rester brillant.',
        'Servez immédiatement — une omelette n\u2019attend pas.',
      ],
      ingredients: ings,
    }));
  }
}

// ── 13. TARTINES & BRUSCHETTAS (25) ─────────────────────────────────────────
const TART_TOP = [
  { n: 'tomate-mozzarella-basilic', i: () => [I('Tomate', 3), I('Mozzarella', 250), I('Basilic', 0.3)] },
  { n: 'champignons-poêlés & chèvre', i: () => [I('Champignons de Paris', 350), I('Chèvre frais', 100)] },
  { n: 'avocat-œuf poché', i: () => [I('Avocat', 2), I('Œuf', 4)] },
  { n: 'thon & tomate confite', i: () => [I('Thon au naturel', 200), I('Tomate concassée (bte)', 200)] },
  { n: 'courgette-grillée & feta', i: () => [I('Courgette', 2), I('Feta', 120)] },
  { n: 'saumon fumé & fromage frais', i: () => [I('Saumon fumé', 200), I('Fromage blanc', 120)] },
  { n: 'ratatouille maison', i: () => [I('Aubergine', 1), I('Courgette', 1), I('Tomate concassée (bte)', 300)] },
  { n: 'champignons & œuf au plat', i: () => [I('Champignons de Paris', 300), I('Œuf', 4)] },
] as const;

function buildTartines(n: number) {
  for (const t of TART_TOP) {
    if (cap(n)) return;
    ING['Pain de campagne'] = ING['Pain de campagne'] ?? { m: [270, 9, 52, 2], r: 'boulangerie', u: 'tranche' };
    const ings = [I('Pain de campagne', 8, 'tranche'), ...one(t.i()), I(A, 1, 'pcs'), I(H, 30, 'ml')];
    macros(ings, 4); // garde-fou : lève si les macros sont incohérentes
    push(rec(`Tartines ${t.n}`, 'dejeuner', {
      prep: 12, cuisson: 8, difficulte: 'facile', cuisine: 'Méditerranéenne', conservation: 1, portions: 4,
      ustensiles: [...POELE, 'Four', 'Grille-pain'],
      instructions: [
        'Préchauffez le four à 200°C.',
        'Tranchez le pain de campagne épais (1,5 cm) : une tartine réussie commence par une bonne mie qui ne détrempe pas.',
        'Frottez chaque tranche avec la gousse d\u2019ail coupée, badigeonnez d\u2019huile d\u2019olive au pinceau.',
        'Faites dorer 6-8 min au four sur grille : les bords doivent croustillander sans durcir.',
        `Préparez la garniture (${t.n}) pendant que le pain dore : légumes poêlés 6-8 min, protéines assaisonnées, fromages tranchés.`,
        'Garnissez généreusement chaque tartine encore chaude — la chaleur révèle les arômes de la garniture.',
        'Terminez par un filet d\u2019huile d\u2019olive, poivre du moulin et herbes fraîches.',
        'Servez aussitôt avec une salade verte ou des bâtonnets de légumes.',
      ],
      ingredients: ings,
    }));
  }
}

// ── 14. DESSERTS (95) — crèmes, gâteaux, tartes, compotes, verrines ─────────
function buildDesserts(n: number) {
  const D = (args: Partial<Parameters<typeof rec>[2]>, titre: string, ings: Ing[], steps: string[], opt?: Partial<{ prep: number; cuisson: number; portions: number; conservation: number; difficulte: 'facile' | 'moyen'; saison: Rec['saison']; cuisine: string; ustensiles: string[] }>) => {
    if (cap(n)) return;
    push(rec(titre, 'dessert', {
      prep: opt?.prep ?? 15, cuisson: opt?.cuisson, difficulte: opt?.difficulte ?? 'facile',
      saison: opt?.saison ?? 'toutes', cuisine: opt?.cuisine ?? 'Française',
      portions: opt?.portions ?? 4, conservation: opt?.conservation ?? 3,
      ustensiles: opt?.ustensiles ?? [...CAT, 'Fouet', 'Casserole'],
      instructions: steps, ingredients: ings,
    }));
  };
  const UG = [...CAT, 'Fouet', 'Moule à manqué', 'Four'];

  // Panna cotta ×5
  const pannaF = [
    { n: 'vanille', extra: () => [I('Gousse de vanille', 1)] },
    { n: 'citron', extra: () => [I('Citron', 1)] },
    { n: 'café', extra: () => [I('Café soluble', 10)] },
    { n: 'framboise', extra: () => [I('Framboise', 150)] },
    { n: 'mangue', extra: () => [I('Mangue', 1)] },
  ];
  for (const f of pannaF) D({}, `Panna cotta à la ${f.n}`, [I('Crème liquide', 400, 'ml'), I('Lait', 100, 'ml'), I('Sucre', 70), I('Gélatine', 3, 'pcs'), ...f.extra(), I('Fruits rouges', 120)], [
    'Faites ramollir les feuilles de gélatine 5 min dans un bol d\u2019eau froide.',
    `Chauffez la crème, le lait et le sucre à feu moyen sans ébullition (${f.n !== 'vanille' ? 'avec l\u2019arôme ' + f.n + ' infusé 5 min à couvert' : 'gousse de vanille grattée infusée 5 min à couvert'}).`,
    'Hors du feu, essorez la gélatine et dissolvez-la dans la crème chaude en fouettant : elle doit disparaître totalement.',
    'Versez dans les verrines et laissez tiédir 20 min à température ambiante (pas de condensation au frigo).',
    'Réfrigérez 4 h minimum, idéalement une nuit : la texture doit trembler comme une crème.',
    'Servez avec un coulis de fruits mixés et quelques fruits frais entiers.',
  ], { prep: 15, cuisson: 5, conservation: 2, ustensiles: [...CAT, 'Casserole', 'Fouet', 'Verrines'] });

  // Mousses ×4
  const mousseF = [
    { n: 'chocolat noir', base: () => [I('Chocolat noir pâtissier', 200)] },
    { n: 'chocolat & orange', base: () => [I('Chocolat noir pâtissier', 180), I('Orange', 1)] },
    { n: 'café', base: () => [I('Café soluble', 15), I('Chocolat noir pâtissier', 120)] },
    { n: 'framboise (sans cuisson)', base: () => [I('Framboise', 250), I('Fromage blanc', 200), I('Crème liquide', 200, 'ml')] },
  ];
  for (const m of mousseF) D({}, `Mousse à la ${m.n}`, [...m.base(), I('Œuf', 4), I('Sucre', 30)], [
    'Séparez les blancs des jaunes avec soin — aucun trace de jaune dans les blancs, sinon ils ne montent pas.',
    'Montez les blancs en neige ferme avec une pincée de sel : ils doivent former des pics.',
    m.n.includes('framboise')
      ? 'Mixez les framboises, passez-les au tamis, mélangez au fromage blanc sucré, puis incorporez la crème fouettée.'
      : 'Faites fondre le chocolat au bain-marie à 50°C maximum, lissez, puis incorporez les jaunes un à un hors du feu.',
    'Incorporez les blancs en trois fois, avec une maryse, en soulevant la masse : on garde l\u2019air, on ne mélange pas en cercle.',
    'Répartissez dans les verrines et réfrigérez 4 h minimum.',
    'Servez tel quel ou avec quelques éclats de noisettes torréfiées.',
  ], { prep: 20, conservation: 2, ustensiles: [...CAT, 'Fouet', 'Bain-marie', 'Maryse'] });

  // Riz au lait & semoule ×4
  D({}, 'Riz au lait vanillé', [I('Riz arborio', 150), I('Lait', 700, 'ml'), I('Sucre', 80), I('Gousse de vanille', 1)], [
    'Rincez le riz à l\u2019eau claire puis égouttez-le.',
    'Portez le lait à frémissement avec le sucre et la gousse de vanille fendue et grattée.',
    'Versez le riz, remuez, puis cuisez 30-35 min à feu très doux couvert, en remuant toutes les 5 min (il attache vite au fond).',
    'Le riz doit être crémeux et les grains fondants : ajoutez un peu de lait si besoin en cours de cuisson.',
    'Versez dans un plat ou des verrines, filmez au contact.',
    'Servez tiède ou bien frais, avec un caramel maison ou une confiture de fruits rouges.',
  ], { prep: 5, cuisson: 35 });
  D({}, 'Semoule au lait & fruits secs', [I('Semoule fine', 140), I('Lait', 600, 'ml'), I('Sucre', 70), I('Raisins secs', 60), I('Cannelle', 1, 'cas')], [
    'Portez le lait à ébullition avec le sucre et la cannelle.',
    'Versez la semoule en pluie en remuant vivement pour éviter les grumeaux.',
    'Coupez le feu, couvrez et laissez gonfler 5 min hors du feu.',
    'Ajoutez les raisins secs (réhydratés 10 min dans du thé chaud, c\u2019est meilleur) et mélangez.',
    'Versez dans des coupes et réfrigérez 2 h.',
    'Servez saupoudré de cannelle et de quelques amandes effilées torréfiées.',
  ], { prep: 10, cuisson: 5 });

  // Cakes & moelleux ×14
  const cakes = [
    { n: 'yaourt & citron', i: () => [I('Yaourt nature', 2), I('Citron', 1), I('Farine', 180), I('Sucre', 150), I('Œuf', 3), I(H, 80, 'ml'), I('Levure chimique', 1)] },
    { n: 'yaourt & fruits rouges', i: () => [I('Yaourt nature', 2), I('Fruits rouges', 200), I('Farine', 180), I('Sucre', 150), I('Œuf', 3), I(H, 80, 'ml'), I('Levure chimique', 1)] },
    { n: 'yaourt & pépites de chocolat', i: () => [I('Yaourt nature', 2), I('Chocolat noir pâtissier', 100), I('Farine', 180), I('Sucre', 150), I('Œuf', 3), I(H, 80, 'ml'), I('Levure chimique', 1)] },
    { n: 'fondant au chocolat', i: () => [I('Chocolat noir pâtissier', 200), I('Beurre', 120), I('Œuf', 3), I('Sucre', 120), I('Farine', 60)], fon: true },
    { n: 'moelleux au chocolat & noisettes', i: () => [I('Chocolat noir pâtissier', 150), I('Noisettes', 80), I('Beurre', 100), I('Œuf', 3), I('Sucre', 110), I('Farine', 60)], fon: true },
    { n: 'cake à la banane & noix', i: () => [I('Banane', 3), I('Farine', 200), I('Sucre', 120), I('Œuf', 2), I('Beurre', 80), I('Noix', 60), I('Levure chimique', 1)] },
    { n: 'cake au citron glacé', i: () => [I('Citron', 2), I('Farine', 200), I('Sucre', 180), I('Œuf', 3), I('Beurre', 90), I('Levure chimique', 1)] },
    { n: 'muffins aux myrtilles', i: () => [I('Farine', 250), I('Myrtilles', 200), I('Sucre', 130), I('Œuf', 2), I('Beurre', 90), I('Levure chimique', 1), I('Lait', 150, 'ml')], muff: true },
    { n: 'muffins pépites de chocolat', i: () => [I('Farine', 250), I('Pépites de chocolat', 120), I('Sucre', 130), I('Œuf', 2), I('Beurre', 90), I('Levure chimique', 1), I('Lait', 150, 'ml')], muff: true },
    { n: 'brownie aux noix', i: () => [I('Chocolat noir pâtissier', 180), I('Beurre', 150), I('Sucre', 150), I('Œuf', 3), I('Farine', 80), I('Noix', 80)], fon: true },
    { n: 'crumble aux pommes', i: () => [I('Pomme', 6), I('Farine', 150), I('Beurre', 100), I('Sucre', 120), I('Amandes', 60), I('Cannelle', 1, 'cas')], cru: true },
    { n: 'clafoutis aux poires', i: () => [I('Poire', 4), I('Œuf', 3), I('Lait', 250, 'ml'), I('Farine', 90), I('Sucre', 90), I('Beurre', 30)] },
  ];
  for (const c of cakes) {
    const t = `Cake ${c.n}`.replace('Cake fondant', 'Fondant').replace('Cake moelleux', 'Moelleux').replace('Cake brownie', 'Brownie').replace('Cake crumble', 'Crumble').replace('Cake clafoutis', 'Clafoutis');
    D({}, t, c.i(), [
      'Préchauffez le four à 180°C (160°C chaleur tournante). Beurrez et farinez le moule.',
      'Mélangez les ingrédients secs d\u2019un côté (farine, levure, sucre) et les liquides de l\u2019autre.',
      c.fon
        ? 'Faites fondre le chocolat et le beurre au bain-marie doux (50°C max), lissez, laissez tiédir 3 min puis incorporez les œufs un à un.'
        : 'Fouettez les œufs avec le sucre jusqu\u2019à ce que le mélange blanchisse (1-2 min au fouet : c\u2019est ce qui donne le moelleux).',
      'Incorporez les ingrédients humides puis la farine en pluie, mélangez juste ce qu\u2019il faut : trop travailler la pâte la rend élastique.',
      'Ajoutez la garniture (fruits farinés au préalable pour ne pas couler au fond, pépites, noix torréfiées).',
      `Versez dans le moule et enfournez ${c.muff ? '20-22 min' : '40-45 min'} : la lame d\u2019un couteau plantée au centre doit ressortir sèche.`,
      'Laissez tiédir 10 min dans le moule puis démoulez sur une grille pour éviter la condensation.',
      'Dégustez tiède ou à température ambiante, conservé sous cloche 3-4 jours.',
    ], { prep: 15, cuisson: c.muff ? 22 : 45, conservation: 4, difficulte: 'facile', ustensiles: UG });
  }

  // Tartes douces ×8
  const tartesD = [
    { n: 'pommes & cannelle', i: () => [I('Pomme', 6), I('Cannelle', 1, 'cas')] },
    { n: 'poires & chocolat', i: () => [I('Poire', 4), I('Chocolat noir pâtissier', 100)] },
    { n: 'citron meringuée', i: () => [I('Citron', 3), I('Œuf', 3), I('Sucre', 150)] },
    { n: 'mangue & coco', i: () => [I('Mangue', 2), I('Noix de coco', 80), I('Crème liquide', 200, 'ml')] },
    { n: 'fruits rouges & crème d\u2019amande', i: () => [I('Fruits rouges', 300), I('Amandes', 100), I('Beurre', 60), I('Œuf', 1), I('Sucre', 80)] },
    { n: 'pomme & caramel au beurre salé', i: () => [I('Pomme', 5), I('Sucre', 100), I('Beurre', 60), I('Crème liquide', 100, 'ml')] },
    { n: 'banane & chocolat', i: () => [I('Banane', 3), I('Chocolat noir pâtissier', 100), I('Crème fraîche épaisse', 100)] },
    { n: 'ananas & vanille', i: () => [I('Ananas frais', 1), I('Gousse de vanille', 1), I('Sucre', 80)] },
  ];
  for (const t of tartesD) D({}, `Tarte ${t.n}`, [I('Pâte brisée', 1), ...t.i()], [
    'Préchauffez le four à 190°C. Étalez la pâte dans le moule, piquez le fond et précuisez-la 12 min à blanc.',
    'Préparez la garniture : fruits tranchés régulièrement (1 cm d\u2019épaisseur) pour une cuisson homogène.',
    t.n.includes('meringuée')
      ? 'Pressez les citrons, faites bouillir jus + sucre + fécule 2 min pour épaissir, puis ajoutez les jaunes hors du feu. Montez les blancs avec le sucre restant pour la meringue.'
      : 'Mélangez les éléments de la garniture selon la recette (appareil ou disposition directe des fruits).',
    'Versez ou disposez la garniture sur le fond précuit.',
    'Enfournez 30-35 min à 190°C : la pâte doit être dorée, la garniture à peine tremblotante au centre.',
    'Laissez refroidir sur une grille : les tartes aux fruits se dégustent tièdes, jamais brûlantes.',
    'Facultatif : un voile de sucre glace ou un nappage d\u2019abricot réchauffé pour la brillance.',
  ], { prep: 25, cuisson: 45, difficulte: 'moyen', conservation: 3, ustensiles: [...UG, 'Moule à tarte', 'Rouleau à pâtisserie'] });

  // Compotes & fruits pochés ×6
  const comps = [
    { n: 'pommes', i: () => [I('Pomme', 6)] },
    { n: 'pommes & framboises', i: () => [I('Pomme', 5), I('Framboise', 150)] },
    { n: 'poires & vanille', i: () => [I('Poire', 5), I('Gousse de vanille', 0.5)] },
    { n: 'pommes & mangue', i: () => [I('Pomme', 3), I('Mangue', 1)] },
    { n: 'fruits d\u2019hiver', i: () => [I('Pomme', 3), I('Poire', 3), I('Cannelle', 1, 'cas')] },
    { n: 'poires pochées au vin rouge', i: () => [I('Poire', 4), I('Vin rouge', 500, 'ml'), I('Sucre', 80), I('Cannelle', 1)], poch: true },
  ];
  for (const c of comps) D({}, c.poch ? `Poires pochées au vin rouge` : `Compote ${c.n}`, [...c.i(), I('Sucre', 50)], [
    c.poch
      ? 'Portez le vin à frémissement avec le sucre et la cannelle : le sirop doit épaissir légèrement (10 min).'
      : 'Épluchez, épépinez et coupez les fruits en cubes réguliers.',
    c.poch
      ? 'Plongez les poires épluchées entières dans le sirop frémissant, couvrez d\u2019un disque de papier cuisson : elles pochant 25 min sans bouillir.'
      : 'Mettez les fruits dans une casserole avec 2 cas d\u2019eau et le sucre, couvrez.',
    c.poch ? 'Retournez les poires à mi-cuisson pour une couleur uniforme.' : 'Laissez compoter 15 min à petit feu, remuez une fois.',
    c.poch ? 'Laissez refroidir dans le sirop : elles se colorent et se parfument en refroidissant.' : 'Écrasez à la fourchette (compote rustique) ou mixez (compote lisse).',
    'Goûtez : ajustez sucre et citron selon l\u2019acidité des fruits.',
    'Conservez en bocaux au frigo 4 jours, ou congelez en portions.',
  ], { prep: 10, cuisson: c.poch ? 30 : 15, conservation: 4 });

  // Verrines express ×14
  const verrF = [
    { n: 'yaourt, miel & noix', i: () => [I('Yaourt nature', 3), I('Miel', 30), I('Noix', 40)] },
    { n: 'yaourt grec & fruits rouges', i: () => [I('Yaourt nature', 3), I('Fruits rouges', 200), I('Miel', 20)] },
    { n: 'fromage blanc & pomme caramélisée', i: () => [I('Fromage blanc', 300), I('Pomme', 2), I('Beurre', 20), I('Sucre', 30)] },
    { n: 'fromage blanc & coulis de fruits', i: () => [I('Fromage blanc', 300), I('Fruits rouges', 200), I('Sucre', 20)] },
    { n: 'skyr & myrtilles', i: () => [I('Skyr', 300), I('Myrtilles', 150), I('Miel', 15)] },
    { n: 'skyr, banane & cacao', i: () => [I('Skyr', 300), I('Banane', 2), I('Cacao en poudre', 10)] },
    { n: 'chia & mangue', i: () => [I('Graines de chia', 60), I('Lait de coco', 400, 'ml'), I('Mangue', 1), I('Miel', 20)], nuit: true },
    { n: 'chia & framboise', i: () => [I('Graines de chia', 60), I('Yaourt nature', 300, 'g'), I('Framboise', 200), I('Miel', 20)], nuit: true },
    { n: 'tiramisu express au spéculoos', i: () => [I('Fromage blanc', 250), I('Spéculoos', 8), I('Café soluble', 10), I('Sucre', 30), I('Œuf', 2)] },
    { n: 'tiramisu aux fraises', i: () => [I('Fromage blanc', 250), I('Biscuits à la cuillère', 10), I('Fraise', 250), I('Sucre', 40), I('Œuf', 2)] },
    { n: 'mousse de citron au fromage blanc', i: () => [I('Fromage blanc', 300), I('Citron', 2), I('Sucre', 50), I('Crème liquide', 100, 'ml')] },
    { n: 'verrine chocolat-poire', i: () => [I('Chocolat noir pâtissier', 100), I('Poire', 3), I('Fromage blanc', 200), I('Spéculoos', 6)] },
    { n: 'verrine mangue-coco', i: () => [I('Mangue', 2), I('Yaourt nature', 250, 'g'), I('Noix de coco', 40), I('Miel', 20)] },
    { n: 'verrine pomme & spéculoos', i: () => [I('Pomme', 3), I('Spéculoos', 8), I('Fromage blanc', 250), I('Cannelle', 1, 'cas')] },
  ];
  for (const v of verrF) D({}, `Verrine ${v.n}`, [...v.i()], [
    v.nuit
      ? 'Mélangez les graines de chia avec le liquide et le miel dans un bol : le mélange doit être homogène dès le départ (pas de paquets au fond).'
      : 'Préparez la base crémeuse : mélangez fromage/yaourt avec le sucre ou le miel jusqu\u2019à lisser.',
    v.nuit
      ? 'Laissez gonfler au frigo 4 h minimum (idéalement une nuit) : les chia doivent absorber le liquide et former un pudding.'
      : 'Préparez la garniture : fruits coupés en dés, biscuits écrasés au rouleau, ou compotée express 5 min à la casserole.',
    'Montez les verrines en couches alternées : crémeuse, garniture, crémeuse — visible par la paroi, c\u2019est le charme.',
    'Terminez par un élément croquant (biscuit, noix, coco râpée) posé juste avant de servir.',
    v.nuit ? 'Servez bien frais, à la cuillère.' : 'Réfrigérez 30 min minimum avant de servir.',
    'Consommez dans les 24 h : les verrines express ne se gardent pas.',
  ], { prep: 10, conservation: 1, ustensiles: [...CAT, 'Verrines'] });

  // Mug cakes & énergies ×8
  const mugs = [
    { n: 'choco-banane', i: () => [I('Banane', 1), I('Farine', 30), I('Cacao en poudre', 10), I('Lait', 30, 'ml'), I('Levure chimique', 0.5)] },
    { n: 'chocolat cœur coulant', i: () => [I('Chocolat noir pâtissier', 40), I('Beurre', 30), I('Œuf', 1), I('Farine', 20), I('Sucre', 30)] },
    { n: 'pomme & cannelle', i: () => [I('Pomme', 0.5), I('Farine', 30), I('Cannelle', 0.5), I('Lait', 30, 'ml'), I('Levure chimique', 0.5)] },
    { n: 'citron & graines de sésame', i: () => [I('Citron', 0.5), I('Farine', 30), I('Graines de sésame', 5), I('Lait', 30, 'ml'), I('Levure chimique', 0.5)] },
  ];
  for (const m of mugs) D({}, `Mug cake ${m.n}`, [...m.i(), I('Sucre', 20)], [
    'Dans un grand mug (300 ml minimum, la pâte gonfle beaucoup), écrasez ou mélangez d\u2019abord les ingrédients humides à la fourchette.',
    'Ajoutez les ingrédients secs et mélangez juste ce qu\u2019il faut : quelques petits grumeaux sont OK, trop mélanger = élastique.',
    'Cuisez au micro-ondes 1 min 30 à 800 W : le dessus doit être pris, le cœur encore moelleux.',
    'Attention : chaque micro-ondes est différent — la première fois, arrêtez à 1 min 15 et vérifiez.',
    'Dégustez à la cuillère directement dans le mug, tiède.',
  ], { prep: 3, cuisson: 2, conservation: 1, portions: 1, ustensiles: ['Mug', 'Fourchette'] });
  const energies = [
    { n: 'dattes-noix de cajou', i: () => [I('Datte', 150), I('Noix de cajou', 100), I('Cacao en poudre', 15)] },
    { n: 'avoine & miel', i: () => [I('Flocons d\u2019avoine', 120), I('Miel', 60), I('Amandes', 60), I('Cacao en poudre', 10)] },
    { n: 'dattes & coco', i: () => [I('Datte', 150), I('Amandes', 80), I('Noix de coco', 40)] },
    { n: 'abricot & sésame', i: () => [I('Datte', 100), I('Amandes', 80), I('Graines de sésame', 30)] },
  ];
  for (const e of energies) D({}, `Bouchées énergie ${e.n}`, [...e.i()], [
    'Mixez tous les ingrédients au robot 30-60 s : la pâte doit s\u2019agglomérer quand on la presse entre les doigts.',
    'Si elle est trop sèche, ajoutez 1 cas d\u2019eau ; trop humide, 1 cas de flocons d\u2019avoine.',
    'Prélevez des portions de 15 g et roulez des boulettes entre les paumes.',
    'Roulez-les dans cacao, coco râpée ou sésame pour la finition.',
    'Réfrigérez 1 h : elles se raffermissent.',
    'Conservez 5 jours au frigo dans une boîte hermétique — parfait pour le sport ou le goûter.',
  ], { prep: 15, cuisson: 0, conservation: 5, portions: 10, ustensiles: ['Mixeur', 'Saladier'] });

  // Salades de fruits ×3
  const sf = [
    { n: 'd\u2019été', i: () => [I('Pomme', 2), I('Fraise', 200), I('Mangue', 1), I('Menthe fraîche', 0.3)] },
    { n: 'd\u2019hiver à l\u2019orange & cannelle', i: () => [I('Orange', 4), I('Pomme', 2), I('Cannelle', 1, 'cas'), I('Miel', 20)] },
    { n: 'exotique', i: () => [I('Ananas frais', 0.5), I('Mangue', 1), I('Banane', 2), I('Citron', 1)] },
  ];
  for (const s of sf) D({}, `Salade de fruits ${s.n}`, [...s.i(), I('Sucre', 20)], [
    'Coupez tous les fruits en dés de taille similaire (1,5 cm) : l\u2019harmonie visuelle compte autant que le goût.',
    'Arrosez immédiatement de jus de citron pour éviter l\u2019oxydation (banane, pomme).',
    'Saupoudrez de sucre et mélangez délicatement à la spatule.',
    'Réfrigérez 1 h minimum : les jus se mélangent et forment un sirop naturel.',
    'Servez très frais, avec de la menthe ciselée au dernier moment.',
  ], { prep: 15, conservation: 2, saison: s.n.includes('été') ? 'ete' : 'hiver' });

  // Recette née DANS l'application (id #109), déclarée ici pour que sa
  // composition ait une source.
  //
  // Elle n'appartient à aucun générateur : c'est pour ça qu'elle est restée la
  // SEULE recette publique sans ingrédient après la réparation des 454 autres,
  // et donc la seule que le moteur écarte d'office pour un profil déclarant une
  // allergie ou un régime (motif `composition_inconnue`). Déclarée ici, elle
  // devient réparable par `--repair` comme n'importe quelle autre, et un
  // re-seed depuis zéro la recrée à l'identique au lieu de la perdre.
  //
  // Ses attributs (dessert, Méditerranéenne, 8 min, 2 portions) sont ceux de la
  // ligne existante : la réparation ne recolle que les ingrédients, donc le
  // générateur et la base doivent décrire la même recette, pas deux voisines.
  D({}, 'Salade d\u2019orange à la cannelle', [I('Orange', 4), I('Cannelle', 1, 'cac'), I('Miel', 20)], [
    'Pelez les oranges à vif : écorce et peau blanche retirées, il ne doit rester que la chair.',
    'Détaillez-les en rondelles de 5 mm et rangez-les dans le saladier en récupérant le jus.',
    'Saupoudrez de cannelle et arrosez de miel, sans mélanger : les rondelles doivent rester en place.',
    'Laissez mariner 10 min au frais : le jus des oranges et le miel forment un sirop léger.',
    'Servez frais, arrosé du sirop du saladier.',
  ], { prep: 8, portions: 2, conservation: 2, saison: 'hiver', cuisine: 'Méditerranéenne', ustensiles: ['Couteau de chef', 'Saladier'] });

  // Cookies ×12 — base commune, 12 garnitures
  const COOKIE_GARN = [
    { n: 'pépites de chocolat', i: () => [I('Pépites de chocolat', 150)] },
    { n: 'double chocolat', i: () => [I('Chocolat noir pâtissier', 80), I('Cacao en poudre', 20)] },
    { n: 'chocolat & noisettes', i: () => [I('Chocolat noir pâtissier', 100), I('Noisettes', 60)] },
    { n: 'avoine & raisins secs', i: () => [I('Flocons d\u2019avoine', 80), I('Raisins secs', 80)] },
    { n: 'avoine & miel', i: () => [I('Flocons d\u2019avoine', 100), I('Miel', 60)] },
    { n: 'beurre de cacahuète', i: () => [I('Beurre de cacahuète', 100)] },
    { n: 'coco & chocolat', i: () => [I('Noix de coco', 80), I('Chocolat noir pâtissier', 80)] },
    { n: 'amandes & orange', i: () => [I('Amandes', 70), I('Orange', 1)] },
    { n: 'citron & sésame', i: () => [I('Citron', 1), I('Graines de sésame', 40)] },
    { n: 'café & noix', i: () => [I('Café soluble', 8), I('Noix', 60)] },
    { n: 'pomme & cannelle', i: () => [I('Pomme', 1), I('Cannelle', 1, 'cas')] },
    { n: 'dattes & cacao', i: () => [I('Datte', 100), I('Cacao en poudre', 15)] },
  ];
  for (const g of COOKIE_GARN) {
    D({}, `Cookies ${g.n}`, [I('Farine', 250), I('Beurre', 125), I('Sucre', 120), I('Œuf', 1), I('Levure chimique', 0.5), ...g.i()], [
      'Sortez le beurre 30 min avant : il doit être pommade (souple mais pas fondu), c\u2019est le secret de la texture.',
      'Créez le beurre pommade avec le sucre au fouet ou à la feuille : le mélange doit blanchir et doubler de volume (2-3 min).',
      'Ajoutez l\u2019œuf, mélangez, puis la farine tamisée avec la levure : arrêtez dès que la pâte est homogène.',
      'Incorporez la garniture à la main ou à la spatule, sans écraser les morceaux.',
      'Filmez la pâte et réfrigérez 30 min minimum : une pâte froide s\u2019étale moins à la cuisson.',
      'Préchauffez le four à 180°C. Façonnez des boules de 40 g, aplatissez-les sur plaque garnie de papier cuisson en les espaçant bien (elles s\u2019étalent).',
      'Enfournez 10-12 min : les bords doivent être dorés mais le centre encore souple — il durcit en refroidissant.',
      'Laissez tiédir 5 min sur la plaque puis finissez sur une grille : ils deviennent croustillants dehors, moelleux dedans.',
      'Conservez 4-5 jours dans une boîte hermétique (une tranche de pain dedans les garde moelleux).',
    ], { prep: 20, cuisson: 12, conservation: 5, portions: 12, ustensiles: [...CAT, 'Fouet', 'Four', 'Plaque de cuisson'] });
  }

  // Crêpes ×8 — pâte commune, 8 garnitures
  const CREPE_GARN = [
    { n: 'sucre & citron', i: () => [I('Citron', 2), I('Sucre', 60)] },
    { n: 'chocolat fondu', i: () => [I('Chocolat noir pâtissier', 150), I('Crème liquide', 80, 'ml')] },
    { n: 'banane & noisettes', i: () => [I('Banane', 3), I('Noisettes', 50), I('Miel', 40)] },
    { n: 'pomme & cannelle', i: () => [I('Pomme', 4), I('Cannelle', 1, 'cas'), I('Beurre', 30)] },
    { n: 'coco & mangue', i: () => [I('Noix de coco', 60), I('Mangue', 2)] },
    { n: 'fruits rouges & miel', i: () => [I('Fruits rouges', 250), I('Miel', 50)] },
    { n: 'beurre de cacahuète & banane', i: () => [I('Beurre de cacahuète', 80), I('Banane', 3)] },
    { n: 'amandes & miel d\u2019orange', i: () => [I('Amandes', 60), I('Orange', 3), I('Miel', 40)] },
  ];
  for (const g of CREPE_GARN) {
    D({}, `Crêpes à la ${g.n}`, [I('Farine', 250), I('Œuf', 4), I('Lait', 500, 'ml'), I('Beurre', 50), I('Sucre', 30), ...g.i()], [
      'Mettez la farine en fontaine, ajoutez les œufs et le sucre au centre, puis délayez avec le lait en versant progressivement : la pâte doit être fluide comme une crème légère (pas de grumeaux).',
      'Ajoutez le beurre fondu, mélangez, puis laissez reposer la pâte 1 h à température ambiante : les crêpes seront souples et jamais caoutchouteuses.',
      'Chauffez une poêle à crêpes (ou une poêle antiadhésive) à feu moyen-vif. Une première crêpe ratée est normale — elle "assaisonne" la poêle.',
      'Versez une louche de pâte, tournez immédiatement la poêle pour répartir finement. Cuisez 1 min 30 : les bords se décollent et dorent.',
      'Retournez d\u2019un geste sec (ou avec une spatule) et cuisez 30 s de l\u2019autre côté.',
      'Empilez les crêpes sur une assiette posée sur une casserole d\u2019eau chaude : elles restent souples jusqu\u2019au service.',
      'Garnissez chaque crêpe de la préparation encore chaude (ou froide selon la garniture), pliez en quatre ou roulez-la.',
      'Servez aussitôt, avec un peu de la garniture et du sucre en poudre à part.',
    ], { prep: 15, cuisson: 25, conservation: 1, portions: 8, ustensiles: [...CAT, 'Fouet', 'Louche', 'Poêle à crêpes'] });
  }

  // Gaufres ×8 — pâte commune, 8 garnitures
  const GAUFRE_GARN = [
    { n: 'sucrées nature', i: () => [I('Sucre', 60)] },
    { n: 'chocolat & noisettes', i: () => [I('Chocolat noir pâtissier', 120), I('Noisettes', 40)] },
    { n: 'banane & caramel de miel', i: () => [I('Banane', 3), I('Miel', 60), I('Beurre', 30)] },
    { n: 'pomme & cannelle', i: () => [I('Pomme', 3), I('Cannelle', 1, 'cas'), I('Sucre', 40)] },
    { n: 'fruits rouges & sucre glace', i: () => [I('Fruits rouges', 250), I('Sucre', 40)] },
    { n: 'coco & mangue', i: () => [I('Noix de coco', 50), I('Mangue', 2)] },
    { n: 'citron meringué', i: () => [I('Citron', 2), I('Œuf', 2), I('Sucre', 80)] },
    { n: 'beurre de cacahuète & miel', i: () => [I('Beurre de cacahuète', 80), I('Miel', 50)] },
  ];
  for (const g of GAUFRE_GARN) {
    D({}, `Gaufres à la ${g.n}`, [I('Farine', 250), I('Œuf', 3), I('Lait', 400, 'ml'), I('Beurre', 100), I('Sucre', 70), I('Levure chimique', 1), ...g.i()], [
      'Séparez les blancs des jaunes. Mélangez les jaunes avec le sucre jusqu\u2019à ce que le mélange blanchisse.',
      'Ajoutez le beurre fondu (tiédi, pas chaud), puis le lait, puis la farine et la levure tamisées : la pâte doit être épaisse et lisse.',
      'Montez les blancs en neige ferme avec une pincée de sel et incorporez-les délicatement : c\u2019est ce qui rend les gaufres légères à l\u2019intérieur.',
      'Laissez reposer 30 min pendant que le gaufrier chauffe (satin de cuisson léger ou papier).',
      'Versez une louche de pâte au centre du gaufrier, refermez et cuisez 3-4 min : la vapeur doit presque cesser avant d\u2019ouvrir.',
      'Posez les gaufres sur une grille (jamais empilées) : la vapeur les ramollirait.',
      'Préparez la garniture pendant la cuisson (chocolat au bain-marie, fruits en dés, caramel de miel 2 min à la casserole).',
      'Servez immédiatement, garnies au dernier moment pour garder le croustillant.',
    ], { prep: 20, cuisson: 20, conservation: 1, portions: 8, ustensiles: [...CAT, 'Fouet', 'Gaufrier', 'Maryse'] });
  }

  // Bouchées énergie — 6 variantes supplémentaires
  const energies2 = [
    { n: 'abricot & coco', i: () => [I('Raisins secs', 120), I('Noix de cajou', 80), I('Noix de coco', 40)] },
    { n: 'choco-café', i: () => [I('Datte', 120), I('Noix', 80), I('Cacao en poudre', 20), I('Café soluble', 5)] },
    { n: 'banane & avoine', i: () => [I('Banane', 2), I('Flocons d\u2019avoine', 120), I('Beurre de cacahuète', 60)] },
    { n: 'noisette & miel', i: () => [I('Noisettes', 100), I('Datte', 100), I('Miel', 40), I('Cacao en poudre', 10)] },
    { n: 'sésame & orange', i: () => [I('Graines de sésame', 60), I('Datte', 120), I('Amandes', 60), I('Orange', 1)] },
    { n: 'fruits rouges & amandes', i: () => [I('Fruits rouges', 100), I('Amandes', 100), I('Datte', 100), I('Flocons d\u2019avoine', 60)] },
  ];
  for (const e of energies2) D({}, `Bouchées énergie ${e.n}`, [...e.i()], [
    'Mixez tous les ingrédients au robot 30-60 s : la pâte doit s\u2019agglomérer quand on la presse entre les doigts.',
    'Si elle est trop sèche, ajoutez 1 cas d\u2019eau ; trop humide, 1 cas de flocons d\u2019avoine.',
    'Prélevez des portions de 15 g et roulez des boulettes entre les paumes.',
    'Roulez-les dans cacao, coco râpée ou sésame pour la finition.',
    'Réfrigérez 1 h : elles se raffermissent.',
    'Conservez 5 jours au frigo dans une boîte hermétique — parfait pour le sport ou le goûter.',
  ], { prep: 15, cuisson: 0, conservation: 5, portions: 10, ustensiles: ['Mixeur', 'Saladier'] });

  // Mug cakes — 4 variantes supplémentaires
  const mugs2 = [
    { n: 'café & noisettes', i: () => [I('Café soluble', 5), I('Farine', 30), I('Noisettes', 15), I('Lait', 30, 'ml'), I('Levure chimique', 0.5)] },
    { n: 'coco & mangue', i: () => [I('Noix de coco', 15), I('Farine', 30), I('Mangue', 0.5), I('Lait', 30, 'ml'), I('Levure chimique', 0.5)] },
    { n: 'miel & amandes', i: () => [I('Miel', 20), I('Farine', 30), I('Amandes', 15), I('Œuf', 0.5), I('Levure chimique', 0.5)] },
    { n: 'framboise & pépites', i: () => [I('Framboise', 5), I('Farine', 30), I('Pépites de chocolat', 15), I('Lait', 30, 'ml'), I('Levure chimique', 0.5)] },
  ];
  for (const m of mugs2) D({}, `Mug cake ${m.n}`, [...m.i(), I('Sucre', 20)], [
    'Dans un grand mug (300 ml minimum, la pâte gonfle beaucoup), écrasez ou mélangez d\u2019abord les ingrédients humides à la fourchette.',
    'Ajoutez les ingrédients secs et mélangez juste ce qu\u2019il faut : quelques petits grumeaux sont OK, trop mélanger = élastique.',
    'Cuisez au micro-ondes 1 min 30 à 800 W : le dessus doit être pris, le cœur encore moelleux.',
    'Attention : chaque micro-ondes est différent — la première fois, arrêtez à 1 min 15 et vérifiez.',
    'Dégustez à la cuillère directement dans le mug, tiède.',
  ], { prep: 3, cuisson: 2, conservation: 1, portions: 1, ustensiles: ['Mug', 'Fourchette'] });
}

// ═════════════════════════ ASSEMBLAGE ═══════════════════════════════════════
const step = (label: string, target: number, fn: (n: number) => void) => {
  const before = OUT.length;
  fn(target);
  console.log(`   ${label.padEnd(10)} ${String(OUT.length - before).padStart(4)} recettes (cible ${target - before})`);
};
step('Pâtes', 160, buildPates);
step('Grains', 250, buildGrains);
step('Four', 410, buildFour);
step('Poêles', 530, buildPoeles);
step('Wok', 605, buildWok);
step('Mijotés', 623, buildMijotes);
step('Soupes', 663, buildSoupes);
step('Tartes', 690, buildTartes);
step('Salades', 850, buildSalades);
step('Gratins', 868, buildGratins);
step('Wraps', 892, buildWraps);
step('Œufs', 902, buildOeufs);
step('Tartines', 910, buildTartines);
// Cible 1011 et non 1010 : les desserts déclarés remplissaient EXACTEMENT la
// cible précédente, donc la salade d'oranges ajoutée plus haut n'aurait jamais
// été poussée (`cap()` refuse dès que la longueur atteint la cible). Décaler la
// cible d'une unité fait entrer cette recette sans en évincer aucune : `cap()`
// accepte les appels DANS L'ORDRE, donc le même premier lot de 100 est retenu,
// plus la nouvelle.
step('Desserts', 1011, buildDesserts);

const TOTAL = OUT.length;

// ─── Garde-fou : ce que la BASE refusera, on le refuse AVANT d'écrire ───────
//
// `meal_ingredients` porte quatre contraintes que PostgREST n'annonce pas :
//
//   • unite ∈ (g, ml, pcs, cac, cas, pincee, sachet, boite, botte, tranche) ;
//   • quantite > 0 ;
//   • ingredient_id → ingredients (FK) ;
//   • primary key (meal_id, ingredient_id) — donc pas deux fois le même.
//
// L'insertion se faisait en UN lot par recette et l'erreur n'était jamais lue.
// Conséquence mesurée : 455 recettes publiques sont en base SANS aucun
// ingrédient — dont 439 plats (45 % du catalogue) — parce qu'une seule unité
// invalide (« gousse », « bouquet », « feuille ») faisait échouer le lot
// entier. Une erreur avalée par lot, c'est une recette muette pour toujours.
//
// Ce contrôle tourne aussi en --dry, donc avant toute écriture.
const UNITES_AUTORISEES = ['g', 'ml', 'pcs', 'cac', 'cas', 'pincee', 'sachet', 'boite', 'botte', 'tranche'];
/**
 * Quantité maximale plausible d'une unité dans UNE recette.
 *
 * Ces plafonds ne sont pas des règles culinaires, ce sont des DÉTECTEURS :
 * « 300 pcs » veut dire que l'auteur a écrit des grammes sans changer l'unité.
 * Ils sont volontairement généreux (24 pommes, 12 cuillères à soupe) pour ne
 * jamais refuser une recette réelle tout en attrapant le facteur 100.
 */
const PLAFOND_UNITE: Record<string, number> = {
  pcs: 24, cas: 12, cac: 8, botte: 3, sachet: 3, boite: 4, tranche: 20,
};
const RAYONS_AUTORISEES = ['fruits_legumes', 'epicerie_salee', 'epicerie_sucree', 'frais', 'surgeles', 'viande_poisson', 'boissons', 'boulangerie', 'conserves', 'epices'];

function verifierRecettes(): string[] {
  const problemes: string[] = [];
  for (const r of OUT) {
    const vus = new Set<string>();
    for (const ing of r.ingredients) {
      const def = ING[ing.nom] as { m: number[]; r: string; u?: string; ml?: boolean } | undefined;
      if (!def) problemes.push(`${r.titre} → « ${ing.nom} » absent de la table ING`);
      else if (!RAYONS_AUTORISEES.includes(def.r)) problemes.push(`${r.titre} → ${ing.nom} : rayon « ${def.r} » refusé par la base`);
      if (!UNITES_AUTORISEES.includes(ing.u)) problemes.push(`${r.titre} → ${ing.nom} : unité « ${ing.u} » refusée par la base`);
      // Le poids de l'unité : la base l'accepte, mais le CALCUL des macros en a
      // besoin. Sans lui, `macros()` refuse la recette — et c'est le même
      // contrôle qui empêche l'erreur d'origine de revenir par une unité
      // nouvelle (une pièce comptée pour un gramme passe inaperçue, un refus non).
      if (!uniteEstMasse(ing.u) && !((POIDS_UNITES[ing.nom]?.[ing.u] ?? 0) > 0)) {
        problemes.push(`${r.titre} → ${ing.nom} : unité « ${ing.u} » sans poids unitaire (POIDS_UNITES)`);
      }
      if (!(ing.q > 0)) problemes.push(`${r.titre} → ${ing.nom} : quantité ${ing.q} (la base exige > 0)`);
      // Plausibilité de la quantité face à l'unité. Une recette qui passe 300
      // pour une unité « pcs » demande 300 pièces : 37 kg de yaourt. Ce défaut
      // de DONNÉES était invisible tant que les pièces étaient comptées comme
      // des grammes — la conversion l'a rendu explosif. On ne le contrôle que
      // pour les unités qui pèsent sur les calories : une quantité absurde de
      // café soluble (coefficient nul) ne fausse aucun total.
      const plafond = PLAFOND_UNITE[ing.u];
      if (plafond && def && def.m[0] > 0 && ing.q > plafond) {
        problemes.push(`${r.titre} → ${ing.nom} : ${ing.q} ${ing.u} — au-delà de ${plafond}, c'est probablement une quantité en grammes (ajoutez 'g')`);
      }
      if (vus.has(ing.nom)) problemes.push(`${r.titre} → ${ing.nom} : présent deux fois (clé primaire meal_id+ingredient_id)`);
      vus.add(ing.nom);
    }
  }
  return problemes;
}

function rapportProblemes(problemes: string[]): void {
  console.log(`\n❌ ${problemes.length} ingrédient(s) seraient refusés par la base :`);
  for (const p of problemes.slice(0, 20)) console.log(`   • ${p}`);
  if (problemes.length > 20) console.log(`   … et ${problemes.length - 20} autres.`);
}

/** Résout (ou crée) les ingrédients d'une recette : nom → id. Partagé par l'import et la réparation. */
async function resoudreIngredients(supabase: Db, r: Rec): Promise<Record<string, number>> {
  const ids: Record<string, number> = {};
  for (const ing of r.ingredients) {
    const { data: found } = await supabase.from('ingredients').select('id').eq('nom', ing.nom).maybeSingle();
    if (found) { ids[ing.nom] = found.id; continue; }
    const { data: created } = await supabase.from('ingredients').insert({
      nom: ing.nom, rayon: ing.r,
      est_allergene: ['Arachides', 'Fruits à coque', 'Lactose', 'Gluten', 'Œufs', 'Crustacés', 'Poisson', 'Soja'].includes(ing.nom),
      ...nutritionPour100g(ing.nom),
      poids_unites: POIDS_UNITES[ing.nom] ?? null,
    }).select('id').maybeSingle();
    if (created) ids[ing.nom] = created.id;
  }
  return ids;
}

/**
 * Insère les liens d'une recette, UN PAR UN, en lisant l'erreur.
 *
 * Un lot qui échoue ne laisse aucune ligne : c'est comme ça que 45 % du
 * catalogue s'est retrouvé sans ingrédient, sans le moindre signal. Lien par
 * lien, un ingrédient refusé ne coûte que lui-même — et il est nommé.
 */
async function insererLiens(supabase: Db, mealId: number, titre: string, r: Rec, ids: Record<string, number>): Promise<number> {
  let poses = 0;
  for (const ing of r.ingredients) {
    const ingredient_id = ids[ing.nom];
    if (!ingredient_id) {
      console.log(`⚠️  ${titre} — « ${ing.nom} » : ingrédient non résolu (recette privée de cet ingrédient)`);
      continue;
    }
    const { error } = await supabase.from('meal_ingredients')
      .insert({ meal_id: mealId, ingredient_id, quantite: ing.q, unite: ing.u });
    if (error) console.log(`⚠️  ${titre} — « ${ing.nom} » : ${error.message}`);
    else poses++;
  }
  return poses;
}

// ─── Métadonnées d'ingrédients : nutrition + poids unitaires ─────────────────
//
// Les coefficients nutritionnels et les poids unitaires vivent dans ce script
// (`ING` et `POIDS_UNITES`) ; la base n'en recevait RIEN — d'où les colonnes
// `calories_pour_100g` à NULL sur les 248 ingrédients. Sans elles, ni le recalcul
// des macros ni une conversion de prix ne sont possibles.
//
// Idempotente : réécrit les mêmes valeurs à chaque exécution. C'est le préalable
// à `scripts/recalculer-macros.ts`.
async function synchroniserIngredients(ecrire: boolean) {
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // On parcourt l'UNION des deux tables, pas seulement `ING` : les autres
  // scripts de seed ont créé leurs propres ingrédients (99 noms absents d'ING),
  // et leur poids unitaire sert au chiffrage des prix même sans coefficients
  // nutritionnels pour eux.
  const noms = [...new Set([...Object.keys(ING), ...Object.keys(POIDS_UNITES)])].sort();

  let maj = 0, majCoef = 0, majPoids = 0;
  const absents: string[] = [];
  const poidsNonDeclares: string[] = [];

  for (const nom of noms) {
    const { data: found, error: errLecture } = await supabase
      .from('ingredients').select('id').eq('nom', nom).maybeSingle();
    if (errLecture) throw new Error(errLecture.message);
    if (!found) { absents.push(nom); continue; }

    const payload: Record<string, unknown> = {};
    if (ING[nom]) { Object.assign(payload, nutritionPour100g(nom)); majCoef++; }
    if (POIDS_UNITES[nom]) { payload.poids_unites = POIDS_UNITES[nom]; majPoids++; }
    if (majCoef + majPoids === 0) continue;
    if (!ecrire) { maj++; continue; }

    const { error } = await supabase.from('ingredients').update(payload).eq('id', found.id);
    if (error) console.log(`⚠️  ${nom} : ${error.message}`);
    else maj++;
  }

  // Un ingrédient dont l'unité par DÉFAUT n'est pas une masse doit avoir un
  // poids : sinon chaque recette qui l'utilise sans préciser d'unité devient
  // incalculable. On le signale ici plutôt que de le découvrir au recalcul.
  for (const [nom, def] of Object.entries(ING)) {
    if (def.u && !uniteEstMasse(def.u) && !((POIDS_UNITES[nom]?.[def.u] ?? 0) > 0)) {
      poidsNonDeclares.push(`${nom} (unité par défaut « ${def.u} »)`);
    }
  }

  console.log(`\n📐 Métadonnées d'ingrédients ${ecrire ? 'écrites' : 'à écrire'} : ${maj} / ${noms.length}`);
  console.log(`   avec coefficients nutritionnels : ${majCoef} ingrédient(s)`);
  console.log(`   avec poids unitaires ........... : ${majPoids} ingrédient(s)`);
  if (absents.length > 0) {
    console.log(`   absents de la base (créés au prochain seed) : ${absents.length}`);
    for (const n of absents.slice(0, 10)) console.log(`     • ${n}`);
    if (absents.length > 10) console.log(`     … et ${absents.length - 10} autres.`);
  }
  if (poidsNonDeclares.length > 0) {
    console.log(`   ⚠️  unités par défaut sans poids : ${poidsNonDeclares.length}`);
    for (const n of poidsNonDeclares.slice(0, 10)) console.log(`     • ${n}`);
  }
  if (!ecrire) console.log('\n(dry-run — rien n’est écrit. Ajoutez `--write` pour appliquer.)');
}

// ─── Réparation : recoller les ingrédients des recettes incomplètes ──────────
//
// 455 recettes publiques sont en base SANS aucun ingrédient (45 % des plats) :
// leurs liens ont été perdus par l'insertion en lot dont l'erreur était avalée.
// Cette réparation les RECOLLE sur place, sur les lignes existantes.
//
// Pourquoi ne pas supprimer puis réimporter, alors que le résultat serait le
// même ? Parce que ce n'est pas le même prix, et c'est mesuré : 13 de ces
// recettes sont dans un planning (2 semaines) et 13 dans l'historique. Leurs
// clés étrangères sont en NO ACTION — la suppression ÉCHOUE. Il faudrait donc
// recréer les lignes, repointer les 26 références, et les identifiants
// changeraient : les URL /recette/<id> déjà partagées renverraient 404, et les
// plannings des utilisateurs pointeraient un instant vers du vide. Recoller sur
// place donne exactement le même catalogue complet, sans rien casser.
//
/**
 * Corrige les liens dont la QUANTITÉ dépasse le plafond de leur unité.
 *
 * « Yaourt nature 300 pcs » veut dire 300 g : personne n'utilise 300 pots. Ce
 * défaut était invisible tant que le calcul des macros comptait une pièce pour
 * un gramme — les deux interprétations donnaient le même nombre. Depuis que la
 * conversion existe, elles divergent d'un facteur 125 : ces recettes passeraient
 * de ~150 à ~19 000 kcal/portion et seraient exclues de tout.
 *
 * La correction garde la QUANTITÉ et passe l'UNITÉ à `g` : c'est
 * l'interprétation que les macros stockées appliquaient déjà, donc la recette
 * reste celle qui a été enregistrée. L'alternative (garder `pcs` et diviser la
 * quantité par le poids) demanderait de deviner l'intention de l'auteur ; ici,
 * les deux lectures possibles de la ligne d'origine convergent.
 */
async function corrigerUnitesIncoherentes(
  supabase: Db, ecrire: boolean
): Promise<{ detectes: { lien: string; avant: string }[]; corriges: number; ids: Set<number> }> {
  type Lien = {
    meal_id: number; ingredient_id: number; quantite: number; unite: string;
    ingredients: { nom: string; calories_pour_100g: number | null } | null;
  };
  const liens: Lien[] = [];
  // Ordre TOTAL : plusieurs lignes partagent un `meal_id`, la clé primaire
  // `(meal_id, ingredient_id)` est le seul ordre qui ne fait ni saut ni doublon.
  for (let debut = 0; ; debut += PAGE) {
    const { data, error } = await supabase.from('meal_ingredients')
      .select('meal_id, ingredient_id, quantite, unite, ingredients(nom, calories_pour_100g)')
      .order('meal_id').order('ingredient_id')
      .range(debut, debut + PAGE - 1);
    if (error) throw new Error(error.message);
    const lot = (data ?? []) as unknown as Lien[];
    liens.push(...lot);
    if (lot.length < PAGE) break;
  }

  // Deux populations distinctes, et la distinction compte :
  //   • l'ingrédient porte des calories → l'unité fausse FAUSSE le total, on corrige ;
  //   • l'ingrédient n'en porte pas (café soluble, épices sans coefficients
  //     renseignés) → la quantité est invraisemblable mais le total est juste.
  // Corriger celles-là relèverait du goût, pas de la justesse : on les signale
  // sans y toucher.
  const auDela = liens.filter(l => {
    const plafond = PLAFOND_UNITE[l.unite];
    return plafond != null && l.quantite > plafond;
  });
  const aCorriger = auDela.filter(l => (l.ingredients?.calories_pour_100g ?? 0) > 0);
  const laissees = auDela.filter(l => (l.ingredients?.calories_pour_100g ?? 0) <= 0);

  const detectes = aCorriger.slice(0, 8).map(l => ({
    lien: `#${l.meal_id} ${l.ingredients?.nom ?? '?'}`,
    avant: `${l.quantite} ${l.unite} → ${l.quantite} g`,
  }));
  const ids = new Set(aCorriger.map(l => l.meal_id));

  if (laissees.length > 0) {
    const noms = [...new Set(laissees.map(l => `${l.ingredients?.nom ?? '?'} (${l.quantite} ${l.unite})`))];
    console.log(`   ℹ️  ${laissees.length} lien(s) invraisemblable(s) mais SANS effet sur les calories, laissés tels quels : ${noms.join(', ')}`);
  }

  let corriges = 0;
  if (ecrire) {
    for (const l of aCorriger) {
      const { error } = await supabase.from('meal_ingredients')
        .update({ unite: 'g' })
        .eq('meal_id', l.meal_id).eq('ingredient_id', l.ingredient_id);
      if (error) console.log(`⚠️  lien ${l.meal_id}/${l.ingredient_id} : ${error.message}`);
      else corriges++;
    }
  }
  return { detectes, corriges, ids };
}

// Sûr par défaut : sans `--write`, rien n'est écrit.
async function reparer(ecrire: boolean) {
  const problemes = verifierRecettes();
  if (problemes.length > 0) {
    rapportProblemes(problemes);
    throw new Error('Réparation annulée : corrigez les ingrédients ci-dessus.');
  }

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // Les recettes sans aucun ingrédient — paginé, puisqu'on lit tout le catalogue.
  const orphelines: { id: number; titre: string }[] = [];
  for (let debut = 0; ; debut += PAGE) {
    const { data, error } = await supabase.from('meals')
      .select('id, titre, meal_ingredients(meal_id)')
      .order('id').range(debut, debut + PAGE - 1);
    if (error) throw new Error(error.message);
    const lot = data ?? [];
    for (const m of lot) if ((m.meal_ingredients ?? []).length === 0) orphelines.push({ id: m.id, titre: m.titre });
    if (lot.length < PAGE) break;
  }

  const parTitre = new Map(OUT.map(r => [norm(r.titre), r]));
  const aReparer = orphelines.filter(m => parTitre.has(norm(m.titre)));
  const horsPerimetre = orphelines.filter(m => !parTitre.has(norm(m.titre)));

  console.log(`\n🔧 Recettes sans ingrédient en base : ${orphelines.length}`);
  console.log(`   réparables depuis ce générateur   : ${aReparer.length}`);
  console.log(`   venues d'un autre import          : ${horsPerimetre.length}`);
  for (const m of horsPerimetre.slice(0, 10)) console.log(`     • #${m.id} ${m.titre}`);
  if (horsPerimetre.length > 10) console.log(`     … et ${horsPerimetre.length - 10} autres.`);

  // ── Unités manifestement fausses (indépendant du recollage ci-dessus) ──
  const unites = await corrigerUnitesIncoherentes(supabase, ecrire);
  console.log(`\n🔢 Liens dont la quantité dépasse le plafond de l'unité : ${unites.ids.size} recette(s) concernée(s)`);
  for (const d of unites.detectes) console.log(`     • ${d.lien} — ${d.avant}`);
  if (unites.ids.size === 0) console.log('     (aucun : les unités sont cohérentes avec les quantités)');

  if (!ecrire) {
    console.log('\n(dry-run — rien n\u2019est écrit. Relancez avec `--repair --write` pour appliquer.)');
    return;
  }

  let reparees = 0, liens = 0;
  for (const m of aReparer) {
    const r = parTitre.get(norm(m.titre))!;
    const ids = await resoudreIngredients(supabase, r);
    liens += await insererLiens(supabase, m.id, m.titre, r, ids);
    reparees++;
    if (reparees % 100 === 0) console.log(`   … ${reparees} recettes recollées`);
  }
  console.log(`\n🎉 ${reparees} recettes réparées, ${liens} liens d'ingrédient recollés, ${horsPerimetre.length} hors périmètre.`);

  console.log(`🔢 ${unites.corriges} lien(s) d'unité corrigés (quantité conservée, unité passée à g).`);

  // Les semaines qui contiennent une recette réparée ont une liste de courses
  // calculée SANS ses ingrédients : elle est donc fausse. On la recalcule — par
  // la même RPC que l'application utilise à chaque remplacement de repas (elle
  // conserve les articles cochés). Seules les semaines concernées sont touchées.
  // Une unité corrigée change aussi la ligne de courses : mêmes semaines à
  // recalculer.
  const idsRepares = new Set([...aReparer.map(m => m.id), ...unites.ids]);
  const { data: planMeals } = await supabase.from('plan_meals').select('plan_id, meal_id');
  const plansImpactes = [...new Set(
    (planMeals ?? [])
      .filter(p => p.meal_id != null && idsRepares.has(p.meal_id))
      .map(p => p.plan_id)
  )];
  for (const planId of plansImpactes) {
    const { error } = await supabase.rpc('recompute_shopping_list_frigo', { p_plan_id: planId });
    if (error) console.log(`⚠️  liste de courses du plan ${planId} : ${error.message}`);
    else console.log(`   ♻️  liste de courses recalculée (plan ${planId})`);
  }
  console.log(`   ${plansImpactes.length} semaine(s) recalculée(s).`);
}

// ─── Écriture en base (ou dry-run) ──────────────────────────────────────────
async function seed() {
  // Rien ne part en base avant d'avoir prouvé que la base l'acceptera.
  const problemes = verifierRecettes();
  if (problemes.length > 0) {
    rapportProblemes(problemes);
    throw new Error('Écriture annulée : corrigez les ingrédients ci-dessus.');
  }

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // Idempotence : charger les titres existants (normalisés)
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

    const { data: mealData, error: mealErr } = await supabase.from('meals').insert({
      titre: r.titre, type_repas: r.type === 'dessert' ? 'dessert' : 'plat', temps_preparation: r.prep,
      temps_cuisson: r.cuisson ?? null, difficulte: r.difficulte,
      saison: r.saison, cuisine: r.cuisine,
      calories_par_portion: macros(r.ingredients, r.portions).cal,
      proteines: macros(r.ingredients, r.portions).p,
      glucides: macros(r.ingredients, r.portions).g,
      lipides: macros(r.ingredients, r.portions).l,
      // Calculées depuis la composition et passées par le contrôle de
      // plausibilité : ces recettes sont vérifiées par construction, donc le
      // moteur a le droit d'en tirer un jugement de légèreté. Les recettes
      // créées autrement (application, import) restent à false jusqu'au
      // recalcul — c'est le défaut de la colonne.
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
const REPAIR = process.argv.includes('--repair');
const INGREDIENTS = process.argv.includes('--ingredients');
const ECRIRE = process.argv.includes('--write');
if (REPAIR) {
  reparer(ECRIRE).catch(e => { console.error(e); process.exit(1); });
} else if (INGREDIENTS) {
  synchroniserIngredients(ECRIRE).catch(e => { console.error(e); process.exit(1); });
} else if (DRY) {
  console.log(`\n📦 Catalogue généré : ${TOTAL} recettes (+ desserts) détaillées.\n`);
  const byType = { dejeuner: 0, diner: 0, dessert: 0 } as Record<string, number>;
  OUT.forEach(r => { byType[r.type]++; });
  console.log(`   plats (dîner)  : ${byType.diner}`);
  console.log(`   plats (déj.)   : ${byType.dejeuner}`);
  console.log(`   desserts       : ${byType.dessert}\n`);
  console.log('Échantillon de titres :');
  for (const t of [OUT[0], OUT[130], OUT[300], OUT[500], OUT[700], OUT[900], OUT[Math.min(999, TOTAL - 1)]]) {
    if (t) console.log(`   • ${t.titre}  [${t.type}, ${t.prep}+${t.cuisson ?? 0} min, ${t.cuisine}]`);
  }
  const problemes = verifierRecettes();
  problemes.length === 0
    ? console.log('\n✅ Toutes les recettes passent les contraintes de `meal_ingredients`.')
    : rapportProblemes(problemes);
  console.log('\nExemple complet (dry-run, rien n\u2019est écrit) :');
  const s = OUT[0];
  console.log(JSON.stringify({ ...s, macros: macros(s.ingredients, s.portions) }, null, 2));
} else {
  seed().catch(e => { console.error(e); process.exit(1); });
}
