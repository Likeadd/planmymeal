// ============================================================================
// SEED PRIX + USTENSILES — PlanMyMeal
// Usage : npm run seed:budget
// 1. Attribue un prix unitaire (€/kg, €/L, €/pièce...) à chaque ingrédient
// 2. Complète les ustensiles des recettes (poêle, four, air fryer, fouet...)
// Idempotent : peut être relancé sans risque.
// ============================================================================

import { config } from 'dotenv';
config({ path: '.env.local' });
config();
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// ─── 1. CATALOGUE DES PRIX (€, France, moyenne grande distribution 2026) ───
// Sources (recherchées le 25/09/2026, France métropolitaine) :
//  • Familles Rurales, Observatoire des prix des fruits et légumes 2026
//    (relevé conventionnel GMS, juin 2026) — 19 fruits/légumes mesurés
//    directement : famillesrurales.org
//  • FranceAgriMer / DAAF — relevés hebdomadaires prix de détail GMS (viandes,
//    volailles) 2026 : franceagrimer.fr, observatoire-prixmarges.franceagrimer.fr
//  • INSEE — séries « Prix moyens mensuels de vente au détail en métropole »
//  • Guides de prix spécialisés 2026 (saumon, fromages AOP, cafés) et
//    baromètres presse consommation 2026 (lait, beurre, œufs, pâtes, riz,
//    huiles, sucre)
// Pour les produits qu'aucun observatoire ne suit individuellement (épices en
// petit sachet, herbes fraîches, sauces asiatiques, conserves de niche...),
// le prix est établi PAR ANALOGIE avec l'article le plus proche du même rayon
// déjà ancré sur une source réelle — ce n'est pas une valeur scrapée, précisé
// dans les commentaires de section ci-dessous.
// unite_prix : 'kg' (au poids), 'L' (au volume), 'pcs' (à la pièce),
//              'botte', 'boite', 'sachet', 'tranche'
const PRIX: Record<string, { pu: number; up: string }> = {
  // ============================================================================
  // FRUITS & LÉGUMES — ancrage réel : Familles Rurales, Observatoire des prix des
  // fruits et légumes, conventionnel GMS, juin 2026 (19 produits directement
  // mesurés) ; reste par analogie de gamme au sein du rayon.
  // ============================================================================
  'Ail': { pu: 8.9, up: 'kg' },
  'Ananas frais': { pu: 2.3, up: 'pcs' },
  'Aneth frais': { pu: 1.5, up: 'botte' },
  'Aubergine': { pu: 2.9, up: 'kg' },
  'Avocat': { pu: 1.5, up: 'pcs' },
  'Banane': { pu: 2.2, up: 'kg' },
  'Basilic': { pu: 1.8, up: 'botte' },
  'Basilic frais': { pu: 1.8, up: 'botte' },
  'Basilic thaï': { pu: 1.9, up: 'botte' },
  'Betterave cuite': { pu: 1.2, up: 'pcs' },
  'Brocoli': { pu: 2.6, up: 'kg' },
  'Carotte': { pu: 2.1, up: 'kg' },
  'Céleri branche': { pu: 2.2, up: 'kg' },
  'Cerise': { pu: 7.9, up: 'kg' },
  'Champignons de Paris': { pu: 3.2, up: 'kg' },
  'Champignons shiitakés': { pu: 12, up: 'kg' },
  'Chayote': { pu: 3.5, up: 'kg' },
  'Chou blanc': { pu: 1.5, up: 'kg' },
  'Chou chinois': { pu: 2.5, up: 'kg' },
  'Chou kale': { pu: 4.5, up: 'kg' },
  'Chou pak choï': { pu: 4, up: 'kg' },
  'Chou rouge': { pu: 1.9, up: 'kg' },
  'Chou-fleur': { pu: 2.3, up: 'pcs' },
  'Chuchu': { pu: 3.5, up: 'kg' },
  'Ciboulette': { pu: 1.2, up: 'botte' },
  'Citron': { pu: 0.55, up: 'pcs' },
  'Citron vert': { pu: 0.5, up: 'pcs' },
  'Citronnelle': { pu: 1.8, up: 'botte' },
  'Clémentine': { pu: 2.8, up: 'kg' },
  'Concombre': { pu: 1.3, up: 'pcs' },
  'Coriandre fraîche': { pu: 1.5, up: 'botte' },
  'Courge butternut': { pu: 2.3, up: 'kg' },
  'Courgette': { pu: 2, up: 'kg' },
  'Échalote': { pu: 6, up: 'kg' },
  'Endive': { pu: 2.8, up: 'kg' },
  'Épinards frais': { pu: 3.5, up: 'kg' },
  'Fenouil': { pu: 2.6, up: 'kg' },
  'Fraise': { pu: 9.1, up: 'kg' },
  'Framboise': { pu: 14, up: 'kg' },
  'Fruits rouges': { pu: 12, up: 'kg' },
  'Gingembre': { pu: 9, up: 'kg' },
  'Gingembre frais': { pu: 9, up: 'kg' },
  'Grenade': { pu: 3.5, up: 'pcs' },
  'Haricots verts': { pu: 7.1, up: 'kg' },
  'Laitue': { pu: 1.3, up: 'pcs' },
  'Mâche': { pu: 1.8, up: 'botte' },
  'Mangue': { pu: 2.2, up: 'pcs' },
  'Melon': { pu: 2.7, up: 'pcs' },
  'Menthe': { pu: 1.5, up: 'botte' },
  'Menthe fraîche': { pu: 1.5, up: 'botte' },
  'Myrtilles': { pu: 12, up: 'kg' },
  'Navet': { pu: 1.8, up: 'kg' },
  'Navet long (daikon)': { pu: 2.5, up: 'kg' },
  'Oignon': { pu: 2.4, up: 'kg' },
  'Oignon nouveau': { pu: 1.5, up: 'botte' },
  'Oignon rouge': { pu: 2.6, up: 'kg' },
  'Orange': { pu: 2.5, up: 'kg' },
  'Papaye': { pu: 3.5, up: 'pcs' },
  'Patate douce': { pu: 2.9, up: 'kg' },
  'Pêche': { pu: 3.9, up: 'kg' },
  'Persil': { pu: 1.2, up: 'botte' },
  'Persil frais': { pu: 1.2, up: 'botte' },
  'Piment frais': { pu: 9, up: 'kg' },
  'Poire': { pu: 2.6, up: 'kg' },
  'Poireau': { pu: 2.2, up: 'kg' },
  'Poivron': { pu: 4.4, up: 'kg' },
  'Poivron rouge': { pu: 4.6, up: 'kg' },
  'Poivron vert': { pu: 4.4, up: 'kg' },
  'Pomme': { pu: 2.6, up: 'kg' },
  'Pomme de terre': { pu: 1.25, up: 'kg' },
  'Potiron': { pu: 1.8, up: 'kg' },
  'Pousses de soja': { pu: 4, up: 'kg' },
  'Radis': { pu: 1.3, up: 'botte' },
  'Raisin': { pu: 4.5, up: 'kg' },
  'Roquette': { pu: 8, up: 'kg' },
  'Roquette en sachet': { pu: 1.8, up: 'sachet' },
  'Salade': { pu: 1.1, up: 'pcs' },
  'Salade romaine': { pu: 1.4, up: 'pcs' },
  'Salade verte': { pu: 1.1, up: 'pcs' },
  'Tomate': { pu: 2.9, up: 'kg' },
  'Tomates cerises': { pu: 4.5, up: 'kg' },
  // ============================================================================
  // VIANDES & POISSONS — ancrage réel : FranceAgriMer/DAAF (relevés GMS 2026),
  // INSEE (séries prix moyens détail), presse spécialisée boucherie 2026.
  // ============================================================================
  'Agneau (épaule)': { pu: 14.5, up: 'kg' },
  'Bacon': { pu: 0.5, up: 'tranche' },
  'Blanc de poulet': { pu: 11.5, up: 'kg' },
  'Blanc de poulet cuit': { pu: 14, up: 'kg' },
  'Bœuf à braiser': { pu: 13, up: 'kg' },
  'Bœuf haché 5 %': { pu: 13.5, up: 'kg' },
  'Bœuf maigre (filet)': { pu: 28, up: 'kg' },
  'Chorizo': { pu: 14, up: 'kg' },
  'Côte de porc': { pu: 8.5, up: 'pcs' },
  'Crevettes': { pu: 15, up: 'kg' },
  'Cuisses de poulet sans peau': { pu: 7.5, up: 'kg' },
  'Dos de cabillaud': { pu: 18, up: 'kg' },
  'Échine de porc': { pu: 8, up: 'kg' },
  'Épaule d’agneau': { pu: 14.5, up: 'kg' },
  'Escalope de veau': { pu: 3.2, up: 'pcs' },
  'Faux-filet': { pu: 5.5, up: 'pcs' },
  'Filet de bœuf': { pu: 32, up: 'kg' },
  'Filet de cabillaud': { pu: 16, up: 'kg' },
  'Filet de dinde': { pu: 12.9, up: 'kg' },
  'Filet de dorade': { pu: 22, up: 'kg' },
  'Filet de poulet': { pu: 11, up: 'kg' },
  'Filet de tilapia': { pu: 13, up: 'kg' },
  'Filet mignon de porc': { pu: 11, up: 'kg' },
  'Gambas': { pu: 19, up: 'kg' },
  'Haché de dinde 7 %': { pu: 11, up: 'kg' },
  'Jambon blanc': { pu: 13, up: 'kg' },
  'Jambon de dinde': { pu: 10, up: 'kg' },
  'Lardons': { pu: 8.5, up: 'kg' },
  'Lardons fumés': { pu: 9, up: 'kg' },
  'Magret de canard': { pu: 16, up: 'kg' },
  'Maquereau': { pu: 9, up: 'kg' },
  'Merguez': { pu: 1.3, up: 'pcs' },
  'Moules': { pu: 3.5, up: 'boite' },
  'Pavé de saumon': { pu: 3.8, up: 'pcs' },
  'Pilons de poulet': { pu: 1.2, up: 'pcs' },
  'Poulet entier': { pu: 6.5, up: 'pcs' },
  'Rôti de porc': { pu: 9.5, up: 'kg' },
  'Rumsteck': { pu: 22, up: 'kg' },
  'Saucisse de Toulouse': { pu: 1.4, up: 'pcs' },
  'Saumon frais': { pu: 20, up: 'kg' },
  'Saumon fumé': { pu: 32, up: 'kg' },
  'Steak haché': { pu: 2.2, up: 'pcs' },
  'Veau (épaule)': { pu: 15, up: 'kg' },
  'Viande hachée (bœuf)': { pu: 12, up: 'kg' },
  // ============================================================================
  // PRODUITS FRAIS (lait, fromages, œufs) — ancrage réel : relevés 2026 (lait,
  // beurre, œufs, fromages), FranceAgriMer, guides prix fromages AOP.
  // ============================================================================
  'Beurre': { pu: 13.5, up: 'kg' },
  'Chantilly': { pu: 4, up: 'boite' },
  'Cheddar': { pu: 0.4, up: 'tranche' },
  'Chèvre frais': { pu: 15, up: 'kg' },
  'Comté': { pu: 16, up: 'kg' },
  'Crème fraîche': { pu: 3.5, up: 'boite' },
  'Crème fraîche épaisse': { pu: 3.5, up: 'boite' },
  'Crème liquide': { pu: 2.6, up: 'L' },
  'Feta': { pu: 12, up: 'kg' },
  'Feuilles de brick': { pu: 0.35, up: 'pcs' },
  'Fromage blanc': { pu: 3.2, up: 'kg' },
  'Fromage frais': { pu: 6, up: 'kg' },
  'Gruyère râpé': { pu: 12, up: 'kg' },
  'Halloumi': { pu: 18, up: 'kg' },
  'Jaune d\'œuf': { pu: 0.1, up: 'pcs' },
  'Labneh': { pu: 7, up: 'kg' },
  'Lait': { pu: 1.2, up: 'L' },
  'Mascarpone': { pu: 7.5, up: 'kg' },
  'Mozzarella': { pu: 8, up: 'kg' },
  'Œuf': { pu: 0.4, up: 'pcs' },
  'Parmesan': { pu: 18, up: 'kg' },
  'Parmesan 24 mois': { pu: 26, up: 'kg' },
  'Pâte brisée': { pu: 2.2, up: 'pcs' },
  'Pâte feuilletée': { pu: 2.3, up: 'pcs' },
  'Pâte filo': { pu: 1.8, up: 'pcs' },
  'Reblochon': { pu: 6.5, up: 'pcs' },
  'Ricotta légère': { pu: 7, up: 'kg' },
  'Seitan': { pu: 11, up: 'kg' },
  'Skyr': { pu: 4.5, up: 'kg' },
  'Tempeh': { pu: 9, up: 'kg' },
  'Tofu ferme': { pu: 5.5, up: 'kg' },
  'Tofu soyeux': { pu: 5, up: 'kg' },
  'Yaourt grec': { pu: 0.9, up: 'pcs' },
  'Yaourt grec 0 %': { pu: 0.9, up: 'pcs' },
  'Yaourt nature': { pu: 0.5, up: 'pcs' },
  'Yaourt turque': { pu: 0.9, up: 'pcs' },
  // ============================================================================
  // ÉPICERIE SALÉE — pâtes/riz/huiles ancrées sur relevés 2026 (marques
  // nationales + MDD, moyenne) ; le reste par analogie de gamme.
  // ============================================================================
  'Algue wakame séchée': { pu: 35, up: 'kg' },
  'Bouillon de bœuf': { pu: 1.5, up: 'L' },
  'Bouillon de légumes': { pu: 1.2, up: 'L' },
  'Bouillon de volaille': { pu: 1.5, up: 'L' },
  'Boulgour': { pu: 2.4, up: 'kg' },
  'Boulgour gros calibre': { pu: 2.4, up: 'kg' },
  'Cacahuètes': { pu: 7, up: 'kg' },
  'Chapelure': { pu: 3.5, up: 'kg' },
  'Crozets': { pu: 3.5, up: 'kg' },
  'Épeautre': { pu: 3.5, up: 'kg' },
  'Farine': { pu: 1.1, up: 'kg' },
  'Farine de manioc': { pu: 4, up: 'kg' },
  'Farine de pois chiches': { pu: 3.5, up: 'kg' },
  'Fécule de tapioca': { pu: 4, up: 'kg' },
  'Feuille de nori': { pu: 3.5, up: 'sachet' },
  'Feuilles de lasagne': { pu: 3.5, up: 'kg' },
  'Flocons d’avoine': { pu: 2, up: 'kg' },
  'Gélatine': { pu: 2, up: 'sachet' },
  'Gnocchis': { pu: 2.8, up: 'kg' },
  'Gochujang': { pu: 6, up: 'boite' },
  'Graines de courge': { pu: 12, up: 'kg' },
  'Graines de sésame': { pu: 9, up: 'kg' },
  'Harissa': { pu: 5, up: 'boite' },
  'Huile d’olive': { pu: 8.5, up: 'L' },
  'Huile de friture': { pu: 2.5, up: 'L' },
  'Huile de palme (dendê)': { pu: 6, up: 'L' },
  'Huile de sésame': { pu: 12, up: 'L' },
  'Huile de tournesol': { pu: 2.5, up: 'L' },
  'Lait de coco': { pu: 1.6, up: 'boite' },
  'Lentilles blondes': { pu: 2.8, up: 'kg' },
  'Lentilles corail': { pu: 3, up: 'kg' },
  'Lentilles vertes': { pu: 2.8, up: 'kg' },
  'Levure boulangère': { pu: 1.2, up: 'sachet' },
  'Levure chimique': { pu: 0.8, up: 'sachet' },
  'Macaroni': { pu: 2.2, up: 'kg' },
  'Mayonnaise': { pu: 3.5, up: 'boite' },
  'Mirin': { pu: 7, up: 'L' },
  'Miso': { pu: 4.5, up: 'boite' },
  'Moutarde': { pu: 2.5, up: 'boite' },
  'Moutarde à l’ancienne': { pu: 2.8, up: 'boite' },
  'Noix': { pu: 16, up: 'kg' },
  'Nouilles chinoises': { pu: 3.5, up: 'kg' },
  'Nouilles de riz': { pu: 5, up: 'kg' },
  'Nouilles soba': { pu: 6, up: 'kg' },
  'Olives Kalamata': { pu: 9, up: 'kg' },
  'Olives noires': { pu: 6.5, up: 'kg' },
  'Olives vertes': { pu: 5.5, up: 'kg' },
  'Pain de riz': { pu: 2.5, up: 'sachet' },
  'Pâte de curry vert': { pu: 5.5, up: 'boite' },
  'Pâte de gochujang': { pu: 6, up: 'boite' },
  'Pâtes (fussili)': { pu: 2.2, up: 'kg' },
  'Pâtes (penne)': { pu: 2.2, up: 'kg' },
  'Pâtes (tagliatelles)': { pu: 2.6, up: 'kg' },
  'Pâtes complètes (penne)': { pu: 2.8, up: 'kg' },
  'Pâtes penne': { pu: 2.2, up: 'kg' },
  'Pesto': { pu: 4.5, up: 'boite' },
  'Pois cassés': { pu: 2.2, up: 'kg' },
  'Pois chiches secs': { pu: 2.8, up: 'kg' },
  'Quinoa': { pu: 5.5, up: 'kg' },
  'Riz': { pu: 2.2, up: 'kg' },
  'Riz à paella': { pu: 4.5, up: 'kg' },
  'Riz à sushi': { pu: 4.5, up: 'kg' },
  'Riz Arborio': { pu: 4.5, up: 'kg' },
  'Riz basmati': { pu: 3.5, up: 'kg' },
  'Riz complet': { pu: 2.8, up: 'kg' },
  'Riz complet cuit': { pu: 4, up: 'kg' },
  'Riz jasmin': { pu: 3.2, up: 'kg' },
  'Riz rond': { pu: 2.5, up: 'kg' },
  'Sauce fish sauce': { pu: 5.5, up: 'L' },
  'Sauce hoisin': { pu: 7, up: 'L' },
  'Sauce nuoc mam': { pu: 5.5, up: 'L' },
  'Sauce soja': { pu: 6, up: 'L' },
  'Sauce sriracha': { pu: 6, up: 'L' },
  'Semoule': { pu: 2.2, up: 'kg' },
  'Semoule fine': { pu: 2.2, up: 'kg' },
  'Spaghetti': { pu: 2.2, up: 'kg' },
  'Tagliatelles': { pu: 2.6, up: 'kg' },
  'Tahini': { pu: 8, up: 'boite' },
  'Vinaigre balsamique': { pu: 6, up: 'L' },
  'Vinaigre de riz': { pu: 5, up: 'L' },
  'Vinaigre de Xérès': { pu: 9, up: 'L' },
  // ============================================================================
  // ÉPICERIE SUCRÉE — ancrage réel (chocolat, fruits secs, miel).
  // ============================================================================
  'Amandes': { pu: 14, up: 'kg' },
  'Arachide beurre': { pu: 10, up: 'kg' },
  'Beurre de cacahuète': { pu: 10, up: 'kg' },
  'Biscuits à la cuillère': { pu: 8, up: 'kg' },
  'Biscuits cuillère': { pu: 8, up: 'kg' },
  'Cacao en poudre': { pu: 12, up: 'kg' },
  'Cacao non sucré': { pu: 12, up: 'kg' },
  'Café soluble': { pu: 18, up: 'kg' },
  'Chia graines': { pu: 12, up: 'kg' },
  'Chocolat noir': { pu: 13, up: 'kg' },
  'Chocolat noir pâtissier': { pu: 11, up: 'kg' },
  'Coco râpée non sucrée': { pu: 9, up: 'kg' },
  'Datte': { pu: 9, up: 'kg' },
  'Gousse de vanille': { pu: 2.5, up: 'pcs' },
  'Graines de chia': { pu: 12, up: 'kg' },
  'Granola': { pu: 6, up: 'kg' },
  'Miel': { pu: 9, up: 'kg' },
  'Noisettes': { pu: 15, up: 'kg' },
  'Noix de cajou': { pu: 16, up: 'kg' },
  'Noix de coco': { pu: 2.2, up: 'pcs' },
  'Pépites de chocolat': { pu: 11, up: 'kg' },
  'Pignons de pin': { pu: 45, up: 'kg' },
  'Pistaches non salées': { pu: 20, up: 'kg' },
  'Poudre d’amandes': { pu: 15, up: 'kg' },
  'Pruneaux': { pu: 6.5, up: 'kg' },
  'Raisins secs': { pu: 7, up: 'kg' },
  'Sirop d\'érable': { pu: 14, up: 'L' },
  'Spéculoos': { pu: 7, up: 'kg' },
  'Sucre': { pu: 1.6, up: 'kg' },
  'Sucre vanillé': { pu: 0.3, up: 'sachet' },
  // ============================================================================
  // ÉPICES — vendues en petit sachet (10-40 g type Ducros) : le prix réel du
  // sachet supermarché est déjà correctement calibré sur les entrées existantes
  // (1,50 à 2,50 €/sachet) ; complété par analogie pour les épices manquantes,
  // avec une majoration pour les épices rares (safran, cardamome).
  // ============================================================================
  'Aneth': { pu: 1.5, up: 'botte' },
  'Anis étoilé (badiane)': { pu: 2.5, up: 'sachet' },
  'Berbere': { pu: 2.5, up: 'sachet' },
  'Cannelle': { pu: 2, up: 'sachet' },
  'Cardamome': { pu: 3.5, up: 'sachet' },
  'Cumin': { pu: 2, up: 'sachet' },
  'Cumin en poudre': { pu: 2, up: 'sachet' },
  'Curcuma': { pu: 2, up: 'sachet' },
  'Curry en poudre': { pu: 2.2, up: 'sachet' },
  'Curry Madras': { pu: 2.2, up: 'sachet' },
  'Feuille de laurier': { pu: 1.5, up: 'sachet' },
  'Garam masala': { pu: 2.5, up: 'sachet' },
  'Garam masala maison': { pu: 2.5, up: 'sachet' },
  'Herbes de Provence': { pu: 2, up: 'sachet' },
  'Laurier': { pu: 1.5, up: 'sachet' },
  'Menthe séchée': { pu: 1.8, up: 'sachet' },
  'Origan': { pu: 1.8, up: 'sachet' },
  'Paprika': { pu: 2, up: 'sachet' },
  'Paprika doux fumé': { pu: 2.5, up: 'sachet' },
  'Paprika fumé': { pu: 2.5, up: 'sachet' },
  'Piment doux': { pu: 2, up: 'sachet' },
  'Ras el hanout': { pu: 2.5, up: 'sachet' },
  'Ras-el-hanout': { pu: 2.5, up: 'sachet' },
  'Safran': { pu: 8, up: 'sachet' },
  'Sumac': { pu: 2.8, up: 'sachet' },
  'Thym': { pu: 1.8, up: 'sachet' },
  'Vanille': { pu: 2.5, up: 'pcs' },
  'Zaatar': { pu: 3, up: 'sachet' },
  // ============================================================================
  // CONSERVES — les grands classiques (maïs, pois chiches, tomate, thon) sont
  // déjà à des prix réels vérifiés ; le reste par analogie.
  // ============================================================================
  'Artichaut (bte)': { pu: 2.8, up: 'boite' },
  'Concentré de tomate': { pu: 1.2, up: 'boite' },
  'Haricots blancs (bte)': { pu: 1.1, up: 'boite' },
  'Haricots noirs (bte)': { pu: 1.3, up: 'boite' },
  'Haricots rouges': { pu: 1.1, up: 'boite' },
  'Haricots rouges (bte)': { pu: 1.1, up: 'boite' },
  'Kimchi (bte)': { pu: 4, up: 'boite' },
  'Lait de coco léger': { pu: 1.6, up: 'boite' },
  'Maïs': { pu: 1, up: 'boite' },
  'Maïs (bte)': { pu: 1, up: 'boite' },
  'Maïs doux (bte)': { pu: 1, up: 'boite' },
  'Pois chiches': { pu: 1.1, up: 'boite' },
  'Pois chiches (bte)': { pu: 1.1, up: 'boite' },
  'Ratatouille (préparée)': { pu: 3.5, up: 'kg' },
  'Salsa tomate-verde': { pu: 3.5, up: 'boite' },
  'Thon au naturel': { pu: 1.8, up: 'boite' },
  'Thon en boîte': { pu: 1.6, up: 'boite' },
  'Tomate concassée (bte)': { pu: 1, up: 'boite' },
  'Tomates concassées': { pu: 1, up: 'boite' },
  // ============================================================================
  // BOULANGERIE — ancrage réel (pain de mie, baguette, tortillas 2026).
  // ============================================================================
  'Galette de sarrasin': { pu: 0.7, up: 'pcs' },
  'Injera': { pu: 1.2, up: 'pcs' },
  'Pain': { pu: 0.25, up: 'tranche' },
  'Pain burger': { pu: 0.6, up: 'pcs' },
  'Pain complet': { pu: 0.25, up: 'tranche' },
  'Pain de campagne': { pu: 0.3, up: 'tranche' },
  'Pain de mie': { pu: 0.15, up: 'tranche' },
  'Pain de seigle': { pu: 0.3, up: 'tranche' },
  'Pain pita': { pu: 0.5, up: 'pcs' },
  'Pain pita complet': { pu: 0.55, up: 'pcs' },
  'Pains burger': { pu: 0.6, up: 'pcs' },
  'Pains pita': { pu: 0.5, up: 'pcs' },
  'Tortilla de blé': { pu: 0.55, up: 'pcs' },
  'Tortilla de blé complète': { pu: 0.6, up: 'pcs' },
  'Tortilla de maïs': { pu: 0.4, up: 'pcs' },
  'Tortillas de blé': { pu: 0.55, up: 'pcs' },
  'Tortillas de maïs nixtamalisées': { pu: 0.4, up: 'pcs' },
  'Wrap / tortilla': { pu: 0.55, up: 'pcs' },
  // ============================================================================
  // SURGELÉS
  // ============================================================================
  'Edamame (surg.)': { pu: 7, up: 'kg' },
  'Épinards surgelés': { pu: 3, up: 'kg' },
  'Fruits rouges surgelés': { pu: 6.5, up: 'kg' },
  'Glace vanille': { pu: 4.5, up: 'boite' },
  'Maïs doux (surg.)': { pu: 2.5, up: 'kg' },
  'Petit pois (surg.)': { pu: 2.5, up: 'kg' },
  'Petits pois': { pu: 2.5, up: 'kg' },
  'Sorbet mangue': { pu: 4.5, up: 'boite' },
  // ============================================================================
  // BOISSONS — ancrage réel (café moulu, vin de table).
  // ============================================================================
  'Café': { pu: 18, up: 'L' },
  'Vin blanc': { pu: 5.5, up: 'L' },
  'Vin rouge': { pu: 5.5, up: 'L' },
};

// ─── 2. USTENSILES PAR RECETTE ──────────────────────────────────────────────
// Liste explicite des ustensiles utiles pour chaque recette du catalogue.
const USTENSILES: Record<string, string[]> = {
  'Poulet rôti aux herbes & patates douces': ['Four', 'Plat à rôtir', 'Couteau de chef', 'Économe', 'Pinceau de cuisine', 'Papier cuisson'],
  'Salade de quinoa aux légumes grillés': ['Casserole', 'Passoire', 'Poêle', 'Couteau de chef', 'Saladier'],
  'Bowl poke au saumon': ['Casserole', 'Passoire', 'Couteau de chef', 'Saladier'],
  'Pâtes aux légumes du soleil': ['Casserole', 'Passoire', 'Poêle', 'Couteau de chef'],
  'Soupe de lentilles corail au lait de coco': ['Casserole', 'Mixeur', 'Couteau de chef', 'Cuillère en bois'],
  'Omelette aux champignons & salade': ['Poêle', 'Fouet', 'Saladier', 'Couteau de chef'],
  'Wrap poulet-crudités sauce yaourt': ['Couteau de chef', 'Râpe', 'Saladier'],
  'Poêlée de légumes & tofu croustillant': ['Wok', 'Couteau de chef', 'Spatule', 'Pressoire'],
  'Tartine avocat-œuf poché': ['Grille-pain', 'Casserole', 'Cuillère à slot', 'Fourchette'],
  'Risotto aux champignons & parmesan': ['Casserole', 'Poêle', 'Louche', 'Cuillère en bois', 'Râpe'],
  'Tajine d\'agneau aux pruneaux': ['Cocotte', 'Couteau de chef', 'Cuillère en bois'],
  'Fish & chips maison': ['Four', 'Friteuse', 'Saladier', 'Fouet', 'Passoire', 'Couteau de chef'],
  'Gratin dauphinois & jambon': ['Mandoline', 'Plat à gratin', 'Four', 'Casserole'],
  'Salade César au poulet': ['Poêle', 'Saladier', 'Couteau de chef', 'Fouet'],
  'Chili sin carne (végétarien)': ['Casserole', 'Ouvre-boîte', 'Passoire', 'Cuillère en bois', 'Couteau de chef'],
  'Pavé de saumon, purée de brocolis': ['Poêle', 'Casserole', 'Mixeur', 'Passoire'],
  'Curry de pois chiches aux épinards': ['Casserole', 'Ouverture-boîte', 'Couteau de chef', 'Cuillère en bois'],
  'Spaghetti bolognaise': ['Casserole', 'Poêle', 'Passoire', 'Couteau de chef', 'Râpe'],
  'Tartiflette': ['Casserole', 'Poêle', 'Plat à gratin', 'Four', 'Couteau de chef', 'Économe'],
  'Gambas sautées à l\'ail & riz': ['Poêle', 'Casserole', 'Pressse-ail', 'Ciseaux'],
  'Mousse au chocolat': ['Saladier', 'Fouet', 'Batteur électrique', 'Casserole (bain-marie)', 'Ramequins', 'Spatule'],
  'Tarte aux pommes': ['Moule à tarte', 'Rouleau à pâtisserie', 'Économe', 'Couteau de chef', 'Four', 'Pinceau de cuisine'],
  'Tiramisu': ['Saladier', 'Fouet', 'Batteur électrique', 'Plat à gratin', 'Passoire'],
  'Salade de fruits frais': ['Couteau de chef', 'Saladier', 'Cuillère à soupe', 'Presse-agrume'],
  'Crème brûlée': ['Casserole', 'Saladier', 'Fouet', 'Ramequins', 'Four', 'Plat à gratin (bain-marie)'],
  'Poulet au curry & riz basmati': ['Poêle', 'Casserole', 'Couteau de chef', 'Râpe (gingembre)'],
  'Lasagnes maison': ['Poêle', 'Casserole', 'Fouet', 'Plat à gratin', 'Four', 'Râpe'],
  'Steak frites & salade': ['Poêle', 'Four', 'Saladier', 'Pince de cuisine'],
  'Riz cantonais': ['Casserole', 'Wok', 'Spatule', 'Fouet'],
  'Poulet tikka masala': ['Saladier', 'Poêle', 'Casserole', 'Mixeur', 'Couteau de chef'],
  'Croque-monsieur & salade': ['Poêle', 'Râpe', 'Couteau'],
  'Bœuf bourguignon': ['Cocotte', 'Poêle', 'Couteau de chef', 'Économe', 'Cuillère en bois'],
  'Dahl de lentilles': ['Casserole', 'Passoire', 'Couteau de chef', 'Râpe (gingembre)', 'Cuillère en bois'],
  'Quiche lorraine': ['Moule à tarte', 'Saladier', 'Fouet', 'Poêle (lardons)', 'Four'],
  'Pavé de cabillaud, riz & poireaux': ['Casserole', 'Poêle', 'Cuit-vapeur', 'Couteau de chef'],
  'Tacos maison poulet-avocat': ['Poêle', 'Couteau de chef', 'Saladier', 'Fourchette'],
  'Hachis parmentier': ['Casserole', 'Poêle', 'Presse-purée', 'Plat à gratin', 'Four', 'Économe'],
  'Nouilles sautées aux légumes': ['Wok', 'Casserole', 'Passoire', 'Couteau de chef', 'Râpe'],
  'Escalope milanaise & spaghetti': ['Saladier', 'Poêle', 'Casserole', 'Passoire', 'Maillet de cuisine'],
  'Ratatouille provençale': ['Cocotte', 'Couteau de chef', 'Cuillère en bois'],
  'Saumon en papillote & légumes': ['Four', 'Papier cuisson', 'Mandoline', 'Ciseaux'],
  'Burger maison': ['Poêle', 'Grille-pain', 'Couteau de chef', 'Spatule'],
  'Gratin de chou-fleur': ['Casserole', 'Fouet', 'Plat à gratin', 'Four', 'Passoire'],
  'Couscous royal': ['Couscoussier', 'Casserole', 'Poêle', 'Passoire', 'Couteau de chef', 'Économe'],
  'Pizza maison': ['Saladier', 'Rouleau à pâtisserie', 'Plaque de cuisson', 'Four', 'Cuillère à soupe', 'Couteau de chef'],
  'Canard laqué & riz': ['Poêle', 'Casserole', 'Pinceau de cuisine', 'Couteau de chef'],
  'Omelette aux fines herbes': ['Poêle', 'Fouet', 'Saladier', 'Ciseaux'],
  'Moules marinières & frites': ['Faitout', 'Couteau de chef', 'Passoire', 'Four (frites)', 'Ciseaux'],
  'Pâtes carbonara': ['Casserole', 'Poêle', 'Passoire', 'Saladier', 'Fouet', 'Râpe'],
  'Curry japonais au poulet': ['Casserole', 'Couteau de chef', 'Économe', 'Cuillère en bois'],
  'Lentilles & saucisses de Toulouse': ['Casserole', 'Poêle', 'Couteau de chef', 'Passoire'],
  'Bowl falafels & houmous': ['Mixeur', 'Four', 'Plaque de cuisson', 'Passoire', 'Saladier', 'Presse-ail'],
  'Pâtes au pesto & tomates cerises': ['Casserole', 'Passoire', 'Poêle', 'Couteau'],
  'Filet mignon au miel & patates': ['Poêle', 'Four', 'Plat à rôtir', 'Pinceau de cuisine', 'Économe'],
  'Frittata aux légumes': ['Poêle allant au four', 'Fouet', 'Saladier', 'Couteau de chef'],
  'Soupe à l\'oignon gratinée': ['Casserole', 'Couteau de chef', 'Bols à gratin', 'Râpe', 'Four'],
  'Côte de porc & ratatouille': ['Poêle', 'Casserole', 'Couteau de chef', 'Spatule'],
  'Gratin de macaronis au jambon': ['Casserole', 'Fouet', 'Râpe', 'Plat à gratin', 'Four', 'Passoire'],
  'Wok de bœuf aux oignons': ['Wok', 'Couteau de chef', 'Spatule', 'Saladier (marinade)'],
  'Tortilla espagnole': ['Poêle', 'Saladier', 'Fouet', 'Couteau de chef', 'Assiette plate (retournement)'],
  'Pad thaï': ['Wok', 'Casserole', 'Passoire', 'Couteau de chef', 'Saladier'],
  'Croziflette': ['Casserole', 'Poêle', 'Plat à gratin', 'Four', 'Râpe'],
  'Galettes bretonnes complètes': ['Crêpière', 'Louche', 'Spatule', 'Saladier', 'Fouet'],
  'Poulet rôti aux légumes racines': ['Four', 'Plat à rôtir', 'Économe', 'Couteau de chef', 'Pinceau de cuisine'],
  'Sauté de porc au caramel': ['Wok', 'Saladier', 'Casserole', 'Couteau de chef'],
  'Pâtes au saumon fumé': ['Casserole', 'Poêle', 'Passoire', 'Couteau'],
  'Blanquette de veau': ['Cocotte', 'Passoire', 'Casserole', 'Fouet', 'Couteau de chef', 'Économe'],
  'Salade niçoise': ['Casserole', 'Saladier', 'Couteau de chef', 'Fouet'],
  'Rôti de porc aux pruneaux': ['Cocotte', 'Ficelle de cuisine', 'Couteau de chef', 'Cuillère en bois', 'Four'],
  'Fajitas bœuf & légumes': ['Poêle', 'Couteau de chef', 'Saladier', 'Spatule'],
  'Gnocchis à la tomate & basilic': ['Casserole', 'Poêle', 'Passoire', 'Ciseaux'],
  'Poulet basquaise': ['Cocotte', 'Couteau de chef', 'Cuillère en bois', 'Casserole (riz)'],
  'Riz sauté aux crevettes': ['Wok', 'Casserole', 'Spatule', 'Ciseaux'],
  'Soufflé au fromage': ['Saladier', 'Fouet', 'Casserole', 'Ramequins ou moule à soufflé', 'Four', 'Râpe'],
  'Fondant au chocolat': ['Saladier', 'Fouet', 'Casserole (bain-marie)', 'Moules individuels', 'Four', 'Spatule'],
  'Panna cotta aux fruits rouges': ['Casserole', 'Saladier', 'Ramequins', 'Fouet'],
  'Gâteau au yaourt': ['Saladier', 'Fouet', 'Moule à manqué', 'Four', 'Pot de yaourt (mesure)', 'Râpe (zeste)'],
  'Compote de pommes maison': ['Économe', 'Casserole', 'Couteau de chef', 'Mixeur (optionnel)', 'Fourchette'],
  'Crêpes sucrées': ['Crêpière', 'Louche', 'Spatule', 'Saladier', 'Fouet', 'Louche'],
  'Clafoutis aux cerises': ['Saladier', 'Fouet', 'Moule à manqué', 'Four'],
  'Moelleux aux pommes': ['Économe', 'Saladier', 'Fouet', 'Moule à manqué', 'Four', 'Couteau de chef'],
  'Brownie au chocolat': ['Saladier', 'Fouet', 'Casserole (bain-marie)', 'Moule carré', 'Four', 'Spatule'],
  'Mug cake choco-banane': ['Mug', 'Fourchette', 'Micro-ondes', 'Cuillère'],
  'Poires pochées au vin': ['Casserole', 'Économe', 'Couteau de chef', 'Écumoire'],
  'Soupe de potiron': ['Économe', 'Casserole', 'Mixeur', 'Couteau de chef', 'Cuillère en bois'],
  'Taboulé oriental': ['Saladier', 'Casserole', 'Passoire', 'Couteau de chef', 'Presse-agrume', 'Ciseaux'],
  'Œufs mimosa': ['Casserole', 'Fourchette', 'Poche à douille (optionnel)', 'Cuillère'],
  'Guacamole & chips': ['Saladier', 'Fourchette', 'Couteau de chef', 'Presse-agrume'],
  'Bruschetta tomate-mozza': ['Grille-pain', 'Couteau de chef', 'Saladier'],
  'Samoussas au bœuf': ['Poêle', 'Pinceau de cuisine', 'Couteau', 'Saladier', 'Four'],
  'Velouté de champignons': ['Casserole', 'Mixeur', 'Couteau de chef', 'Poêle (croûtons)'],
  'Carpaccio de betteraves': ['Couteau de chef', 'Assiette', 'Cuillère à soupe'],
  'Porridge aux fruits rouges': ['Casserole', 'Cuillère en bois', 'Saladier'],
  'Smoothie bowl banane-fraise': ['Blender', 'Saladier', 'Cuillère'],
  'Pancakes américains': ['Saladier', 'Fouet', 'Poêle', 'Louche', 'Spatule'],
  'Œufs brouillés & bacon': ['Poêle', 'Saladier', 'Fouet', 'Spatule', 'Grille-pain'],
  'Muesli maison & yaourt': ['Saladier', 'Poêle (torréfier)', 'Couteau'],
  'Energy balls cacao-dattes': ['Mixeur', 'Saladier', 'Cuillère', 'Assiette'],
  'Houmous maison & bâtonnets de légumes': ['Mixeur', 'Presse-ail', 'Presse-agrume', 'Couteau de chef', 'Saladier', 'Passoire'],
  'Cake salé jambon-olives': ['Saladier', 'Fouet', 'Moule à cake', 'Four', 'Couteau de chef', 'Râpe'],
};

async function preflight() {
  const { error: prixErr } = await supabase.from('ingredients').select('id, prix_unitaire').limit(1);
  const { error: ustErr } = await supabase.from('meals').select('id, ustensiles').limit(1);
  if (prixErr && /prix_unitaire|schema cache/i.test(prixErr.message) || ustErr && /ustensiles|schema cache/i.test(ustErr.message)) {
    console.error('❌ Les colonnes de la migration 00004 sont introuvables (prix_unitaire / unite_prix / ustensiles).');
    console.error('');
    console.error('👉 Applique d\'abord la migration :');
    console.error('   1. npm run db:migrate  (affiche le SQL)');
    console.error('   2. Colle supabase/migrations/00004_budget_prix_ustensiles.sql dans le SQL Editor Supabase');
    console.error('   3. Relance : npm run seed:budget');
    process.exit(1);
  }
  if (prixErr) throw prixErr;
  if (ustErr) throw ustErr;
}

async function seedPrix() {
  console.log('💰 Attribution des prix aux ingrédients...\n');

  let updated = 0;
  let missing: string[] = [];

  // Récupérer tous les ingrédients existants
  const { data: ingredients, error } = await supabase.from('ingredients').select('id, nom');
  if (error) throw error;

  for (const ing of ingredients || []) {
    const prix = PRIX[ing.nom];
    if (prix) {
      const { error: upErr } = await supabase
        .from('ingredients')
        .update({ prix_unitaire: prix.pu, unite_prix: prix.up })
        .eq('id', ing.id);
      if (upErr) {
        console.log(`❌ ${ing.nom}: ${upErr.message}`);
      } else {
        updated++;
      }
    } else {
      missing.push(ing.nom);
    }
  }

  console.log(`✅ ${updated}/${ingredients?.length} ingrédients chiffrés`);
  if (missing.length > 0) {
    console.log(`⚠️  Prix manquants pour : ${missing.join(', ')}`);
    console.log('   → Ces ingrédients sont ignorés dans le calcul (prix = —).');
  }
}

async function seedUstensiles() {
  console.log('\n🍳 Attribution des ustensiles aux recettes...\n');

  const { data: meals, error } = await supabase.from('meals').select('id, titre');
  if (error) throw error;

  let updated = 0;
  let missing: string[] = [];

  for (const meal of meals || []) {
    const ustensiles = USTENSILES[meal.titre];
    if (ustensiles && ustensiles.length > 0) {
      const { error: upErr } = await supabase
        .from('meals')
        .update({ ustensiles })
        .eq('id', meal.id);
      if (upErr) {
        console.log(`❌ ${meal.titre}: ${upErr.message}`);
      } else {
        updated++;
      }
    } else {
      missing.push(meal.titre);
    }
  }

  console.log(`✅ ${updated}/${meals?.length} recettes avec ustensiles`);
  if (missing.length > 0) {
    console.log(`⚠️  Ustensiles manquants pour : ${missing.join(', ')}`);
  }
}

async function main() {
  console.log('🌱 Seed prix + ustensiles...\n');
  await preflight();
  await seedPrix();
  await seedUstensiles();
  console.log('\n🎉 Terminé ! Les recettes ont maintenant un prix et des ustensiles.');
  console.log('   → Le budget hebdomadaire se règle sur la page /budget.');
}

main().catch(console.error);
