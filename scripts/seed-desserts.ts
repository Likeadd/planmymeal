// ============================================================================
// SEED : Catalogue desserts complet — tous les types
// Usage : npm run seed:desserts
//
// Couvre toutes les familles demandées :
//   • Yaourt / fromage blanc / skyr (express midi)
//   • Fruits (salades, brochettes, pochés...)
//   • Compotes & fruits cuits
//   • Pâtisserie (tartes, cakes, moelleux, crumbles...)
//   • Crèmes & entremets (mousse, panna cotta, crème brûlée...)
//   • Glaces & fruits rouges
//   • Desserts du soir festifs
//
// Idempotent : les recettes déjà présentes (même titre) sont ignorées.
// Les ingrédients manquants sont créés à la volée dans le bon rayon.
// ============================================================================

import { config } from 'dotenv';
config({ path: '.env.local' });
config();
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

interface Ing { nom: string; q: number; u: string; r: string }
interface Recette {
  titre: string; prep: number; cuisson?: number; difficulte: string;
  saison: string; cuisine: string; cal: number; p: number; g: number; l: number;
  instructions: string[]; portions: number; conservation: number; ingredients: Ing[];
}

const R = 'epicerie_salee', S = 'epicerie_sucree', F = 'frais', L = 'fruits_legumes',
      V = 'surgeles', B = 'boissons', E = 'epices';

// ─── Yaourt / fromage blanc / skyr — express (≤ 10 min) ─────────────────────
const YAOURTS: Recette[] = [
  { titre: 'Yaourt nature au miel', prep: 3, difficulte: 'facile', saison: 'toutes', cuisine: 'Française', cal: 150, p: 5, g: 22, l: 4, instructions: ['Verser le yaourt dans une coupe', 'Arroser de miel'], portions: 1, conservation: 1, ingredients: [{ nom: 'Yaourt nature', q: 1, u: 'pcs', r: F }, { nom: 'Miel', q: 1, u: 'cas', r: S }] },
  { titre: 'Yaourt aux fruits rouges', prep: 5, difficulte: 'facile', saison: 'ete', cuisine: 'Française', cal: 160, p: 6, g: 24, l: 4, instructions: ['Couper les fruits en deux', 'Mélanger au yaourt', 'Un filet de miel'], portions: 1, conservation: 1, ingredients: [{ nom: 'Yaourt nature', q: 1, u: 'pcs', r: F }, { nom: 'Fruits rouges', q: 100, u: 'g', r: L }, { nom: 'Miel', q: 1, u: 'cac', r: S }] },
  { titre: 'Yaourt grec aux fruits', prep: 5, difficulte: 'facile', saison: 'toutes', cuisine: 'Grecque', cal: 190, p: 9, g: 20, l: 8, instructions: ['Répartir le yaourt grec en coupes', 'Ajouter les fruits coupés', 'Miel par-dessus'], portions: 2, conservation: 1, ingredients: [{ nom: 'Yaourt grec', q: 2, u: 'pcs', r: F }, { nom: 'Banane', q: 1, u: 'pcs', r: L }, { nom: 'Fruits rouges', q: 80, u: 'g', r: L }, { nom: 'Miel', q: 1, u: 'cas', r: S }] },
  { titre: 'Fromage blanc au miel & noix', prep: 5, difficulte: 'facile', saison: 'toutes', cuisine: 'Française', cal: 210, p: 12, g: 16, l: 10, instructions: ['Verser le fromage blanc dans une coupe', 'Miel + noix concassées'], portions: 1, conservation: 1, ingredients: [{ nom: 'Fromage blanc', q: 150, u: 'g', r: F }, { nom: 'Miel', q: 1, u: 'cas', r: S }, { nom: 'Noix', q: 20, u: 'g', r: R }] },
  { titre: 'Fromage blanc & fruits de saison', prep: 5, difficulte: 'facile', saison: 'toutes', cuisine: 'Française', cal: 130, p: 7, g: 14, l: 4, instructions: ['Fromage blanc dans les coupes', 'Fruits coupés en morceaux', 'Sucre ou miel selon goût'], portions: 2, conservation: 1, ingredients: [{ nom: 'Fromage blanc', q: 200, u: 'g', r: F }, { nom: 'Pomme', q: 1, u: 'pcs', r: L }, { nom: 'Banane', q: 1, u: 'pcs', r: L }] },
  { titre: 'Skyr & myrtilles', prep: 3, difficulte: 'facile', saison: 'ete', cuisine: 'Nordique', cal: 120, p: 11, g: 12, l: 2, instructions: ['Skyr dans un bol', 'Myrtilles par-dessus', 'Filet de miel'], portions: 1, conservation: 1, ingredients: [{ nom: 'Skyr', q: 150, u: 'g', r: F }, { nom: 'Myrtilles', q: 80, u: 'g', r: L }, { nom: 'Miel', q: 1, u: 'cac', r: S }] },
  { titre: 'Verrine fromage blanc & compotée de fruits', prep: 8, difficulte: 'facile', saison: 'toutes', cuisine: 'Française', cal: 170, p: 8, g: 22, l: 5, instructions: ['Faire compoter les fruits 5 min avec un peu de sucre', 'Alterner fromage blanc et compotée en verrine'], portions: 2, conservation: 1, ingredients: [{ nom: 'Fromage blanc', q: 200, u: 'g', r: F }, { nom: 'Fruits rouges', q: 150, u: 'g', r: L }, { nom: 'Sucre', q: 15, u: 'g', r: S }] },
];

// ─── Fruits — express (≤ 10 min) ────────────────────────────────────────────
const FRUITS: Recette[] = [
  { titre: 'Salade de fruits frais', prep: 10, difficulte: 'facile', saison: 'ete', cuisine: 'Française', cal: 110, p: 1, g: 25, l: 1, instructions: ['Couper tous les fruits en cubes', 'Citron + menthe + un voile de sucre', '1 h au frais'], portions: 4, conservation: 2, ingredients: [{ nom: 'Pomme', q: 2, u: 'pcs', r: L }, { nom: 'Banane', q: 2, u: 'pcs', r: L }, { nom: 'Orange', q: 2, u: 'pcs', r: L }, { nom: 'Citron', q: 1, u: 'pcs', r: L }, { nom: 'Menthe fraîche', q: 0.5, u: 'botte', r: L }] },
  { titre: 'Brochettes de fruits & yaourt', prep: 10, difficulte: 'facile', saison: 'ete', cuisine: 'Française', cal: 110, p: 3, g: 22, l: 1.5, instructions: ['Couper les fruits en gros dés', 'Enfiler sur des piques', 'Yaourt nature à tremper'], portions: 2, conservation: 1, ingredients: [{ nom: 'Pomme', q: 1, u: 'pcs', r: L }, { nom: 'Banane', q: 1, u: 'pcs', r: L }, { nom: 'Fraise', q: 150, u: 'g', r: L }, { nom: 'Yaourt nature', q: 1, u: 'pcs', r: F }] },
  { titre: 'Salade d\u2019orange à la cannelle', prep: 8, difficulte: 'facile', saison: 'hiver', cuisine: 'Méditerranéenne', cal: 90, p: 1, g: 20, l: 0.5, instructions: ['Peler les oranges à vif', 'Rondelles + cannelle + miel', 'Mariner 10 min au frais'], portions: 2, conservation: 1, ingredients: [{ nom: 'Orange', q: 2, u: 'pcs', r: L }, { nom: 'Cannelle', q: 1, u: 'pincée', r: E }, { nom: 'Miel', q: 1, u: 'cac', r: S }] },
  { titre: 'Ananas frais en dés', prep: 5, difficulte: 'facile', saison: 'ete', cuisine: 'Tropicale', cal: 80, p: 0.5, g: 20, l: 0.2, instructions: ['Éplucher l\u2019ananas', 'Couper en dés', 'Servir frais'], portions: 2, conservation: 1, ingredients: [{ nom: 'Ananas frais', q: 0.5, u: 'pcs', r: L }] },
  { titre: 'Fruits de saison à croquer', prep: 3, difficulte: 'facile', saison: 'toutes', cuisine: 'Française', cal: 90, p: 1, g: 21, l: 0.5, instructions: ['Laver les fruits', 'Couper en morceaux ou servir entier', 'Un carré de chocolat en plus si envie'], portions: 1, conservation: 1, ingredients: [{ nom: 'Pomme', q: 1, u: 'pcs', r: L }, { nom: 'Clémentine', q: 2, u: 'pcs', r: L }, { nom: 'Raisin', q: 100, u: 'g', r: L }] },
  { titre: 'Poires pochées au vin', prep: 10, cuisson: 30, difficulte: 'moyen', saison: 'automne', cuisine: 'Française', cal: 190, p: 1, g: 38, l: 1, instructions: ['Porter vin + sucre + cannelle + vanille à ébullition', 'Pocher les poires 25 min', 'Servir tiède'], portions: 4, conservation: 3, ingredients: [{ nom: 'Poire', q: 4, u: 'pcs', r: L }, { nom: 'Vin rouge', q: 500, u: 'ml', r: B }, { nom: 'Sucre', q: 80, u: 'g', r: S }, { nom: 'Cannelle', q: 1, u: 'pcs', r: E }] },
];

// ─── Compotes & fruits cuits — express ou rapide ────────────────────────────
const COMPOTES: Recette[] = [
  { titre: 'Compote de pommes express', prep: 10, cuisson: 15, difficulte: 'facile', saison: 'toutes', cuisine: 'Française', cal: 90, p: 0.5, g: 22, l: 0.5, instructions: ['Éplucher, épépiner, couper les pommes', '15 min à couvert avec un voile d\u2019eau', 'Écraser à la fourchette'], portions: 4, conservation: 4, ingredients: [{ nom: 'Pomme', q: 6, u: 'pcs', r: L }, { nom: 'Sucre vanillé', q: 1, u: 'sachet', r: S }] },
  { titre: 'Compote de pommes aux fruits rouges', prep: 10, cuisson: 12, difficulte: 'facile', saison: 'ete', cuisine: 'Française', cal: 95, p: 0.6, g: 22, l: 0.5, instructions: ['Cuire les pommes en morceaux 10 min', 'Ajouter les fruits rouges 2 min', 'Écraser grossièrement'], portions: 4, conservation: 3, ingredients: [{ nom: 'Pomme', q: 5, u: 'pcs', r: L }, { nom: 'Fruits rouges', q: 150, u: 'g', r: L }] },
  { titre: 'Compote express pomme-fruits rouges (micro-ondes)', prep: 5, cuisson: 5, difficulte: 'facile', saison: 'toutes', cuisine: 'Française', cal: 100, p: 0.5, g: 24, l: 0.5, instructions: ['Pomme en morceaux, micro-ondes 4 min', 'Écraser avec les fruits rouges surgelés'], portions: 2, conservation: 2, ingredients: [{ nom: 'Pomme', q: 2, u: 'pcs', r: L }, { nom: 'Fruits rouges surgelés', q: 100, u: 'g', r: V }] },
  { titre: 'Poire fondante au four & miel', prep: 5, cuisson: 25, difficulte: 'facile', saison: 'automne', cuisine: 'Française', cal: 130, p: 0.5, g: 28, l: 1, instructions: ['Couper les poires en deux, épépiner', 'Miel + vanille, four 200°C 25 min', 'Servir tiède'], portions: 2, conservation: 2, ingredients: [{ nom: 'Poire', q: 2, u: 'pcs', r: L }, { nom: 'Miel', q: 1, u: 'cas', r: S }, { nom: 'Vanille', q: 0.5, u: 'pcs', r: E }] },
  { titre: 'Pommes au four cannelle', prep: 5, cuisson: 30, difficulte: 'facile', saison: 'automne', cuisine: 'Française', cal: 120, p: 0.5, g: 28, l: 1, instructions: ['Évider les pommes sans les peler', 'Beurre + sucre + cannelle au centre', 'Four 180°C 30 min'], portions: 4, conservation: 2, ingredients: [{ nom: 'Pomme', q: 4, u: 'pcs', r: L }, { nom: 'Beurre', q: 15, u: 'g', r: F }, { nom: 'Sucre', q: 30, u: 'g', r: S }, { nom: 'Cannelle', q: 1, u: 'cac', r: E }] },
];

// ─── Crèmes, mousses & entremets ────────────────────────────────────────────
const CREMES: Recette[] = [
  { titre: 'Mousse au chocolat classique', prep: 15, difficulte: 'facile', saison: 'toutes', cuisine: 'Française', cal: 220, p: 5, g: 18, l: 15, instructions: ['Séparer blancs/jaunes', 'Fondre chocolat, incorporer jaunes', 'Monter blancs en neige ferme', 'Incorporer délicatement', '4 h au frais'], portions: 4, conservation: 3, ingredients: [{ nom: 'Chocolat noir pâtissier', q: 200, u: 'g', r: S }, { nom: 'Œuf', q: 6, u: 'pcs', r: F }, { nom: 'Sucre', q: 20, u: 'g', r: S }] },
  { titre: 'Panna cotta aux fruits rouges', prep: 15, cuisson: 5, difficulte: 'facile', saison: 'printemps', cuisine: 'Italienne', cal: 240, p: 4, g: 22, l: 15, instructions: ['Chauffer crème + sucre + vanille', 'Dissoudre la gélatine', '4 h au frais', 'Coulis de fruits rouges'], portions: 4, conservation: 2, ingredients: [{ nom: 'Crème liquide', q: 400, u: 'ml', r: F }, { nom: 'Sucre', q: 60, u: 'g', r: S }, { nom: 'Gélatine', q: 2, u: 'pcs', r: S }, { nom: 'Fruits rouges', q: 200, u: 'g', r: L }] },
  { titre: 'Crème brûlée à la vanille', prep: 15, cuisson: 50, difficulte: 'moyen', saison: 'toutes', cuisine: 'Française', cal: 300, p: 5, g: 26, l: 20, instructions: ['Chauffer crème + vanille', 'Battre jaunes + sucre', 'Bain-marie 50 min 150°C', 'Caraméliser au moment'], portions: 4, conservation: 3, ingredients: [{ nom: 'Crème liquide', q: 400, u: 'ml', r: F }, { nom: 'Œuf', q: 4, u: 'pcs', r: F }, { nom: 'Sucre', q: 80, u: 'g', r: S }, { nom: 'Vanille', q: 1, u: 'pcs', r: E }] },
  { titre: 'Riz au lait vanillé', prep: 5, cuisson: 35, difficulte: 'facile', saison: 'hiver', cuisine: 'Française', cal: 230, p: 6, g: 36, l: 7, instructions: ['Rincer le riz', 'Cuire 30 min dans lait + sucre + vanille', 'Repos au frais'], portions: 4, conservation: 3, ingredients: [{ nom: 'Riz rond', q: 100, u: 'g', r: R }, { nom: 'Lait', q: 500, u: 'ml', r: F }, { nom: 'Sucre', q: 60, u: 'g', r: S }, { nom: 'Gousse de vanille', q: 1, u: 'pcs', r: S }] },
  { titre: 'Mousse citron-menthe express', prep: 10, difficulte: 'facile', saison: 'ete', cuisine: 'Française', cal: 160, p: 4, g: 18, l: 8, instructions: ['Mélanger yaourt grec, zeste et jus de citron, miel', 'Monter la crème, incorporer', '2 h au frais'], portions: 4, conservation: 2, ingredients: [{ nom: 'Yaourt grec', q: 3, u: 'pcs', r: F }, { nom: 'Citron', q: 2, u: 'pcs', r: L }, { nom: 'Miel', q: 2, u: 'cas', r: S }, { nom: 'Crème liquide', q: 150, u: 'ml', r: F }] },
];

// ─── Pâtisserie ─────────────────────────────────────────────────────────────
const PATISSERIE: Recette[] = [
  { titre: 'Tarte aux pommes maison', prep: 20, cuisson: 35, difficulte: 'moyen', saison: 'automne', cuisine: 'Française', cal: 260, p: 3, g: 38, l: 11, instructions: ['Étaler la pâte', 'Disposer les lamelles de pommes', 'Sucre + cannelle', '35 min 190°C'], portions: 6, conservation: 3, ingredients: [{ nom: 'Pâte brisée', q: 1, u: 'pcs', r: F }, { nom: 'Pomme', q: 6, u: 'pcs', r: L }, { nom: 'Sucre', q: 60, u: 'g', r: S }, { nom: 'Beurre', q: 30, u: 'g', r: F }, { nom: 'Cannelle', q: 1, u: 'cac', r: E }] },
  { titre: 'Fondant au chocolat', prep: 10, cuisson: 12, difficulte: 'moyen', saison: 'toutes', cuisine: 'Française', cal: 310, p: 5, g: 28, l: 20, instructions: ['Fondre chocolat + beurre', 'Mélanger œufs + sucre', 'Incorporer farine, puis chocolat', '12 min 200°C — cœur coulant garanti'], portions: 4, conservation: 4, ingredients: [{ nom: 'Chocolat noir pâtissier', q: 200, u: 'g', r: S }, { nom: 'Beurre', q: 120, u: 'g', r: F }, { nom: 'Œuf', q: 3, u: 'pcs', r: F }, { nom: 'Sucre', q: 80, u: 'g', r: S }, { nom: 'Farine', q: 50, u: 'g', r: R }] },
  { titre: 'Cookies moelleux pépites de chocolat', prep: 15, cuisson: 12, difficulte: 'facile', saison: 'toutes', cuisine: 'Américaine', cal: 195, p: 3, g: 26, l: 9, instructions: ['Crémer beurre + sucres + œuf', 'Farine + levure, pépites', 'Boules sur plaque, 12 min 180°C'], portions: 8, conservation: 4, ingredients: [{ nom: 'Farine', q: 200, u: 'g', r: R }, { nom: 'Beurre', q: 100, u: 'g', r: F }, { nom: 'Sucre', q: 80, u: 'g', r: S }, { nom: 'Œuf', q: 1, u: 'pcs', r: F }, { nom: 'Pépites de chocolat', q: 100, u: 'g', r: S }] },
  { titre: 'Gâteau au yaourt', prep: 10, cuisson: 35, difficulte: 'facile', saison: 'toutes', cuisine: 'Française', cal: 240, p: 5, g: 32, l: 10, instructions: ['Mélanger yaourt, sucre, œufs', 'Farine + levure + huile', '35 min 180°C'], portions: 6, conservation: 3, ingredients: [{ nom: 'Yaourt nature', q: 1, u: 'pcs', r: F }, { nom: 'Œuf', q: 3, u: 'pcs', r: F }, { nom: 'Farine', q: 250, u: 'g', r: R }, { nom: 'Sucre', q: 150, u: 'g', r: S }, { nom: 'Huile de tournesol', q: 100, u: 'ml', r: R }, { nom: 'Levure chimique', q: 0.5, u: 'sachet', r: R }] },
  { titre: 'Moelleux aux pommes', prep: 10, cuisson: 30, difficulte: 'facile', saison: 'automne', cuisine: 'Française', cal: 200, p: 4, g: 30, l: 8, instructions: ['Battre œufs + sucre', 'Farine + levure + beurre fondu', 'Pommes en dés, 30 min 180°C'], portions: 6, conservation: 3, ingredients: [{ nom: 'Pomme', q: 3, u: 'pcs', r: L }, { nom: 'Œuf', q: 2, u: 'pcs', r: F }, { nom: 'Farine', q: 150, u: 'g', r: R }, { nom: 'Sucre', q: 80, u: 'g', r: S }, { nom: 'Beurre', q: 80, u: 'g', r: F }, { nom: 'Levure chimique', q: 0.5, u: 'sachet', r: R }] },
  { titre: 'Clafoutis aux cerises', prep: 10, cuisson: 35, difficulte: 'facile', saison: 'ete', cuisine: 'Française', cal: 220, p: 6, g: 30, l: 9, instructions: ['Beurrer le moule, disposer les cerises', 'Mélanger farine, sucre, œufs, lait', 'Verser sur les cerises, 35 min 180°C'], portions: 6, conservation: 3, ingredients: [{ nom: 'Cerise', q: 400, u: 'g', r: L }, { nom: 'Farine', q: 100, u: 'g', r: R }, { nom: 'Sucre', q: 80, u: 'g', r: S }, { nom: 'Œuf', q: 3, u: 'pcs', r: F }, { nom: 'Lait', q: 200, u: 'ml', r: F }] },
  { titre: 'Brownie aux noix', prep: 10, cuisson: 25, difficulte: 'facile', saison: 'toutes', cuisine: 'Américaine', cal: 280, p: 4, g: 30, l: 16, instructions: ['Fondre chocolat + beurre', 'Sucre + œufs', 'Farine + noix', '25 min 180°C, doit rester moelleux'], portions: 8, conservation: 4, ingredients: [{ nom: 'Chocolat noir pâtissier', q: 200, u: 'g', r: S }, { nom: 'Beurre', q: 120, u: 'g', r: F }, { nom: 'Sucre', q: 150, u: 'g', r: S }, { nom: 'Œuf', q: 3, u: 'pcs', r: F }, { nom: 'Farine', q: 80, u: 'g', r: R }, { nom: 'Noix', q: 60, u: 'g', r: R }] },
  { titre: 'Crêpes sucrées', prep: 10, cuisson: 15, difficulte: 'facile', saison: 'toutes', cuisine: 'Française', cal: 180, p: 6, g: 24, l: 7, instructions: ['Mélanger farine, œufs, lait, beurre fondu', 'Reposer 30 min', 'Cuire à la poêle', 'Garnir selon envie'], portions: 6, conservation: 3, ingredients: [{ nom: 'Farine', q: 250, u: 'g', r: R }, { nom: 'Œuf', q: 3, u: 'pcs', r: F }, { nom: 'Lait', q: 500, u: 'ml', r: F }, { nom: 'Beurre', q: 30, u: 'g', r: F }] },
  { titre: 'Tiramisu classique', prep: 25, difficulte: 'moyen', saison: 'toutes', cuisine: 'Italienne', cal: 380, p: 8, g: 35, l: 22, instructions: ['Mascarpone + jaunes + sucre', 'Monter blancs, incorporer', 'Tremper les biscuits dans le café', 'Alterner couches, cacao, 4 h au frais'], portions: 6, conservation: 4, ingredients: [{ nom: 'Mascarpone', q: 250, u: 'g', r: F }, { nom: 'Œuf', q: 3, u: 'pcs', r: F }, { nom: 'Biscuits cuillère', q: 200, u: 'g', r: S }, { nom: 'Sucre', q: 80, u: 'g', r: S }, { nom: 'Café', q: 200, u: 'ml', r: B }, { nom: 'Cacao en poudre', q: 10, u: 'g', r: S }] },
  { titre: 'Crumble pommes-fruits rouges', prep: 15, cuisson: 30, difficulte: 'facile', saison: 'toutes', cuisine: 'Française', cal: 250, p: 3.5, g: 34, l: 11, instructions: ['Beurrer un plat, disposer pommes + fruits rouges', 'Sabler beurre + farine + sucre + poudre d\u2019amandes', 'Émietter sur les fruits, 30 min 180°C'], portions: 6, conservation: 3, ingredients: [{ nom: 'Pomme', q: 4, u: 'pcs', r: L }, { nom: 'Fruits rouges', q: 150, u: 'g', r: L }, { nom: 'Farine', q: 100, u: 'g', r: R }, { nom: 'Beurre', q: 80, u: 'g', r: F }, { nom: 'Sucre', q: 80, u: 'g', r: S }, { nom: 'Poudre d\u2019amandes', q: 40, u: 'g', r: S }] },
];

// ─── Glaces & fraîcheur ─────────────────────────────────────────────────────
const GLACES: Recette[] = [
  { titre: 'Vacherin express fruits rouges', prep: 10, difficulte: 'facile', saison: 'ete', cuisine: 'Française', cal: 210, p: 4, g: 30, l: 8, instructions: ['Alterner glace vanille, fruits rouges et chantilly en verrine', 'Servir immédiatement'], portions: 2, conservation: 1, ingredients: [{ nom: 'Glace vanille', q: 250, u: 'ml', r: V }, { nom: 'Fruits rouges', q: 150, u: 'g', r: L }, { nom: 'Chantilly', q: 100, u: 'ml', r: F }] },
  { titre: 'Sorbet mangue & citron vert', prep: 5, difficulte: 'facile', saison: 'ete', cuisine: 'Tropicale', cal: 110, p: 1, g: 26, l: 0.5, instructions: ['Sorbet mangue en coupes', 'Zeste + jus de citron vert', 'Feuille de menthe'], portions: 2, conservation: 1, ingredients: [{ nom: 'Sorbet mangue', q: 250, u: 'ml', r: V }, { nom: 'Citron vert', q: 1, u: 'pcs', r: L }, { nom: 'Menthe fraîche', q: 0.2, u: 'botte', r: L }] },
  { titre: 'Banane split express', prep: 8, difficulte: 'facile', saison: 'toutes', cuisine: 'Américaine', cal: 280, p: 4, g: 42, l: 10, instructions: ['Banane fendue en deux dans l\u2019assiette', 'Boules de glace vanille + chocolat', 'Chantilly + pépites de chocolat'], portions: 2, conservation: 1, ingredients: [{ nom: 'Banane', q: 1, u: 'pcs', r: L }, { nom: 'Glace vanille', q: 200, u: 'ml', r: V }, { nom: 'Chantilly', q: 60, u: 'ml', r: F }, { nom: 'Pépites de chocolat', q: 20, u: 'g', r: S }] },
  { titre: 'Brochette de fruits glacés au chocolat', prep: 10, cuisson: 2, difficulte: 'facile', saison: 'ete', cuisine: 'Française', cal: 150, p: 2.5, g: 22, l: 6, instructions: ['Enfiler des morceaux de banane et fraise sur des piques', 'Tremper dans chocolat fondu', '15 min au congélateur'], portions: 2, conservation: 2, ingredients: [{ nom: 'Banane', q: 1, u: 'pcs', r: L }, { nom: 'Fraise', q: 150, u: 'g', r: L }, { nom: 'Chocolat noir pâtissier', q: 80, u: 'g', r: S }] },
];

// ─── Petit festif du soir (gourmand) ────────────────────────────────────────
const FESTIFS: Recette[] = [
  { titre: 'Mug cake choco-banane', prep: 2, cuisson: 2, difficulte: 'facile', saison: 'toutes', cuisine: 'Américaine', cal: 280, p: 8, g: 35, l: 12, instructions: ['Écraser la demi-banane dans un mug', 'Farine, cacao, lait, levure', 'Micro-ondes 1 min 30'], portions: 1, conservation: 1, ingredients: [{ nom: 'Banane', q: 0.5, u: 'pcs', r: L }, { nom: 'Farine', q: 30, u: 'g', r: R }, { nom: 'Cacao en poudre', q: 10, u: 'g', r: S }, { nom: 'Lait', q: 30, u: 'ml', r: F }, { nom: 'Levure chimique', q: 0.25, u: 'sachet', r: R }] },
  { titre: 'Dattes au fromage frais & noix', prep: 7, difficulte: 'facile', saison: 'toutes', cuisine: 'Orientale', cal: 160, p: 4, g: 26, l: 4, instructions: ['Ouvrir les dattes, dénoyauter', 'Garnir de fromage frais', 'Une noix sur chaque, filet de miel'], portions: 2, conservation: 2, ingredients: [{ nom: 'Datte', q: 8, u: 'pcs', r: S }, { nom: 'Fromage frais', q: 60, u: 'g', r: F }, { nom: 'Noix', q: 20, u: 'g', r: R }, { nom: 'Miel', q: 1, u: 'cac', r: S }] },
  { titre: 'Poires Belle-Hélène express', prep: 10, difficulte: 'facile', saison: 'toutes', cuisine: 'Française', cal: 230, p: 3, g: 32, l: 9, instructions: ['Poires en lamelles (boîte ou fraîches)', 'Sauce chocolat chaude au micro-ondes', 'Éclats de noisettes + chantilly'], portions: 2, conservation: 1, ingredients: [{ nom: 'Poire', q: 2, u: 'pcs', r: L }, { nom: 'Chocolat noir pâtissier', q: 80, u: 'g', r: S }, { nom: 'Crème liquide', q: 50, u: 'ml', r: F }, { nom: 'Noisettes', q: 15, u: 'g', r: S }] },
  { titre: 'Tarte tatin express (pâte feuilletée)', prep: 10, cuisson: 30, difficulte: 'moyen', saison: 'automne', cuisine: 'Française', cal: 290, p: 3, g: 40, l: 13, instructions: ['Caramel au fond du moule', 'Quartiers de pommes debout', 'Couvrir de pâte feuilletée, 30 min 190°C', 'Retourner à chaud'], portions: 4, conservation: 3, ingredients: [{ nom: 'Pâte feuilletée', q: 1, u: 'pcs', r: F }, { nom: 'Pomme', q: 6, u: 'pcs', r: L }, { nom: 'Sucre', q: 80, u: 'g', r: S }, { nom: 'Beurre', q: 50, u: 'g', r: F }] },
];

const CATALOGUE: Recette[] = [...YAOURTS, ...FRUITS, ...COMPOTES, ...CREMES, ...PATISSERIE, ...GLACES, ...FESTIFS];

const ALLERGENES = ['Arachides', 'Fruits à coque', 'Lactose', 'Gluten', 'Œufs', 'Crustacés', 'Poisson', 'Soja'];

async function seed() {
  console.log('🍰 Seed catalogue desserts…\n');

  let ajoutes = 0, ignores = 0;

  for (const meal of CATALOGUE) {
    // Idempotence : ignorer si le titre existe déjà
    const { data: existing } = await supabase.from('meals').select('id').eq('titre', meal.titre).maybeSingle();
    if (existing) { ignores++; continue; }

    // Résoudre/créer les ingrédients
    const ingredientIds: Record<string, number> = {};
    for (const ing of meal.ingredients) {
      const { data: found } = await supabase.from('ingredients').select('id').eq('nom', ing.nom).single();
      if (found) { ingredientIds[ing.nom] = found.id; continue; }
      const { data: created } = await supabase.from('ingredients').insert({
        nom: ing.nom, rayon: ing.r,
        est_allergene: ALLERGENES.includes(ing.nom),
      }).select('id').single();
      if (created) ingredientIds[ing.nom] = created.id;
    }

    const { data: mealData } = await supabase.from('meals').insert({
      titre: meal.titre, type_repas: 'dessert', temps_preparation: meal.prep,
      temps_cuisson: meal.cuisson ?? null, difficulte: meal.difficulte,
      saison: meal.saison, cuisine: meal.cuisine,
      calories_par_portion: meal.cal, proteines: meal.p, glucides: meal.g, lipides: meal.l,
      instructions: meal.instructions, portions_par_defaut: meal.portions,
      conservation_jours: meal.conservation, is_public: true,
    }).select('id').single();

    if (!mealData) { console.log(`❌ ${meal.titre}`); continue; }

    const liens = meal.ingredients
      .map(ing => ({ meal_id: mealData.id, ingredient_id: ingredientIds[ing.nom], quantite: ing.q, unite: ing.u }))
      .filter(mi => mi.ingredient_id);
    if (liens.length > 0) await supabase.from('meal_ingredients').insert(liens);

    ajoutes++;
    console.log(`✅ ${meal.titre}`);
  }

  console.log(`\n🎉 Terminé : ${ajoutes} desserts ajoutés, ${ignores} déjà présents (ignorés).`);
  console.log(`   Total catalogue dessert : ${CATALOGUE.length} familles couvertes (yaourt, fromage blanc, skyr, fruits, compotes, crèmes, pâtisserie, glaces, festifs).`);
}

seed().catch(e => { console.error(e); process.exit(1); });
