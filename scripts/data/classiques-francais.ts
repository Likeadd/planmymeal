// Plats simples du quotidien français (lentilles-saucisses, steak frites, saumon riz,
// quenelles, lasagnes…), rédigés à la main, sans déclinaisons d'un même plat. Noms
// d'ingrédients = ceux de la table `ingredients` (+ NOUVEAUX_INGREDIENTS). Insérés par
// scripts/ajouter-classiques-francais.ts, qui calcule les macros et marque `classique`.

import type { RecetteSaisie } from './recettes-proteinees';
import { LOT_VOLAILLES } from './classiques-francais-volailles';
import { LOT_BOEUF } from './classiques-francais-boeuf';
import { LOT_PORC } from './classiques-francais-porc';
import { LOT_POISSONS } from './classiques-francais-poissons';
import { LOT_FAMILLE } from './classiques-francais-famille';
import { LOT_REGIONS } from './classiques-francais-regions';

export const CLASSIQUES_FRANCAIS: RecetteSaisie[] = [
  ...LOT_VOLAILLES, ...LOT_BOEUF, ...LOT_PORC, ...LOT_POISSONS, ...LOT_FAMILLE, ...LOT_REGIONS,
];

/** Ingrédients du quotidien absents du catalogue (valeurs pour 100 g, prix moyens grande surface) */
export const NOUVEAUX_INGREDIENTS = [
  { nom: 'Quenelles nature', rayon: 'frais', calories_pour_100g: 165, proteines_pour_100g: 6, glucides_pour_100g: 15, lipides_pour_100g: 9, prix_unitaire: 0.45, unite_prix: 'pcs', poids_unites: { pcs: 60 } },
  { nom: 'Quenelles de brochet', rayon: 'frais', calories_pour_100g: 170, proteines_pour_100g: 7, glucides_pour_100g: 14, lipides_pour_100g: 10, prix_unitaire: 0.65, unite_prix: 'pcs', poids_unites: { pcs: 60 } },
  { nom: 'Saucisse de Morteau', rayon: 'viande_poisson', calories_pour_100g: 300, proteines_pour_100g: 15, glucides_pour_100g: 1, lipides_pour_100g: 27, prix_unitaire: 6, unite_prix: 'pcs', poids_unites: { pcs: 350 } },
  { nom: 'Saucisse de Montbéliard', rayon: 'viande_poisson', calories_pour_100g: 290, proteines_pour_100g: 15, glucides_pour_100g: 1, lipides_pour_100g: 25, prix_unitaire: 2.2, unite_prix: 'pcs', poids_unites: { pcs: 150 } },
  { nom: 'Saucisses de Strasbourg', rayon: 'frais', calories_pour_100g: 270, proteines_pour_100g: 12, glucides_pour_100g: 2, lipides_pour_100g: 24, prix_unitaire: 0.45, unite_prix: 'pcs', poids_unites: { pcs: 35 } },
  { nom: 'Chipolatas', rayon: 'viande_poisson', calories_pour_100g: 250, proteines_pour_100g: 15, glucides_pour_100g: 1, lipides_pour_100g: 21, prix_unitaire: 0.6, unite_prix: 'pcs', poids_unites: { pcs: 50 } },
  { nom: 'Chair à saucisse', rayon: 'viande_poisson', calories_pour_100g: 280, proteines_pour_100g: 14, glucides_pour_100g: 1, lipides_pour_100g: 25, prix_unitaire: 10, unite_prix: 'kg', poids_unites: null },
  { nom: 'Boudin blanc', rayon: 'viande_poisson', calories_pour_100g: 240, proteines_pour_100g: 11, glucides_pour_100g: 6, lipides_pour_100g: 19, prix_unitaire: 1.4, unite_prix: 'pcs', poids_unites: { pcs: 100 } },
  { nom: 'Andouillette', rayon: 'viande_poisson', calories_pour_100g: 200, proteines_pour_100g: 18, glucides_pour_100g: 1, lipides_pour_100g: 14, prix_unitaire: 3, unite_prix: 'pcs', poids_unites: { pcs: 150 } },
  { nom: 'Petit salé', rayon: 'viande_poisson', calories_pour_100g: 250, proteines_pour_100g: 16, glucides_pour_100g: 0, lipides_pour_100g: 21, prix_unitaire: 11, unite_prix: 'kg', poids_unites: null },
  { nom: 'Cordon bleu', rayon: 'frais', calories_pour_100g: 230, proteines_pour_100g: 14, glucides_pour_100g: 15, lipides_pour_100g: 13, prix_unitaire: 1.1, unite_prix: 'pcs', poids_unites: { pcs: 100 } },
  { nom: 'Nuggets de poulet', rayon: 'surgeles', calories_pour_100g: 250, proteines_pour_100g: 15, glucides_pour_100g: 17, lipides_pour_100g: 14, prix_unitaire: 9, unite_prix: 'kg', poids_unites: { pcs: 20 } },
  { nom: 'Poisson pané', rayon: 'surgeles', calories_pour_100g: 200, proteines_pour_100g: 12, glucides_pour_100g: 18, lipides_pour_100g: 9, prix_unitaire: 0.55, unite_prix: 'pcs', poids_unites: { pcs: 75 } },
  { nom: 'Paupiettes de veau', rayon: 'viande_poisson', calories_pour_100g: 210, proteines_pour_100g: 16, glucides_pour_100g: 5, lipides_pour_100g: 14, prix_unitaire: 2, unite_prix: 'pcs', poids_unites: { pcs: 130 } },
  { nom: 'Raviolis frais', rayon: 'frais', calories_pour_100g: 240, proteines_pour_100g: 10, glucides_pour_100g: 38, lipides_pour_100g: 6, prix_unitaire: 7, unite_prix: 'kg', poids_unites: null },
  { nom: 'Cuisse de canard confite', rayon: 'conserves', calories_pour_100g: 250, proteines_pour_100g: 20, glucides_pour_100g: 0, lipides_pour_100g: 19, prix_unitaire: 3.5, unite_prix: 'pcs', poids_unites: { pcs: 250 } },
  { nom: 'Cuisse de lapin', rayon: 'viande_poisson', calories_pour_100g: 150, proteines_pour_100g: 21, glucides_pour_100g: 0, lipides_pour_100g: 7, prix_unitaire: 14, unite_prix: 'kg', poids_unites: { pcs: 200 } },
  { nom: 'Fromage à raclette', rayon: 'frais', calories_pour_100g: 340, proteines_pour_100g: 23, glucides_pour_100g: 0, lipides_pour_100g: 28, prix_unitaire: 16, unite_prix: 'kg', poids_unites: { tranche: 30 } },
  { nom: 'Choucroute cuite', rayon: 'frais', calories_pour_100g: 25, proteines_pour_100g: 1.5, glucides_pour_100g: 4, lipides_pour_100g: 0.3, prix_unitaire: 4, unite_prix: 'kg', poids_unites: null },
  { nom: 'Rôti de bœuf', rayon: 'viande_poisson', calories_pour_100g: 160, proteines_pour_100g: 26, glucides_pour_100g: 0, lipides_pour_100g: 6, prix_unitaire: 25, unite_prix: 'kg', poids_unites: null },
  { nom: 'Bavette de bœuf', rayon: 'viande_poisson', calories_pour_100g: 150, proteines_pour_100g: 21, glucides_pour_100g: 0, lipides_pour_100g: 7, prix_unitaire: 22, unite_prix: 'kg', poids_unites: { pcs: 150 } },
  { nom: 'Foie de veau', rayon: 'viande_poisson', calories_pour_100g: 135, proteines_pour_100g: 20, glucides_pour_100g: 4, lipides_pour_100g: 4, prix_unitaire: 28, unite_prix: 'kg', poids_unites: { pcs: 130 } },
  { nom: 'Côtelettes d’agneau', rayon: 'viande_poisson', calories_pour_100g: 250, proteines_pour_100g: 18, glucides_pour_100g: 0, lipides_pour_100g: 20, prix_unitaire: 24, unite_prix: 'kg', poids_unites: { pcs: 70 } },
  { nom: 'Gigot d’agneau', rayon: 'viande_poisson', calories_pour_100g: 200, proteines_pour_100g: 20, glucides_pour_100g: 0, lipides_pour_100g: 13, prix_unitaire: 18, unite_prix: 'kg', poids_unites: null },
  { nom: 'Steak de thon', rayon: 'viande_poisson', calories_pour_100g: 130, proteines_pour_100g: 25, glucides_pour_100g: 0, lipides_pour_100g: 3, prix_unitaire: 25, unite_prix: 'kg', poids_unites: { pcs: 150 } },
  { nom: 'Pâte à pizza', rayon: 'frais', calories_pour_100g: 270, proteines_pour_100g: 7, glucides_pour_100g: 50, lipides_pour_100g: 4, prix_unitaire: 1.6, unite_prix: 'pcs', poids_unites: { pcs: 260 } },
  { nom: 'Baguette', rayon: 'boulangerie', calories_pour_100g: 270, proteines_pour_100g: 9, glucides_pour_100g: 56, lipides_pour_100g: 1.5, prix_unitaire: 1.1, unite_prix: 'pcs', poids_unites: { pcs: 250 } },
  { nom: 'Flageolets (bte)', rayon: 'conserves', calories_pour_100g: 100, proteines_pour_100g: 7, glucides_pour_100g: 13, lipides_pour_100g: 0.6, prix_unitaire: 3.5, unite_prix: 'kg', poids_unites: null },
  { nom: 'Cornichons', rayon: 'conserves', calories_pour_100g: 15, proteines_pour_100g: 0.5, glucides_pour_100g: 2, lipides_pour_100g: 0.1, prix_unitaire: 6, unite_prix: 'kg', poids_unites: null },
  { nom: 'Muscade', rayon: 'epices', calories_pour_100g: 525, proteines_pour_100g: 6, glucides_pour_100g: 49, lipides_pour_100g: 36, prix_unitaire: 60, unite_prix: 'kg', poids_unites: { pincee: 0.3, cac: 2 } },
  { nom: 'Bière blonde', rayon: 'boissons', calories_pour_100g: 43, proteines_pour_100g: 0.5, glucides_pour_100g: 3.5, lipides_pour_100g: 0, prix_unitaire: 2.5, unite_prix: 'L', poids_unites: null },
  { nom: 'Travers de porc', rayon: 'viande_poisson', calories_pour_100g: 290, proteines_pour_100g: 17, glucides_pour_100g: 0, lipides_pour_100g: 24, prix_unitaire: 9, unite_prix: 'kg', poids_unites: null },
  { nom: 'Jarret de veau', rayon: 'viande_poisson', calories_pour_100g: 150, proteines_pour_100g: 20, glucides_pour_100g: 0, lipides_pour_100g: 7, prix_unitaire: 17, unite_prix: 'kg', poids_unites: { pcs: 250 } },
  { nom: 'Cidre brut', rayon: 'boissons', calories_pour_100g: 35, proteines_pour_100g: 0, glucides_pour_100g: 3, lipides_pour_100g: 0, prix_unitaire: 3, unite_prix: 'L', poids_unites: null },
];
