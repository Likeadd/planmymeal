// ============================================================================
// Gratins, quiches, tartes, cakes salés, papillotes, moules, mijotés, soupes,
// entrées, desserts et collations. Mêmes principes que complementaires-plats.ts :
// briques combinées, chaque brique apporte ses ingrédients et son geste.
// ============================================================================

import type { RecetteSaisie } from './recettes-proteinees';
import { BASES, combiner, recette, avecArticle, de, type Base, type L } from './complementaires-briques';

interface Veg { t: string; nom: string; i: L[]; x: string; cuis: number }
const veg = (t: string, nom: string, i: L[], x: string, cuis: number): Veg => ({ t, nom, i, x, cuis });

// ─── A. Gratins, quiches, tartes fines, cakes salés, clafoutis salés ────────

const VEG_FOUR: Veg[] = [
  veg('courgettes', 'courgettes', [['Courgette', 450, 'g']], 'Coupez les courgettes en rondelles de 5 mm et faites-les revenir 5 min dans une poêle pour évaporer leur eau', 5),
  veg('chou-fleur', 'chou-fleur', [['Chou-fleur', 500, 'g']], 'Détaillez le chou-fleur en bouquets et faites-les cuire 8 min à l’eau bouillante salée, égouttez-les bien', 8),
  veg('brocoli', 'brocoli', [['Brocoli', 450, 'g']], 'Détaillez le brocoli en bouquets et faites-les cuire 5 min à l’eau bouillante salée, égouttez-les bien', 5),
  veg('poireaux', 'poireaux', [['Poireau', 450, 'g']], 'Lavez les poireaux, coupez-les en rondelles de 1 cm et faites-les fondre 8 min à la poêle avec un peu d’eau', 8),
  veg('endives', 'endives', [['Endive', 500, 'g']], 'Coupez les endives en deux et faites-les braiser 10 min à la poêle avec un filet d’huile et 3 cuillères à soupe d’eau, à couvert', 10),
  veg('épinards', 'épinards', [['Épinards frais', 400, 'g']], 'Faites tomber les épinards 3 min à la poêle, puis pressez-les pour retirer l’eau et hachez-les grossièrement', 3),
  veg('aubergines', 'aubergines', [['Aubergine', 450, 'g']], 'Coupez les aubergines en rondelles et faites-les dorer 4 min par face à la poêle avec un filet d’huile', 8),
  veg('butternut', 'butternut', [['Courge butternut', 500, 'g']], 'Épluchez la courge butternut, coupez-la en cubes et faites-la cuire 12 min à la vapeur ou à l’eau bouillante', 12),
  veg('carottes', 'carottes', [['Carotte', 450, 'g']], 'Coupez les carottes en rondelles et faites-les cuire 10 min à l’eau bouillante salée', 10),
  veg('champignons', 'champignons', [['Champignons de Paris', 400, 'g']], 'Émincez les champignons et faites-les sauter 6 min à feu vif jusqu’à évaporation de l’eau', 6),
  veg('blettes', 'blettes', [['Blette', 450, 'g']], 'Séparez les feuilles des côtes de blettes, coupez-les en tronçons et faites-les cuire 6 min à l’eau bouillante salée, égouttez-les', 6),
  veg('fenouil', 'fenouil', [['Fenouil', 450, 'g']], 'Coupez le fenouil en lamelles et faites-le cuire 8 min à l’eau bouillante salée, égouttez-le', 8),
  veg('haricots verts', 'haricots verts', [['Haricots verts', 400, 'g']], 'Équeutez les haricots verts et faites-les cuire 8 min à l’eau bouillante salée, égouttez-les', 8),
  veg('poivrons', 'poivrons', [['Poivron rouge', 200, 'g'], ['Poivron jaune', 200, 'g']], 'Coupez les poivrons en lanières et faites-les revenir 8 min à la poêle', 8),
  veg('potiron', 'potiron', [['Potiron', 500, 'g']], 'Épluchez le potiron, coupez-le en dés et faites-les cuire 12 min à l’eau bouillante, égouttez-les', 12),
  veg('tomates', 'tomates', [['Tomate', 500, 'g']], 'Coupez les tomates en rondelles et laissez-les dégorger 10 min sur du papier absorbant', 2),
];

interface Garn2 { t: string; i: L[]; x: string; vege?: boolean }
const GARN_FOUR: Garn2[] = [
  { t: 'au jambon blanc', i: [['Jambon blanc', 150, 'g']], x: 'Coupez le jambon en lanières' },
  { t: 'aux lardons', i: [['Lardons', 120, 'g']], x: 'Faites dorer les lardons 4 min dans une poêle sans matière grasse et égouttez-les' },
  { t: 'au poulet', i: [['Blanc de poulet cuit', 200, 'g']], x: 'Effilochez le poulet cuit' },
  { t: 'au thon', i: [['Thon au naturel', 160, 'g']], x: 'Égouttez et émiettez le thon' },
  { t: 'au saumon fumé', i: [['Saumon fumé', 120, 'g']], x: 'Coupez le saumon fumé en lanières' },
  { t: 'au chorizo', i: [['Chorizo', 80, 'g']], x: 'Coupez le chorizo en fines rondelles' },
  { t: 'au chèvre', i: [['Chèvre frais', 150, 'g']], x: 'Émiettez le chèvre frais', vege: true },
  { t: 'à la mozzarella', i: [['Mozzarella', 150, 'g']], x: 'Coupez la mozzarella en dés', vege: true },
  { t: 'à la feta', i: [['Feta', 130, 'g']], x: 'Émiettez la feta', vege: true },
  { t: 'au jambon de dinde', i: [['Jambon de dinde', 150, 'g']], x: 'Coupez le jambon de dinde en dés' },
  { t: 'aux crevettes', i: [['Crevettes', 200, 'g']], x: 'Décortiquez les crevettes et coupez-les en deux' },
  { t: 'aux haricots blancs', i: [['Haricots blancs (bte)', 240, 'g']], x: 'Rincez et égouttez les haricots blancs', vege: true },
  { t: 'au bœuf haché', i: [['Bœuf haché 5 %', 250, 'g']], x: 'Faites revenir le bœuf haché 5 min à feu vif en l’émiettant, salez et poivrez' },
];

const FROMAGES: [string, number][] = [['Emmental', 60], ['Gruyère râpé', 60], ['Comté', 60], ['Fromage râpé', 60], ['Parmesan', 30], ['Cheddar', 60]];

const LIAISONS: { t: string; i: L[]; x: string }[] = [
  { t: 'béchamel', i: [['Beurre', 20, 'g'], ['Farine', 25, 'g'], ['Lait', 300, 'ml']], x: 'Préparez une béchamel : faites fondre le beurre, ajoutez la farine, remuez 1 min, puis versez le lait peu à peu en fouettant et laissez épaissir 5 min ; salez, poivrez et ajoutez une pincée de noix de muscade' },
  { t: 'crème et œuf', i: [['Crème liquide', 150, 'ml'], ['Œuf', 2, 'pcs']], x: 'Battez la crème liquide avec les œufs, du sel et du poivre' },
  { t: 'fromage blanc et œuf', i: [['Fromage blanc', 200, 'g'], ['Œuf', 2, 'pcs']], x: 'Battez le fromage blanc avec les œufs, du sel et du poivre' },
];

export function gratins(n: number): RecetteSaisie[] {
  return combiner<[Veg, Garn2, [string, number], (typeof LIAISONS)[number]]>([VEG_FOUR, GARN_FOUR, FROMAGES, LIAISONS], n, 201).map(([v, g, f, l]) =>
    recette('plat', `Gratin ${de(v.t)} ${g.t} et ${f[0].toLowerCase().replace(' râpé', '')}`, 20, 30 + v.cuis,
      [...v.i, ...g.i, [f[0], f[1], 'g'], ...l.i],
      ['Préchauffez le four à 200 °C et beurrez un plat à gratin.', `${v.x}.`, `${g.x}.`, `${l.x}.`,
        `Disposez les légumes et la garniture dans le plat, nappez de la préparation, parsemez de ${f[0].toLowerCase()} et enfournez 25 à 30 min, jusqu’à ce que le dessus soit bien doré et que la lame d’un couteau ressorte chaude.`,
        'Laissez reposer 5 min avant de découper.'],
      ['Four', 'Plat à gratin'], 'Française', 3));
}

export function quiches(n: number): RecetteSaisie[] {
  return combiner<[Veg, Garn2, [string, number]]>([VEG_FOUR, GARN_FOUR, FROMAGES], n, 202).map(([v, g, f]) =>
    recette('plat', `Quiche ${de(v.t)} ${g.t}`, 25, 40,
      [['Pâte brisée', 230, 'g'], ...v.i.map(([nom, q, u]) => [nom, Math.round(q * 0.7), u] as L), ...g.i, [f[0], f[1], 'g'], ['Œuf', 3, 'pcs'], ['Crème liquide', 150, 'ml'], ['Lait', 100, 'ml']],
      ['Préchauffez le four à 180 °C. Étalez la pâte brisée dans un moule à tarte, piquez le fond à la fourchette et enfournez 10 min à blanc.', `${v.x}.`, `${g.x}.`,
        'Battez les œufs avec la crème liquide et le lait, salez, poivrez et ajoutez une pincée de noix de muscade.',
        `Répartissez les légumes et la garniture sur le fond de tarte, parsemez de ${f[0].toLowerCase()}, versez l’appareil.`,
        'Enfournez 30 min : la quiche doit être dorée et légèrement gonflée, sans trace liquide au centre.'],
      ['Four', 'Moule à tarte'], 'Française', 3));
}

export function tartesFines(n: number): RecetteSaisie[] {
  return combiner<[Veg, Garn2, [string, number]]>([VEG_FOUR.filter(v => v.t !== 'chou-fleur'), GARN_FOUR, FROMAGES], n, 203).map(([v, g, f]) =>
    recette('plat', `Tarte fine ${de(v.t)} ${g.t}`, 20, 25,
      [['Pâte feuilletée', 230, 'g'], ...v.i.map(([nom, q, u]) => [nom, Math.round(q * 0.6), u] as L), ...g.i, [f[0], f[1], 'g'], ['Fromage frais', 100, 'g'], ['Moutarde', 15, 'g']],
      ['Préchauffez le four à 200 °C. Déroulez la pâte feuilletée sur sa feuille de papier cuisson et piquez-la à la fourchette en laissant 2 cm de bord.',
        `${v.x}.`, `${g.x}.`,
        'Étalez le fromage frais mélangé à la moutarde sur la pâte, en gardant les bords libres.',
        `Répartissez les légumes et la garniture, parsemez de ${f[0].toLowerCase()} et enfournez 22 à 25 min, jusqu’à ce que les bords soient gonflés et dorés.`],
      ['Four', 'Papier cuisson'], 'Française', 2));
}

export function cakesSales(n: number): RecetteSaisie[] {
  return combiner<[Veg, Garn2, [string, number]]>([VEG_FOUR.filter(v => ['courgettes', 'poivrons', 'champignons', 'épinards', 'carottes', 'brocoli', 'tomates', 'aubergines', 'potiron'].includes(v.t)), GARN_FOUR, FROMAGES], n, 204).map(([v, g, f]) =>
    recette('plat', `Cake salé ${v.t} ${g.t}`, 20, 40,
      [['Farine', 150, 'g'], ['Levure chimique', 8, 'g'], ['Œuf', 3, 'pcs'], ['Lait', 100, 'ml'], ['Huile d’olive', 50, 'ml'], ...v.i.map(([nom, q, u]) => [nom, Math.round(q * 0.5), u] as L), ...g.i, [f[0], f[1] + 20, 'g']],
      ['Préchauffez le four à 180 °C et chemisez un moule à cake de papier cuisson.', `${v.x}.`, `${g.x}.`,
        'Mélangez la farine et la levure. Ajoutez les œufs battus, le lait et l’huile d’olive, puis mélangez jusqu’à obtenir une pâte lisse ; salez, poivrez.',
        'Incorporez les légumes, la garniture et le fromage, versez dans le moule.',
        'Enfournez 40 min : un couteau planté au centre doit ressortir sec. Laissez tiédir 10 min avant de démouler.'],
      ['Four', 'Moule à cake', 'Saladier'], 'Française', 3));
}

// ─── B. Papillotes et moules ─────────────────────────────────────────────────

interface Poisson { t: string; i: L[]; ep: number }
const POISSONS: Poisson[] = [
  { t: 'cabillaud', i: [['Filet de cabillaud', 320, 'g']], ep: 15 }, { t: 'saumon', i: [['Pavé de saumon', 300, 'g']], ep: 14 },
  { t: 'colin', i: [['Colin', 320, 'g']], ep: 15 }, { t: 'dorade', i: [['Filet de dorade', 300, 'g']], ep: 14 },
  { t: 'truite', i: [['Truite', 300, 'g']], ep: 14 }, { t: 'merlan', i: [['Merlan', 320, 'g']], ep: 14 },
  { t: 'bar', i: [['Bar (poisson)', 300, 'g']], ep: 14 }, { t: 'tilapia', i: [['Filet de tilapia', 320, 'g']], ep: 13 },
  { t: 'crevettes', i: [['Crevettes', 280, 'g']], ep: 12 }, { t: 'gambas', i: [['Gambas', 280, 'g']], ep: 12 },
];

const LEG_PAP: { t: string; i: L[]; x: string }[] = [
  { t: 'courgettes et tomates cerises', i: [['Courgette', 250, 'g'], ['Tomates cerises', 150, 'g']], x: 'Coupez les courgettes en fines rondelles et les tomates cerises en deux' },
  { t: 'carottes et poireau', i: [['Carotte', 200, 'g'], ['Poireau', 200, 'g']], x: 'Coupez les carottes en fins bâtonnets et le poireau en fines rondelles' },
  { t: 'fenouil et citron', i: [['Fenouil', 300, 'g'], ['Citron', 1, 'pcs']], x: 'Émincez finement le fenouil et coupez le citron en rondelles' },
  { t: 'poivron et oignon rouge', i: [['Poivron rouge', 200, 'g'], ['Oignon rouge', 1, 'pcs']], x: 'Coupez le poivron en fines lanières et l’oignon rouge en lamelles' },
  { t: 'asperges et citron', i: [['Asperge verte', 250, 'g'], ['Citron', 1, 'pcs']], x: 'Cassez le pied des asperges et coupez le citron en rondelles' },
  { t: 'champignons et épinards', i: [['Champignons de Paris', 200, 'g'], ['Épinards frais', 100, 'g']], x: 'Émincez les champignons et rincez les épinards' },
  { t: 'haricots verts et tomates', i: [['Haricots verts', 250, 'g'], ['Tomate', 2, 'pcs']], x: 'Équeutez les haricots verts (précuits 5 min à l’eau bouillante) et coupez les tomates en rondelles' },
  { t: 'brocoli et carottes', i: [['Brocoli', 250, 'g'], ['Carotte', 150, 'g']], x: 'Détaillez le brocoli en petits bouquets et coupez les carottes en fines rondelles' },
  { t: 'pak choï et gingembre', i: [['Chou pak choï', 250, 'g'], ['Gingembre', 10, 'g']], x: 'Coupez le pak choï en lanières et râpez le gingembre' },
];

const AROMATES: { t: string; c: string; i: L[]; x: string }[] = [
  { t: 'citron-aneth', c: 'Française', i: [['Citron', 0.5, 'pcs'], ['Aneth', 8, 'g'], ['Huile d’olive', 20, 'ml']], x: 'le jus du demi-citron, l’aneth ciselé et l’huile d’olive' },
  { t: 'ail-persil', c: 'Française', i: [['Ail', 2, 'pcs'], ['Persil', 10, 'g'], ['Huile d’olive', 20, 'ml']], x: 'l’ail haché, le persil ciselé et l’huile d’olive' },
  { t: 'soja-gingembre', c: 'Asiatique', i: [['Sauce soja', 25, 'ml'], ['Gingembre', 8, 'g'], ['Huile de sésame', 10, 'ml']], x: 'la sauce soja, le gingembre râpé et l’huile de sésame' },
  { t: 'curry-coco', c: 'Indienne', i: [['Curry en poudre', 1, 'cac'], ['Lait de coco léger', 80, 'ml']], x: 'le curry délayé dans le lait de coco' },
  { t: 'tomate-basilic', c: 'Italienne', i: [['Tomate concassée (bte)', 150, 'g'], ['Basilic', 8, 'g'], ['Huile d’olive', 15, 'ml']], x: 'la tomate concassée, le basilic ciselé et l’huile d’olive' },
  { t: 'thym-vin blanc', c: 'Française', i: [['Thym', 2, 'g'], ['Vin blanc', 60, 'ml'], ['Huile d’olive', 15, 'ml']], x: 'le thym, le vin blanc et l’huile d’olive' },
  { t: 'pesto', c: 'Italienne', i: [['Pesto', 40, 'g']], x: 'le pesto délayé avec 2 cuillères à soupe d’eau' },
  { t: 'miso-citron vert', c: 'Japonaise', i: [['Miso', 20, 'g'], ['Citron vert', 1, 'pcs']], x: 'le miso délayé dans le jus du citron vert' },
];

const ACCOMP: Base[] = BASES.filter(b => ['riz basmati', 'riz jasmin', 'semoule', 'quinoa', 'boulgour', 'pommes de terre vapeur', 'millet', 'épeautre'].includes(b.t));

const AVEC: Record<string, string> = {
  'courgettes et tomates cerises': 'aux courgettes et tomates cerises', 'carottes et poireau': 'aux carottes et au poireau',
  'fenouil et citron': 'au fenouil et au citron', 'poivron et oignon rouge': 'au poivron et à l’oignon rouge',
  'asperges et citron': 'aux asperges et au citron', 'champignons et épinards': 'aux champignons et aux épinards',
  'haricots verts et tomates': 'aux haricots verts et aux tomates', 'brocoli et carottes': 'au brocoli et aux carottes',
  'pak choï et gingembre': 'au pak choï et au gingembre',
};

export function papillotes(n: number): RecetteSaisie[] {
  return combiner<[Poisson, (typeof LEG_PAP)[number], (typeof AROMATES)[number], Base]>([POISSONS, LEG_PAP, AROMATES, ACCOMP], n, 205).map(([p, v, a, b]) =>
    recette('plat', `Papillotes de ${p.t} ${AVEC[v.t]}, sauce ${a.t} et ${b.t}`,
      12 + b.prep, Math.max(p.ep, b.cuis),
      [...b.i, ...p.i, ...v.i, ...a.i],
      [`Préchauffez le four à 200 °C. ${b.x}.`, `${v.x}.`,
        'Découpez deux grandes feuilles de papier cuisson (35 cm de côté) et déposez au centre de chacune la moitié des légumes.',
        `Posez le poisson par-dessus, salez, poivrez et ajoutez ${a.x}.`,
        'Refermez hermétiquement chaque papillote en repliant les bords sur eux-mêmes, et posez-les sur une plaque.',
        `Enfournez ${p.ep} min : le poisson doit être opaque et s’effeuiller facilement ; ouvrez prudemment, la vapeur est brûlante.`,
        `Servez les papillotes ouvertes sur ${avecArticle(b.t)}.`],
      ['Four', 'Papier cuisson', 'Plaque', 'Casserole'], a.c, 1));
}

const MOULES: { t: string; c: string; i: L[]; x: string }[] = [
  { t: 'marinière', c: 'Française', i: [['Vin blanc', 150, 'ml'], ['Échalote', 2, 'pcs'], ['Persil', 10, 'g'], ['Beurre', 20, 'g']], x: 'Faites fondre le beurre, faites suer les échalotes ciselées 2 min, versez le vin blanc' },
  { t: 'à la crème', c: 'Française', i: [['Vin blanc', 100, 'ml'], ['Échalote', 2, 'pcs'], ['Crème liquide', 100, 'ml'], ['Persil', 10, 'g']], x: 'Faites suer les échalotes ciselées 2 min dans une noix de beurre, versez le vin blanc ; la crème sera ajoutée à la fin' },
  { t: 'au curry', c: 'Indienne', i: [['Curry en poudre', 2, 'cac'], ['Crème liquide', 100, 'ml'], ['Échalote', 2, 'pcs'], ['Vin blanc', 100, 'ml']], x: 'Faites suer les échalotes 2 min, ajoutez le curry 30 secondes puis versez le vin blanc ; la crème sera ajoutée à la fin' },
  { t: 'à la tomate et au basilic', c: 'Italienne', i: [['Tomate concassée (bte)', 200, 'g'], ['Basilic', 10, 'g'], ['Ail', 2, 'pcs'], ['Vin blanc', 80, 'ml']], x: 'Faites suer l’ail haché 1 min dans un filet d’huile, versez le vin blanc puis la tomate concassée' },
  { t: 'au chorizo', c: 'Espagnole', i: [['Chorizo', 80, 'g'], ['Vin blanc', 100, 'ml'], ['Échalote', 2, 'pcs'], ['Paprika fumé', 1, 'cac']], x: 'Faites dorer le chorizo en rondelles 2 min, ajoutez les échalotes et le paprika, versez le vin blanc' },
  { t: 'au lait de coco-citron vert', c: 'Thaïlandaise', i: [['Lait de coco léger', 150, 'ml'], ['Citron vert', 1, 'pcs'], ['Gingembre', 8, 'g'], ['Coriandre fraîche', 8, 'g']], x: 'Faites chauffer le lait de coco avec le gingembre râpé' },
  { t: 'au pesto', c: 'Italienne', i: [['Pesto', 40, 'g'], ['Vin blanc', 100, 'ml'], ['Échalote', 2, 'pcs']], x: 'Faites suer les échalotes ciselées 2 min, versez le vin blanc ; le pesto sera délayé dans le jus à la fin' },
  { t: 'à l’ail et au persil', c: 'Française', i: [['Ail', 3, 'pcs'], ['Persil', 15, 'g'], ['Vin blanc', 120, 'ml'], ['Beurre', 20, 'g']], x: 'Faites fondre le beurre, ajoutez l’ail haché 1 min, versez le vin blanc' },
];

const ACC_MOULES: { t: string; i: L[]; x: string; cuis: number }[] = [
  { t: 'frites au four', i: [['Frites surgelées', 300, 'g']], x: 'Enfournez les frites 20 min à 220 °C sur une plaque, en les retournant à mi-cuisson', cuis: 22 },
  { t: 'riz basmati', i: [['Riz basmati', 150, 'g']], x: 'Faites cuire le riz basmati 12 min dans l’eau bouillante salée et égouttez-le', cuis: 12 },
  { t: 'pain de campagne', i: [['Pain de campagne', 4, 'tranche']], x: 'Faites griller les tranches de pain de campagne', cuis: 3 },
  { t: 'pommes de terre vapeur', i: [['Pomme de terre', 500, 'g']], x: 'Faites cuire les pommes de terre coupées en morceaux 18 min à la vapeur', cuis: 18 },
];

export function moules(): RecetteSaisie[] {
  return combiner<[(typeof MOULES)[number], (typeof ACC_MOULES)[number]]>([MOULES, ACC_MOULES], 40, 206).map(([m, a]) =>
    recette('plat', `Moules ${m.t} et ${a.t}`, 15, Math.max(a.cuis, 12),
      [['Moules', 1000, 'g'], ...m.i, ...a.i],
      ['Grattez les moules, retirez les barbes et rincez-les ; jetez celles qui restent ouvertes après un petit coup sec.', `${a.x}.`, `${m.x}.`,
        'Ajoutez les moules, couvrez et laissez cuire 5 à 6 min à feu vif en secouant la casserole à mi-cuisson, jusqu’à ce que toutes les coquilles soient ouvertes (jetez celles qui restent fermées).',
        'Hors du feu, incorporez la crème, le pesto ou le lait de coco si la recette en prévoit, et parsemez d’herbes fraîches. Servez dans de grandes assiettes creuses avec le jus de cuisson.'],
      ['Faitout', 'Four'], m.c, 1));
}

// ─── C. Mijotés ──────────────────────────────────────────────────────────────

interface Viande { t: string; a: string; i: L[]; min: number; x: string }
const VIANDES: Viande[] = [
  { t: 'Bœuf braisé', a: 'au bœuf', i: [['Bœuf à braiser', 500, 'g']], min: 100, x: 'Coupez le bœuf en cubes de 4 cm, salez et poivrez' },
  { t: 'Sauté de veau', a: 'au veau', i: [['Veau (épaule)', 500, 'g']], min: 75, x: 'Coupez le veau en cubes de 4 cm, salez et poivrez' },
  { t: 'Ragoût d’agneau', a: 'à l’agneau', i: [['Épaule d’agneau', 500, 'g']], min: 80, x: 'Coupez l’agneau en cubes de 4 cm, salez et poivrez' },
  { t: 'Sauté de porc', a: 'au porc', i: [['Échine de porc', 500, 'g']], min: 55, x: 'Coupez l’échine de porc en cubes de 4 cm, salez et poivrez' },
  { t: 'Poulet mijoté', a: 'au poulet', i: [['Cuisses de poulet sans peau', 650, 'g']], min: 40, x: 'Séparez les cuisses de poulet en deux au niveau de l’articulation, salez et poivrez' },
  { t: 'Saucisses mijotées', a: 'aux saucisses', i: [['Saucisse de Toulouse', 450, 'g']], min: 30, x: 'Piquez les saucisses' },
  { t: 'Chili de bœuf', a: 'au bœuf haché', i: [['Viande hachée (bœuf)', 400, 'g'], ['Haricots rouges (bte)', 240, 'g']], min: 40, x: 'Salez et poivrez la viande hachée' },
  { t: 'Chili de dinde', a: 'à la dinde hachée', i: [['Haché de dinde 7 %', 400, 'g'], ['Haricots rouges (bte)', 240, 'g']], min: 35, x: 'Salez et poivrez le haché de dinde' },
];

interface Liquide { t: string; c: string; i: L[]; x: string }
const LIQUIDES: Liquide[] = [
  { t: 'au vin rouge', c: 'Française', i: [['Vin rouge', 200, 'ml'], ['Bouillon de bœuf', 250, 'ml'], ['Concentré de tomate', 20, 'g'], ['Thym', 2, 'g']], x: 'déglacez avec le vin rouge, laissez réduire 2 min, ajoutez le bouillon de bœuf, le concentré de tomate et le thym' },
  { t: 'à la tomate', c: 'Italienne', i: [['Tomate concassée (bte)', 400, 'g'], ['Ail', 2, 'pcs'], ['Origan', 2, 'g']], x: 'ajoutez la tomate concassée, l’ail écrasé et l’origan, avec un demi-verre d’eau' },
  { t: 'à la moutarde', c: 'Française', i: [['Vin blanc', 150, 'ml'], ['Moutarde à l’ancienne', 30, 'g'], ['Crème fraîche', 100, 'g']], x: 'déglacez avec le vin blanc, ajoutez la moutarde à l’ancienne et un demi-verre d’eau ; la crème sera ajoutée en fin de cuisson' },
  { t: 'au curry et au lait de coco', c: 'Indienne', i: [['Curry Madras', 2, 'cac'], ['Lait de coco', 300, 'ml'], ['Gingembre', 10, 'g']], x: 'ajoutez le curry et le gingembre râpé, faites revenir 1 min, puis versez le lait de coco' },
  { t: 'au paprika', c: 'Hongroise', i: [['Paprika', 2, 'cac'], ['Tomate concassée (bte)', 300, 'g'], ['Crème fraîche', 80, 'g']], x: 'ajoutez le paprika, faites-le revenir 30 secondes, puis versez la tomate concassée et un demi-verre d’eau ; la crème sera ajoutée en fin de cuisson' },
  { t: 'aux olives et au citron', c: 'Marocaine', i: [['Olives vertes', 80, 'g'], ['Citron', 1, 'pcs'], ['Ras-el-hanout', 6, 'g'], ['Bouillon de volaille', 300, 'ml']], x: 'ajoutez le ras-el-hanout, les olives, le citron coupé en quartiers et le bouillon de volaille' },
  { t: 'à la harissa', c: 'Marocaine', i: [['Harissa', 20, 'g'], ['Tomate concassée (bte)', 300, 'g'], ['Cumin', 1, 'cac']], x: 'ajoutez la harissa et le cumin, puis versez la tomate concassée et un demi-verre d’eau' },
  { t: 'au vin blanc et aux champignons', c: 'Française', i: [['Vin blanc', 200, 'ml'], ['Champignons de Paris', 250, 'g'], ['Crème liquide', 100, 'ml']], x: 'déglacez avec le vin blanc et laissez réduire 2 min ; ajoutez les champignons émincés, la crème sera ajoutée en fin de cuisson' },
];

const LEG_MIJOTE: { t: string; i: L[]; x: string; ajout: number }[] = [
  { t: 'carottes', i: [['Carotte', 300, 'g']], x: 'Épluchez les carottes et coupez-les en rondelles épaisses', ajout: 30 },
  { t: 'pommes de terre', i: [['Pomme de terre', 450, 'g']], x: 'Épluchez les pommes de terre et coupez-les en gros cubes', ajout: 30 },
  { t: 'champignons', i: [['Champignons de Paris', 250, 'g']], x: 'Essuyez les champignons et coupez-les en quartiers', ajout: 20 },
  { t: 'poivrons', i: [['Poivron rouge', 150, 'g'], ['Poivron jaune', 150, 'g']], x: 'Coupez les poivrons en larges lanières', ajout: 25 },
  { t: 'courgettes', i: [['Courgette', 350, 'g']], x: 'Coupez les courgettes en gros tronçons', ajout: 15 },
  { t: 'navets', i: [['Navet', 300, 'g']], x: 'Épluchez les navets et coupez-les en quartiers', ajout: 25 },
  { t: 'céleri branche', i: [['Céleri branche', 200, 'g'], ['Carotte', 150, 'g']], x: 'Coupez le céleri et les carottes en tronçons', ajout: 25 },
  { t: 'poireaux', i: [['Poireau', 300, 'g']], x: 'Lavez les poireaux et coupez-les en tronçons de 3 cm', ajout: 20 },
  { t: 'butternut', i: [['Courge butternut', 350, 'g']], x: 'Épluchez la courge butternut et coupez-la en cubes de 3 cm', ajout: 20 },
  { t: 'patates douces', i: [['Patate douce', 350, 'g']], x: 'Épluchez la patate douce et coupez-la en cubes de 3 cm', ajout: 20 },
  { t: 'haricots verts', i: [['Haricots verts', 300, 'g']], x: 'Équeutez les haricots verts', ajout: 15 },
  { t: 'petits pois', i: [['Petit pois (surg.)', 250, 'g']], x: 'Gardez les petits pois surgelés', ajout: 10 },
  { t: 'aubergines', i: [['Aubergine', 300, 'g']], x: 'Coupez les aubergines en cubes de 3 cm', ajout: 20 },
  { t: 'fenouil', i: [['Fenouil', 300, 'g']], x: 'Coupez le fenouil en quartiers', ajout: 25 },
];

export function mijotes(n: number): RecetteSaisie[] {
  return combiner<[Viande, Liquide, (typeof LEG_MIJOTE)[number], (typeof LEG_MIJOTE)[number]]>([VIANDES, LIQUIDES, LEG_MIJOTE, LEG_MIJOTE], n * 2, 207)
    .filter(([m, l, a, b]) => a.t < b.t && (!/^Chili/.test(m.t) || ['à la tomate', 'au paprika', 'à la harissa'].includes(l.t))).slice(0, n).map(([m, l, a, b]) => {
      const cuisson = m.min + 10;
      const ajout = Math.min(Math.max(a.ajout, b.ajout), m.min - 10);
      const creme = l.i.some(x => x[0] === 'Crème fraîche' || x[0] === 'Crème liquide');
      return recette('plat', `${m.t} ${l.t}, ${a.t} et ${b.t}`, 20, cuisson,
        [...m.i, ...a.i, ...b.i, ...l.i, ['Oignon', 1, 'pcs'], ['Huile d’olive', 15, 'ml']],
        [`${m.x}. ${a.x}. ${b.x}. Émincez l’oignon.`,
          'Faites chauffer l’huile d’olive dans une cocotte et faites dorer la viande 8 min à feu vif en la retournant, par petites quantités ; réservez-la.',
          `Dans la même cocotte, faites suer l’oignon 3 min, ${l.x}.`,
          `Remettez la viande, couvrez et laissez mijoter à feu doux ${m.min - ajout} min.`,
          `Ajoutez les légumes (${a.t} et ${b.t}), couvrez et poursuivez ${ajout} min : la viande doit être tendre à la fourchette et les légumes fondants.`,
          creme ? 'Hors du feu, incorporez la crème, rectifiez l’assaisonnement et laissez reposer 5 min.' : 'Retirez le couvercle et laissez réduire 8 à 10 min si la sauce est trop liquide, puis rectifiez l’assaisonnement.'],
        ['Cocotte'], l.c, 4, 4);
    });
}

// ─── D. Soupes (entrées) et soupes-repas (plats) ─────────────────────────────

const VELOUTES: { t: string; i: L[]; min: number }[] = [
  { t: 'courgette', i: [['Courgette', 500, 'g']], min: 15 }, { t: 'carotte', i: [['Carotte', 500, 'g']], min: 20 },
  { t: 'potiron', i: [['Potiron', 500, 'g']], min: 20 }, { t: 'poireau et pomme de terre', i: [['Poireau', 300, 'g'], ['Pomme de terre', 250, 'g']], min: 20 },
  { t: 'champignons', i: [['Champignons de Paris', 450, 'g']], min: 15 }, { t: 'brocoli', i: [['Brocoli', 500, 'g']], min: 12 },
  { t: 'chou-fleur', i: [['Chou-fleur', 500, 'g']], min: 18 }, { t: 'butternut', i: [['Courge butternut', 500, 'g']], min: 20 },
  { t: 'tomate', i: [['Tomate concassée (bte)', 500, 'g']], min: 15 }, { t: 'petits pois', i: [['Petit pois (surg.)', 450, 'g']], min: 10 },
  { t: 'épinards', i: [['Épinards frais', 300, 'g'], ['Pomme de terre', 200, 'g']], min: 15 }, { t: 'fenouil', i: [['Fenouil', 450, 'g']], min: 18 },
  { t: 'panais', i: [['Panais', 450, 'g']], min: 20 }, { t: 'betterave', i: [['Betterave cuite', 400, 'g'], ['Pomme de terre', 150, 'g']], min: 15 },
  { t: 'patate douce', i: [['Patate douce', 450, 'g']], min: 18 }, { t: 'asperges vertes', i: [['Asperge verte', 450, 'g'], ['Pomme de terre', 150, 'g']], min: 15 },
  { t: 'chou kale', i: [['Chou kale', 200, 'g'], ['Pomme de terre', 250, 'g']], min: 15 }, { t: 'topinambour', i: [['Topinambour', 450, 'g']], min: 20 },
];
const ENRICH: { t: string; i: L[]; x: string; pre?: string }[] = [
  { t: 'à la crème', i: [['Crème liquide', 60, 'ml']], x: 'Hors du feu, incorporez la crème liquide' },
  { t: 'au fromage frais', i: [['Fromage frais', 80, 'g']], x: 'Hors du feu, incorporez le fromage frais' },
  { t: 'au lait de coco', i: [['Lait de coco léger', 150, 'ml']], x: 'Incorporez le lait de coco léger' },
  { t: 'au curry', i: [['Curry en poudre', 1, 'cac'], ['Crème liquide', 40, 'ml']], pre: 'ajoutez 1 cuillère à café de curry et laissez-le chauffer 30 secondes', x: 'Hors du feu, incorporez la crème liquide' },
  { t: 'au gingembre', i: [['Gingembre', 10, 'g'], ['Lait de coco léger', 100, 'ml']], pre: 'ajoutez le gingembre râpé', x: 'Incorporez le lait de coco léger' },
  { t: 'au cumin', i: [['Cumin', 1, 'cac'], ['Yaourt grec', 60, 'g']], pre: 'ajoutez le cumin', x: 'Servez avec une cuillerée de yaourt grec dans chaque bol' },
];
const TOPPINGS: { t: string; i: L[]; x: string }[] = [
  { t: 'lardons grillés', i: [['Lardons', 60, 'g']], x: 'Faites dorer les lardons 4 min dans une poêle sans matière grasse' },
  { t: 'graines de courge', i: [['Graines de courge', 15, 'g']], x: 'Faites griller les graines de courge 2 min dans une poêle sèche' },
  { t: 'noisettes', i: [['Noisettes', 20, 'g']], x: 'Concassez les noisettes et faites-les griller 2 min dans une poêle sèche' },
  { t: 'ciboulette', i: [['Ciboulette', 6, 'g']], x: 'Ciselez la ciboulette' },
  { t: 'chèvre frais', i: [['Chèvre frais', 60, 'g']], x: 'Émiettez le chèvre frais' },
  { t: 'croûtons', i: [['Pain de campagne', 2, 'tranche'], ['Huile d’olive', 10, 'ml']], x: 'Coupez le pain en dés et faites-les dorer 4 min à la poêle avec l’huile d’olive' },
  { t: 'jambon cru', i: [['Jambon cru', 40, 'g']], x: 'Faites dorer le jambon cru en lanières 2 min à la poêle jusqu’à ce qu’il soit croustillant' },
];

export function veloutes(n: number): RecetteSaisie[] {
  return combiner<[(typeof VELOUTES)[number], (typeof ENRICH)[number], (typeof TOPPINGS)[number]]>([VELOUTES, ENRICH, TOPPINGS], n, 208).map(([v, e, t]) =>
    recette('entree', `Velouté ${de(v.t)} ${e.t}, ${t.t}`, 12, v.min + 5,
      [...v.i, ...e.i, ...t.i, ['Oignon', 1, 'pcs'], ['Bouillon de légumes', 600, 'ml'], ['Huile d’olive', 10, 'ml']],
      ['Émincez l’oignon et coupez les légumes en morceaux réguliers.', `Faites suer l’oignon 3 min dans l’huile d’olive à feu moyen, sans le colorer${e.pre ? `, puis ${e.pre}` : ''}.`,
        `Ajoutez les légumes et le bouillon de légumes, portez à frémissement et laissez cuire ${v.min} min à couvert, jusqu’à ce que les légumes soient très tendres.`,
        `Mixez finement. ${e.x}. Salez, poivrez, et rallongez avec un peu d’eau chaude si la texture est trop épaisse.`,
        `${t.x}. Servez la soupe dans des bols chauds, avec en garniture : ${t.t}.`],
      ['Casserole', 'Mixeur'], 'Française', 3, 2));
}

const LEGUMINEUSES: { t: string; i: L[]; min: number }[] = [
  { t: 'lentilles corail', i: [['Lentilles corail', 180, 'g']], min: 15 }, { t: 'pois cassés', i: [['Pois cassés', 180, 'g']], min: 40 },
  { t: 'haricots blancs', i: [['Haricots blancs (bte)', 480, 'g']], min: 15 }, { t: 'pois chiches', i: [['Pois chiches (bte)', 480, 'g']], min: 15 },
  { t: 'lentilles vertes', i: [['Lentilles vertes', 180, 'g']], min: 25 },
];
const PROT_SOUPE: { t: string; i: L[]; x: string }[] = [
  { t: 'saucisse de Toulouse', i: [['Saucisse de Toulouse', 250, 'g']], x: 'Faites dorer les saucisses entières 8 min dans la cocotte, puis coupez-les en rondelles' },
  { t: 'lardons', i: [['Lardons fumés', 120, 'g']], x: 'Faites dorer les lardons fumés 4 min dans la cocotte sans matière grasse' },
  { t: 'poulet', i: [['Filet de poulet', 250, 'g']], x: 'Faites dorer le poulet en dés 6 min dans la cocotte' },
  { t: 'jambon', i: [['Jambon blanc', 150, 'g']], x: 'Coupez le jambon en dés' },
  { t: 'chorizo', i: [['Chorizo', 100, 'g']], x: 'Faites dorer le chorizo en rondelles 3 min dans la cocotte' },
  { t: 'merguez', i: [['Merguez', 250, 'g']], x: 'Faites dorer les merguez 8 min dans la cocotte puis coupez-les en tronçons' },
];
const LEG_SOUPE: { t: string; i: L[] }[] = [
  { t: 'carottes et céleri', i: [['Carotte', 200, 'g'], ['Céleri branche', 100, 'g']] }, { t: 'poireau et pomme de terre', i: [['Poireau', 200, 'g'], ['Pomme de terre', 200, 'g']] },
  { t: 'tomates et poivron', i: [['Tomate concassée (bte)', 300, 'g'], ['Poivron rouge', 150, 'g']] }, { t: 'chou et carottes', i: [['Chou blanc', 250, 'g'], ['Carotte', 150, 'g']] },
  { t: 'épinards', i: [['Épinards frais', 200, 'g']] }, { t: 'courgettes et tomates', i: [['Courgette', 250, 'g'], ['Tomate', 2, 'pcs']] },
];

export function soupesRepas(n: number): RecetteSaisie[] {
  return combiner<[(typeof LEGUMINEUSES)[number], (typeof PROT_SOUPE)[number], (typeof LEG_SOUPE)[number]]>([LEGUMINEUSES, PROT_SOUPE, LEG_SOUPE], n, 209).map(([l, p, g]) =>
    recette('plat', `Soupe épaisse ${de(l.t)} et ${p.t}, ${g.t}`, 15, l.min + 15,
      [...l.i, ...p.i, ...g.i, ['Oignon', 1, 'pcs'], ['Bouillon de légumes', 800, 'ml'], ['Huile d’olive', 10, 'ml']],
      [`${p.x}.`, 'Réservez la garniture, puis faites suer l’oignon émincé 3 min dans la cocotte avec l’huile d’olive.',
        'Coupez les légumes en petits dés et ajoutez-les avec les légumineuses (rincées) et le bouillon de légumes.',
        `Portez à frémissement et laissez cuire ${l.min} min à couvert, jusqu’à ce que les légumineuses soient tendres.`,
        'Remettez la garniture, mixez grossièrement à moitié pour épaissir la soupe, salez, poivrez et laissez chauffer 3 min.'],
      ['Cocotte', 'Mixeur plongeant'], 'Française', 4));
}

// ─── E. Entrées froides légères ──────────────────────────────────────────────

const ENT_BASES: { t: string; i: L[]; x: string }[] = [
  { t: 'carottes râpées', i: [['Carotte', 300, 'g']], x: 'Râpez les carottes' },
  { t: 'concombre', i: [['Concombre', 2, 'pcs']], x: 'Coupez le concombre en fines rondelles' },
  { t: 'tomates', i: [['Tomate', 3, 'pcs']], x: 'Coupez les tomates en rondelles' },
  { t: 'betterave', i: [['Betterave cuite', 300, 'g']], x: 'Coupez la betterave cuite en dés' },
  { t: 'chou rouge', i: [['Chou rouge', 250, 'g']], x: 'Émincez très finement le chou rouge' },
  { t: 'courgette crue', i: [['Courgette', 300, 'g']], x: 'Taillez la courgette en rubans à l’économe' },
  { t: 'radis', i: [['Radis', 200, 'g']], x: 'Coupez les radis en fines rondelles' },
  { t: 'champignons crus', i: [['Champignons de Paris', 250, 'g']], x: 'Émincez finement les champignons' },
  { t: 'fenouil', i: [['Fenouil', 300, 'g']], x: 'Émincez finement le fenouil' },
  { t: 'avocat', i: [['Avocat', 2, 'pcs']], x: 'Coupez les avocats en lamelles' },
  { t: 'céleri-rave', i: [['Céleri branche', 250, 'g']], x: 'Coupez le céleri en fines tranches' },
  { t: 'mâche', i: [['Mâche', 100, 'g']], x: 'Rincez et essorez la mâche' },
];
const ENT_PLUS: { t: string; i: L[]; x: string }[] = [
  { t: 'à la feta', i: [['Feta', 80, 'g']], x: 'Émiettez la feta par-dessus' },
  { t: 'au chèvre frais', i: [['Chèvre frais', 80, 'g']], x: 'Déposez le chèvre frais en petits morceaux' },
  { t: 'aux noix', i: [['Noix', 25, 'g']], x: 'Concassez les noix et parsemez-en le plat' },
  { t: 'au citron et au yaourt', i: [['Yaourt grec', 80, 'g'], ['Citron', 0.5, 'pcs']], x: 'Nappez d’une sauce de yaourt grec relevé du jus de citron' },
  { t: 'aux pistaches', i: [['Pistaches non salées', 20, 'g']], x: 'Parsemez de pistaches concassées' },
  { t: 'à l’orange', i: [['Orange', 1, 'pcs']], x: 'Ajoutez l’orange pelée à vif et coupée en quartiers' },
  { t: 'au saumon fumé', i: [['Saumon fumé', 60, 'g']], x: 'Disposez le saumon fumé en lanières par-dessus' },
  { t: 'aux graines de courge', i: [['Graines de courge', 15, 'g']], x: 'Parsemez de graines de courge' },
  { t: 'au parmesan', i: [['Parmesan', 25, 'g']], x: 'Rabotez le parmesan en copeaux' },
  { t: 'aux œufs durs', i: [['Œuf', 2, 'pcs']], x: 'Faites durcir les œufs 9 min à l’eau bouillante, écalez-les et coupez-les en quartiers' },
];
const VIN_ENT: { t: string; i: L[]; x: string }[] = [
  { t: 'vinaigrette au citron', i: [['Citron', 0.5, 'pcs'], ['Huile d’olive', 20, 'ml']], x: 'Fouettez le jus du demi-citron avec l’huile d’olive, du sel et du poivre' },
  { t: 'vinaigrette balsamique', i: [['Vinaigre balsamique', 15, 'ml'], ['Huile d’olive', 20, 'ml']], x: 'Fouettez le vinaigre balsamique avec l’huile d’olive, du sel et du poivre' },
  { t: 'vinaigrette moutardée', i: [['Moutarde', 10, 'g'], ['Vinaigre de cidre', 10, 'ml'], ['Huile d’olive', 20, 'ml']], x: 'Fouettez la moutarde, le vinaigre de cidre et l’huile d’olive' },
  { t: 'sauce au tahini', i: [['Tahini', 20, 'g'], ['Citron', 0.5, 'pcs']], x: 'Fouettez le tahini avec le jus du demi-citron et 2 cuillères à soupe d’eau' },
];

export function entreesFroides(n: number): RecetteSaisie[] {
  return combiner<[(typeof ENT_BASES)[number], (typeof ENT_PLUS)[number], (typeof VIN_ENT)[number]]>([ENT_BASES, ENT_PLUS, VIN_ENT], n, 210).map(([b, p, v]) =>
    recette('entree', `Salade ${de(b.t)} ${p.t}, ${v.t}`, 10, p.i.some(x => x[0] === 'Œuf') ? 10 : 0,
      [...b.i, ...p.i, ...v.i],
      [`${b.x}.`, `${v.x}.`, 'Assaisonnez la base avec la vinaigrette, mélangez et laissez reposer 5 min.', `${p.x}.`],
      ['Saladier', 'Fouet'], 'Française', 1));
}

// ─── F. Desserts simples ─────────────────────────────────────────────────────

interface Fruit { t: string; i: L[]; x: string }
const FRUITS_D: Fruit[] = [
  { t: 'pommes', i: [['Pomme', 4, 'pcs']], x: 'Épluchez les pommes et coupez-les en dés' },
  { t: 'poires', i: [['Poire', 3, 'pcs']], x: 'Épluchez les poires et coupez-les en dés' },
  { t: 'pêches', i: [['Pêche', 400, 'g']], x: 'Coupez les pêches en quartiers' },
  { t: 'abricots', i: [['Abricot', 400, 'g']], x: 'Dénoyautez les abricots et coupez-les en quartiers' },
  { t: 'fruits rouges', i: [['Fruits rouges', 400, 'g']], x: 'Rincez les fruits rouges' },
  { t: 'rhubarbe', i: [['Rhubarbe', 400, 'g']], x: 'Coupez la rhubarbe en tronçons de 2 cm' },
  { t: 'mangues', i: [['Mangue', 2, 'pcs']], x: 'Épluchez les mangues et coupez-les en dés' },
  { t: 'bananes', i: [['Banane', 3, 'pcs']], x: 'Coupez les bananes en rondelles' },
  { t: 'prunes', i: [['Pruneaux', 150, 'g'], ['Pomme', 2, 'pcs']], x: 'Coupez les pruneaux en deux et les pommes en dés' },
  { t: 'cerises', i: [['Cerise', 400, 'g']], x: 'Dénoyautez les cerises' },
  { t: 'figues', i: [['Figue fraîche', 300, 'g']], x: 'Coupez les figues en quartiers' },
  { t: 'ananas', i: [['Ananas frais', 0.5, 'pcs']], x: 'Épluchez l’ananas et coupez-le en dés' },
  { t: 'framboises', i: [['Framboise', 300, 'g'], ['Pêche', 200, 'g']], x: 'Rincez les framboises et coupez les pêches en lamelles' },
  { t: 'coings', i: [['Coing', 400, 'g'], ['Pomme', 250, 'g']], x: 'Épluchez les coings et les pommes et coupez-les en dés' },
];

const CRUMBLES: { t: string; i: L[]; x: string }[] = [
  { t: 'aux flocons d’avoine', i: [['Flocons d’avoine', 70, 'g'], ['Beurre', 40, 'g'], ['Sucre', 30, 'g']], x: 'Du bout des doigts, sablez les flocons d’avoine avec le beurre froid en dés et le sucre' },
  { t: 'aux amandes', i: [['Poudre d’amandes', 50, 'g'], ['Farine', 40, 'g'], ['Beurre', 50, 'g'], ['Sucre', 30, 'g']], x: 'Du bout des doigts, sablez la poudre d’amandes, la farine, le beurre froid en dés et le sucre' },
  { t: 'au spéculoos', i: [['Spéculoos', 60, 'g'], ['Farine', 30, 'g'], ['Beurre', 40, 'g']], x: 'Écrasez les spéculoos et sablez-les avec la farine et le beurre froid en dés' },
  { t: 'aux noisettes', i: [['Noisettes', 40, 'g'], ['Farine', 50, 'g'], ['Beurre', 50, 'g'], ['Sucre', 30, 'g']], x: 'Concassez les noisettes et sablez-les avec la farine, le beurre froid en dés et le sucre' },
  { t: 'à la coco', i: [['Coco râpée non sucrée', 40, 'g'], ['Farine', 50, 'g'], ['Beurre', 50, 'g'], ['Sucre', 30, 'g']], x: 'Sablez la coco râpée avec la farine, le beurre froid en dés et le sucre' },
];

export function crumbles(): RecetteSaisie[] {
  return combiner<[Fruit, (typeof CRUMBLES)[number]]>([FRUITS_D, CRUMBLES], 70, 211).map(([f, c]) =>
    recette('dessert', `Crumble ${f.t} ${c.t}`, 15, 30, [...f.i, ...c.i, ['Cannelle', 1, 'cac']],
      ['Préchauffez le four à 180 °C.', `${f.x}.`, 'Disposez les fruits dans un plat à gratin et saupoudrez de cannelle.', `${c.x} jusqu’à obtenir une texture sableuse.`,
        'Répartissez la pâte à crumble sur les fruits et enfournez 30 min, jusqu’à ce que le dessus soit bien doré et que les fruits bouillonnent.'],
      ['Four', 'Plat à gratin'], 'Française', 3, 4));
}

const ACC_DESSERT: { t: string; i: L[] }[] = [
  { t: 'yaourt grec', i: [['Yaourt grec', 200, 'g']] }, { t: 'fromage blanc', i: [['Fromage blanc', 200, 'g']] },
  { t: 'skyr', i: [['Skyr', 200, 'g']] }, { t: 'glace vanille', i: [['Glace vanille', 120, 'g']] },
  { t: 'ricotta', i: [['Ricotta légère', 150, 'g']] },
];
const EPICES_D: { t: string; i: L[]; x: string }[] = [
  { t: 'cannelle', i: [['Cannelle', 1, 'cac'], ['Miel', 1, 'cas']], x: 'Saupoudrez de cannelle et arrosez de miel' },
  { t: 'vanille', i: [['Sucre vanillé', 8, 'g'], ['Beurre', 15, 'g']], x: 'Parsemez de sucre vanillé et de petits morceaux de beurre' },
  { t: 'cardamome-miel', i: [['Cardamome', 1, 'cac'], ['Miel', 1, 'cas']], x: 'Saupoudrez de cardamome et arrosez de miel' },
  { t: 'sirop d’érable', i: [['Sirop d\'érable', 1, 'cas'], ['Noix de pécan', 20, 'g']], x: 'Arrosez de sirop d’érable et parsemez de noix de pécan concassées' },
];

export function fruitsRotis(): RecetteSaisie[] {
  return combiner<[Fruit, (typeof EPICES_D)[number], (typeof ACC_DESSERT)[number]]>([FRUITS_D.filter(f => !['fruits rouges', 'framboises'].includes(f.t)), EPICES_D, ACC_DESSERT], 90, 212).map(([f, e, a]) =>
    recette('dessert', `${f.t.charAt(0).toUpperCase() + f.t.slice(1)} au four, ${e.t} et ${a.t}`, 10, 20,
      [...f.i, ...e.i, ...a.i],
      ['Préchauffez le four à 200 °C.', `${f.x}.`, 'Étalez les fruits dans un plat et enfournez 15 à 20 min jusqu’à ce qu’ils soient tendres et légèrement caramélisés.', `${e.x} à la sortie du four.`, `Servez tiède, accompagné de ${a.t}.`],
      ['Four', 'Plat à gratin'], 'Française', 2, 2));
}

const BASES_BOL: { t: string; i: L[] }[] = [
  { t: 'skyr', i: [['Skyr', 300, 'g']] }, { t: 'fromage blanc', i: [['Fromage blanc', 300, 'g']] },
  { t: 'yaourt grec', i: [['Yaourt grec', 300, 'g']] }, { t: 'ricotta', i: [['Ricotta légère', 250, 'g']] },
];
const CROQUANTS: { t: string; i: L[] }[] = [
  { t: 'granola', i: [['Granola', 40, 'g']] }, { t: 'spéculoos', i: [['Spéculoos', 40, 'g']] }, { t: 'noix', i: [['Noix', 30, 'g']] },
  { t: 'pépites de chocolat', i: [['Pépites de chocolat', 25, 'g']] }, { t: 'amandes', i: [['Amandes', 30, 'g']] }, { t: 'pistaches', i: [['Pistaches non salées', 30, 'g']] },
  { t: 'noisettes', i: [['Noisettes', 30, 'g']] }, { t: 'coco râpée', i: [['Coco râpée non sucrée', 20, 'g']] },
];

export function verrines(): RecetteSaisie[] {
  return combiner<[(typeof BASES_BOL)[number], Fruit, (typeof CROQUANTS)[number]]>([BASES_BOL, FRUITS_D, CROQUANTS], 90, 213).map(([b, f, c]) =>
    recette('dessert', `Verrines ${b.t} aux ${f.t}, ${c.t} et miel`, 10, 0,
      [...b.i, ...f.i.map(([n, q, u]) => [n, Math.round(q * 0.5 * 10) / 10, u] as L), ...c.i, ['Miel', 1, 'cas']],
      [`${f.x}.`, `Répartissez la moitié du ${b.t} dans deux verrines.`, 'Ajoutez une couche de fruits, puis le reste du laitage.', `Terminez par les fruits restants, ${c.t} et un filet de miel.`],
      ['Verrines'], 'Française', 1));
}

const LAITAGES_D: { t: string; i: L[]; x: string }[] = [
  { t: 'riz au lait', i: [['Riz rond', 120, 'g'], ['Lait', 600, 'ml'], ['Sucre', 30, 'g']], x: 'Faites cuire le riz rond 5 min dans l’eau bouillante, égouttez-le, puis laissez-le cuire 30 min à feu très doux dans le lait en remuant souvent' },
  { t: 'semoule au lait', i: [['Semoule fine', 80, 'g'], ['Lait', 500, 'ml'], ['Sucre', 30, 'g']], x: 'Portez le lait à frémissement, versez la semoule fine en pluie en remuant et laissez épaissir 5 min' },
];
const PARF: { t: string; i: L[]; x: string }[] = [
  { t: 'à la vanille', i: [['Sucre vanillé', 8, 'g']], x: 'Parfumez avec le sucre vanillé' },
  { t: 'à la cannelle', i: [['Cannelle', 1, 'cac']], x: 'Parfumez avec la cannelle' },
  { t: 'à la noix de coco', i: [['Coco râpée non sucrée', 25, 'g']], x: 'Parsemez de noix de coco râpée' },
  { t: 'au chocolat', i: [['Chocolat noir', 40, 'g']], x: 'Faites fondre le chocolat noir dans le lait chaud' },
  { t: 'aux fruits rouges', i: [['Fruits rouges', 150, 'g']], x: 'Servez avec les fruits rouges' },
  { t: 'au caramel de dattes', i: [['Datte', 60, 'g']], x: 'Mixez les dattes avec 3 cuillères à soupe d’eau chaude et nappez' },
];
export function laitages(): RecetteSaisie[] {
  return combiner<[(typeof LAITAGES_D)[number], (typeof PARF)[number]]>([LAITAGES_D, PARF], 12, 214).map(([l, p]) =>
    recette('dessert', `${l.t.charAt(0).toUpperCase() + l.t.slice(1)} ${p.t}`, 5, 35, [...l.i, ...p.i],
      [`${l.x}.`, `${p.x}.`, 'Servez tiède ou frais, en répartissant dans quatre coupelles.'], ['Casserole'], 'Française', 3, 4));
}

const CLAFOUTIS: Fruit[] = FRUITS_D.filter(f => ['cerises', 'abricots', 'pêches', 'poires', 'pommes', 'fruits rouges', 'prunes', 'figues', 'rhubarbe', 'framboises'].includes(f.t));
export function clafoutis(): RecetteSaisie[] {
  return CLAFOUTIS.flatMap(f => [
    recette('dessert', `Clafoutis aux ${f.t}`, 15, 35, [...f.i, ['Œuf', 3, 'pcs'], ['Farine', 60, 'g'], ['Sucre', 50, 'g'], ['Lait', 250, 'ml']],
      ['Préchauffez le four à 180 °C et beurrez un plat.', `${f.x}.`, 'Battez les œufs avec le sucre, ajoutez la farine puis le lait en fouettant jusqu’à obtenir une pâte lisse.', 'Disposez les fruits dans le plat et versez la pâte.', 'Enfournez 30 à 35 min jusqu’à ce que le clafoutis soit gonflé et doré ; il doit rester légèrement tremblotant au centre.'], ['Four', 'Plat à gratin'], 'Française', 2, 4),
    recette('dessert', `Gâteau au yaourt aux ${f.t}`, 15, 35, [...f.i, ['Yaourt nature', 125, 'g'], ['Œuf', 2, 'pcs'], ['Farine', 150, 'g'], ['Sucre', 80, 'g'], ['Levure chimique', 8, 'g'], ['Huile de tournesol', 50, 'ml']],
      ['Préchauffez le four à 180 °C et chemisez un moule à manqué.', `${f.x}.`, 'Mélangez le yaourt, le sucre, les œufs et l’huile, puis ajoutez la farine mélangée à la levure.', 'Incorporez les fruits, versez dans le moule et enfournez 35 min : un couteau planté au centre doit ressortir sec.'], ['Four', 'Moule à manqué'], 'Française', 3, 6),
  ]);
}

// ─── G. Collations et petits-déjeuners ───────────────────────────────────────

const SN_BASES: { t: string; i: L[]; x: string }[] = [
  { t: 'pomme', i: [['Pomme', 2, 'pcs']], x: 'Coupez les pommes en quartiers' },
  { t: 'banane', i: [['Banane', 2, 'pcs']], x: 'Coupez les bananes en rondelles' },
  { t: 'poire', i: [['Poire', 2, 'pcs']], x: 'Coupez les poires en quartiers' },
  { t: 'céleri', i: [['Céleri branche', 150, 'g']], x: 'Coupez le céleri en bâtonnets' },
  { t: 'carottes', i: [['Carotte', 200, 'g']], x: 'Coupez les carottes en bâtonnets' },
  { t: 'concombre', i: [['Concombre', 1, 'pcs']], x: 'Coupez le concombre en bâtonnets' },
  { t: 'dattes', i: [['Datte', 6, 'pcs']], x: 'Dénoyautez les dattes' },
  { t: 'galettes de riz', i: [['Pain de riz', 4, 'pcs']], x: 'Préparez les galettes de riz' },
];
const SN_TARTINADES: { t: string; i: L[]; x: string }[] = [
  { t: 'beurre de cacahuète', i: [['Beurre de cacahuète', 30, 'g']], x: 'Tartinez de beurre de cacahuète' },
  { t: 'fromage frais', i: [['Fromage frais', 80, 'g']], x: 'Tartinez de fromage frais' },
  { t: 'houmous maison', i: [['Pois chiches (bte)', 150, 'g'], ['Tahini', 15, 'g'], ['Citron', 0.5, 'pcs']], x: 'Mixez les pois chiches égouttés avec le tahini, le jus de citron et 2 cuillères à soupe d’eau, puis servez en dip' },
  { t: 'yaourt grec et miel', i: [['Yaourt grec', 120, 'g'], ['Miel', 1, 'cas']], x: 'Mélangez le yaourt grec et le miel, servez en dip' },
  { t: 'skyr et cannelle', i: [['Skyr', 150, 'g'], ['Cannelle', 1, 'cac']], x: 'Mélangez le skyr et la cannelle, servez en dip' },
  { t: 'purée d’amandes', i: [['Amandes', 30, 'g'], ['Miel', 1, 'cac']], x: 'Mixez les amandes en purée lisse avec le miel et tartinez' },
  { t: 'guacamole', i: [['Avocat', 1, 'pcs'], ['Citron vert', 0.5, 'pcs']], x: 'Écrasez l’avocat avec le jus du citron vert, du sel et du poivre, servez en dip' },
  { t: 'fromage blanc et ciboulette', i: [['Fromage blanc', 120, 'g'], ['Ciboulette', 5, 'g']], x: 'Mélangez le fromage blanc et la ciboulette ciselée, servez en dip' },
];
export function collations(): RecetteSaisie[] {
  return combiner<[(typeof SN_BASES)[number], (typeof SN_TARTINADES)[number]]>([SN_BASES, SN_TARTINADES], 50, 215).map(([b, t]) =>
    recette('snack', `${b.t.charAt(0).toUpperCase() + b.t.slice(1)} et ${t.t}`, 5, 0, [...b.i, ...t.i], [`${b.x}.`, `${t.x}.`, 'Dégustez aussitôt.'], ['Couteau de chef'], 'Healthy', 1));
}

const PD_BASES: { t: string; i: L[]; x: string }[] = [
  { t: 'pain complet', i: [['Pain complet', 4, 'tranche']], x: 'Faites griller le pain complet' },
  { t: 'pain de seigle', i: [['Pain de seigle', 4, 'tranche']], x: 'Faites griller le pain de seigle' },
  { t: 'pain de campagne', i: [['Pain de campagne', 4, 'tranche']], x: 'Faites griller le pain de campagne' },
];
const PD_GARN: { t: string; i: L[]; x: string }[] = [
  { t: 'œufs brouillés et saumon fumé', i: [['Œuf', 4, 'pcs'], ['Saumon fumé', 80, 'g'], ['Beurre', 10, 'g']], x: 'Battez les œufs et faites-les brouiller 4 min à feu doux dans le beurre en remuant ; déposez-les sur les tartines avec le saumon fumé' },
  { t: 'avocat et œuf mollet', i: [['Avocat', 1, 'pcs'], ['Œuf', 2, 'pcs'], ['Citron', 0.5, 'pcs']], x: 'Faites cuire les œufs 6 min 30 à l’eau bouillante, écalez-les ; écrasez l’avocat avec le citron, tartinez, puis posez les œufs coupés en deux' },
  { t: 'ricotta et miel', i: [['Ricotta légère', 120, 'g'], ['Miel', 1, 'cas'], ['Noix', 20, 'g']], x: 'Tartinez de ricotta, ajoutez les noix concassées et un filet de miel' },
  { t: 'fromage frais et radis', i: [['Fromage frais', 100, 'g'], ['Radis', 80, 'g'], ['Ciboulette', 5, 'g']], x: 'Tartinez de fromage frais, ajoutez les radis en rondelles et la ciboulette' },
  { t: 'tomates et mozzarella', i: [['Tomate', 2, 'pcs'], ['Mozzarella', 125, 'g'], ['Basilic', 5, 'g']], x: 'Garnissez de rondelles de tomate et de mozzarella, ajoutez le basilic et un filet d’huile d’olive' },
  { t: 'jambon et œuf au plat', i: [['Jambon blanc', 80, 'g'], ['Œuf', 2, 'pcs'], ['Beurre', 10, 'g']], x: 'Faites cuire les œufs au plat 3 min dans le beurre ; posez le jambon sur les tartines puis les œufs' },
  { t: 'thon et concombre', i: [['Thon au naturel', 120, 'g'], ['Concombre', 0.5, 'pcs'], ['Fromage frais', 60, 'g']], x: 'Mélangez le thon égoutté avec le fromage frais, tartinez et ajoutez le concombre' },
  { t: 'beurre de cacahuète et banane', i: [['Beurre de cacahuète', 40, 'g'], ['Banane', 1, 'pcs'], ['Graines de chia', 10, 'g']], x: 'Tartinez de beurre de cacahuète, ajoutez la banane en rondelles et les graines de chia' },
  { t: 'champignons et chèvre', i: [['Champignons de Paris', 150, 'g'], ['Chèvre frais', 80, 'g'], ['Persil', 5, 'g']], x: 'Faites sauter les champignons émincés 5 min, déposez-les sur les tartines avec le chèvre et le persil' },
  { t: 'épinards et œuf poché', i: [['Épinards frais', 100, 'g'], ['Œuf', 2, 'pcs'], ['Vinaigre de cidre', 10, 'ml']], x: 'Faites tomber les épinards 2 min ; pochez les œufs 3 min dans l’eau frémissante vinaigrée, déposez-les sur les tartines avec les épinards' },
];
export function petitsDejeuners(): RecetteSaisie[] {
  return combiner<[(typeof PD_BASES)[number], (typeof PD_GARN)[number]]>([PD_BASES, PD_GARN], 30, 216).map(([b, g]) =>
    recette('petit_dejeuner', `Tartines de ${b.t}, ${g.t}`, 8, 6, [...b.i, ...g.i], [`${b.x}.`, `${g.x}.`, 'Dégustez aussitôt.'], ['Grille-pain', 'Poêle'], 'Française', 1));
}
