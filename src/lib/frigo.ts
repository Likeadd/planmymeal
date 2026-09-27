// ============================================================================
// Frigo / garde-manger — PlanMyMeal
//
// Le frigo est un SIGNAL, pas un objectif : il donne un léger avantage aux
// recettes qui utilisent ce qu'on a déjà, sans jamais construire des menus
// artificiels juste pour le vider (le brief produit est explicite là-dessus).
// Il alimente aussi la liste de courses, qui en déduit ce qui est déjà présent
// (côté SQL, cf. migration 00016 : recompute_shopping_list_frigo).
// ============================================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/../supabase/database.types';
import type { FridgeItem, RecetteFoyer } from '@/types';
import { normaliserNom } from '@/lib/regimes';
import { UserError } from '@/lib/utils';

export type Db = SupabaseClient<Database>;

/** Unités acceptées au frigo — alignées sur les unités du catalogue recettes */
export const UNITES_FRIGO = ['g', 'ml', 'pcs', 'botte', 'boite', 'sachet'] as const;
export type UniteFrigo = (typeof UNITES_FRIGO)[number];

export interface NouvelArticle {
  ingredient_id: number;
  quantite: number;
  unite: string;
  expiration?: string | null;
}

// ─── Ajouts rapides — le garde-manger courant en un clic ───────────────────

/** Un aliment proposé à l'ajout rapide sur la page Frigo. */
export interface AlimentFrigo {
  /** Nom EXACT attendu dans la table `ingredients` (accents compris) */
  nom: string;
  emoji: string;
  /** Quantité pré-remplie, adaptée à un frigo courant (voir `unite`) */
  quantite: number;
  /** Unité de SAISIE — normalisée ensuite (kg → g, cl → ml, etc.) */
  unite: string;
}

/**
 * Catalogue curaté des ajouts rapides, groupé par rayon — bien plus large que
 * les 40 puces alphabétiques de la recherche, qui n'affichent que le début du
 * catalogue avant la première lettre tapée.
 *
 * CONTRAT : chaque `nom` doit EXISTER dans la table `ingredients` (la page
 * résout par nom, insensible aux accents et à la casse). Un nom introuvable
 * est simplement MASQUÉ — on ne crée JAMAIS d'ingrédient côté client : le
 * catalogue est la source de vérité des prix, rayons et macros.
 */
export const ALIMENTS_FRIGO: { label: string; aliments: AlimentFrigo[] }[] = [
  {
    label: 'Crèmerie & œufs',
    aliments: [
      { nom: 'Œuf', emoji: '🥚', quantite: 6, unite: 'pcs' },
      { nom: 'Lait', emoji: '🥛', quantite: 1, unite: 'L' },
      { nom: 'Lait d’amande', emoji: '🥛', quantite: 1, unite: 'L' },
      { nom: 'Lait d’avoine', emoji: '🥛', quantite: 1, unite: 'L' },
      { nom: 'Lait de soja', emoji: '🥛', quantite: 1, unite: 'L' },
      { nom: 'Beurre', emoji: '🧈', quantite: 250, unite: 'g' },
      { nom: 'Beurre demi-sel', emoji: '🧈', quantite: 250, unite: 'g' },
      { nom: 'Margarine', emoji: '🧈', quantite: 250, unite: 'g' },
      { nom: 'Yaourt nature', emoji: '🍶', quantite: 4, unite: 'pcs' },
      { nom: 'Yaourt grec', emoji: '🍶', quantite: 2, unite: 'pcs' },
      { nom: 'Fromage blanc', emoji: '🥛', quantite: 500, unite: 'g' },
      { nom: 'Skyr', emoji: '🥛', quantite: 400, unite: 'g' },
      { nom: 'Crème fraîche épaisse', emoji: '🥛', quantite: 20, unite: 'cl' },
      { nom: 'Crème liquide', emoji: '🥛', quantite: 20, unite: 'cl' },
      { nom: 'Crème végétale', emoji: '🥛', quantite: 20, unite: 'cl' },
      { nom: 'Mascarpone', emoji: '🧀', quantite: 250, unite: 'g' },
      { nom: 'Parmesan', emoji: '🧀', quantite: 100, unite: 'g' },
      { nom: 'Mozzarella', emoji: '🧀', quantite: 125, unite: 'g' },
      { nom: 'Feta', emoji: '🧀', quantite: 150, unite: 'g' },
      { nom: 'Ricotta légère', emoji: '🧀', quantite: 250, unite: 'g' },
      { nom: 'Camembert', emoji: '🧀', quantite: 1, unite: 'pcs' },
      { nom: 'Brie', emoji: '🧀', quantite: 1, unite: 'pcs' },
      { nom: 'Emmental', emoji: '🧀', quantite: 200, unite: 'g' },
      { nom: 'Fromage râpé', emoji: '🧀', quantite: 200, unite: 'g' },
      { nom: 'Cheddar', emoji: '🧀', quantite: 150, unite: 'g' },
      { nom: 'Chèvre frais', emoji: '🧀', quantite: 150, unite: 'g' },
    ],
  },
  {
    label: 'Viandes',
    aliments: [
      { nom: 'Filet de poulet', emoji: '🍗', quantite: 300, unite: 'g' },
      { nom: 'Escalope de poulet', emoji: '🍗', quantite: 300, unite: 'g' },
      { nom: 'Cuisses de poulet', emoji: '🍗', quantite: 4, unite: 'pcs' },
      { nom: 'Ailes de poulet', emoji: '🍗', quantite: 500, unite: 'g' },
      { nom: 'Poulet entier', emoji: '🍗', quantite: 1, unite: 'pcs' },
      { nom: 'Viande hachée (bœuf)', emoji: '🥩', quantite: 400, unite: 'g' },
      { nom: 'Bœuf haché 5 %', emoji: '🥩', quantite: 400, unite: 'g' },
      { nom: 'Steak haché', emoji: '🥩', quantite: 300, unite: 'g' },
      { nom: 'Filet mignon de porc', emoji: '🥩', quantite: 400, unite: 'g' },
      { nom: 'Côte de porc', emoji: '🥩', quantite: 2, unite: 'pcs' },
      { nom: 'Rôti de porc', emoji: '🥩', quantite: 1, unite: 'pcs' },
      { nom: 'Escalope de veau', emoji: '🥩', quantite: 2, unite: 'pcs' },
      { nom: 'Magret de canard', emoji: '🦆', quantite: 1, unite: 'pcs' },
      { nom: 'Merguez', emoji: '🌭', quantite: 6, unite: 'pcs' },
      { nom: 'Chorizo', emoji: '🌭', quantite: 150, unite: 'g' },
      { nom: 'Bacon', emoji: '🥓', quantite: 150, unite: 'g' },
      { nom: 'Lardons', emoji: '🥓', quantite: 200, unite: 'g' },
      { nom: 'Jambon blanc', emoji: '🥓', quantite: 200, unite: 'g' },
      { nom: 'Jambon cru', emoji: '🥓', quantite: 100, unite: 'g' },
      { nom: 'Boudin noir', emoji: '🍖', quantite: 300, unite: 'g' },
      { nom: 'Foie de volaille', emoji: '🍖', quantite: 250, unite: 'g' },
    ],
  },
  {
    label: 'Poissons & fruits de mer',
    aliments: [
      { nom: 'Pavé de saumon', emoji: '🐟', quantite: 2, unite: 'pcs' },
      { nom: 'Saumon frais', emoji: '🐟', quantite: 300, unite: 'g' },
      { nom: 'Saumon fumé', emoji: '🐟', quantite: 100, unite: 'g' },
      { nom: 'Filet de cabillaud', emoji: '🐟', quantite: 300, unite: 'g' },
      { nom: 'Truite', emoji: '🐟', quantite: 2, unite: 'pcs' },
      { nom: 'Sole', emoji: '🐟', quantite: 2, unite: 'pcs' },
      { nom: 'Bar (poisson)', emoji: '🐟', quantite: 2, unite: 'pcs' },
      { nom: 'Filet de dorade', emoji: '🐟', quantite: 2, unite: 'pcs' },
      { nom: 'Filet de tilapia', emoji: '🐟', quantite: 300, unite: 'g' },
      { nom: 'Maquereau', emoji: '🐟', quantite: 2, unite: 'pcs' },
      { nom: 'Sardines fraîches', emoji: '🐟', quantite: 6, unite: 'pcs' },
      { nom: 'Sardines (bte)', emoji: '🥫', quantite: 1, unite: 'boite' },
      { nom: 'Thon au naturel', emoji: '🥫', quantite: 1, unite: 'boite' },
      { nom: 'Anchois (bte)', emoji: '🥫', quantite: 1, unite: 'boite' },
      { nom: 'Crevettes', emoji: '🍤', quantite: 250, unite: 'g' },
      { nom: 'Gambas', emoji: '🍤', quantite: 250, unite: 'g' },
      { nom: 'Moules', emoji: '🦪', quantite: 1, unite: 'kg' },
      { nom: 'Noix de Saint-Jacques', emoji: '🦪', quantite: 250, unite: 'g' },
      { nom: 'Calamars', emoji: '🦑', quantite: 300, unite: 'g' },
      { nom: 'Poulpe', emoji: '🐙', quantite: 300, unite: 'g' },
      { nom: 'Surimi', emoji: '🦀', quantite: 200, unite: 'g' },
    ],
  },
  {
    label: 'Légumes',
    aliments: [
      { nom: 'Tomate', emoji: '🍅', quantite: 500, unite: 'g' },
      { nom: 'Tomates cerises', emoji: '🍅', quantite: 250, unite: 'g' },
      { nom: 'Oignon', emoji: '🧅', quantite: 500, unite: 'g' },
      { nom: 'Oignon rouge', emoji: '🧅', quantite: 250, unite: 'g' },
      { nom: 'Ail', emoji: '🧄', quantite: 2, unite: 'pcs' },
      { nom: 'Échalote', emoji: '🧅', quantite: 100, unite: 'g' },
      { nom: 'Carotte', emoji: '🥕', quantite: 500, unite: 'g' },
      { nom: 'Courgette', emoji: '🥒', quantite: 500, unite: 'g' },
      { nom: 'Aubergine', emoji: '🍆', quantite: 300, unite: 'g' },
      { nom: 'Poivron rouge', emoji: '🫑', quantite: 250, unite: 'g' },
      { nom: 'Poivron jaune', emoji: '🫑', quantite: 250, unite: 'g' },
      { nom: 'Poivron vert', emoji: '🫑', quantite: 250, unite: 'g' },
      { nom: 'Piment vert', emoji: '🌶️', quantite: 2, unite: 'pcs' },
      { nom: 'Champignons de Paris', emoji: '🍄', quantite: 250, unite: 'g' },
      { nom: 'Brocoli', emoji: '🥦', quantite: 400, unite: 'g' },
      { nom: 'Chou-fleur', emoji: '🥦', quantite: 500, unite: 'g' },
      { nom: 'Chou de Bruxelles', emoji: '🥦', quantite: 400, unite: 'g' },
      { nom: 'Chou rouge', emoji: '🥬', quantite: 500, unite: 'g' },
      { nom: 'Épinards frais', emoji: '🥬', quantite: 250, unite: 'g' },
      { nom: 'Blette', emoji: '🥬', quantite: 400, unite: 'g' },
      { nom: 'Salade verte', emoji: '🥗', quantite: 1, unite: 'pcs' },
      { nom: 'Roquette', emoji: '🥗', quantite: 100, unite: 'g' },
      { nom: 'Cresson', emoji: '🥗', quantite: 100, unite: 'g' },
      { nom: 'Concombre', emoji: '🥒', quantite: 1, unite: 'pcs' },
      { nom: 'Avocat', emoji: '🥑', quantite: 2, unite: 'pcs' },
      { nom: 'Pomme de terre', emoji: '🥔', quantite: 1, unite: 'kg' },
      { nom: 'Patate douce', emoji: '🍠', quantite: 600, unite: 'g' },
      { nom: 'Igname', emoji: '🍠', quantite: 500, unite: 'g' },
      { nom: 'Panais', emoji: '🥕', quantite: 400, unite: 'g' },
      { nom: 'Rutabaga', emoji: '🥕', quantite: 400, unite: 'g' },
      { nom: 'Topinambour', emoji: '🥔', quantite: 400, unite: 'g' },
      { nom: 'Salsifis', emoji: '🥕', quantite: 400, unite: 'g' },
      { nom: 'Courge butternut', emoji: '🎃', quantite: 1, unite: 'pcs' },
      { nom: 'Poireau', emoji: '🥬', quantite: 250, unite: 'g' },
      { nom: 'Fenouil', emoji: '🥬', quantite: 1, unite: 'pcs' },
      { nom: 'Céleri branche', emoji: '🥬', quantite: 1, unite: 'pcs' },
      { nom: 'Asperge verte', emoji: '🥬', quantite: 500, unite: 'g' },
      { nom: 'Artichaut frais', emoji: '🥬', quantite: 2, unite: 'pcs' },
      { nom: 'Gombo', emoji: '🥬', quantite: 250, unite: 'g' },
      { nom: 'Navet', emoji: '🥕', quantite: 400, unite: 'g' },
      { nom: 'Radis', emoji: '🥕', quantite: 1, unite: 'botte' },
      { nom: 'Betterave cuite', emoji: '🥕', quantite: 250, unite: 'g' },
      { nom: 'Haricots verts', emoji: '🫛', quantite: 400, unite: 'g' },
      { nom: 'Persil', emoji: '🌿', quantite: 1, unite: 'botte' },
      { nom: 'Basilic', emoji: '🌿', quantite: 1, unite: 'botte' },
      { nom: 'Ciboulette', emoji: '🌿', quantite: 1, unite: 'botte' },
      { nom: 'Coriandre fraîche', emoji: '🌿', quantite: 1, unite: 'botte' },
    ],
  },
  {
    label: 'Fruits',
    aliments: [
      { nom: 'Pomme', emoji: '🍎', quantite: 4, unite: 'pcs' },
      { nom: 'Poire', emoji: '🍐', quantite: 4, unite: 'pcs' },
      { nom: 'Coing', emoji: '🍐', quantite: 3, unite: 'pcs' },
      { nom: 'Banane', emoji: '🍌', quantite: 3, unite: 'pcs' },
      { nom: 'Orange', emoji: '🍊', quantite: 4, unite: 'pcs' },
      { nom: 'Clémentine', emoji: '🍊', quantite: 6, unite: 'pcs' },
      { nom: 'Pamplemousse', emoji: '🍊', quantite: 2, unite: 'pcs' },
      { nom: 'Citron', emoji: '🍋', quantite: 2, unite: 'pcs' },
      { nom: 'Citron vert', emoji: '🍋', quantite: 3, unite: 'pcs' },
      { nom: 'Fraise', emoji: '🍓', quantite: 250, unite: 'g' },
      { nom: 'Framboise', emoji: '🍓', quantite: 125, unite: 'g' },
      { nom: 'Myrtilles', emoji: '🫐', quantite: 125, unite: 'g' },
      { nom: 'Cerise', emoji: '🍒', quantite: 250, unite: 'g' },
      { nom: 'Raisin', emoji: '🍇', quantite: 500, unite: 'g' },
      { nom: 'Mangue', emoji: '🥭', quantite: 1, unite: 'pcs' },
      { nom: 'Melon', emoji: '🍈', quantite: 1, unite: 'pcs' },
      { nom: 'Pastèque', emoji: '🍉', quantite: 1, unite: 'pcs' },
      { nom: 'Abricot', emoji: '🍑', quantite: 6, unite: 'pcs' },
      { nom: 'Pêche', emoji: '🍑', quantite: 4, unite: 'pcs' },
      { nom: 'Nectarine', emoji: '🍑', quantite: 4, unite: 'pcs' },
      { nom: 'Figue fraîche', emoji: '🍈', quantite: 6, unite: 'pcs' },
      { nom: 'Fruit de la passion', emoji: '🍈', quantite: 4, unite: 'pcs' },
      { nom: 'Grenade', emoji: '🍎', quantite: 1, unite: 'pcs' },
      { nom: 'Papaye', emoji: '🥭', quantite: 1, unite: 'pcs' },
      { nom: 'Rhubarbe', emoji: '🌿', quantite: 400, unite: 'g' },
    ],
  },
  {
    label: 'Épicerie & secs',
    aliments: [
      { nom: 'Pâtes penne', emoji: '🍝', quantite: 500, unite: 'g' },
      { nom: 'Pâtes coquillettes', emoji: '🍝', quantite: 500, unite: 'g' },
      { nom: 'Pâtes orzo', emoji: '🍝', quantite: 500, unite: 'g' },
      { nom: 'Tagliatelles', emoji: '🍝', quantite: 500, unite: 'g' },
      { nom: 'Riz basmati', emoji: '🍚', quantite: 500, unite: 'g' },
      { nom: 'Riz complet', emoji: '🍚', quantite: 500, unite: 'g' },
      { nom: 'Riz sauvage', emoji: '🍚', quantite: 500, unite: 'g' },
      { nom: 'Quinoa', emoji: '🌾', quantite: 250, unite: 'g' },
      { nom: 'Boulgour', emoji: '🌾', quantite: 500, unite: 'g' },
      { nom: 'Semoule', emoji: '🌾', quantite: 500, unite: 'g' },
      { nom: 'Sarrasin', emoji: '🌾', quantite: 500, unite: 'g' },
      { nom: 'Millet', emoji: '🌾', quantite: 500, unite: 'g' },
      { nom: 'Lentilles corail', emoji: '🌾', quantite: 400, unite: 'g' },
      { nom: 'Lentilles vertes', emoji: '🌾', quantite: 400, unite: 'g' },
      { nom: 'Pois chiches secs', emoji: '🌾', quantite: 400, unite: 'g' },
      { nom: 'Farine', emoji: '🌾', quantite: 1, unite: 'kg' },
      { nom: 'Flocons d’avoine', emoji: '🥣', quantite: 500, unite: 'g' },
      { nom: 'Huile d’olive', emoji: '🫒', quantite: 50, unite: 'cl' },
      { nom: 'Miel', emoji: '🍯', quantite: 250, unite: 'g' },
      { nom: 'Confiture', emoji: '🍯', quantite: 1, unite: 'pcs' },
      { nom: 'Pâte à tartiner', emoji: '🍫', quantite: 1, unite: 'pcs' },
      { nom: 'Tomate concassée (bte)', emoji: '🥫', quantite: 1, unite: 'boite' },
      { nom: 'Concentré de tomate', emoji: '🥫', quantite: 1, unite: 'boite' },
      { nom: 'Lait de coco', emoji: '🥫', quantite: 1, unite: 'boite' },
      { nom: 'Pois chiches (bte)', emoji: '🥫', quantite: 1, unite: 'boite' },
      { nom: 'Haricots rouges (bte)', emoji: '🥫', quantite: 1, unite: 'boite' },
      { nom: 'Maïs (bte)', emoji: '🌽', quantite: 1, unite: 'boite' },
      { nom: 'Olives noires', emoji: '🫒', quantite: 200, unite: 'g' },
      { nom: 'Chocolat noir pâtissier', emoji: '🍫', quantite: 200, unite: 'g' },
      { nom: 'Amandes', emoji: '🥜', quantite: 200, unite: 'g' },
      { nom: 'Noix', emoji: '🥜', quantite: 150, unite: 'g' },
      { nom: 'Noix de pécan', emoji: '🥜', quantite: 150, unite: 'g' },
      { nom: 'Noix de cajou', emoji: '🥜', quantite: 150, unite: 'g' },
      { nom: 'Pistaches non salées', emoji: '🥜', quantite: 150, unite: 'g' },
      { nom: 'Graines de tournesol', emoji: '🌻', quantite: 150, unite: 'g' },
      { nom: 'Graines de lin', emoji: '🌾', quantite: 100, unite: 'g' },
      { nom: 'Graines de sésame', emoji: '🌾', quantite: 100, unite: 'g' },
      { nom: 'Beurre de cacahuète', emoji: '🥜', quantite: 350, unite: 'g' },
    ],
  },
  {
    label: 'Condiments & sauces',
    aliments: [
      { nom: 'Moutarde', emoji: '🟡', quantite: 200, unite: 'g' },
      { nom: 'Mayonnaise', emoji: '🥚', quantite: 200, unite: 'g' },
      { nom: 'Ketchup', emoji: '🍅', quantite: 1, unite: 'pcs' },
      { nom: 'Sauce barbecue', emoji: '🍖', quantite: 1, unite: 'pcs' },
      { nom: 'Sauce soja', emoji: '🍶', quantite: 10, unite: 'cl' },
      { nom: 'Sauce sriracha', emoji: '🌶️', quantite: 1, unite: 'pcs' },
      { nom: 'Sauce Worcestershire', emoji: '🍶', quantite: 1, unite: 'pcs' },
      { nom: 'Tabasco', emoji: '🌶️', quantite: 1, unite: 'pcs' },
      { nom: 'Harissa', emoji: '🌶️', quantite: 100, unite: 'g' },
      { nom: 'Pesto', emoji: '🌿', quantite: 190, unite: 'g' },
      { nom: 'Vinaigre balsamique', emoji: '🍷', quantite: 25, unite: 'cl' },
      { nom: 'Vinaigre de cidre', emoji: '🍷', quantite: 25, unite: 'cl' },
      { nom: 'Vinaigre de riz', emoji: '🍷', quantite: 25, unite: 'cl' },
    ],
  },
  {
    label: 'Boulangerie',
    aliments: [
      { nom: 'Pain complet', emoji: '🍞', quantite: 1, unite: 'pcs' },
      { nom: 'Pain de campagne', emoji: '🍞', quantite: 1, unite: 'pcs' },
      { nom: 'Pain de mie', emoji: '🍞', quantite: 1, unite: 'pcs' },
      { nom: 'Biscottes', emoji: '🍞', quantite: 1, unite: 'pcs' },
      { nom: 'Pains pita', emoji: '🫓', quantite: 4, unite: 'pcs' },
      { nom: 'Tortillas de blé', emoji: '🌯', quantite: 6, unite: 'pcs' },
    ],
  },
  {
    label: 'Surgelés',
    aliments: [
      { nom: 'Petit pois (surg.)', emoji: '🧊', quantite: 500, unite: 'g' },
      { nom: 'Épinards surgelés', emoji: '🧊', quantite: 500, unite: 'g' },
      { nom: 'Fruits rouges', emoji: '🧊', quantite: 300, unite: 'g' },
      { nom: 'Fruits de mer surgelés', emoji: '🧊', quantite: 400, unite: 'g' },
      { nom: 'Frites surgelées', emoji: '🍟', quantite: 750, unite: 'g' },
      { nom: 'Poêlée de légumes surgelée', emoji: '🧊', quantite: 600, unite: 'g' },
      { nom: 'Nuggets de poulet (surg.)', emoji: '🍗', quantite: 500, unite: 'g' },
      { nom: 'Glace vanille', emoji: '🍦', quantite: 500, unite: 'g' },
    ],
  },
  {
    label: 'Boissons',
    aliments: [
      { nom: 'Café', emoji: '☕', quantite: 250, unite: 'g' },
      { nom: 'Thé', emoji: '🍵', quantite: 1, unite: 'pcs' },
      { nom: 'Jus d’orange', emoji: '🧃', quantite: 1, unite: 'L' },
      { nom: 'Eau gazeuse', emoji: '🫧', quantite: 1, unite: 'L' },
      { nom: 'Vin blanc', emoji: '🍷', quantite: 1, unite: 'pcs' },
      { nom: 'Vin rouge', emoji: '🍷', quantite: 1, unite: 'pcs' },
    ],
  },
];

/**
 * Clé de rapprochement d'un nom d'ingrédient : casse, accents, espaces ET
 * apostrophes oubliés (la base a connu la duplication « Huile d'olive » /
 * « Huile d’olive », droite vs typographique — une clé aveugle au type
 * d'apostrophe rapproche les deux). Employée par les ajouts rapides de la
 * page Frigo pour résoudre les noms curatés vers les ingrédients réels.
 */
export function cleNomIngredient(nom: string): string {
  return normaliserNom(nom).replace(/['’`]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Convertit une saisie utilisateur vers une unité du catalogue : les cuisiniers
 * pensent en kg et en litres, la liste de courses en grammes et millilitres.
 * Sans cette normalisation, la déduction du frigo ne matcherait jamais.
 */
function normaliserQuantite(quantite: number, unite: string): { quantite: number; unite: UniteFrigo } {
  const u = unite.trim().toLowerCase();
  const facteurs: Record<string, { unite: UniteFrigo; facteur: number }> = {
    kg: { unite: 'g', facteur: 1000 },
    g: { unite: 'g', facteur: 1 },
    l: { unite: 'ml', facteur: 1000 },
    litre: { unite: 'ml', facteur: 1000 },
    litres: { unite: 'ml', facteur: 1000 },
    ml: { unite: 'ml', facteur: 1 },
    cl: { unite: 'ml', facteur: 10 },
    pcs: { unite: 'pcs', facteur: 1 },
    piece: { unite: 'pcs', facteur: 1 },
    botte: { unite: 'botte', facteur: 1 },
    boite: { unite: 'boite', facteur: 1 },
    sachet: { unite: 'sachet', facteur: 1 },
  };
  const cible = facteurs[u] ?? { unite: 'pcs' as UniteFrigo, facteur: 1 };
  return {
    quantite: Math.round(quantite * cible.facteur * 100) / 100,
    unite: cible.unite,
  };
}

type FridgeRow = {
  id: number;
  ingredient_id: number;
  quantite: number;
  unite: string;
  expiration: string | null;
  updated_at: string;
  ingredients?: { id: number; nom: string; rayon: string } | null;
};

/** Charge le garde-manger (trié : périme bientôt d'abord, puis alphabétique) */
export async function chargerFrigo(userId: string, supabase: Db): Promise<FridgeItem[]> {
  const { data, error } = await supabase
    .from('fridge_items')
    .select('id, ingredient_id, quantite, unite, expiration, updated_at, ingredients(id, nom, rayon)')
    .eq('user_id', userId);
  if (error) throw new Error(error.message);

  const items = ((data ?? []) as unknown as FridgeRow[]).map(r => ({
    id: r.id,
    ingredient_id: r.ingredient_id,
    ingredient: r.ingredients ?? null,
    quantite: r.quantite,
    unite: r.unite,
    expiration: r.expiration,
    updated_at: r.updated_at,
  }));

  return items.sort((a, b) => {
    if (a.expiration && b.expiration) return a.expiration.localeCompare(b.expiration);
    if (a.expiration) return -1;
    if (b.expiration) return 1;
    return (a.ingredient?.nom ?? '').localeCompare(b.ingredient?.nom ?? '');
  });
}

/** Ajoute (ou cumule) un article. Clé d'unicité : (user, ingrédient, unité). */
export async function ajouterAuFrigo(userId: string, article: NouvelArticle, supabase: Db): Promise<void> {
  const { quantite, unite } = normaliserQuantite(article.quantite, article.unite);
  if (!Number.isFinite(quantite) || quantite <= 0) {
    throw new UserError('Quantité invalide');
  }

  const { data: existant } = await supabase
    .from('fridge_items')
    .select('id, quantite')
    .eq('user_id', userId)
    .eq('ingredient_id', article.ingredient_id)
    .eq('unite', unite)
    .maybeSingle();

  if (existant) {
    const { error } = await supabase
      .from('fridge_items')
      .update({
        quantite: Math.round((existant.quantite + quantite) * 100) / 100,
        expiration: article.expiration ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existant.id);
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await supabase.from('fridge_items').insert({
    user_id: userId,
    ingredient_id: article.ingredient_id,
    quantite,
    unite,
    expiration: article.expiration ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function supprimerDuFrigo(userId: string, id: number, supabase: Db): Promise<void> {
  const { error } = await supabase.from('fridge_items').delete().eq('user_id', userId).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function viderFrigo(userId: string, supabase: Db): Promise<void> {
  const { error } = await supabase.from('fridge_items').delete().eq('user_id', userId);
  if (error) throw new Error(error.message);
}

// ─── Lecture pour le moteur ─────────────────────────────────────────────────

/** Ids des ingrédients présents au frigo (peu importe la quantité) */
export function ingredientIdsFrigo(items: { ingredient_id: number }[]): Set<number> {
  return new Set(items.map(i => i.ingredient_id));
}

/**
 * Nombre d'ingrédients d'une recette déjà présents au frigo, et part couverte
 * (0 → 1). Sert au facteur frigo du moteur (boost plafonné dans rotation-engine).
 */
export function couvertureFrigo(meal: RecetteFoyer, frigoIds: Set<number>): { presents: number; part: number } {
  const ingredients = meal.ingredients ?? [];
  const total = ingredients.length;
  if (total === 0 || frigoIds.size === 0) return { presents: 0, part: 0 };
  const presents = ingredients.filter(i => frigoIds.has(i.ingredient.id)).length;
  return { presents, part: presents / total };
}
