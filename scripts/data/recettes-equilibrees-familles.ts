// ============================================================================
// Familles de recettes simples, équilibrées et sportives : petits-déjeuners,
// collations et plats. Chaque famille combine des briques (base, fruit, garniture,
// féculent, protéine, légume, sauce) ; chaque brique apporte ses ingrédients ET
// son étape de préparation, donc chaque recette a une composition et des étapes
// propres. Mélange déterministe (graine fixe). Les doublons de composition sont
// écartés à l'insertion (scripts/ajouter-recettes-generees.ts --equilibrees).
// ============================================================================

import type { RecetteSaisie } from './recettes-proteinees';

type L = [string, number, string, boolean?];
type T = RecetteSaisie['type'];

/** Brique : titre, ingrédients, étape de préparation. */
interface B { t: string; i: L[]; x: string }

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

/** Produit cartésien mélangé de façon déterministe, limité à `n` éléments. */
function combiner<A extends unknown[]>(listes: { [K in keyof A]: A[K][] }, n: number, graine: number): A[] {
  const toutes: unknown[][] = [[]];
  let courant: unknown[][] = toutes;
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

const recette = (
  type: T, titre: string, prep: number, cuisson: number, ingredients: L[], etapes: string[],
  ustensiles: string[], portions = 2, cuisine = 'Française', conservation = 1,
): RecetteSaisie => ({ titre, type, cuisine, prep, cuisson, difficulte: 'facile', portions, conservation, ustensiles, ingredients, etapes });

const PD: T = 'petit_dejeuner';
const SN: T = 'snack';

// ─── Briques communes ────────────────────────────────────────────────────────

const FRUITS: B[] = [
  { t: 'aux fruits rouges', i: [['Fruits rouges', 150, 'g']], x: 'Rincez les fruits rouges et laissez-les égoutter' },
  { t: 'aux myrtilles', i: [['Myrtilles', 120, 'g']], x: 'Rincez les myrtilles' },
  { t: 'aux fraises', i: [['Fraise', 200, 'g']], x: 'Lavez et équeutez les fraises, coupez-les en quartiers' },
  { t: 'aux framboises', i: [['Framboise', 150, 'g']], x: 'Rincez délicatement les framboises' },
  { t: 'à la banane', i: [['Banane', 1, 'pcs']], x: 'Coupez la banane en rondelles' },
  { t: 'au kiwi', i: [['Kiwi', 200, 'g']], x: 'Épluchez les kiwis et coupez-les en rondelles' },
  { t: 'à la mangue', i: [['Mangue', 1, 'pcs']], x: 'Épluchez la mangue et coupez-la en dés' },
  { t: 'à la pomme', i: [['Pomme', 1, 'pcs']], x: 'Coupez la pomme en petits dés' },
  { t: 'à la poire', i: [['Poire', 1, 'pcs']], x: 'Coupez la poire en lamelles' },
  { t: 'à l’orange', i: [['Orange', 1, 'pcs']], x: 'Pelez l’orange à vif et détaillez-la en quartiers' },
  { t: 'aux abricots', i: [['Abricot', 200, 'g']], x: 'Dénoyautez les abricots et coupez-les en quartiers' },
  { t: 'à la pêche', i: [['Pêche', 200, 'g']], x: 'Coupez la pêche en lamelles' },
  { t: 'au raisin', i: [['Raisin', 150, 'g']], x: 'Égrenez et rincez le raisin' },
  { t: 'à l’ananas', i: [['Ananas frais', 0.5, 'pcs']], x: 'Épluchez l’ananas et coupez-le en petits morceaux' },
];

const NOIX: B[] = [
  { t: 'amandes', i: [['Amandes', 20, 'g']], x: 'concassez les amandes' },
  { t: 'noix', i: [['Noix', 20, 'g']], x: 'concassez les noix' },
  { t: 'noisettes', i: [['Noisettes', 20, 'g']], x: 'concassez les noisettes' },
  { t: 'noix de cajou', i: [['Noix de cajou', 20, 'g']], x: 'concassez les noix de cajou' },
  { t: 'pistaches', i: [['Pistaches non salées', 20, 'g']], x: 'concassez les pistaches' },
  { t: 'noix de pécan', i: [['Noix de pécan', 20, 'g']], x: 'concassez les noix de pécan' },
  { t: 'graines de courge', i: [['Graines de courge', 15, 'g']], x: 'préparez les graines de courge' },
  { t: 'graines de chia', i: [['Graines de chia', 10, 'g']], x: 'préparez les graines de chia' },
  { t: 'noix de coco', i: [['Coco râpée non sucrée', 15, 'g']], x: 'préparez la noix de coco râpée' },
];

const BASES_LAITIERES: B[] = [
  { t: 'fromage blanc', i: [['Fromage blanc', 400, 'g']], x: 'Répartissez le fromage blanc dans deux bols' },
  { t: 'skyr', i: [['Skyr', 400, 'g']], x: 'Répartissez le skyr dans deux bols' },
  { t: 'yaourt grec', i: [['Yaourt grec', 3, 'pcs']], x: 'Répartissez le yaourt grec dans deux bols' },
];

const CEREALES: B[] = [
  { t: 'flocons d’avoine', i: [['Flocons d’avoine', 60, 'g']], x: 'Ajoutez les flocons d’avoine' },
  { t: 'granola', i: [['Granola', 60, 'g']], x: 'Ajoutez le granola' },
];

const SUCRANTS: L[] = [['Miel', 1, 'cas'], ['Sirop d\'érable', 1, 'cas']];

// ─── Petits-déjeuners ────────────────────────────────────────────────────────

function bols(n: number): RecetteSaisie[] {
  return combiner<[B, B, B, B]>([BASES_LAITIERES, CEREALES, FRUITS, NOIX], n, 11).map(([b, c, f, no], k) => {
    const sucrant = SUCRANTS[k % SUCRANTS.length];
    return recette(PD, `Bol de ${b.t} ${f.t}, ${c.t} et ${no.t}`, 5, 0,
      [...b.i, ...c.i, ...f.i, ...no.i, sucrant],
      [`${b.x}.`, `${c.x}.`, `${f.x} et disposez-les sur le bol.`, `Parsemez de ${no.t}${no.x.startsWith('concassez') ? ' (' + no.x + ')' : ''} et ajoutez ${sucrant[0] === 'Miel' ? 'un filet de miel' : 'un filet de sirop d’érable'}.`],
      ['Bol']);
  });
}

const LAITS: B[] = [
  { t: 'lait', i: [['Lait', 400, 'ml']], x: 'le lait' },
  { t: 'lait d’avoine', i: [['Lait d’avoine', 400, 'ml']], x: 'le lait d’avoine' },
  { t: 'lait d’amande', i: [['Lait d’amande', 400, 'ml']], x: 'le lait d’amande' },
  { t: 'lait de soja', i: [['Lait de soja', 400, 'ml']], x: 'le lait de soja' },
];

const BOOSTS: B[] = [
  { t: 'skyr', i: [['Skyr', 150, 'g']], x: 'Hors du feu, incorporez le skyr pour une texture crémeuse' },
  { t: 'beurre de cacahuète', i: [['Beurre de cacahuète', 25, 'g']], x: 'Ajoutez le beurre de cacahuète et mélangez jusqu’à ce qu’il fonde' },
  { t: 'œuf', i: [['Œuf', 1, 'pcs']], x: 'Battez l’œuf et versez-le en filet dans le porridge chaud en remuant vivement' },
  { t: 'fromage blanc', i: [['Fromage blanc', 150, 'g']], x: 'Servez avec une généreuse cuillerée de fromage blanc' },
  { t: 'graines de lin', i: [['Graines de lin', 15, 'g']], x: 'Ajoutez les graines de lin' },
  { t: 'cacao', i: [['Cacao en poudre', 10, 'g']], x: 'Délayez le cacao dans le porridge chaud' },
];

const FRUITS_CUITS: B[] = FRUITS.filter(f => ['à la banane', 'à la pomme', 'à la poire', 'aux fruits rouges', 'à la mangue', 'aux abricots', 'à la pêche', 'à l’ananas'].includes(f.t));

function porridges(n: number): RecetteSaisie[] {
  return combiner<[B, B, B, B]>([LAITS, FRUITS_CUITS, BOOSTS, NOIX], n, 12).map(([l, f, bo, no]) =>
    recette(PD, `Porridge ${f.t} au ${l.t}, ${bo.t} et ${no.t}`, 5, 8,
      [['Flocons d’avoine', 90, 'g'], ...l.i, ...f.i, ...bo.i, ...no.i, ['Cannelle', 1, 'cac']],
      [`Chauffez ${l.x} avec les flocons d’avoine et la cannelle 5 min à feu doux en remuant.`,
        `${f.x}.`, `${bo.x}.`, `Servez avec les fruits et parsemez de ${no.t}.`],
      ['Casserole']));
}

function overnight(n: number): RecetteSaisie[] {
  return combiner<[B, B, B]>([BASES_LAITIERES, FRUITS, NOIX], n, 13).map(([b, f, no]) =>
    recette(PD, `Overnight oats ${f.t}, ${b.t} et ${no.t}`, 5, 0,
      [['Flocons d’avoine', 70, 'g'], ['Lait', 150, 'ml'], ['Graines de chia', 15, 'g'], ...b.i.map(([nom, q, u]) => [nom, Math.round(q * 0.6 * 10) / 10, u] as L), ...f.i, ...no.i.filter(x => x[0] !== 'Graines de chia')],
      [`La veille, mélangez les flocons, le lait, les graines de chia et le ${b.t} dans deux bocaux.`, 'Fermez et laissez reposer une nuit au réfrigérateur.', `${f.x} et déposez-les sur le dessus le matin.`, `Parsemez de ${no.t}.`],
      ['Bocaux']));
}

function pancakes(n: number): RecetteSaisie[] {
  const garnitures: B[] = BASES_LAITIERES.map(b => ({ ...b, i: b.i.map(([nom, q, u]) => [nom, Math.round(q * 0.5 * 10) / 10, u] as L) }));
  return combiner<[B, B, B]>([FRUITS, garnitures, NOIX], n, 14).map(([f, g, no]) =>
    recette(PD, `Pancakes avoine ${f.t}, ${g.t} et ${no.t}`, 8, 10,
      [['Flocons d’avoine', 80, 'g'], ['Œuf', 2, 'pcs'], ['Banane', 1, 'pcs'], ...g.i, ...f.i.filter(x => x[0] !== 'Banane'), ...no.i, ['Miel', 1, 'cas']],
      ['Mixez les flocons, les œufs et la banane en pâte épaisse.', 'Cuisez de petites louches 2 min par face dans une poêle légèrement huilée.', `${f.x}.`, `Empilez les pancakes, garnissez de ${g.t}, de fruits et de ${no.t}, puis arrosez de miel.`],
      ['Mixeur', 'Poêle']));
}

const PAINS: B[] = [
  { t: 'complet', i: [['Pain complet', 4, 'tranche']], x: 'Faites griller le pain complet' },
  { t: 'de seigle', i: [['Pain de seigle', 4, 'tranche']], x: 'Faites griller le pain de seigle' },
  { t: 'de campagne', i: [['Pain de campagne', 4, 'tranche']], x: 'Faites griller le pain de campagne' },
];

const GARNITURES_TARTINES: B[] = [
  { t: 'au fromage frais et au saumon fumé', i: [['Fromage frais', 80, 'g'], ['Saumon fumé', 100, 'g'], ['Citron', 0.5, 'pcs']], x: 'Tartinez de fromage frais, posez le saumon fumé et arrosez de citron' },
  { t: 'à l’avocat et à l’œuf poché', i: [['Avocat', 1, 'pcs'], ['Œuf', 2, 'pcs'], ['Citron', 0.5, 'pcs']], x: 'Écrasez l’avocat avec le citron, tartinez, puis posez un œuf poché 3 min' },
  { t: 'au chèvre et au miel', i: [['Chèvre frais', 120, 'g'], ['Miel', 1, 'cas'], ['Noix', 20, 'g']], x: 'Posez le chèvre en tranches, arrosez de miel et parsemez de noix' },
  { t: 'au jambon de dinde et à la tomate', i: [['Jambon de dinde', 4, 'tranche'], ['Tomate', 2, 'pcs'], ['Fromage frais', 60, 'g']], x: 'Tartinez de fromage frais, ajoutez le jambon et les tomates en rondelles' },
  { t: 'au fromage blanc et aux fruits rouges', i: [['Fromage blanc', 150, 'g'], ['Fruits rouges', 100, 'g'], ['Miel', 1, 'cac']], x: 'Tartinez de fromage blanc égoutté, garnissez de fruits rouges et d’un filet de miel' },
  { t: 'au beurre de cacahuète et à la banane', i: [['Beurre de cacahuète', 40, 'g'], ['Banane', 1, 'pcs']], x: 'Tartinez de beurre de cacahuète et posez la banane en rondelles' },
  { t: 'au thon et au concombre', i: [['Thon au naturel', 150, 'g'], ['Concombre', 1, 'pcs'], ['Fromage frais', 50, 'g']], x: 'Mélangez le thon égoutté avec le fromage frais, tartinez et ajoutez le concombre en rondelles' },
  { t: 'aux œufs durs et aux radis', i: [['Œuf', 3, 'pcs'], ['Radis', 100, 'g'], ['Fromage frais', 50, 'g']], x: 'Tartinez de fromage frais et garnissez d’œufs durs en rondelles et de radis émincés' },
  { t: 'au houmous et aux tomates cerises', i: [['Pois chiches (bte)', 120, 'g'], ['Tahini', 15, 'g'], ['Citron', 0.5, 'pcs'], ['Tomates cerises', 100, 'g']], x: 'Mixez pois chiches, tahini et citron en houmous, tartinez et ajoutez les tomates cerises coupées en deux' },
  { t: 'à la ricotta et à la poire', i: [['Ricotta légère', 120, 'g'], ['Poire', 1, 'pcs'], ['Miel', 1, 'cac']], x: 'Tartinez de ricotta, garnissez de poire en lamelles et d’un filet de miel' },
  { t: 'au poulet et à l’avocat', i: [['Blanc de poulet cuit', 150, 'g'], ['Avocat', 1, 'pcs'], ['Citron', 0.5, 'pcs']], x: 'Écrasez l’avocat au citron, tartinez et garnissez de poulet effiloché' },
  { t: 'à la mozzarella et au basilic', i: [['Mozzarella', 100, 'g'], ['Tomate', 2, 'pcs'], ['Basilic', 0.5, 'botte']], x: 'Garnissez de mozzarella en tranches, de tomates en rondelles et de basilic' },
];

function tartines(n: number): RecetteSaisie[] {
  return combiner<[B, B]>([PAINS, GARNITURES_TARTINES], n, 15).map(([p, g]) =>
    recette(PD, `Tartines de pain ${p.t} ${g.t}`, 7, 3, [...p.i, ...g.i], [`${p.x}.`, `${g.x}.`, 'Salez légèrement, poivrez et servez aussitôt.'], ['Grille-pain']));
}

const METHODES_OEUF: { t: string; x: string; min: number }[] = [
  { t: 'Omelette', x: 'Battez les œufs avec du sel et du poivre, versez-les dans une poêle chaude et cuisez 4 min à feu doux en repliant l’omelette', min: 6 },
  { t: 'Œufs brouillés', x: 'Battez les œufs, cuisez-les à feu très doux 4 min en remuant sans cesse', min: 6 },
  { t: 'Œufs cocotte', x: 'Répartissez les garnitures dans deux ramequins, cassez les œufs dessus et cuisez 9 min au four à 180 °C', min: 12 },
  { t: 'Œufs au plat', x: 'Cuisez les œufs au plat 3 min dans une poêle antiadhésive couverte pour que le blanc soit pris', min: 5 },
];

const GARNITURES_OEUF: B[] = [
  { t: 'aux épinards', i: [['Épinards frais', 120, 'g']], x: 'Faites tomber les épinards 2 min à la poêle' },
  { t: 'aux champignons', i: [['Champignons de Paris', 150, 'g']], x: 'Faites sauter les champignons émincés 5 min' },
  { t: 'à la tomate et au basilic', i: [['Tomate', 2, 'pcs'], ['Basilic', 0.5, 'botte']], x: 'Coupez les tomates en dés et ciselez le basilic' },
  { t: 'au jambon de dinde et à l’emmental', i: [['Jambon de dinde', 3, 'tranche'], ['Emmental', 40, 'g']], x: 'Coupez le jambon en lanières et râpez l’emmental' },
  { t: 'au saumon fumé et à la ciboulette', i: [['Saumon fumé', 80, 'g'], ['Ciboulette', 0.5, 'botte']], x: 'Coupez le saumon fumé en lanières et ciselez la ciboulette' },
  { t: 'aux courgettes et à la feta', i: [['Courgette', 1, 'pcs'], ['Feta', 60, 'g']], x: 'Faites sauter la courgette en petits dés 5 min et émiettez la feta' },
  { t: 'aux poivrons et aux oignons', i: [['Poivron rouge', 1, 'pcs'], ['Oignon', 0.5, 'pcs']], x: 'Faites revenir le poivron et l’oignon en lanières 6 min' },
  { t: 'au fromage frais et aux herbes', i: [['Fromage frais', 60, 'g'], ['Ciboulette', 0.5, 'botte'], ['Persil', 0.5, 'botte']], x: 'Mélangez le fromage frais avec les herbes ciselées' },
  { t: 'à l’avocat', i: [['Avocat', 1, 'pcs'], ['Citron', 0.5, 'pcs']], x: 'Coupez l’avocat en lamelles et arrosez de citron' },
  { t: 'au chèvre et aux poireaux', i: [['Chèvre frais', 80, 'g'], ['Poireau', 1, 'pcs']], x: 'Faites fondre le poireau émincé 6 min et émiettez le chèvre' },
  { t: 'au thon et aux tomates cerises', i: [['Thon au naturel', 100, 'g'], ['Tomates cerises', 100, 'g']], x: 'Émiettez le thon et coupez les tomates cerises en deux' },
  { t: 'aux asperges vertes', i: [['Asperge verte', 150, 'g']], x: 'Cuisez les asperges coupées en tronçons 5 min à l’eau bouillante salée' },
];

function oeufs(n: number): RecetteSaisie[] {
  return combiner<[(typeof METHODES_OEUF)[number], B, B]>([METHODES_OEUF, GARNITURES_OEUF, PAINS], n, 16).map(([m, g, p]) =>
    recette(PD, `${m.t} ${g.t} et pain ${p.t}`, 8, m.min,
      [['Œuf', m.t === 'Œufs cocotte' ? 4 : 5, 'pcs'], ...g.i, ...p.i, ['Beurre', 10, 'g']],
      [`${g.x}.`, `${m.x}.`, `${p.x}.`, 'Servez les œufs avec le pain, salez et poivrez à votre goût.'],
      m.t === 'Œufs cocotte' ? ['Four', 'Ramequins'] : ['Poêle', 'Grille-pain']));
}

const LIQUIDES_SMOOTHIE: B[] = [
  { t: 'lait', i: [['Lait', 300, 'ml']], x: 'le lait' },
  { t: 'lait d’avoine', i: [['Lait d’avoine', 300, 'ml']], x: 'le lait d’avoine' },
  { t: 'lait d’amande', i: [['Lait d’amande', 300, 'ml']], x: 'le lait d’amande' },
  { t: 'lait de soja', i: [['Lait de soja', 300, 'ml']], x: 'le lait de soja' },
];

const FRUITS_SMOOTHIE: B[] = [
  { t: 'banane', i: [['Banane', 2, 'pcs']], x: 'les bananes en rondelles' },
  { t: 'fraise', i: [['Fraise', 200, 'g']], x: 'les fraises équeutées' },
  { t: 'mangue', i: [['Mangue', 1, 'pcs']], x: 'la mangue en dés' },
  { t: 'fruits rouges', i: [['Fruits rouges surgelés', 200, 'g']], x: 'les fruits rouges surgelés' },
  { t: 'kiwi', i: [['Kiwi', 200, 'g']], x: 'les kiwis épluchés' },
  { t: 'pêche', i: [['Pêche', 250, 'g']], x: 'les pêches en quartiers' },
  { t: 'myrtille', i: [['Myrtilles', 150, 'g']], x: 'les myrtilles' },
  { t: 'ananas', i: [['Ananas frais', 0.5, 'pcs']], x: 'l’ananas en morceaux' },
  { t: 'poire', i: [['Poire', 2, 'pcs']], x: 'les poires en quartiers' },
];

const BOOSTS_SMOOTHIE: B[] = [
  { t: 'skyr', i: [['Skyr', 150, 'g']], x: 'le skyr' },
  { t: 'flocons d’avoine', i: [['Flocons d’avoine', 40, 'g']], x: 'les flocons d’avoine' },
  { t: 'beurre de cacahuète', i: [['Beurre de cacahuète', 25, 'g']], x: 'le beurre de cacahuète' },
  { t: 'cacao', i: [['Cacao en poudre', 10, 'g'], ['Skyr', 100, 'g']], x: 'le cacao et le skyr' },
  { t: 'fromage blanc', i: [['Fromage blanc', 150, 'g']], x: 'le fromage blanc' },
  { t: 'yaourt grec', i: [['Yaourt grec', 2, 'pcs']], x: 'le yaourt grec' },
];

function smoothies(n: number, type: T, graine: number): RecetteSaisie[] {
  return combiner<[B, B, B]>([LIQUIDES_SMOOTHIE, FRUITS_SMOOTHIE, BOOSTS_SMOOTHIE], n, graine).map(([l, f, bo]) =>
    recette(type, `${type === SN ? 'Smoothie de récupération' : 'Smoothie protéiné'} ${f.t}, ${bo.t} et ${l.t}`, 5, 0,
      [...l.i, ...f.i, ...bo.i],
      [`Mettez ${l.x}, ${f.x} et ${bo.x} dans le blender.`, 'Mixez 1 min jusqu’à obtenir une texture lisse.', 'Versez dans deux verres et buvez frais.'],
      ['Blender']));
}

// ─── Collations ──────────────────────────────────────────────────────────────

const AJOUTS_BALLS: B[] = [
  { t: 'cacao', i: [['Cacao en poudre', 15, 'g']], x: 'le cacao' },
  { t: 'beurre de cacahuète', i: [['Beurre de cacahuète', 30, 'g']], x: 'le beurre de cacahuète' },
  { t: 'noix de coco', i: [['Coco râpée non sucrée', 30, 'g']], x: 'la noix de coco râpée' },
  { t: 'pistaches', i: [['Pistaches non salées', 40, 'g']], x: 'les pistaches' },
  { t: 'cannelle', i: [['Cannelle', 1, 'cac'], ['Noix', 40, 'g']], x: 'la cannelle et les noix' },
  { t: 'raisins secs', i: [['Raisins secs', 40, 'g'], ['Noisettes', 30, 'g']], x: 'les raisins secs et les noisettes' },
  { t: 'graines de courge', i: [['Graines de courge', 30, 'g'], ['Noix de cajou', 30, 'g']], x: 'les graines de courge et les noix de cajou' },
  { t: 'pépites de chocolat', i: [['Pépites de chocolat', 30, 'g'], ['Amandes', 40, 'g']], x: 'les pépites de chocolat et les amandes' },
];

const BASES_BALLS: B[] = [
  { t: 'dattes et avoine', i: [['Datte', 150, 'g'], ['Flocons d’avoine', 80, 'g']], x: 'Mixez les dattes dénoyautées et les flocons d’avoine' },
  { t: 'dattes et amandes', i: [['Datte', 150, 'g'], ['Poudre d’amandes', 80, 'g']], x: 'Mixez les dattes dénoyautées et la poudre d’amandes' },
  { t: 'pruneaux et avoine', i: [['Pruneaux', 150, 'g'], ['Flocons d’avoine', 80, 'g']], x: 'Mixez les pruneaux dénoyautés et les flocons d’avoine' },
];

function balls(n: number): RecetteSaisie[] {
  return combiner<[B, B]>([BASES_BALLS, AJOUTS_BALLS], n, 21).map(([b, a]) =>
    recette(SN, `Energy balls ${b.t} et ${a.t}`, 15, 0, [...b.i, ...a.i],
      [`${b.x} jusqu’à obtenir une pâte collante.`, `Ajoutez ${a.x} et mixez brièvement.`, 'Formez une douzaine de boules et réservez 30 min au frais. Elles se gardent une semaine.'],
      ['Mixeur'], 4, 'Française', 7));
}

const PROTEINES_SANDWICH: B[] = [
  { t: 'poulet', i: [['Blanc de poulet cuit', 150, 'g']], x: 'effilochez le poulet' },
  { t: 'jambon de dinde', i: [['Jambon de dinde', 4, 'tranche']], x: 'répartissez le jambon de dinde' },
  { t: 'thon', i: [['Thon au naturel', 150, 'g']], x: 'émiettez le thon' },
  { t: 'œuf dur', i: [['Œuf', 3, 'pcs']], x: 'écalez et tranchez les œufs durs' },
  { t: 'saumon fumé', i: [['Saumon fumé', 100, 'g']], x: 'posez le saumon fumé' },
  { t: 'fromage frais', i: [['Fromage frais', 100, 'g']], x: 'étalez le fromage frais' },
  { t: 'chèvre', i: [['Chèvre frais', 100, 'g']], x: 'émiettez le chèvre' },
];

const LEGUMES_SANDWICH: B[] = [
  { t: 'tomate', i: [['Tomate', 2, 'pcs']], x: 'des rondelles de tomate' },
  { t: 'concombre', i: [['Concombre', 1, 'pcs']], x: 'des rondelles de concombre' },
  { t: 'salade', i: [['Salade verte', 0.5, 'pcs']], x: 'des feuilles de salade' },
  { t: 'avocat', i: [['Avocat', 1, 'pcs']], x: 'des lamelles d’avocat' },
  { t: 'carotte râpée', i: [['Carotte', 2, 'pcs']], x: 'de la carotte râpée' },
  { t: 'radis', i: [['Radis', 100, 'g']], x: 'des radis émincés' },
  { t: 'poivron', i: [['Poivron rouge', 1, 'pcs']], x: 'des lanières de poivron' },
];

function sandwichs(n: number): RecetteSaisie[] {
  return combiner<[B, B, B]>([PAINS, PROTEINES_SANDWICH, LEGUMES_SANDWICH], n, 22).map(([p, pr, l]) =>
    recette(SN, `Sandwich pain ${p.t}, ${pr.t} et ${l.t}`, 8, 0,
      [...p.i.map(([nom, , u]) => [nom, 4, u] as L), ...pr.i, ...l.i, ['Moutarde', 1, 'cac']],
      [`${p.x.replace('Faites griller', 'Prenez')}, tartinez-le d’une fine couche de moutarde.`, `Dans chaque sandwich, ${pr.x} et ajoutez ${l.x}.`, 'Refermez, coupez en deux et emballez pour l’emporter.'],
      ['Planche']));
}

const EPICES_POIS_CHICHES: { t: string; i: L[]; x: string }[] = [
  { t: 'au paprika fumé', i: [['Paprika fumé', 1, 'cac']], x: 'le paprika fumé' },
  { t: 'au curry', i: [['Curry en poudre', 1, 'cac']], x: 'le curry' },
  { t: 'au cumin et au citron', i: [['Cumin', 1, 'cac'], ['Citron', 0.5, 'pcs']], x: 'le cumin et le zeste du citron' },
  { t: 'aux herbes de Provence', i: [['Herbes de Provence', 2, 'g'], ['Ail', 1, 'pcs']], x: 'les herbes de Provence et l’ail écrasé' },
  { t: 'au ras-el-hanout', i: [['Ras-el-hanout', 3, 'g']], x: 'le ras-el-hanout' },
  { t: 'au sumac', i: [['Sumac', 3, 'g']], x: 'le sumac' },
  { t: 'au zaatar', i: [['Zaatar', 3, 'g']], x: 'le zaatar' },
  { t: 'au miel et au piment doux', i: [['Miel', 1, 'cac'], ['Piment doux', 1, 'cac']], x: 'le miel et le piment doux' },
];

function poisChiches(): RecetteSaisie[] {
  return EPICES_POIS_CHICHES.map(e =>
    recette(SN, `Pois chiches rôtis ${e.t}`, 5, 25,
      [['Pois chiches (bte)', 240, 'g'], ['Huile d’olive', 1, 'cas'], ...e.i],
      ['Égouttez, rincez et séchez soigneusement les pois chiches.', `Mélangez-les à l’huile et à ${e.x}, salez.`, 'Enfournez 25 min à 200 °C en remuant à mi-cuisson. Laissez refroidir pour qu’ils croustillent.'],
      ['Four'], 2, 'Méditerranéenne', 4));
}

// ─── Plats équilibrés ────────────────────────────────────────────────────────

const PROT_WOK: B[] = [
  { t: 'poulet', i: [['Filet de poulet', 300, 'g']], x: 'Coupez le poulet en lanières et saisissez-le 5 min à feu vif' },
  { t: 'dinde', i: [['Filet de dinde', 300, 'g']], x: 'Coupez la dinde en lanières et saisissez-la 5 min à feu vif' },
  { t: 'bœuf', i: [['Bœuf haché 5 %', 280, 'g']], x: 'Faites cuire le bœuf haché 5 min à feu vif en l’émiettant' },
  { t: 'crevettes', i: [['Crevettes', 280, 'g']], x: 'Saisissez les crevettes 3 min à feu vif' },
  { t: 'tofu', i: [['Tofu ferme', 350, 'g']], x: 'Faites dorer le tofu en dés 7 min' },
  { t: 'œufs brouillés', i: [['Œuf', 4, 'pcs']], x: 'Brouillez les œufs 2 min dans le wok huilé, puis réservez-les' },
];

const NOUILLES: B[] = [
  { t: 'nouilles chinoises', i: [['Nouilles chinoises', 150, 'g']], x: 'Cuisez les nouilles chinoises le temps indiqué et égouttez-les' },
  { t: 'nouilles de riz', i: [['Nouilles de riz', 130, 'g']], x: 'Faites tremper les nouilles de riz dans l’eau bouillante, puis égouttez-les' },
  { t: 'nouilles soba', i: [['Nouilles soba', 140, 'g']], x: 'Cuisez les nouilles soba 5 min et rincez-les' },
  { t: 'riz basmati', i: [['Riz basmati', 140, 'g']], x: 'Cuisez le riz basmati 11 min dans l’eau bouillante salée' },
];

const LEGUMES_WOK: B[] = [
  { t: 'brocoli', i: [['Brocoli', 250, 'g']], x: 'ajoutez le brocoli en petits bouquets avec un peu d’eau et couvrez 4 min' },
  { t: 'poivron et carotte', i: [['Poivron rouge', 1, 'pcs'], ['Carotte', 2, 'pcs']], x: 'ajoutez le poivron et les carottes en julienne et sautez 5 min' },
  { t: 'haricots verts', i: [['Haricots verts', 250, 'g']], x: 'ajoutez les haricots verts et cuisez 6 min à couvert' },
  { t: 'champignons et oignon nouveau', i: [['Champignons de Paris', 200, 'g'], ['Oignon nouveau', 2, 'pcs']], x: 'ajoutez les champignons émincés et l’oignon nouveau et sautez 5 min' },
  { t: 'courgette et carotte', i: [['Courgette', 1, 'pcs'], ['Carotte', 1, 'pcs']], x: 'ajoutez la courgette et la carotte en bâtonnets et sautez 5 min' },
  { t: 'edamame et poivron', i: [['Edamame (surg.)', 150, 'g'], ['Poivron rouge', 1, 'pcs']], x: 'ajoutez les edamame et le poivron en lanières et sautez 5 min' },
  { t: 'pak choï et champignons', i: [['Chou pak choï', 250, 'g'], ['Champignons de Paris', 150, 'g']], x: 'ajoutez le pak choï émincé et les champignons et sautez 4 min' },
  { t: 'chou rouge et carotte', i: [['Chou rouge', 200, 'g'], ['Carotte', 1, 'pcs']], x: 'ajoutez le chou rouge émincé et la carotte râpée et sautez 5 min' },
];

const SAUCES_WOK: B[] = [
  { t: 'sauce soja et gingembre', i: [['Sauce soja', 2, 'cas'], ['Gingembre', 1, 'cas']], x: 'Nappez de sauce soja et de gingembre râpé' },
  { t: 'sauce soja et miel', i: [['Sauce soja', 2, 'cas'], ['Miel', 1, 'cas']], x: 'Nappez du mélange de sauce soja et de miel et laissez caraméliser 1 min' },
  { t: 'sriracha et citron vert', i: [['Sauce sriracha', 2, 'cac'], ['Citron vert', 1, 'pcs']], x: 'Ajoutez la sriracha et le jus de citron vert' },
  { t: 'sauce hoisin', i: [['Sauce hoisin', 2, 'cas']], x: 'Nappez de sauce hoisin' },
  { t: 'sauce soja et ail', i: [['Sauce soja', 2, 'cas'], ['Ail', 2, 'pcs']], x: 'Ajoutez la sauce soja et l’ail haché' },
];

function woks(n: number): RecetteSaisie[] {
  return combiner<[B, B, B, B]>([PROT_WOK, NOUILLES, LEGUMES_WOK, SAUCES_WOK], n, 31).map(([p, f, l, s]) =>
    recette('plat', `Wok ${/^[aeiouhœ]/i.test(p.t) ? 'd’' : 'de '}${p.t}, ${l.t}, ${f.t} et ${s.t}`, 10, 14,
      [...p.i, ...f.i, ...l.i, ...s.i, ['Huile d’olive', 1, 'cas']],
      [`${f.x}.`, `${p.x} dans un wok huilé, puis réservez.`, `Dans le même wok, ${l.x}.`, `Remettez la protéine et les nouilles, ${s.x.charAt(0).toLowerCase() + s.x.slice(1)} et mélangez 2 min à feu vif.`],
      ['Wok', 'Casserole'], 2, 'Asiatique'));
}

const FECULENTS_SALADE: B[] = [
  { t: 'quinoa', i: [['Quinoa', 130, 'g']], x: 'Cuisez le quinoa 12 min dans deux fois son volume d’eau bouillante salée et laissez refroidir' },
  { t: 'boulgour', i: [['Boulgour', 130, 'g']], x: 'Faites gonfler le boulgour 12 min dans deux fois son volume d’eau bouillante salée, puis laissez refroidir' },
  { t: 'riz complet', i: [['Riz complet', 150, 'g']], x: 'Cuisez le riz complet 25 min à l’eau bouillante salée, rincez-le et laissez refroidir' },
  { t: 'lentilles', i: [['Lentilles vertes', 140, 'g']], x: 'Cuisez les lentilles 20 min à l’eau non salée, égouttez-les et laissez tiédir' },
  { t: 'pois chiches', i: [['Pois chiches (bte)', 300, 'g']], x: 'Égouttez et rincez les pois chiches' },
  { t: 'pommes de terre', i: [['Pomme de terre', 450, 'g']], x: 'Cuisez les pommes de terre en rondelles 15 min à l’eau salée et laissez tiédir' },
  { t: 'semoule', i: [['Semoule', 130, 'g']], x: 'Versez la semoule dans un volume égal d’eau bouillante salée, couvrez 5 min et égrenez' },
];

const PROT_SALADE: B[] = [
  { t: 'poulet', i: [['Blanc de poulet cuit', 200, 'g']], x: 'ajoutez le poulet effiloché' },
  { t: 'thon', i: [['Thon au naturel', 180, 'g']], x: 'ajoutez le thon émietté' },
  { t: 'œufs durs', i: [['Œuf', 4, 'pcs']], x: 'ajoutez les œufs durs coupés en quartiers' },
  { t: 'feta', i: [['Feta', 120, 'g']], x: 'ajoutez la feta émiettée' },
  { t: 'saumon fumé', i: [['Saumon fumé', 120, 'g']], x: 'ajoutez le saumon fumé en lanières' },
  { t: 'jambon de dinde', i: [['Jambon de dinde', 4, 'tranche']], x: 'ajoutez le jambon de dinde en lanières' },
  { t: 'haricots rouges', i: [['Haricots rouges (bte)', 240, 'g']], x: 'ajoutez les haricots rouges égouttés' },
  { t: 'crevettes', i: [['Crevettes', 250, 'g']], x: 'ajoutez les crevettes cuites' },
];

const LEGUMES_SALADE: B[] = [
  { t: 'tomates et concombre', i: [['Tomate', 2, 'pcs'], ['Concombre', 1, 'pcs']], x: 'les tomates et le concombre en dés' },
  { t: 'poivron et maïs', i: [['Poivron rouge', 1, 'pcs'], ['Maïs doux (surg.)', 100, 'g']], x: 'le poivron en dés et le maïs décongelé' },
  { t: 'haricots verts', i: [['Haricots verts', 250, 'g']], x: 'les haricots verts cuits 8 min et refroidis' },
  { t: 'carottes râpées', i: [['Carotte', 3, 'pcs']], x: 'les carottes râpées' },
  { t: 'courgette crue', i: [['Courgette', 1, 'pcs']], x: 'la courgette en fins rubans' },
  { t: 'radis et salade', i: [['Radis', 100, 'g'], ['Salade verte', 0.5, 'pcs']], x: 'les radis émincés et la salade' },
  { t: 'avocat et tomates cerises', i: [['Avocat', 1, 'pcs'], ['Tomates cerises', 150, 'g']], x: 'l’avocat en dés et les tomates cerises coupées en deux' },
  { t: 'brocoli', i: [['Brocoli', 250, 'g']], x: 'le brocoli en petits bouquets cuits 5 min et refroidis' },
];

const VINAIGRETTES: B[] = [
  { t: 'citron et huile d’olive', i: [['Citron', 1, 'pcs'], ['Huile d’olive', 2, 'cas']], x: 'Assaisonnez avec le jus de citron, l’huile, du sel et du poivre' },
  { t: 'moutarde', i: [['Moutarde', 1, 'cas'], ['Vinaigre de cidre', 15, 'ml'], ['Huile d’olive', 2, 'cas']], x: 'Fouettez la moutarde, le vinaigre et l’huile et versez sur la salade' },
  { t: 'yaourt et ciboulette', i: [['Yaourt grec', 1, 'pcs'], ['Ciboulette', 0.5, 'botte']], x: 'Mélangez le yaourt, la ciboulette ciselée, du sel et du poivre et nappez' },
  { t: 'vinaigre balsamique', i: [['Vinaigre balsamique', 1, 'cas'], ['Huile d’olive', 2, 'cas']], x: 'Assaisonnez avec le vinaigre balsamique, l’huile, du sel et du poivre' },
  { t: 'miel et moutarde', i: [['Miel', 1, 'cac'], ['Moutarde à l’ancienne', 1, 'cas'], ['Huile d’olive', 2, 'cas']], x: 'Fouettez le miel, la moutarde à l’ancienne et l’huile, versez sur la salade' },
];

function salades(n: number): RecetteSaisie[] {
  return combiner<[B, B, B, B]>([FECULENTS_SALADE, PROT_SALADE, LEGUMES_SALADE, VINAIGRETTES], n, 32).map(([f, p, l, v]) =>
    recette('plat', `Salade-repas de ${f.t}, ${p.t} et ${l.t}, sauce ${v.t}`, 15, 15,
      [...f.i, ...p.i, ...l.i, ...v.i],
      [`${f.x}.`, `Préparez ${l.x}.`, `Dans un saladier, mélangez le féculent et les légumes, ${p.x}.`, `${v.x}.`],
      ['Casserole', 'Saladier'], 2, 'Française', 2));
}

const LEGUMINEUSES_SOUPE: B[] = [
  { t: 'lentilles corail', i: [['Lentilles corail', 120, 'g']], x: 'les lentilles corail' },
  { t: 'pois chiches', i: [['Pois chiches (bte)', 240, 'g']], x: 'les pois chiches égouttés' },
  { t: 'haricots blancs', i: [['Haricots blancs (bte)', 240, 'g']], x: 'les haricots blancs égouttés' },
  { t: 'lentilles vertes', i: [['Lentilles vertes', 120, 'g']], x: 'les lentilles vertes rincées' },
];

const LEGUMES_SOUPE: B[] = [
  { t: 'carottes', i: [['Carotte', 3, 'pcs'], ['Oignon', 1, 'pcs']], x: 'les carottes et l’oignon en dés' },
  { t: 'tomates', i: [['Tomate', 4, 'pcs'], ['Oignon', 1, 'pcs']], x: 'les tomates et l’oignon en dés' },
  { t: 'poireaux', i: [['Poireau', 2, 'pcs'], ['Pomme de terre', 200, 'g']], x: 'les poireaux émincés et la pomme de terre en dés' },
  { t: 'courge', i: [['Courge butternut', 400, 'g'], ['Oignon', 1, 'pcs']], x: 'la courge et l’oignon en cubes' },
  { t: 'épinards', i: [['Épinards frais', 200, 'g'], ['Pomme de terre', 200, 'g']], x: 'la pomme de terre en dés et les épinards en fin de cuisson' },
  { t: 'courgettes', i: [['Courgette', 2, 'pcs'], ['Oignon', 1, 'pcs']], x: 'les courgettes et l’oignon en dés' },
];

const PROT_SOUPE: B[] = [
  { t: 'œuf poché', i: [['Œuf', 2, 'pcs']], x: 'Pochez les œufs 3 min dans la soupe frémissante juste avant de servir' },
  { t: 'poulet', i: [['Blanc de poulet cuit', 160, 'g']], x: 'Ajoutez le poulet effiloché dans la soupe 3 min avant de servir' },
  { t: 'jambon de dinde', i: [['Jambon de dinde', 3, 'tranche']], x: 'Ajoutez le jambon de dinde en lanières dans les bols' },
  { t: 'fromage blanc', i: [['Fromage blanc', 120, 'g']], x: 'Servez avec une cuillerée de fromage blanc au centre' },
  { t: 'crevettes', i: [['Crevettes', 200, 'g']], x: 'Plongez les crevettes dans la soupe 3 min avant de servir' },
];

function soupes(n: number): RecetteSaisie[] {
  return combiner<[B, B, B]>([LEGUMINEUSES_SOUPE, LEGUMES_SOUPE, PROT_SOUPE], n, 33).map(([le, lg, p]) =>
    recette('plat', `Soupe-repas de ${lg.t} et de ${le.t}, ${p.t}`, 10, 30,
      [...le.i, ...lg.i, ...p.i, ['Bouillon de légumes', 800, 'ml']],
      [`Faites revenir ${lg.x} 5 min dans la casserole.`, `Versez le bouillon, ajoutez ${le.x} et laissez cuire 25 min jusqu’à ce que tout soit tendre.`, 'Mixez grossièrement pour une texture épaisse, salez et poivrez.', `${p.x}.`],
      ['Casserole', 'Mixeur'], 2, 'Française', 3));
}

const POISSONS_PAPILLOTE: B[] = [
  { t: 'saumon', i: [['Pavé de saumon', 2, 'pcs']], x: 'les pavés de saumon' },
  { t: 'cabillaud', i: [['Filet de cabillaud', 350, 'g']], x: 'le cabillaud' },
  { t: 'colin', i: [['Colin', 350, 'g']], x: 'le colin' },
  { t: 'truite', i: [['Truite', 400, 'g']], x: 'les filets de truite' },
  { t: 'crevettes', i: [['Crevettes', 300, 'g']], x: 'les crevettes' },
];

const LEGUMES_PAPILLOTE: B[] = [
  { t: 'courgettes et citron', i: [['Courgette', 2, 'pcs'], ['Citron', 1, 'pcs']], x: 'les courgettes en rondelles et le citron en tranches' },
  { t: 'tomates cerises et basilic', i: [['Tomates cerises', 200, 'g'], ['Basilic', 0.5, 'botte']], x: 'les tomates cerises coupées en deux et le basilic' },
  { t: 'poireaux et carottes', i: [['Poireau', 2, 'pcs'], ['Carotte', 2, 'pcs']], x: 'les poireaux et les carottes en fines lamelles' },
  { t: 'haricots verts et échalote', i: [['Haricots verts', 250, 'g'], ['Échalote', 1, 'pcs']], x: 'les haricots verts et l’échalote émincée' },
  { t: 'fenouil et orange', i: [['Fenouil', 1, 'pcs'], ['Orange', 1, 'pcs']], x: 'le fenouil en lamelles et l’orange en rondelles' },
  { t: 'poivron et oignon', i: [['Poivron rouge', 1, 'pcs'], ['Oignon', 1, 'pcs']], x: 'le poivron et l’oignon en lanières' },
];

const FECULENTS_PAPILLOTE: B[] = [
  { t: 'riz basmati', i: [['Riz basmati', 140, 'g']], x: 'Cuisez le riz basmati 11 min à l’eau bouillante salée' },
  { t: 'quinoa', i: [['Quinoa', 130, 'g']], x: 'Cuisez le quinoa 12 min dans deux fois son volume d’eau bouillante salée' },
  { t: 'pommes de terre', i: [['Pomme de terre', 450, 'g']], x: 'Cuisez les pommes de terre en morceaux 15 min à la vapeur' },
  { t: 'semoule', i: [['Semoule', 130, 'g']], x: 'Préparez la semoule dans un volume égal d’eau bouillante salée, couverte 5 min' },
  { t: 'boulgour', i: [['Boulgour', 130, 'g']], x: 'Faites gonfler le boulgour 12 min dans deux fois son volume d’eau bouillante salée' },
];

function papillotes(n: number): RecetteSaisie[] {
  return combiner<[B, B, B]>([POISSONS_PAPILLOTE, LEGUMES_PAPILLOTE, FECULENTS_PAPILLOTE], n, 34).map(([p, l, f]) =>
    recette('plat', `Papillote de ${p.t}, ${l.t} et ${f.t}`, 10, 22,
      [...p.i, ...l.i, ...f.i, ['Huile d’olive', 1, 'cas']],
      [`Préparez ${l.x}.`, `Disposez ${p.x} et les légumes sur deux feuilles de papier cuisson, huilez, salez, poivrez et fermez les papillotes.`, 'Enfournez 18 à 20 min à 200 °C.', `${f.x}, puis servez avec les papillotes ouvertes à table.`],
      ['Four'], 2, 'Française'));
}

/** Toutes les familles : le nombre par famille fixe l'équilibre du lot. */
export function genererEquilibrees(): RecetteSaisie[] {
  const toutes = [
    ...bols(34), ...porridges(26), ...overnight(24), ...pancakes(24), ...tartines(30), ...oeufs(34),
    ...smoothies(18, PD, 41), ...smoothies(14, SN, 42),
    ...balls(16), ...sandwichs(40), ...poisChiches(),
    ...woks(56), ...salades(60), ...soupes(30), ...papillotes(36),
  ];
  // Deux recettes ne portent jamais le même titre (l'insertion associe les ingrédients par titre)
  const vus = new Set<string>();
  return toutes.filter(x => (vus.has(x.titre) ? false : (vus.add(x.titre), true)));
}
