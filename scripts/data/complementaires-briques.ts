// ============================================================================
// Briques communes des recettes complémentaires (plats simples, rapides et
// complets). Chaque brique porte ses ingrédients ET sa phrase de préparation,
// donc chaque recette assemblée a une composition et des étapes précises.
// Quantités pour 2 personnes. Mélange déterministe (graine fixe).
// ============================================================================

import type { RecetteSaisie } from './recettes-proteinees';

export type L = [string, number, string, boolean?];
export type T = RecetteSaisie['type'];

export function aleatoire(graine: number) {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Produit cartésien mélangé de façon déterministe, limité à `n` éléments. */
export function combiner<A extends unknown[]>(listes: { [K in keyof A]: A[K][] }, n: number, graine: number): A[] {
  let courant: unknown[][] = [[]];
  for (const liste of listes as unknown[][][]) {
    const suivant: unknown[][] = [];
    for (const c of courant) for (const e of liste) suivant.push([...c, e]);
    courant = suivant;
  }
  const rng = aleatoire(graine);
  for (let i = courant.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [courant[i], courant[j]] = [courant[j], courant[i]];
  }
  return courant.slice(0, n) as A[];
}

export const recette = (
  type: T, titre: string, prep: number, cuisson: number, ingredients: L[], etapes: string[],
  ustensiles: string[], cuisine = 'Française', conservation = 2, portions = 2, difficulte: RecetteSaisie['difficulte'] = 'facile',
): RecetteSaisie => ({ titre, type, cuisine, prep, cuisson, difficulte, portions, conservation, ustensiles, ingredients, etapes });

/** Protéine : t = nom préparé (« Poulet sauté »), a = « au poulet », x = geste de cuisson précis. */
export interface Proteine { t: string; a: string; i: L[]; x: string; prep: number; cuis: number; vege?: boolean; cons?: number }
/** Légume : t = « aux courgettes » ; x = préparation + cuisson. */
export interface Legume { t: string; nom: string; i: L[]; x: string; prep: number; cuis: number }
/** Féculent : t = « riz basmati » ; x = cuisson. */
export interface Base { t: string; i: L[]; x: string; prep: number; cuis: number }
/** Sauce : t = « soja-gingembre » ; x = préparation (dans un bol). */
export interface Sauce { t: string; i: L[]; x: string; c: string }

const HUILE: L = ['Huile d’olive', 10, 'ml'];

export const PROTEINES: Proteine[] = [
  { t: 'Poulet sauté', a: 'au poulet', i: [['Filet de poulet', 300, 'g'], HUILE], prep: 5, cuis: 8,
    x: 'Détaillez le poulet en dés de 2 cm, salez et poivrez. Faites-le dorer 7 à 8 min à feu vif dans une poêle avec l’huile d’olive, en remuant, jusqu’à ce qu’il soit cuit à cœur (plus de rose au centre). Réservez dans une assiette' },
  { t: 'Émincé de dinde', a: 'à la dinde', i: [['Filet de dinde', 300, 'g'], HUILE], prep: 5, cuis: 6,
    x: 'Émincez la dinde en lanières de 1 cm, salez et poivrez. Faites-les sauter 5 à 6 min à feu vif dans l’huile d’olive jusqu’à ce qu’elles soient dorées et cuites à cœur. Réservez dans une assiette' },
  { t: 'Escalopes de poulet poêlées', a: 'à l’escalope de poulet', i: [['Escalope de poulet', 300, 'g'], HUILE], prep: 5, cuis: 9,
    x: 'Aplatissez légèrement les escalopes, salez et poivrez. Faites-les dorer 4 min par face à feu moyen-vif dans l’huile d’olive, jusqu’à cuisson à cœur, puis tranchez-les en lanières. Réservez dans une assiette' },
  { t: 'Steak haché', a: 'au steak haché', i: [['Steak haché', 300, 'g'], HUILE], prep: 3, cuis: 7,
    x: 'Faites cuire les steaks hachés 3 à 4 min par face à feu vif dans une poêle huilée, jusqu’à ce qu’ils soient bien cuits à cœur (plus de rose). Coupez-les en tranches et réservez dans une assiette' },
  { t: 'Bœuf haché sauté', a: 'au bœuf haché', i: [['Bœuf haché 5 %', 280, 'g'], HUILE], prep: 3, cuis: 6,
    x: 'Faites revenir le bœuf haché 5 à 6 min à feu vif dans une poêle huilée, en l’émiettant à la cuillère en bois, jusqu’à ce qu’il soit bien doré et sans trace rose. Salez, poivrez et réservez' },
  { t: 'Faux-filet poêlé', a: 'au faux-filet', i: [['Faux-filet', 300, 'g'], HUILE], prep: 5, cuis: 8,
    x: 'Sortez la viande 15 min avant la cuisson. Saisissez-la 2 à 3 min par face à feu très vif dans une poêle huilée pour une cuisson à point, salez, poivrez, puis laissez-la reposer 3 min sous une feuille d’aluminium avant de la trancher en lamelles' },
  { t: 'Bœuf sauté', a: 'au bœuf', i: [['Rumsteck', 300, 'g'], HUILE], prep: 5, cuis: 5,
    x: 'Coupez le rumsteck en lanières de 1 cm en travers des fibres. Faites-les saisir 2 min à feu très vif dans l’huile d’olive bien chaude, sans les entasser (en deux fois si besoin), puis réservez dans une assiette' },
  { t: 'Médaillons de porc', a: 'au porc', i: [['Filet mignon de porc', 320, 'g'], HUILE], prep: 5, cuis: 10,
    x: 'Coupez le filet mignon en médaillons de 2 cm, salez et poivrez. Faites-les dorer 4 à 5 min par face à feu moyen-vif dans l’huile d’olive, jusqu’à ce que la chair soit juste rosée à cœur, puis réservez dans une assiette' },
  { t: 'Côtes de porc poêlées', a: 'à la côte de porc', i: [['Côte de porc', 360, 'g'], HUILE], prep: 3, cuis: 12,
    x: 'Salez et poivrez les côtes de porc. Faites-les cuire 5 à 6 min par face à feu moyen-vif dans l’huile d’olive, jusqu’à ce que le jus qui s’en échappe soit clair, puis laissez-les reposer 3 min dans une assiette' },
  { t: 'Escalopes de veau', a: 'au veau', i: [['Escalope de veau', 300, 'g'], HUILE], prep: 3, cuis: 6,
    x: 'Aplatissez les escalopes de veau, salez et poivrez. Faites-les dorer 2 à 3 min par face à feu vif dans l’huile d’olive, puis réservez dans une assiette' },
  { t: 'Saucisses de Toulouse', a: 'à la saucisse de Toulouse', i: [['Saucisse de Toulouse', 320, 'g']], prep: 2, cuis: 14,
    x: 'Piquez légèrement les saucisses de Toulouse et faites-les cuire 12 à 14 min à feu moyen dans une poêle sans matière grasse, en les retournant régulièrement, jusqu’à ce qu’elles soient dorées et cuites à cœur. Coupez-les en rondelles et réservez' },
  { t: 'Magret de canard', a: 'au magret de canard', i: [['Magret de canard', 320, 'g']], prep: 5, cuis: 12,
    x: 'Quadrillez la peau du magret, salez et poivrez. Posez-le côté peau dans une poêle froide, chauffez à feu moyen et laissez cuire 7 min sans y toucher, puis retournez-le 3 min. Laissez reposer 5 min sous une feuille d’aluminium et tranchez finement' },
  { t: 'Merguez grillées', a: 'à la merguez', i: [['Merguez', 300, 'g']], prep: 2, cuis: 12,
    x: 'Faites cuire les merguez 10 à 12 min à feu moyen dans une poêle sans matière grasse, en les retournant régulièrement jusqu’à ce qu’elles soient bien dorées et cuites à cœur. Coupez-les en tronçons et réservez' },
  { t: 'Saumon poêlé', a: 'au saumon', i: [['Pavé de saumon', 280, 'g'], HUILE], prep: 3, cuis: 8,
    x: 'Salez et poivrez les pavés de saumon. Posez-les côté peau dans une poêle huilée bien chaude et laissez cuire 4 min sans y toucher, puis retournez-les 2 à 3 min : la chair doit rester nacrée au centre. Réservez dans une assiette' },
  { t: 'Cabillaud poêlé', a: 'au cabillaud', i: [['Filet de cabillaud', 300, 'g'], HUILE], prep: 3, cuis: 7,
    x: 'Épongez les filets de cabillaud, salez et poivrez. Faites-les cuire 3 à 4 min par face dans une poêle huilée, jusqu’à ce que la chair s’effeuille facilement. Réservez dans une assiette' },
  { t: 'Colin poêlé', a: 'au colin', i: [['Colin', 300, 'g'], HUILE], prep: 3, cuis: 7,
    x: 'Épongez le colin, salez et poivrez. Faites-le cuire 3 à 4 min par face à feu moyen dans une poêle huilée, jusqu’à ce que la chair soit opaque et s’effeuille. Réservez dans une assiette' },
  { t: 'Dorade poêlée', a: 'à la dorade', i: [['Filet de dorade', 280, 'g'], HUILE], prep: 3, cuis: 7,
    x: 'Épongez les filets de dorade, salez et poivrez. Cuisez-les 4 min côté peau dans une poêle huilée bien chaude, puis 1 à 2 min de l’autre côté. Réservez dans une assiette' },
  { t: 'Truite poêlée', a: 'à la truite', i: [['Truite', 300, 'g'], HUILE], prep: 3, cuis: 7,
    x: 'Épongez la truite, salez et poivrez. Faites-la cuire 3 à 4 min côté peau, puis 2 min de l’autre côté dans une poêle huilée. La chair doit s’effeuiller facilement. Réservez dans une assiette' },
  { t: 'Crevettes sautées', a: 'aux crevettes', i: [['Crevettes', 250, 'g'], HUILE], prep: 3, cuis: 4,
    x: 'Séchez les crevettes, salez et poivrez. Faites-les sauter 2 min par face à feu vif dans l’huile d’olive, jusqu’à ce qu’elles soient bien roses. Réservez dans une assiette' },
  { t: 'Gambas poêlées', a: 'aux gambas', i: [['Gambas', 250, 'g'], HUILE], prep: 3, cuis: 5,
    x: 'Séchez les gambas, salez et poivrez. Faites-les cuire 2 à 3 min par face à feu vif dans l’huile d’olive, jusqu’à ce qu’elles soient bien rosées. Réservez dans une assiette' },
  { t: 'Calamars sautés', a: 'aux calamars', i: [['Calamars', 250, 'g'], HUILE], prep: 5, cuis: 4,
    x: 'Coupez les calamars en anneaux et séchez-les. Faites-les sauter 2 min à feu très vif dans l’huile d’olive, sans les entasser, pour qu’ils restent tendres. Réservez dans une assiette' },
  { t: 'Saint-Jacques poêlées', a: 'aux Saint-Jacques', i: [['Noix de Saint-Jacques', 200, 'g'], HUILE], prep: 3, cuis: 4,
    x: 'Séchez soigneusement les noix de Saint-Jacques, salez et poivrez. Saisissez-les 1 min 30 par face à feu très vif dans une poêle huilée, pour qu’elles soient dorées dehors et nacrées au centre. Réservez dans une assiette' },
  { t: 'Thon émietté', a: 'au thon', i: [['Thon au naturel', 200, 'g']], prep: 3, cuis: 0,
    x: 'Égouttez soigneusement le thon et émiettez-le à la fourchette. Réservez dans un bol' },
  { t: 'Tofu doré', a: 'au tofu', i: [['Tofu ferme', 300, 'g'], HUILE], prep: 12, cuis: 8, vege: true,
    x: 'Pressez le tofu 10 min entre deux feuilles de papier absorbant, puis coupez-le en cubes de 2 cm. Faites-le dorer 8 min à feu moyen-vif dans l’huile d’olive en le retournant, jusqu’à ce que toutes les faces soient croustillantes. Réservez dans une assiette' },
  { t: 'Halloumi grillé', a: 'au halloumi', i: [['Halloumi', 200, 'g']], prep: 2, cuis: 5, vege: true,
    x: 'Coupez le halloumi en tranches de 1 cm et faites-les dorer 2 min par face dans une poêle antiadhésive sans matière grasse. Réservez dans une assiette' },
  { t: 'Tempeh poêlé', a: 'au tempeh', i: [['Tempeh', 200, 'g'], HUILE], prep: 4, cuis: 8, vege: true,
    x: 'Coupez le tempeh en tranches de 5 mm. Faites-les dorer 4 min par face à feu moyen dans l’huile d’olive, jusqu’à ce qu’elles soient croustillantes. Réservez dans une assiette' },
  { t: 'Pois chiches dorés', a: 'aux pois chiches', i: [['Pois chiches (bte)', 400, 'g'], HUILE], prep: 3, cuis: 8, vege: true,
    x: 'Rincez et égouttez les pois chiches, séchez-les bien. Faites-les dorer 7 à 8 min à feu vif dans l’huile d’olive en remuant souvent, jusqu’à ce qu’ils soient légèrement croustillants. Réservez dans une assiette' },
  { t: 'Seitan sauté', a: 'au seitan', i: [['Seitan', 220, 'g'], HUILE], prep: 3, cuis: 6, vege: true,
    x: 'Coupez le seitan en lamelles. Faites-les dorer 5 à 6 min à feu vif dans l’huile d’olive. Réservez dans une assiette' },
];

const lg = (t: string, nom: string, i: L[], x: string, prep: number, cuis: number): Legume => ({ t, nom, i, x, prep, cuis });

export const LEGUMES: Legume[] = [
  lg('aux courgettes', 'courgettes', [['Courgette', 350, 'g']], 'Coupez les courgettes en demi-rondelles de 1 cm et faites-les sauter 5 à 6 min à feu vif dans la même poêle avec une pincée de sel, jusqu’à ce qu’elles soient dorées mais encore croquantes', 5, 6),
  lg('aux poivrons', 'poivrons', [['Poivron rouge', 150, 'g'], ['Poivron jaune', 150, 'g']], 'Épépinez les poivrons, coupez-les en lanières et faites-les sauter 7 min à feu moyen-vif dans la même poêle, jusqu’à ce qu’ils soient tendres et légèrement colorés', 5, 7),
  lg('aux champignons', 'champignons', [['Champignons de Paris', 250, 'g']], 'Essuyez les champignons, coupez-les en quartiers et faites-les revenir 6 min à feu vif dans la même poêle, sans les couvrir, jusqu’à ce que l’eau soit évaporée et qu’ils soient dorés', 4, 6),
  lg('au brocoli', 'brocoli', [['Brocoli', 300, 'g']], 'Détaillez le brocoli en petits bouquets et faites-les cuire 4 min dans l’eau bouillante salée, puis égouttez-les : ils doivent rester fermes et d’un beau vert', 5, 5),
  lg('aux haricots verts', 'haricots verts', [['Haricots verts', 250, 'g']], 'Équeutez les haricots verts et faites-les cuire 8 min dans l’eau bouillante salée, puis égouttez-les : ils doivent rester légèrement croquants', 5, 8),
  lg('aux épinards', 'épinards', [['Épinards frais', 200, 'g']], 'Lavez les épinards, puis faites-les tomber 2 min à feu vif dans la poêle jusqu’à ce qu’ils soient réduits ; pressez-les légèrement pour retirer l’excès d’eau', 3, 3),
  lg('aux carottes', 'carottes', [['Carotte', 300, 'g']], 'Épluchez les carottes, coupez-les en fins bâtonnets et faites-les sauter 8 à 9 min à feu moyen avec 2 cuillères à soupe d’eau, à couvert, jusqu’à ce qu’elles soient tendres', 6, 9),
  lg('au chou-fleur', 'chou-fleur', [['Chou-fleur', 350, 'g']], 'Détaillez le chou-fleur en petits bouquets et faites-les cuire 8 à 9 min à feu moyen avec 3 cuillères à soupe d’eau, à couvert, puis 2 min à découvert pour les dorer', 6, 10),
  lg('à l’aubergine', 'aubergine', [['Aubergine', 300, 'g']], 'Coupez l’aubergine en dés de 2 cm et faites-les dorer 10 min à feu moyen-vif dans la poêle avec un filet d’huile, en remuant, jusqu’à ce qu’ils soient fondants', 5, 10),
  lg('aux tomates cerises', 'tomates cerises', [['Tomates cerises', 250, 'g']], 'Coupez les tomates cerises en deux et faites-les cuire 3 à 4 min à feu moyen dans la poêle jusqu’à ce qu’elles commencent à s’affaisser', 3, 4),
  lg('au poireau', 'poireau', [['Poireau', 300, 'g']], 'Lavez le poireau, coupez-le en rondelles de 1 cm et faites-le fondre 8 min à feu moyen avec 3 cuillères à soupe d’eau, à couvert, en remuant de temps en temps', 5, 8),
  lg('aux petits pois', 'petits pois', [['Petit pois (surg.)', 250, 'g']], 'Faites cuire les petits pois surgelés 4 min dans l’eau bouillante salée, puis égouttez-les', 1, 4),
  lg('à la poêlée de légumes', 'poêlée de légumes', [['Poêlée de légumes surgelée', 350, 'g']], 'Faites cuire la poêlée de légumes surgelée 8 à 10 min à feu vif dans la poêle sans la décongeler, en remuant, jusqu’à ce que l’eau soit évaporée', 1, 10),
  lg('au fenouil', 'fenouil', [['Fenouil', 300, 'g']], 'Coupez le fenouil en fines lamelles et faites-les sauter 8 min à feu moyen dans la poêle avec un filet d’huile, jusqu’à ce qu’elles soient tendres et dorées', 5, 8),
  lg('aux asperges vertes', 'asperges', [['Asperge verte', 300, 'g']], 'Cassez le pied des asperges, coupez-les en tronçons de 4 cm et faites-les sauter 5 à 6 min à feu moyen-vif dans la poêle, jusqu’à ce qu’elles soient tendres sous la pointe du couteau', 4, 6),
  lg('au chou kale', 'chou kale', [['Chou kale', 150, 'g']], 'Retirez la nervure centrale du chou kale, déchirez les feuilles et faites-les sauter 4 min à feu vif avec 2 cuillères à soupe d’eau, jusqu’à ce qu’elles soient tendres', 4, 4),
  lg('au pak choï', 'pak choï', [['Chou pak choï', 250, 'g']], 'Coupez le pak choï en deux dans la longueur et faites-le sauter 3 à 4 min à feu vif dans la poêle, jusqu’à ce que les tiges soient translucides', 3, 4),
  lg('à la courge butternut', 'butternut', [['Courge butternut', 350, 'g']], 'Épluchez la courge butternut, coupez-la en dés de 1,5 cm et faites-les dorer 12 min à feu moyen dans la poêle avec un filet d’huile et un fond d’eau, à couvert, jusqu’à ce qu’ils soient fondants', 8, 12),
  lg('aux endives', 'endives', [['Endive', 300, 'g']], 'Coupez les endives en deux dans la longueur et faites-les braiser 8 min à feu moyen dans la poêle avec un filet d’huile et 3 cuillères à soupe d’eau, à couvert, jusqu’à ce qu’elles soient tendres et dorées', 3, 9),
  lg('au chou blanc', 'chou blanc', [['Chou blanc', 300, 'g']], 'Émincez finement le chou blanc et faites-le sauter 10 min à feu moyen-vif dans la poêle, en remuant, jusqu’à ce qu’il soit tendre et légèrement caramélisé', 5, 10),
];

const bs = (t: string, i: L[], x: string, prep: number, cuis: number): Base => ({ t, i, x, prep, cuis });

export const BASES: Base[] = [
  bs('riz basmati', [['Riz basmati', 150, 'g']], 'Rincez le riz basmati à l’eau froide, puis faites-le cuire 10 min à couvert dans 2 fois son volume d’eau salée à frémissement ; laissez-le gonfler 5 min hors du feu et égrenez-le à la fourchette', 2, 16),
  bs('riz jasmin', [['Riz jasmin', 150, 'g']], 'Rincez le riz jasmin, puis faites-le cuire 12 min à couvert dans 1,5 fois son volume d’eau salée ; laissez-le reposer 5 min hors du feu et égrenez-le', 2, 17),
  bs('riz complet', [['Riz complet', 150, 'g']], 'Faites cuire le riz complet 25 min dans 3 fois son volume d’eau bouillante salée, puis égouttez-le', 1, 25),
  bs('quinoa', [['Quinoa', 150, 'g']], 'Rincez le quinoa, puis faites-le cuire 12 min à couvert dans 2 fois son volume d’eau salée, jusqu’à ce que les petits germes se détachent ; laissez-le gonfler 3 min hors du feu', 2, 15),
  bs('boulgour', [['Boulgour', 150, 'g']], 'Versez le boulgour dans 2 fois son volume d’eau bouillante salée, couvrez et laissez cuire 10 min à feu doux jusqu’à absorption complète, puis égrenez-le à la fourchette', 1, 10),
  bs('semoule', [['Semoule', 150, 'g']], 'Versez la semoule dans un volume égal d’eau bouillante salée additionnée d’un filet d’huile d’olive, couvrez et laissez gonfler 5 min, puis égrenez-la à la fourchette', 1, 5),
  bs('penne', [['Pâtes penne', 180, 'g']], 'Faites cuire les penne 10 à 11 min dans une grande casserole d’eau bouillante salée (1 L d’eau pour 100 g de pâtes), puis égouttez-les', 1, 11),
  bs('spaghetti', [['Spaghetti', 180, 'g']], 'Faites cuire les spaghetti 9 à 10 min dans une grande casserole d’eau bouillante salée (1 L d’eau pour 100 g de pâtes), puis égouttez-les', 1, 10),
  bs('nouilles de riz', [['Nouilles de riz', 150, 'g']], 'Plongez les nouilles de riz 5 min dans de l’eau bouillante hors du feu, puis égouttez-les et rincez-les à l’eau froide', 1, 5),
  bs('nouilles soba', [['Nouilles soba', 150, 'g']], 'Faites cuire les nouilles soba 5 min dans l’eau bouillante, puis égouttez-les et rincez-les à l’eau froide', 1, 5),
  bs('lentilles vertes', [['Lentilles vertes', 150, 'g']], 'Rincez les lentilles vertes, couvrez-les d’eau froide et faites-les cuire 20 à 25 min à petit frémissement (salez en fin de cuisson), puis égouttez-les', 1, 25),
  bs('lentilles corail', [['Lentilles corail', 150, 'g']], 'Rincez les lentilles corail et faites-les cuire 10 à 12 min dans 3 fois leur volume d’eau, jusqu’à ce qu’elles soient tendres, puis égouttez-les', 1, 12),
  bs('pommes de terre vapeur', [['Pomme de terre', 500, 'g']], 'Épluchez les pommes de terre, coupez-les en morceaux de 3 cm et faites-les cuire 18 min à la vapeur ou à l’eau bouillante salée, jusqu’à ce que la pointe d’un couteau s’enfonce sans résistance', 6, 18),
  bs('patate douce vapeur', [['Patate douce', 400, 'g']], 'Épluchez la patate douce, coupez-la en dés de 2 cm et faites-la cuire 15 min à la vapeur ou à l’eau bouillante, jusqu’à ce qu’elle soit tendre', 5, 15),
  bs('gnocchis dorés', [['Gnocchis', 350, 'g']], 'Plongez les gnocchis 2 min dans l’eau bouillante salée jusqu’à ce qu’ils remontent, égouttez-les, puis faites-les dorer 4 à 5 min dans une poêle huilée', 1, 8),
  bs('épeautre', [['Épeautre', 150, 'g']], 'Faites cuire l’épeautre 18 à 20 min dans 3 fois son volume d’eau bouillante salée, puis égouttez-le', 1, 20),
  bs('millet', [['Millet', 150, 'g']], 'Faites griller le millet 2 min à sec dans une casserole, puis couvrez de 2 fois son volume d’eau salée et laissez cuire 12 min à couvert ; laissez gonfler 5 min hors du feu', 2, 17),
  bs('sarrasin', [['Sarrasin', 150, 'g']], 'Rincez le sarrasin, puis faites-le cuire 12 min dans 2 fois son volume d’eau salée, à couvert, jusqu’à absorption', 1, 12),
  bs('orzo', [['Pâtes orzo', 160, 'g']], 'Faites cuire les pâtes orzo 8 min dans l’eau bouillante salée, puis égouttez-les', 1, 8),
  bs('frites au four', [['Frites surgelées', 300, 'g']], 'Étalez les frites surgelées sur une plaque recouverte de papier cuisson et enfournez-les 20 min à 220 °C, en les retournant à mi-cuisson, jusqu’à ce qu’elles soient dorées', 1, 22),
];

const sc = (t: string, c: string, i: L[], x: string): Sauce => ({ t, c, i, x });

export const SAUCES: Sauce[] = [
  sc('soja-gingembre', 'Asiatique', [['Sauce soja', 30, 'ml'], ['Gingembre', 10, 'g'], ['Ail', 1, 'pcs'], ['Miel', 1, 'cas']], 'Mélangez dans un bol 30 ml de sauce soja, 10 g de gingembre râpé, 1 gousse d’ail pressée et 1 cuillère à soupe de miel'),
  sc('crème-moutarde', 'Française', [['Crème fraîche', 100, 'g'], ['Moutarde', 20, 'g']], 'Mélangez dans un bol 100 g de crème fraîche et 20 g de moutarde, avec du poivre'),
  sc('tomate-basilic', 'Italienne', [['Tomate concassée (bte)', 200, 'g'], ['Basilic', 10, 'g'], ['Ail', 1, 'pcs']], 'Mélangez la tomate concassée avec 1 gousse d’ail pressée et le basilic ciselé, salez et poivrez'),
  sc('citron-herbes', 'Méditerranéenne', [['Citron', 1, 'pcs'], ['Persil', 10, 'g'], ['Huile d’olive', 10, 'ml']], 'Pressez le citron, mélangez le jus avec le persil ciselé, l’huile d’olive, du sel et du poivre'),
  sc('curry-coco', 'Indienne', [['Curry en poudre', 2, 'cac'], ['Lait de coco léger', 150, 'ml']], 'Délayez 2 cuillères à café de curry dans 150 ml de lait de coco léger, salez'),
  sc('paprika-yaourt', 'Méditerranéenne', [['Paprika fumé', 1, 'cac'], ['Yaourt grec', 120, 'g'], ['Ail', 1, 'pcs']], 'Mélangez 120 g de yaourt grec avec 1 cuillère à café de paprika fumé, 1 gousse d’ail pressée, du sel et du poivre'),
  sc('pesto', 'Italienne', [['Pesto', 50, 'g']], 'Détendez 50 g de pesto avec 2 cuillères à soupe d’eau chaude'),
  sc('harissa-tomate', 'Marocaine', [['Harissa', 15, 'g'], ['Tomate concassée (bte)', 150, 'g']], 'Mélangez 15 g de harissa avec la tomate concassée, salez'),
  sc('ail-persil', 'Française', [['Ail', 3, 'pcs'], ['Persil', 15, 'g'], ['Beurre', 15, 'g']], 'Hachez finement 3 gousses d’ail et le persil, mélangez-les avec 15 g de beurre mou'),
  sc('teriyaki', 'Japonaise', [['Sauce soja', 30, 'ml'], ['Miel', 1, 'cas'], ['Vinaigre de riz', 15, 'ml'], ['Gingembre', 5, 'g']], 'Mélangez 30 ml de sauce soja, 1 cuillère à soupe de miel, 15 ml de vinaigre de riz et 5 g de gingembre râpé'),
  sc('barbecue', 'Américaine', [['Sauce barbecue', 50, 'g']], 'Délayez 50 g de sauce barbecue avec 2 cuillères à soupe d’eau'),
  sc('fromage frais-ciboulette', 'Française', [['Fromage frais', 100, 'g'], ['Ciboulette', 8, 'g']], 'Mélangez 100 g de fromage frais avec la ciboulette ciselée, du sel et du poivre'),
  sc('tahini-citron', 'Libanaise', [['Tahini', 30, 'g'], ['Citron', 1, 'pcs'], ['Ail', 1, 'pcs']], 'Fouettez 30 g de tahini avec le jus d’un citron, 1 gousse d’ail pressée et 3 cuillères à soupe d’eau jusqu’à obtenir une sauce lisse'),
  sc('miso', 'Japonaise', [['Miso', 25, 'g'], ['Vinaigre de riz', 10, 'ml'], ['Sauce soja', 10, 'ml']], 'Délayez 25 g de miso avec 10 ml de vinaigre de riz, 10 ml de sauce soja et 3 cuillères à soupe d’eau chaude'),
  sc('vin blanc-échalote', 'Française', [['Vin blanc', 100, 'ml'], ['Échalote', 2, 'pcs'], ['Crème liquide', 50, 'ml']], 'Pelez et ciselez 2 échalotes ; mélangez avec 100 ml de vin blanc et 50 ml de crème liquide'),
  sc('gochujang', 'Coréenne', [['Gochujang', 25, 'g'], ['Sauce soja', 10, 'ml'], ['Miel', 1, 'cas'], ['Ail', 1, 'pcs']], 'Mélangez 25 g de gochujang, 10 ml de sauce soja, 1 cuillère à soupe de miel, 1 gousse d’ail pressée et 3 cuillères à soupe d’eau'),
  sc('olives-tomate', 'Méditerranéenne', [['Olives vertes', 50, 'g'], ['Tomate concassée (bte)', 150, 'g']], 'Coupez 50 g d’olives vertes en rondelles et mélangez-les avec la tomate concassée'),
  sc('coco-citron vert', 'Thaïlandaise', [['Lait de coco léger', 150, 'ml'], ['Citron vert', 1, 'pcs']], 'Mélangez 150 ml de lait de coco léger avec le jus d’un citron vert et une pincée de sel'),
  sc('hoisin', 'Asiatique', [['Sauce hoisin', 40, 'g'], ['Sauce soja', 10, 'ml']], 'Mélangez 40 g de sauce hoisin, 10 ml de sauce soja et 3 cuillères à soupe d’eau'),
  sc('sriracha-miel', 'Asiatique', [['Sauce sriracha', 2, 'cac'], ['Miel', 1, 'cas'], ['Sauce soja', 20, 'ml']], 'Mélangez 2 cuillères à café de sriracha, 1 cuillère à soupe de miel et 20 ml de sauce soja'),
];

/** Phrase pour associer une sauce préparée à une poêle. */
export const lierSauce = (sauce: Sauce) =>
  `Versez la sauce ${sauce.t} dans la poêle et laissez réduire 1 à 2 min à feu moyen en remuant, jusqu’à ce qu’elle nappe les ingrédients`;

/** Ustensiles d'une base selon sa cuisson */
export const ustensilesBase = (b: Base) => (b.t.startsWith('frites') ? ['Four', 'Papier cuisson'] : ['Casserole']);

/** « riz basmati » → « le riz basmati », « penne » → « les penne » */
export function avecArticle(t: string): string {
  const mot = t.split(' ')[0];
  if (['penne', 'spaghetti', 'nouilles', 'lentilles', 'gnocchis', 'frites'].includes(mot) || t.startsWith('pommes de terre')) return `les ${t}`;
  if (['semoule', 'patate'].includes(mot)) return `la ${t}`;
  if (['épeautre', 'orzo'].includes(mot)) return `l’${t}`;
  return `le ${t}`;
}

/** « de riz » / « d’épeautre » */
export const de = (t: string) => (/^[aeiouyéèêàâîôûh]/i.test(t) ? `d’${t}` : `de ${t}`);
