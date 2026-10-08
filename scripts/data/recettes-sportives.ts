// ============================================================================
// Repas SPORTIFS à la française : une protéine maigre (poulet, dinde, bœuf,
// poisson, œufs…) + un féculent complexe + un légume + une sauce de cuisine
// française. Chaque combinaison a ses ingrédients, ses quantités (2 portions
// riches en protéines) et ses étapes assemblées à partir de gestes précis.
// Générées de façon déterministe (graine fixe) : le même lot à chaque
// exécution. Les doublons de composition sont écartés à l'insertion
// (scripts/ajouter-recettes-generees.ts --sportives).
// ============================================================================

import type { RecetteSaisie } from './recettes-proteinees';

type L = [string, number, string, boolean?];

interface Proteine {
  /** Titre : forme préparée (« Poulet poêlé ») */
  titre: string;
  ingredients: L[];
  /** Étape de cuisson de la protéine ; `{sauce}` = fragment de sauce */
  etape: string;
  minutes: number;
  four?: boolean;
}

const PROTEINES: Proteine[] = [
  { titre: 'Poulet poêlé', ingredients: [['Filet de poulet', 360, 'g']], etape: 'Coupez le poulet en escalopes de 1 cm d’épaisseur, séchez-les et faites-les dorer 5 à 6 min par face dans une poêle huilée bien chaude, sans les déplacer, jusqu’à ce que la chair ne soit plus rosée au centre ; salez, poivrez et laissez reposer 2 min', minutes: 12 },
  { titre: 'Poulet rôti au four', ingredients: [['Filet de poulet', 360, 'g']], etape: 'Posez le poulet dans un plat, huilez, salez, poivrez et enfournez 22 min à 200 °C, jusqu’à 74 °C à cœur ou jusqu’à ce que le jus soit clair ; laissez reposer 3 min avant de trancher', minutes: 22, four: true },
  { titre: 'Escalopes de poulet grillées', ingredients: [['Escalope de poulet', 360, 'g']], etape: 'Faites griller les escalopes 4 min par face dans une poêle très chaude légèrement huilée, jusqu’à ce qu’elles soient dorées et fermes au toucher ; salez, poivrez et laissez reposer 2 min', minutes: 10 },
  { titre: 'Dinde sautée', ingredients: [['Filet de dinde', 360, 'g']], etape: 'Coupez la dinde en lamelles de 1 cm et faites-la sauter 7 min à feu vif en remuant, jusqu’à ce qu’elle soit dorée et blanche à cœur ; salez et poivrez', minutes: 10 },
  { titre: 'Dinde rôtie', ingredients: [['Filet de dinde', 360, 'g']], etape: 'Posez la dinde dans un plat huilé, salez, poivrez et enfournez 25 min à 190 °C, jusqu’à 74 °C à cœur ; laissez reposer 5 min sous une feuille d’aluminium avant de trancher', minutes: 25, four: true },
  { titre: 'Haché de dinde en boulettes', ingredients: [['Haché de dinde 7 %', 320, 'g'], ['Œuf', 1, 'pcs']], etape: 'Mélangez le haché de dinde avec l’œuf, du sel et du poivre, formez 8 boulettes de la taille d’une noix et poêlez-les 10 min à feu moyen en les retournant régulièrement, jusqu’à ce qu’elles soient dorées de tous les côtés et cuites à cœur', minutes: 14 },
  { titre: 'Bœuf haché sauté', ingredients: [['Bœuf haché 5 %', 320, 'g']], etape: 'Faites cuire le bœuf haché à feu vif 6 min en l’émiettant à la cuillère en bois, jusqu’à ce qu’il soit bien coloré et sans jus ; salez et poivrez', minutes: 8 },
  { titre: 'Steaks hachés', ingredients: [['Steak haché', 2, 'pcs']], etape: 'Poêlez les steaks hachés 3 à 4 min par face à feu moyen-vif (à point : 3 min, bien cuit : 4 min), puis laissez-les reposer 1 min ; salez à la fin', minutes: 8 },
  { titre: 'Boulettes de bœuf', ingredients: [['Bœuf haché 5 %', 320, 'g'], ['Œuf', 1, 'pcs'], ['Persil', 0.5, 'botte']], etape: 'Mélangez le bœuf haché avec l’œuf, le persil ciselé, du sel et du poivre, formez 8 boulettes et poêlez-les 10 min à feu moyen en les retournant, jusqu’à ce qu’elles soient dorées et cuites à cœur', minutes: 14 },
  { titre: 'Pavé de saumon poêlé', ingredients: [['Pavé de saumon', 2, 'pcs']], etape: 'Poêlez les pavés de saumon 4 min côté peau à feu moyen-vif, jusqu’à ce que la peau soit croustillante, puis 2 min de l’autre côté (le cœur doit rester légèrement nacré) ; salez et poivrez', minutes: 8 },
  { titre: 'Saumon au four', ingredients: [['Pavé de saumon', 2, 'pcs']], etape: 'Posez les pavés de saumon sur une feuille de papier cuisson, salez, poivrez et enfournez 14 min à 190 °C, jusqu’à ce que la chair se détache en pétales mais reste nacrée au centre', minutes: 14, four: true },
  { titre: 'Cabillaud poêlé', ingredients: [['Filet de cabillaud', 360, 'g']], etape: 'Séchez le cabillaud, poêlez-le 3 à 4 min par face à feu moyen-vif dans un filet d’huile, jusqu’à ce que la chair soit opaque et se détache en pétales ; salez et poivrez à la fin', minutes: 9 },
  { titre: 'Cabillaud au four', ingredients: [['Filet de cabillaud', 360, 'g']], etape: 'Posez le cabillaud dans un plat huilé, salez, poivrez et enfournez 15 min à 190 °C, jusqu’à ce que la chair soit opaque et se détache facilement à la fourchette', minutes: 15, four: true },
  { titre: 'Colin poêlé', ingredients: [['Colin', 360, 'g']], etape: 'Séchez le colin, poêlez-le 3 min par face à feu moyen jusqu’à ce que la chair soit opaque et se défasse en pétales ; salez et poivrez', minutes: 8 },
  { titre: 'Crevettes sautées', ingredients: [['Crevettes', 320, 'g']], etape: 'Faites sauter les crevettes 3 à 4 min à feu vif dans une poêle bien chaude, en remuant, jusqu’à ce qu’elles soient roses et bien enroulées ; ne les cuisez pas plus pour qu’elles restent tendres', minutes: 5 },
  { titre: 'Truite poêlée', ingredients: [['Truite', 400, 'g']], etape: 'Poêlez la truite 4 min par face à feu moyen-vif, jusqu’à ce que la peau soit dorée et la chair se détache à la fourchette ; salez et poivrez', minutes: 9 },
  { titre: 'Omelette', ingredients: [['Œuf', 6, 'pcs']], etape: 'Battez les œufs vigoureusement avec du sel et du poivre, versez-les dans une poêle chaude beurrée et cuisez l’omelette à feu doux 4 min, en ramenant les bords vers le centre, jusqu’à ce qu’elle soit prise mais encore baveuse ; repliez-la', minutes: 6 },
  { titre: 'Œufs brouillés', ingredients: [['Œuf', 6, 'pcs']], etape: 'Battez les œufs avec une pincée de sel, versez-les dans une poêle beurrée à feu très doux et remuez sans cesse à la spatule 4 min, jusqu’à obtenir des œufs crémeux et à peine pris', minutes: 6 },
  { titre: 'Œufs durs', ingredients: [['Œuf', 6, 'pcs']], etape: 'Plongez les œufs dans l’eau bouillante et cuisez-les 10 min, puis passez-les 2 min sous l’eau froide pour stopper la cuisson avant de les écaler', minutes: 10 },
  { titre: 'Tofu sauté', ingredients: [['Tofu ferme', 400, 'g']], etape: 'Épongez le tofu dans un torchon, coupez-le en dés de 2 cm et faites-le dorer 8 min à la poêle à feu vif en le retournant, jusqu’à ce que toutes les faces soient dorées ; salez à la fin', minutes: 10 },
  { titre: 'Jambon de dinde poêlé', ingredients: [['Jambon de dinde', 4, 'tranche'], ['Œuf', 2, 'pcs']], etape: 'Réchauffez le jambon 2 min à la poêle et faites cuire les œufs au plat à côté', minutes: 6 },
];

interface Feculent {
  titre: string;
  ingredients: L[];
  etape: string;
  minutes: number;
}

const FECULENTS: Feculent[] = [
  { titre: 'riz complet', ingredients: [['Riz complet', 160, 'g']], etape: 'Portez 1 litre d’eau salée à ébullition, versez le riz complet et cuisez 25 min à frémissement ; égouttez-le et laissez-le sécher 2 min à couvert', minutes: 25 },
  { titre: 'riz basmati', ingredients: [['Riz basmati', 150, 'g']], etape: 'Rincez le riz basmati jusqu’à ce que l’eau soit claire, cuisez-le 11 min dans 1 litre d’eau bouillante salée, égouttez-le et laissez-le gonfler 2 min à couvert', minutes: 11 },
  { titre: 'quinoa', ingredients: [['Quinoa', 140, 'g']], etape: 'Rincez le quinoa à l’eau froide, puis cuisez-le 12 min dans deux fois son volume d’eau bouillante salée, jusqu’à ce que les petits germes se détachent ; égouttez-le et égrenez-le à la fourchette', minutes: 12 },
  { titre: 'patate douce', ingredients: [['Patate douce', 500, 'g']], etape: 'Épluchez les patates douces, coupez-les en cubes de 2 cm et cuisez-les 15 min à la vapeur ou à l’eau salée, jusqu’à ce que la pointe d’un couteau s’enfonce sans résistance', minutes: 15 },
  { titre: 'pommes de terre vapeur', ingredients: [['Pomme de terre', 500, 'g']], etape: 'Épluchez les pommes de terre, coupez-les en morceaux de 3 cm et cuisez-les 18 min à la vapeur, jusqu’à ce que la pointe d’un couteau s’enfonce sans résistance', minutes: 18 },
  { titre: 'pommes de terre sautées', ingredients: [['Pomme de terre', 500, 'g'], ['Huile d’olive', 1, 'cas']], etape: 'Épluchez les pommes de terre, coupez-les en dés de 1,5 cm et faites-les dorer 18 min à la poêle avec l’huile, à feu moyen, en les remuant toutes les 3 min, jusqu’à ce qu’elles soient dorées et fondantes', minutes: 18 },
  { titre: 'boulgour', ingredients: [['Boulgour', 140, 'g']], etape: 'Versez le boulgour dans deux fois son volume d’eau bouillante salée, couvrez et laissez gonfler 12 min hors du feu, puis égrenez-le à la fourchette', minutes: 12 },
  { titre: 'lentilles vertes', ingredients: [['Lentilles vertes', 150, 'g']], etape: 'Rincez les lentilles, cuisez-les 20 min dans trois fois leur volume d’eau non salée, jusqu’à ce qu’elles soient tendres mais intactes ; égouttez-les et salez seulement à la fin', minutes: 20 },
  { titre: 'semoule', ingredients: [['Semoule', 140, 'g']], etape: 'Versez la semoule dans un volume égal d’eau bouillante salée additionnée d’un filet d’huile, couvrez 5 min hors du feu, puis égrenez à la fourchette', minutes: 5 },
  { titre: 'pâtes complètes', ingredients: [['Pâtes complètes (penne)', 160, 'g']], etape: 'Cuisez les pâtes complètes dans 2 litres d’eau bouillante salée selon le temps indiqué sur le paquet, en les goûtant 1 min avant la fin pour qu’elles restent al dente ; égouttez-les', minutes: 11 },
  { titre: 'pain complet grillé', ingredients: [['Pain complet', 4, 'tranche']], etape: 'Faites griller les tranches de pain complet jusqu’à ce qu’elles soient dorées et croustillantes', minutes: 3 },
];

interface Legume {
  titre: string;
  ingredients: L[];
  etape: string;
  minutes: number;
}

const LEGUMES: Legume[] = [
  { titre: 'brocoli', ingredients: [['Brocoli', 300, 'g']], etape: 'Détaillez le brocoli en petits bouquets de même taille et cuisez-le 6 min à la vapeur, jusqu’à ce qu’il soit vert vif et tendre mais encore croquant', minutes: 6 },
  { titre: 'haricots verts', ingredients: [['Haricots verts', 300, 'g']], etape: 'Équeutez les haricots verts et cuisez-les 8 min à l’eau bouillante salée, jusqu’à ce qu’ils soient tendres mais encore légèrement croquants', minutes: 8 },
  { titre: 'épinards', ingredients: [['Épinards frais', 250, 'g']], etape: 'Faites tomber les épinards 3 min à la poêle avec une noix de beurre', minutes: 3 },
  { titre: 'courgettes', ingredients: [['Courgette', 2, 'pcs']], etape: 'Coupez les courgettes en rondelles et faites-les sauter 8 min à la poêle', minutes: 8 },
  { titre: 'carottes', ingredients: [['Carotte', 3, 'pcs']], etape: 'Épluchez les carottes, coupez-les en rondelles de 5 mm et cuisez-les 12 min à la vapeur, jusqu’à ce qu’elles soient tendres', minutes: 12 },
  { titre: 'poivrons', ingredients: [['Poivron rouge', 2, 'pcs']], etape: 'Épépinez les poivrons, coupez-les en lanières de 1 cm et faites-les revenir 10 min à feu moyen dans un filet d’huile, jusqu’à ce qu’ils soient souples et légèrement dorés', minutes: 10 },
  { titre: 'champignons', ingredients: [['Champignons de Paris', 250, 'g']], etape: 'Essuyez les champignons (sans les laver), émincez-les et faites-les sauter 6 min à feu vif sans les remuer trop tôt, jusqu’à ce qu’ils soient dorés et aient rendu leur eau', minutes: 6 },
  { titre: 'tomates provençales', ingredients: [['Tomate', 3, 'pcs'], ['Ail', 1, 'pcs']], etape: 'Coupez les tomates en deux, parsemez d’ail haché et faites-les cuire 10 min à la poêle à feu doux', minutes: 10 },
  { titre: 'chou-fleur', ingredients: [['Chou-fleur', 1, 'pcs']], etape: 'Détaillez le chou-fleur en bouquets et cuisez-les 10 min à la vapeur', minutes: 10 },
  { titre: 'aubergine', ingredients: [['Aubergine', 1, 'pcs']], etape: 'Coupez l’aubergine en dés et faites-la dorer 10 min à la poêle', minutes: 10 },
  { titre: 'poireaux', ingredients: [['Poireau', 3, 'pcs']], etape: 'Émincez les poireaux et faites-les fondre 10 min dans une poêle avec un peu d’eau', minutes: 10 },
  { titre: 'asperges vertes', ingredients: [['Asperge verte', 300, 'g']], etape: 'Cuisez les asperges vertes 6 min à l’eau bouillante salée', minutes: 6 },
  { titre: 'endives braisées', ingredients: [['Endive', 3, 'pcs']], etape: 'Coupez les endives en deux et faites-les braiser 12 min à la poêle couverte', minutes: 12 },
  { titre: 'salade verte', ingredients: [['Salade verte', 1, 'pcs']], etape: 'Lavez et essorez la salade verte', minutes: 3 },
];

interface Sauce {
  titre: string;
  ingredients: L[];
  etape: string;
}

const SAUCES: Sauce[] = [
  { titre: 'à la moutarde', ingredients: [['Moutarde', 1, 'cas'], ['Fromage blanc', 80, 'g']], etape: 'Mélangez la moutarde et le fromage blanc avec du sel et du poivre pour une sauce légère' },
  { titre: 'citron-thym', ingredients: [['Citron', 1, 'pcs'], ['Thym', 2, 'g']], etape: 'Arrosez du jus de citron et parsemez de thym effeuillé' },
  { titre: 'aux herbes de Provence', ingredients: [['Herbes de Provence', 2, 'g'], ['Ail', 1, 'pcs']], etape: 'Parfumez avec l’ail écrasé et les herbes de Provence' },
  { titre: 'ail-persil', ingredients: [['Ail', 2, 'pcs'], ['Persil', 0.5, 'botte']], etape: 'Terminez avec l’ail et le persil hachés, ajoutés en fin de cuisson' },
  { titre: 'sauce au fromage blanc et ciboulette', ingredients: [['Fromage blanc', 100, 'g'], ['Ciboulette', 0.5, 'botte']], etape: 'Mélangez le fromage blanc et la ciboulette ciselée, salez et poivrez pour accompagner' },
  { titre: 'à la tomate', ingredients: [['Tomate', 2, 'pcs'], ['Oignon', 1, 'pcs']], etape: 'Faites compoter l’oignon et les tomates en dés 10 min avec du sel et du poivre pour napper' },
  { titre: 'au vin blanc et à l’échalote', ingredients: [['Échalote', 2, 'pcs'], ['Vin blanc', 80, 'ml']], etape: 'Déglacez avec le vin blanc et les échalotes ciselées, laissez réduire 3 min' },
  { titre: 'miel-moutarde', ingredients: [['Miel', 1, 'cas'], ['Moutarde à l’ancienne', 1, 'cas']], etape: 'Mélangez le miel et la moutarde à l’ancienne, nappez en fin de cuisson' },
  { titre: 'au paprika fumé', ingredients: [['Paprika fumé', 1, 'cac'], ['Ail', 1, 'pcs']], etape: 'Saupoudrez de paprika fumé et d’ail écrasé dès le début de cuisson' },
  { titre: 'à la crème légère', ingredients: [['Crème fraîche', 60, 'g'], ['Échalote', 1, 'pcs']], etape: 'Ajoutez l’échalote ciselée puis la crème, laissez épaissir 2 min' },
];

/** Générateur pseudo-aléatoire déterministe (mulberry32) : même lot à chaque exécution. */
function aleatoire(graine: number) {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Un plat du lot : tous les choix sont des indices dans les tables ci-dessus. */
function composer(p: Proteine, f: Feculent, l: Legume, s: Sauce): RecetteSaisie {
  const poissonOuViande = p.titre;
  const titre = `${poissonOuViande} ${s.titre}, ${f.titre} et ${l.titre}`;
  const cuisson = Math.max(p.minutes, f.minutes, l.minutes) + 4;
  const four = Boolean(p.four);
  // Les légumes se préparent pendant que le féculent cuit : l'ordre des étapes suit le temps
  const etapes = [
    `${f.etape}.`,
    `${l.etape}.`,
    `${p.etape}.`,
    `${s.etape}.`,
    'Dressez le féculent et le légume dans deux assiettes, posez la protéine dessus et servez chaud.',
  ];
  return {
    titre, type: 'plat', cuisine: 'Française', prep: 10, cuisson, difficulte: 'facile', portions: 2, conservation: 2,
    ustensiles: four ? ['Four', 'Casserole'] : ['Poêle', 'Casserole'],
    ingredients: [...p.ingredients, ...f.ingredients, ...l.ingredients, ...s.ingredients, ['Huile d’olive', 1, 'cas']],
    etapes,
  };
}

/** Combinaisons évidemment absurdes (ex. omelette + œufs durs dans le même plat) écartées. */
function coherent(p: Proteine, f: Feculent, l: Legume, s: Sauce): boolean {
  // Pas de sauce lourde avec des œufs durs ; pas de pain avec une sauce à la tomate ; pas de salade crue avec un féculent chaud en cuisson four
  if (p.titre === 'Œufs durs' && s.titre === 'à la crème légère') return false;
  if (f.titre === 'pain complet grillé' && (s.titre === 'à la tomate' || l.titre === 'salade verte')) return false;
  if (l.titre === 'tomates provençales' && s.titre === 'à la tomate') return false;
  if (l.titre === 'salade verte' && f.titre === 'lentilles vertes') return false;
  return true;
}

/** Jusqu'à `n` recettes sportives, mélangées de façon déterministe. */
export function genererSportives(n = 760): RecetteSaisie[] {
  const rng = aleatoire(20261008);
  const toutes: RecetteSaisie[] = [];
  for (const p of PROTEINES) for (const f of FECULENTS) for (const l of LEGUMES) for (const s of SAUCES) {
    if (coherent(p, f, l, s)) toutes.push(composer(p, f, l, s));
  }
  // Mélange de Fisher-Yates, puis on prend les n premières
  for (let i = toutes.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [toutes[i], toutes[j]] = [toutes[j], toutes[i]];
  }
  return toutes.slice(0, n);
}
