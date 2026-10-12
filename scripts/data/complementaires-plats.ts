// ============================================================================
// Plats simples, rapides et complets : poêlées express, bowls, pâtes, pommes de
// terre, wraps/burgers/croques, plats au four, œufs et salades-repas.
// Chaque famille assemble des briques (voir complementaires-briques.ts).
// ============================================================================

import type { RecetteSaisie } from './recettes-proteinees';
import {
  BASES, LEGUMES, avecArticle, de, PROTEINES, SAUCES, combiner, lierSauce, recette, ustensilesBase,
  type Base, type L, type Legume, type Proteine, type Sauce,
} from './complementaires-briques';

const GRAINS = BASES.filter(b => !/^(frites|gnocchis|penne|spaghetti|orzo)/.test(b.t));

// ─── 1. Poêlées express : protéine + légume + féculent + sauce ──────────────

export function poeleesExpress(n: number): RecetteSaisie[] {
  return combiner<[Proteine, Legume, Base, Sauce]>([PROTEINES, LEGUMES, BASES, SAUCES], n, 101).map(([p, v, b, s]) =>
    recette('plat', `${p.t} ${v.t}, sauce ${s.t} et ${b.t}`,
      p.prep + v.prep + b.prep, Math.max(b.cuis, p.cuis + v.cuis + 3),
      [...b.i, ...p.i, ...v.i, ...s.i],
      [`${b.x}.`, `${p.x}.`, `${v.x}.`, `${s.x}.`,
        `${lierSauce(s)}, puis remettez dans la poêle le contenu de l’assiette réservée et mélangez 1 min pour bien enrober`,
        `Dans chaque assiette, déposez d’abord ${avecArticle(b.t)}, puis répartissez le mélange par-dessus.`],
      ['Poêle', ...ustensilesBase(b)], s.c, p.cons ?? 2));
}

// ─── 2. Bowls ────────────────────────────────────────────────────────────────

interface Cru { t: string; i: L[]; x: string }
const CRUS: Cru[] = [
  { t: 'avocat et concombre', i: [['Avocat', 1, 'pcs'], ['Concombre', 1, 'pcs']], x: 'Coupez l’avocat en lamelles et le concombre en demi-rondelles' },
  { t: 'edamame et carottes râpées', i: [['Edamame (surg.)', 150, 'g'], ['Carotte', 150, 'g']], x: 'Plongez l’edamame 3 min dans l’eau bouillante et égouttez-le ; râpez les carottes' },
  { t: 'chou rouge et maïs', i: [['Chou rouge', 150, 'g'], ['Maïs doux (bte)', 100, 'g']], x: 'Émincez très finement le chou rouge et égouttez le maïs' },
  { t: 'tomates cerises et radis', i: [['Tomates cerises', 150, 'g'], ['Radis', 100, 'g']], x: 'Coupez les tomates cerises en deux et les radis en fines rondelles' },
  { t: 'betterave et roquette', i: [['Betterave cuite', 150, 'g'], ['Roquette', 40, 'g']], x: 'Coupez la betterave cuite en dés et rincez la roquette' },
  { t: 'mangue et concombre', i: [['Mangue', 1, 'pcs'], ['Concombre', 1, 'pcs']], x: 'Épluchez la mangue et coupez-la en dés, coupez le concombre en demi-rondelles' },
  { t: 'poivron et oignon rouge', i: [['Poivron rouge', 150, 'g'], ['Oignon rouge', 0.5, 'pcs']], x: 'Coupez le poivron en fines lanières et émincez finement l’oignon rouge' },
  { t: 'avocat et maïs', i: [['Avocat', 1, 'pcs'], ['Maïs doux (bte)', 100, 'g']], x: 'Coupez l’avocat en lamelles et égouttez le maïs' },
  { t: 'carottes râpées et chou chinois', i: [['Carotte', 150, 'g'], ['Chou chinois', 150, 'g']], x: 'Râpez les carottes et émincez le chou chinois en fines lanières' },
  { t: 'concombre et radis', i: [['Concombre', 1, 'pcs'], ['Radis', 100, 'g']], x: 'Coupez le concombre en bâtonnets et les radis en rondelles' },
  { t: 'pois chiches et tomates', i: [['Pois chiches (bte)', 200, 'g'], ['Tomate', 2, 'pcs']], x: 'Rincez les pois chiches et coupez les tomates en dés' },
  { t: 'courgette crue et menthe', i: [['Courgette', 200, 'g'], ['Menthe fraîche', 5, 'g']], x: 'Taillez la courgette en rubans à l’économe et ciselez la menthe' },
];

export function bowls(n: number): RecetteSaisie[] {
  return combiner<[Proteine, Base, Cru, Sauce]>([PROTEINES, GRAINS, CRUS, SAUCES], n, 102).map(([p, b, c, s]) =>
    recette('plat', `Bowl ${p.a}, ${b.t}, ${c.t}, sauce ${s.t}`,
      p.prep + b.prep + 5, Math.max(b.cuis, p.cuis + 2),
      [...b.i, ...p.i, ...c.i, ...s.i],
      [`${b.x}.`, `${p.x}.`, `${c.x}.`, `${s.x}.`,
        `Composez les bols : répartissez ${avecArticle(b.t)} au fond de chaque bol, puis disposez en sections la préparation réservée et les légumes frais.`,
        'Nappez de sauce et servez aussitôt, avec le reste de sauce à part.'],
      ['Casserole', 'Poêle', 'Bol'], s.c, 3));
}

// ─── 3. Pâtes ────────────────────────────────────────────────────────────────

interface Pate { t: string; nom: string; i: L[]; cuis: number }
const PATES: Pate[] = [
  { t: 'Penne', nom: 'penne', i: [['Pâtes penne', 180, 'g']], cuis: 11 },
  { t: 'Spaghetti', nom: 'spaghetti', i: [['Spaghetti', 180, 'g']], cuis: 10 },
  { t: 'Tagliatelles', nom: 'tagliatelles', i: [['Pâtes (tagliatelles)', 180, 'g']], cuis: 9 },
  { t: 'Fusilli', nom: 'fusilli', i: [['Pâtes (fussili)', 180, 'g']], cuis: 10 },
  { t: 'Coquillettes', nom: 'coquillettes', i: [['Pâtes coquillettes', 180, 'g']], cuis: 8 },
  { t: 'Macaroni', nom: 'macaroni', i: [['Macaroni', 180, 'g']], cuis: 9 },
  { t: 'Penne complètes', nom: 'penne complètes', i: [['Pâtes complètes (penne)', 180, 'g']], cuis: 12 },
  { t: 'Orzo', nom: 'orzo', i: [['Pâtes orzo', 180, 'g']], cuis: 8 },
];

const SAUCES_PATES: Sauce[] = [
  ...SAUCES.filter(s => ['tomate-basilic', 'crème-moutarde', 'pesto', 'harissa-tomate', 'ail-persil', 'fromage frais-ciboulette', 'olives-tomate', 'vin blanc-échalote', 'citron-herbes', 'curry-coco', 'paprika-yaourt'].includes(s.t)),
  { t: 'ricotta-citron', c: 'Italienne', i: [['Ricotta légère', 120, 'g'], ['Citron', 0.5, 'pcs']], x: 'Mélangez 120 g de ricotta avec le zeste et le jus d’un demi-citron, du sel et du poivre' },
  { t: 'parmesan-poivre', c: 'Italienne', i: [['Parmesan', 30, 'g'], ['Crème liquide', 50, 'ml']], x: 'Râpez 30 g de parmesan et mélangez-le avec 50 ml de crème liquide et beaucoup de poivre' },
  { t: 'crème-citron', c: 'Italienne', i: [['Crème fraîche', 100, 'g'], ['Citron', 1, 'pcs']], x: 'Mélangez 100 g de crème fraîche avec le zeste râpé et le jus d’un citron, du sel et du poivre' },
  { t: 'tomate-piment', c: 'Italienne', i: [['Tomate concassée (bte)', 200, 'g'], ['Piment frais', 1, 'pcs'], ['Ail', 2, 'pcs']], x: 'Mélangez la tomate concassée avec 2 gousses d’ail pressées et 1 piment frais épépiné et finement haché' },
  { t: 'mascarpone-parmesan', c: 'Italienne', i: [['Mascarpone', 80, 'g'], ['Parmesan', 25, 'g']], x: 'Mélangez 80 g de mascarpone avec 25 g de parmesan râpé et du poivre' },
];

export function pates(n: number): RecetteSaisie[] {
  return combiner<[Pate, Proteine, Legume, Sauce]>([PATES, PROTEINES.filter(p => !p.t.startsWith('Faux-filet') && !p.t.startsWith('Magret')), LEGUMES.filter(l => !['au chou blanc', 'à la courge butternut'].includes(l.t)), SAUCES_PATES], n, 103).map(([pa, p, v, s]) =>
    recette('plat', `${pa.t} ${p.a} et ${v.t}, sauce ${s.t}`,
      p.prep + v.prep + 2, Math.max(pa.cuis, p.cuis + v.cuis + 3),
      [...pa.i, ...p.i, ...v.i, ...s.i],
      [`Faites cuire les ${pa.nom} ${pa.cuis} min dans une grande casserole d’eau bouillante salée (1 L d’eau pour 100 g de pâtes), réservez une louche d’eau de cuisson puis égouttez-les.`,
        `${p.x}.`, `${v.x}.`, `${s.x}.`,
        `Versez la sauce dans la poêle, ajoutez le contenu de l’assiette réservée et les pâtes égouttées, puis mélangez 1 min à feu moyen en ajoutant 2 à 3 cuillères à soupe d’eau de cuisson pour obtenir une sauce onctueuse.`,
        'Répartissez dans deux assiettes creuses.'],
      ['Casserole', 'Poêle'], s.c, 3));
}

// ─── 4. Pommes de terre ──────────────────────────────────────────────────────

interface Garn { t: string; i: L[]; x: string; vege?: boolean }
const GARNITURES_PDT: Garn[] = [
  { t: 'thon et fromage frais', i: [['Thon au naturel', 160, 'g'], ['Fromage frais', 100, 'g'], ['Ciboulette', 5, 'g']], x: 'Égouttez le thon, émiettez-le et mélangez-le avec le fromage frais et la ciboulette ciselée' },
  { t: 'saumon fumé et crème', i: [['Saumon fumé', 120, 'g'], ['Crème fraîche', 80, 'g'], ['Aneth', 5, 'g']], x: 'Coupez le saumon fumé en lanières et mélangez-le avec la crème fraîche et l’aneth ciselé' },
  { t: 'jambon et emmental', i: [['Jambon blanc', 120, 'g'], ['Emmental', 60, 'g'], ['Fromage blanc', 100, 'g']], x: 'Coupez le jambon en petits dés et mélangez-le avec l’emmental râpé et le fromage blanc' },
  { t: 'poulet et moutarde', i: [['Blanc de poulet cuit', 200, 'g'], ['Moutarde', 15, 'g'], ['Fromage blanc', 100, 'g']], x: 'Effilochez le poulet cuit et mélangez-le avec la moutarde et le fromage blanc' },
  { t: 'lardons et oignons', i: [['Lardons', 120, 'g'], ['Oignon', 1, 'pcs'], ['Crème fraîche', 60, 'g']], x: 'Faites revenir les lardons 4 min avec l’oignon émincé dans une poêle sans matière grasse, puis ajoutez la crème fraîche et laissez épaissir 1 min' },
  { t: 'chèvre et miel', i: [['Chèvre frais', 120, 'g'], ['Miel', 1, 'cas'], ['Noix', 20, 'g']], x: 'Écrasez le chèvre frais à la fourchette avec le miel et les noix concassées', vege: true },
  { t: 'reblochon et lardons', i: [['Reblochon', 120, 'g'], ['Lardons fumés', 100, 'g'], ['Oignon', 1, 'pcs']], x: 'Faites revenir les lardons fumés avec l’oignon émincé 4 min, puis coupez le reblochon en tranches' },
  { t: 'chorizo et poivron', i: [['Chorizo', 80, 'g'], ['Poivron rouge', 100, 'g'], ['Fromage râpé', 50, 'g']], x: 'Coupez le chorizo en rondelles et le poivron en petits dés, faites-les revenir 4 min à la poêle' },
  { t: 'champignons et crème', i: [['Champignons de Paris', 200, 'g'], ['Crème fraîche', 80, 'g'], ['Persil', 5, 'g'], ['Jambon de dinde', 100, 'g']], x: 'Faites sauter les champignons émincés 5 min à feu vif avec le jambon de dinde en dés, puis ajoutez la crème et le persil ciselé' },
  { t: 'épinards et ricotta', i: [['Épinards frais', 150, 'g'], ['Ricotta légère', 150, 'g'], ['Parmesan', 20, 'g'], ['Œuf', 1, 'pcs']], x: 'Faites tomber les épinards 2 min à la poêle, pressez-les, puis mélangez-les avec la ricotta, le parmesan râpé et l’œuf', vege: true },
  { t: 'haricots blancs et tomate', i: [['Haricots blancs (bte)', 240, 'g'], ['Tomate concassée (bte)', 150, 'g'], ['Fromage râpé', 50, 'g']], x: 'Réchauffez les haricots blancs égouttés avec la tomate concassée 5 min à feu moyen', vege: true },
  { t: 'sardines et citron', i: [['Sardines (bte)', 150, 'g'], ['Citron', 0.5, 'pcs'], ['Fromage frais', 80, 'g']], x: 'Égouttez les sardines, écrasez-les grossièrement avec le jus de citron et le fromage frais' },
  { t: 'crevettes et ail', i: [['Crevettes', 200, 'g'], ['Ail', 2, 'pcs'], ['Persil', 8, 'g']], x: 'Faites sauter les crevettes 3 min à feu vif avec l’ail haché, puis ajoutez le persil ciselé' },
  { t: 'dinde et brocoli', i: [['Filet de dinde', 200, 'g'], ['Brocoli', 200, 'g'], ['Fromage râpé', 50, 'g']], x: 'Faites sauter la dinde en dés 6 min à la poêle, ajoutez le brocoli cuit 4 min à l’eau bouillante et mélangez' },
  { t: 'poireau et jambon', i: [['Poireau', 200, 'g'], ['Jambon blanc', 100, 'g'], ['Crème fraîche', 60, 'g']], x: 'Faites fondre le poireau émincé 8 min à la poêle avec un peu d’eau, ajoutez le jambon en dés et la crème fraîche' },
  { t: 'œufs et fromage', i: [['Œuf', 4, 'pcs'], ['Gruyère râpé', 60, 'g']], x: 'Prévoyez les œufs et le gruyère râpé pour finir la cuisson', vege: true },
  { t: 'maquereau et moutarde', i: [['Maquereau', 150, 'g'], ['Moutarde à l’ancienne', 15, 'g'], ['Fromage blanc', 100, 'g']], x: 'Émiettez le maquereau et mélangez-le avec la moutarde à l’ancienne et le fromage blanc' },
  { t: 'tofu et curcuma', i: [['Tofu ferme', 250, 'g'], ['Curcuma', 1, 'cac'], ['Épinards frais', 100, 'g']], x: 'Émiettez le tofu et faites-le revenir 5 min avec le curcuma, puis ajoutez les épinards 2 min', vege: true },
];

type Fp = (g: Garn, k: number) => RecetteSaisie;
const farcies: Fp = g => recette('plat', `Pommes de terre farcies ${g.t}`, 15, 55,
  [['Pomme de terre', 700, 'g'], ...g.i, ['Huile d’olive', 10, 'ml']],
  ['Préchauffez le four à 200 °C. Brossez les pommes de terre sous l’eau, piquez-les à la fourchette, frottez-les d’huile d’olive et de sel, puis enfournez-les 45 à 50 min jusqu’à ce que la pointe d’un couteau s’enfonce sans résistance.',
    `${g.x}.`,
    'Ouvrez les pommes de terre en deux dans la longueur sans les séparer, écrasez légèrement la chair à la fourchette, puis garnissez de la préparation.',
    'Remettez au four 5 à 8 min sous le gril pour dorer le dessus.'],
  ['Four', 'Plat à gratin'], 'Française', 2);

const gratins: Fp = g => recette('plat', `Gratin de pommes de terre ${g.t}`, 20, 45,
  [['Pomme de terre', 700, 'g'], ...g.i, ['Crème liquide', 100, 'ml'], ['Lait', 100, 'ml'], ['Ail', 1, 'pcs']],
  ['Préchauffez le four à 190 °C. Épluchez les pommes de terre et coupez-les en rondelles de 3 mm, sans les rincer pour garder leur amidon.',
    `${g.x}.`,
    'Frottez un plat à gratin avec l’ail, puis disposez la moitié des pommes de terre, salez, poivrez, répartissez la préparation, puis recouvrez du reste des pommes de terre.',
    'Mélangez la crème et le lait, versez sur le gratin et couvrez de papier d’aluminium.',
    'Enfournez 30 min, retirez l’aluminium et poursuivez 15 min pour dorer le dessus : la pointe d’un couteau doit s’enfoncer sans résistance.'],
  ['Four', 'Plat à gratin'], 'Française', 3);

const sautees: Fp = g => recette('plat', `Pommes de terre sautées ${g.t}`, 12, 30,
  [['Pomme de terre', 600, 'g'], ...g.i, ['Huile d’olive', 20, 'ml'], ['Ail', 1, 'pcs']],
  ['Épluchez les pommes de terre, coupez-les en cubes de 2 cm et faites-les cuire 8 min à l’eau bouillante salée, puis égouttez-les et séchez-les.',
    'Faites chauffer l’huile d’olive dans une grande poêle et faites sauter les pommes de terre 12 à 15 min à feu moyen-vif en les retournant, jusqu’à ce qu’elles soient bien dorées et croustillantes.',
    `${g.x}.`,
    'Ajoutez l’ail écrasé aux pommes de terre 1 min avant la fin, puis incorporez la préparation et mélangez 2 min à feu moyen.'],
  ['Casserole', 'Poêle'], 'Française', 2);

const tiedes: Fp = g => recette('plat', `Salade tiède de pommes de terre ${g.t}`, 15, 20,
  [['Pomme de terre', 600, 'g'], ...g.i, ['Moutarde', 15, 'g'], ['Vinaigre de cidre', 15, 'ml'], ['Huile d’olive', 20, 'ml'], ['Échalote', 1, 'pcs']],
  ['Lavez les pommes de terre et faites-les cuire 18 à 20 min à l’eau bouillante salée, jusqu’à ce que la pointe d’un couteau s’enfonce sans résistance.',
    'Préparez la vinaigrette : fouettez la moutarde, le vinaigre de cidre, l’huile d’olive, l’échalote ciselée, du sel et du poivre.',
    `${g.x}.`,
    'Égouttez les pommes de terre, pelez-les encore tièdes, coupez-les en rondelles épaisses et arrosez-les aussitôt de vinaigrette pour qu’elles l’absorbent.',
    'Ajoutez la préparation et mélangez délicatement.'],
  ['Casserole', 'Saladier'], 'Française', 2);

export function plats_pommes_de_terre(n: number): RecetteSaisie[] {
  const fabriques = [farcies, gratins, sautees, tiedes];
  return combiner<[Garn, number]>([GARNITURES_PDT, [0, 1, 2, 3]], n, 104).map(([g, f], k) => fabriques[f](g, k));
}

// ─── 5. Wraps, pitas, burgers, croques, tartines, galettes ──────────────────

interface Format { t: string; i: L[]; x: string; ust: string[]; prep: number; cuis: number }
const FORMATS: Format[] = [
  { t: 'Wrap', i: [['Tortillas de blé', 4, 'pcs']], x: 'Réchauffez les tortillas 20 secondes par face dans une poêle sèche. Étalez un peu de sauce au centre, répartissez la garniture, repliez les côtés puis roulez serré ; coupez en deux en biais', ust: ['Poêle'], prep: 5, cuis: 2 },
  { t: 'Pita garni', i: [['Pains pita', 2, 'pcs']], x: 'Réchauffez les pains pita 1 min par face à la poêle, ouvrez-les en poche, tartinez l’intérieur de sauce puis garnissez', ust: ['Poêle'], prep: 5, cuis: 2 },
  { t: 'Burger maison', i: [['Pains burger', 2, 'pcs']], x: 'Coupez les pains burger en deux et faites-les toaster 1 min côté mie dans la poêle chaude ; tartinez de sauce, garnissez et refermez', ust: ['Poêle'], prep: 5, cuis: 2 },
  { t: 'Croque', i: [['Pain de mie', 4, 'tranche'], ['Emmental', 60, 'g'], ['Beurre', 10, 'g']], x: 'Beurrez l’extérieur des tranches de pain de mie, garnissez l’intérieur de sauce, de la préparation et d’emmental râpé, refermez et faites dorer 3 min par face à feu moyen sous couvercle, jusqu’à ce que le fromage fonde', ust: ['Poêle'], prep: 5, cuis: 7 },
  { t: 'Tartines gratinées', i: [['Pain de campagne', 4, 'tranche'], ['Gruyère râpé', 60, 'g']], x: 'Préchauffez le gril du four. Faites griller les tranches de pain de campagne 2 min, tartinez de sauce, garnissez, parsemez de gruyère râpé et passez 4 à 5 min sous le gril jusqu’à ce que le fromage soit doré', ust: ['Four', 'Plaque'], prep: 5, cuis: 8 },
  { t: 'Galettes de sarrasin garnies', i: [['Galette de sarrasin', 4, 'pcs'], ['Emmental', 60, 'g'], ['Œuf', 2, 'pcs']], x: 'Faites chauffer une poêle, posez une galette, cassez un œuf au centre, ajoutez la garniture et le fromage, laissez cuire 3 min, puis repliez les quatre côtés en carré ; recommencez avec la seconde galette', ust: ['Poêle'], prep: 5, cuis: 8 },
];

interface Remplissage { a: string; i: L[]; x: string; prep: number; cuis: number }
const FROIDS: Remplissage[] = [
  { a: 'au poulet froid', i: [['Blanc de poulet cuit', 220, 'g']], x: 'Effilochez le poulet cuit', prep: 3, cuis: 0 },
  { a: 'au thon', i: [['Thon au naturel', 200, 'g']], x: 'Égouttez et émiettez le thon', prep: 3, cuis: 0 },
  { a: 'au saumon fumé', i: [['Saumon fumé', 140, 'g']], x: 'Coupez le saumon fumé en lanières', prep: 2, cuis: 0 },
  { a: 'au jambon de dinde', i: [['Jambon de dinde', 6, 'tranche'], ['Emmental', 40, 'g']], x: 'Préparez les tranches de jambon de dinde et l’emmental en lamelles', prep: 2, cuis: 0 },
  { a: 'aux œufs durs', i: [['Œuf', 4, 'pcs']], x: 'Faites cuire les œufs 9 min à l’eau bouillante, plongez-les dans l’eau froide, écalez-les et coupez-les en rondelles', prep: 3, cuis: 10 },
  { a: 'à la mozzarella', i: [['Mozzarella', 200, 'g'], ['Jambon cru', 60, 'g']], x: 'Coupez la mozzarella en tranches et le jambon cru en lanières', prep: 3, cuis: 0 },
  { a: 'au chèvre', i: [['Chèvre frais', 150, 'g'], ['Jambon de dinde', 4, 'tranche']], x: 'Émiettez le chèvre frais et préparez le jambon de dinde', prep: 3, cuis: 0 },
  { a: 'aux sardines', i: [['Sardines (bte)', 180, 'g']], x: 'Égouttez les sardines et écrasez-les grossièrement à la fourchette', prep: 2, cuis: 0 },
  { a: 'au surimi', i: [['Surimi', 200, 'g'], ['Œuf', 2, 'pcs']], x: 'Coupez le surimi en tronçons ; faites durcir les œufs 9 min à l’eau bouillante, écalez-les et tranchez-les', prep: 4, cuis: 10 },
];

const GARNIS: Cru[] = [
  { t: 'avocat-tomate', i: [['Avocat', 1, 'pcs'], ['Tomate', 1, 'pcs']], x: 'Coupez l’avocat en lamelles et la tomate en fines rondelles' },
  { t: 'salade-concombre', i: [['Salade verte', 60, 'g'], ['Concombre', 0.5, 'pcs']], x: 'Lavez et essorez la salade, coupez le concombre en rondelles' },
  { t: 'carottes râpées-chou rouge', i: [['Carotte', 100, 'g'], ['Chou rouge', 80, 'g']], x: 'Râpez la carotte et émincez finement le chou rouge' },
  { t: 'oignon rouge-roquette', i: [['Oignon rouge', 0.5, 'pcs'], ['Roquette', 40, 'g']], x: 'Émincez l’oignon rouge en fines lamelles et rincez la roquette' },
  { t: 'poivron-maïs', i: [['Poivron rouge', 100, 'g'], ['Maïs doux (bte)', 80, 'g']], x: 'Coupez le poivron en lanières et égouttez le maïs' },
  { t: 'tomate-basilic', i: [['Tomate', 2, 'pcs'], ['Basilic', 5, 'g']], x: 'Coupez les tomates en rondelles et ciselez le basilic' },
  { t: 'betterave-feta', i: [['Betterave cuite', 100, 'g'], ['Feta', 60, 'g']], x: 'Coupez la betterave cuite en dés et émiettez la feta' },
  { t: 'champignons-épinards', i: [['Champignons de Paris', 120, 'g'], ['Épinards frais', 60, 'g']], x: 'Émincez les champignons et rincez les jeunes épinards' },
  { t: 'courgette-menthe', i: [['Courgette', 150, 'g'], ['Menthe fraîche', 4, 'g']], x: 'Taillez la courgette en rubans et ciselez la menthe' },
  { t: 'concombre-radis', i: [['Concombre', 0.5, 'pcs'], ['Radis', 80, 'g']], x: 'Coupez le concombre en rondelles et les radis en lamelles' },
];

const SAUCES_SANDWICH: Sauce[] = [
  ...SAUCES.filter(s => ['paprika-yaourt', 'tahini-citron', 'fromage frais-ciboulette', 'barbecue', 'sriracha-miel', 'pesto', 'crème-moutarde'].includes(s.t)),
  { t: 'yaourt-citron', c: 'Méditerranéenne', i: [['Yaourt grec', 100, 'g'], ['Citron', 0.5, 'pcs']], x: 'Mélangez 100 g de yaourt grec avec le jus d’un demi-citron, du sel et du poivre' },
  { t: 'moutarde-miel', c: 'Française', i: [['Moutarde', 15, 'g'], ['Miel', 1, 'cac'], ['Yaourt grec', 60, 'g']], x: 'Mélangez la moutarde, le miel et 60 g de yaourt grec' },
  { t: 'harissa-yaourt', c: 'Marocaine', i: [['Harissa', 10, 'g'], ['Yaourt grec', 100, 'g']], x: 'Mélangez 10 g de harissa avec 100 g de yaourt grec' },
];

export function sandwichs(n: number): RecetteSaisie[] {
  const chauds: Remplissage[] = PROTEINES.filter(p => !p.vege && !/Saint-Jacques|Magret|Merguez|Saucisses|Calamars|Gambas/.test(p.t)).map(p => ({ a: p.a, i: p.i, x: p.x, prep: p.prep, cuis: p.cuis }));
  const vegetariens: Remplissage[] = PROTEINES.filter(p => p.vege).map(p => ({ a: p.a, i: p.i, x: p.x, prep: p.prep, cuis: p.cuis }));
  const remplissages = [...chauds, ...vegetariens, ...FROIDS];
  return combiner<[Format, Remplissage, Cru, Sauce]>([FORMATS, remplissages, GARNIS, SAUCES_SANDWICH], n, 105).map(([f, r, g, s]) =>
    recette('plat', `${f.t} ${r.a} et ${g.t}, sauce ${s.t}`,
      f.prep + r.prep + 4, f.cuis + r.cuis,
      [...f.i, ...r.i, ...g.i, ...s.i],
      [`${r.x}.`, `${g.x}.`, `${s.x}.`, `${f.x}.`],
      [...new Set([...f.ust, ...(r.cuis > 2 ? ['Poêle'] : [])])], s.c, 1));
}

// ─── 6. Plats au four : une plaque, protéine + légumes ──────────────────────

interface PlaqueP { t: string; i: L[]; four: number; temp: number; prep: number; test: string; vege?: boolean }
const PLAQUE_PROTEINES: PlaqueP[] = [
  { t: 'Cuisses de poulet rôties', i: [['Cuisses de poulet', 700, 'g']], four: 40, temp: 200, prep: 5, test: 'le jus doit être clair et la chair se détacher facilement (74 °C à cœur)' },
  { t: 'Pilons de poulet rôtis', i: [['Pilons de poulet', 700, 'g']], four: 40, temp: 200, prep: 5, test: 'le jus doit être clair et la chair se détacher facilement (74 °C à cœur)' },
  { t: 'Filets de poulet rôtis', i: [['Filet de poulet', 350, 'g']], four: 22, temp: 200, prep: 5, test: 'la chair doit être blanche et ferme à cœur (74 °C)' },
  { t: 'Saucisses de Toulouse au four', i: [['Saucisse de Toulouse', 350, 'g']], four: 25, temp: 200, prep: 3, test: 'elles doivent être dorées et cuites à cœur' },
  { t: 'Filet mignon de porc rôti', i: [['Filet mignon de porc', 400, 'g']], four: 25, temp: 200, prep: 5, test: 'la chair doit être à peine rosée à cœur (63 °C), laissez reposer 5 min avant de trancher' },
  { t: 'Pavés de saumon rôtis', i: [['Pavé de saumon', 300, 'g']], four: 12, temp: 200, prep: 3, test: 'la chair doit être nacrée au centre' },
  { t: 'Cabillaud rôti', i: [['Filet de cabillaud', 320, 'g']], four: 12, temp: 200, prep: 3, test: 'la chair doit s’effeuiller facilement' },
  { t: 'Filets de dinde rôtis', i: [['Filet de dinde', 350, 'g']], four: 22, temp: 200, prep: 5, test: 'la chair doit être blanche et ferme à cœur (74 °C)' },
  { t: 'Merguez rôties', i: [['Merguez', 350, 'g']], four: 20, temp: 200, prep: 2, test: 'elles doivent être dorées et cuites à cœur' },
  { t: 'Côtes de porc rôties', i: [['Côte de porc', 400, 'g']], four: 22, temp: 200, prep: 3, test: 'le jus doit être clair' },
  { t: 'Tofu rôti', i: [['Tofu ferme', 320, 'g']], four: 25, temp: 200, prep: 12, test: 'les cubes doivent être dorés et fermes', vege: true },
  { t: 'Pois chiches rôtis', i: [['Pois chiches (bte)', 400, 'g']], four: 25, temp: 200, prep: 3, test: 'ils doivent être dorés et légèrement croustillants', vege: true },
  { t: 'Halloumi rôti', i: [['Halloumi', 220, 'g']], four: 12, temp: 200, prep: 3, test: 'il doit être doré sur les bords', vege: true },
];

interface PlaqueV { t: string; i: L[]; x: string; temps: number }
const PLAQUE_LEGUMES: PlaqueV[] = [
  { t: 'pommes de terre', i: [['Pomme de terre', 500, 'g']], x: 'Coupez les pommes de terre en quartiers (non épluchées si elles sont bien brossées)', temps: 40 },
  { t: 'patates douces', i: [['Patate douce', 450, 'g']], x: 'Coupez la patate douce en bâtonnets épais', temps: 35 },
  { t: 'carottes', i: [['Carotte', 350, 'g']], x: 'Épluchez les carottes et coupez-les en tronçons de 4 cm', temps: 35 },
  { t: 'courgettes', i: [['Courgette', 350, 'g']], x: 'Coupez les courgettes en gros demi-rondelles', temps: 25 },
  { t: 'brocoli', i: [['Brocoli', 350, 'g']], x: 'Détaillez le brocoli en bouquets', temps: 22 },
  { t: 'chou-fleur', i: [['Chou-fleur', 400, 'g']], x: 'Détaillez le chou-fleur en bouquets moyens', temps: 30 },
  { t: 'fenouil', i: [['Fenouil', 350, 'g']], x: 'Coupez le fenouil en quartiers', temps: 30 },
  { t: 'poivrons', i: [['Poivron rouge', 150, 'g'], ['Poivron jaune', 150, 'g']], x: 'Épépinez les poivrons et coupez-les en larges lanières', temps: 25 },
  { t: 'courge butternut', i: [['Courge butternut', 400, 'g']], x: 'Épluchez la courge butternut et coupez-la en cubes de 3 cm', temps: 35 },
  { t: 'panais', i: [['Panais', 350, 'g']], x: 'Épluchez les panais et coupez-les en bâtonnets', temps: 35 },
  { t: 'aubergines', i: [['Aubergine', 350, 'g']], x: 'Coupez les aubergines en cubes de 3 cm', temps: 30 },
  { t: 'champignons', i: [['Champignons de Paris', 300, 'g']], x: 'Essuyez les champignons et coupez-les en deux', temps: 25 },
  { t: 'haricots verts', i: [['Haricots verts', 300, 'g']], x: 'Équeutez les haricots verts', temps: 22 },
  { t: 'tomates cerises', i: [['Tomates cerises', 300, 'g']], x: 'Gardez les tomates cerises entières', temps: 18 },
  { t: 'topinambours', i: [['Topinambour', 400, 'g']], x: 'Brossez les topinambours et coupez-les en deux', temps: 30 },
  { t: 'choux de Bruxelles', i: [['Chou de Bruxelles', 350, 'g']], x: 'Coupez les choux de Bruxelles en deux', temps: 28 },
];

interface Epice { t: string; c: string; i: L[]; x: string }
const EPICES: Epice[] = [
  { t: 'au paprika fumé', c: 'Espagnole', i: [['Paprika fumé', 2, 'cac'], ['Ail', 2, 'pcs']], x: 'le paprika fumé et l’ail écrasé' },
  { t: 'aux herbes de Provence', c: 'Française', i: [['Herbes de Provence', 2, 'cac'], ['Ail', 2, 'pcs']], x: 'les herbes de Provence et l’ail écrasé' },
  { t: 'au ras-el-hanout', c: 'Marocaine', i: [['Ras-el-hanout', 6, 'g'], ['Citron', 0.5, 'pcs']], x: 'le ras-el-hanout et le jus du demi-citron' },
  { t: 'au curry', c: 'Indienne', i: [['Curry en poudre', 2, 'cac'], ['Yaourt nature', 60, 'g']], x: 'le curry et le yaourt nature' },
  { t: 'au cumin et au citron', c: 'Méditerranéenne', i: [['Cumin', 2, 'cac'], ['Citron', 1, 'pcs']], x: 'le cumin et le jus du citron' },
  { t: 'au zaatar', c: 'Libanaise', i: [['Zaatar', 6, 'g'], ['Citron', 0.5, 'pcs']], x: 'le zaatar et le jus du demi-citron' },
  { t: 'au thym et au citron', c: 'Française', i: [['Thym', 3, 'g'], ['Citron', 1, 'pcs']], x: 'le thym et le zeste du citron' },
  { t: 'à la harissa', c: 'Marocaine', i: [['Harissa', 15, 'g'], ['Ail', 1, 'pcs']], x: 'la harissa et l’ail écrasé' },
  { t: 'à l’origan et à l’ail', c: 'Grecque', i: [['Origan', 2, 'cac'], ['Ail', 3, 'pcs']], x: 'l’origan et l’ail écrasé' },
  { t: 'au miel et à la moutarde', c: 'Française', i: [['Miel', 1, 'cas'], ['Moutarde', 20, 'g']], x: 'le miel et la moutarde' },
  { t: 'au sumac', c: 'Libanaise', i: [['Sumac', 6, 'g'], ['Ail', 1, 'pcs']], x: 'le sumac et l’ail écrasé' },
];

export function platsAuFour(n: number): RecetteSaisie[] {
  return combiner<[PlaqueP, PlaqueV, PlaqueV, Epice]>([PLAQUE_PROTEINES, PLAQUE_LEGUMES, PLAQUE_LEGUMES, EPICES], n * 2, 106)
    .filter(([, v1, v2]) => v1.t !== v2.t).slice(0, n).map(([p, v1, v2, e]) => {
      const dureeLeg = Math.max(v1.temps, v2.temps);
      const avant = Math.max(0, dureeLeg - p.four);
      return recette('plat', `${p.t} aux ${v1.t} et aux ${v2.t}, ${e.t}`,
        p.prep + 10, dureeLeg,
        [...p.i, ...v1.i, ...v2.i, ...e.i, ['Huile d’olive', 30, 'ml']],
        [`Préchauffez le four à ${p.temp} °C et recouvrez une grande plaque de papier cuisson.`,
          `${v1.x}. ${v2.x}. Mélangez-les sur la plaque avec 20 ml d’huile d’olive, du sel, du poivre, ${e.x}.`,
          avant > 0 ? `Enfournez les légumes ${avant} min seuls, en les remuant à mi-cuisson.` : 'Gardez les légumes de côté pendant la préparation de la protéine.',
          `Séchez la protéine, enrobez-la de 10 ml d’huile d’olive, de sel, de poivre et d’un peu du mélange d’épices, puis posez-la sur la plaque${avant > 0 ? ' avec les légumes' : ' à côté des légumes'}${avant === 0 ? ' et enfournez le tout' : ''}.`,
          `Poursuivez la cuisson ${p.four} min en retournant les morceaux à mi-parcours : ${p.test}.`,
          'Laissez reposer 3 min avant de servir.'],
        ['Four', 'Papier cuisson', 'Plaque'], e.c, 3);
    });
}

// ─── 7. Œufs : omelettes, frittatas, brouillés, shakshuka, cocotte ──────────

interface Garni { t: string; i: L[]; x: string }
const GARNIS_OEUFS: Garni[] = [
  { t: 'champignons', i: [['Champignons de Paris', 150, 'g']], x: 'Émincez les champignons et faites-les sauter 5 min à feu vif jusqu’à ce que l’eau soit évaporée' },
  { t: 'jambon', i: [['Jambon blanc', 100, 'g']], x: 'Coupez le jambon en petits dés' },
  { t: 'emmental', i: [['Emmental', 60, 'g']], x: 'Râpez l’emmental' },
  { t: 'épinards', i: [['Épinards frais', 120, 'g']], x: 'Faites tomber les épinards 2 min à la poêle et pressez-les' },
  { t: 'tomates cerises', i: [['Tomates cerises', 150, 'g']], x: 'Coupez les tomates cerises en deux' },
  { t: 'courgette', i: [['Courgette', 200, 'g']], x: 'Coupez la courgette en petits dés et faites-la sauter 5 min à feu vif' },
  { t: 'poivron', i: [['Poivron rouge', 150, 'g']], x: 'Coupez le poivron en petits dés et faites-le sauter 6 min à feu moyen' },
  { t: 'chèvre', i: [['Chèvre frais', 100, 'g']], x: 'Émiettez le chèvre frais' },
  { t: 'saumon fumé', i: [['Saumon fumé', 100, 'g']], x: 'Coupez le saumon fumé en lanières' },
  { t: 'lardons', i: [['Lardons', 100, 'g']], x: 'Faites dorer les lardons 4 min dans une poêle sans matière grasse, puis égouttez-les' },
  { t: 'chorizo', i: [['Chorizo', 70, 'g']], x: 'Coupez le chorizo en petites rondelles et faites-les dorer 2 min à la poêle' },
  { t: 'feta', i: [['Feta', 80, 'g']], x: 'Émiettez la feta' },
  { t: 'petits pois', i: [['Petit pois (surg.)', 120, 'g']], x: 'Faites cuire les petits pois 3 min à l’eau bouillante et égouttez-les' },
  { t: 'asperges', i: [['Asperge verte', 150, 'g']], x: 'Coupez les asperges en tronçons et faites-les sauter 5 min' },
  { t: 'oignon rouge', i: [['Oignon rouge', 1, 'pcs']], x: 'Émincez l’oignon rouge et faites-le fondre 5 min à la poêle' },
  { t: 'thon', i: [['Thon au naturel', 120, 'g']], x: 'Égouttez et émiettez le thon' },
  { t: 'brocoli', i: [['Brocoli', 150, 'g']], x: 'Faites cuire les petits bouquets de brocoli 4 min à l’eau bouillante, égouttez-les' },
  { t: 'poireau', i: [['Poireau', 150, 'g']], x: 'Émincez le poireau et faites-le fondre 7 min à la poêle avec un peu d’eau' },
];

const FORMES_OEUFS: ('omelette' | 'frittata' | 'brouillés' | 'cocotte')[] = ['omelette', 'frittata', 'brouillés', 'cocotte'];

export function platsOeufs(n: number): RecetteSaisie[] {
  return combiner<[Garni, Garni, 'omelette' | 'frittata' | 'brouillés' | 'cocotte']>([GARNIS_OEUFS, GARNIS_OEUFS, FORMES_OEUFS], n * 2, 107)
    .filter(([a, b]) => a.t < b.t).slice(0, n).map(([a, b, f]) => {
      const base: L[] = [['Œuf', 6, 'pcs'], ['Beurre', 10, 'g'], ...a.i, ...b.i];
      const battre = 'Battez les œufs avec du sel et du poivre';
      if (f === 'omelette') return recette('plat', `Omelette ${a.t} et ${b.t}`, 10, 8, base,
        [`${a.x}.`, `${b.x}.`, `${battre}.`, 'Faites fondre le beurre dans une poêle antiadhésive, versez les œufs et laissez cuire 2 min à feu moyen en ramenant les bords vers le centre.', 'Répartissez la garniture sur une moitié, laissez cuire encore 1 à 2 min jusqu’à ce que le dessous soit pris et le dessus encore baveux, puis repliez l’omelette.'], ['Poêle', 'Fouet'], 'Française', 1);
      if (f === 'frittata') return recette('plat', `Frittata ${a.t} et ${b.t}`, 10, 18, base,
        ['Préchauffez le four à 190 °C.', `${a.x}.`, `${b.x}.`, `${battre}, puis ajoutez les garnitures.`, 'Faites fondre le beurre dans une poêle allant au four, versez le mélange et laissez prendre 3 min à feu moyen.', 'Enfournez 10 à 12 min jusqu’à ce que la frittata soit gonflée et dorée, sans trace liquide au centre.'], ['Poêle allant au four', 'Four', 'Fouet'], 'Italienne', 2);
      if (f === 'brouillés') return recette('plat', `Œufs brouillés ${a.t} et ${b.t} sur toasts`, 10, 8, [...base, ['Pain complet', 4, 'tranche']],
        [`${a.x}.`, `${b.x}.`, 'Faites griller les tranches de pain complet.', `${battre}.`, 'Faites fondre le beurre dans une casserole à feu doux, versez les œufs et remuez sans cesse à la spatule 4 à 5 min jusqu’à obtenir une texture crémeuse, encore légèrement brillante.', 'Incorporez les garnitures hors du feu, puis dressez sur les toasts.'], ['Casserole', 'Grille-pain'], 'Française', 1);
      return recette('plat', `Œufs cocotte ${a.t} et ${b.t}`, 10, 15, base,
        ['Préchauffez le four à 180 °C et beurrez deux ramequins.', `${a.x}.`, `${b.x}.`, 'Répartissez les garnitures au fond des ramequins, cassez 3 œufs dans chacun, salez et poivrez.', 'Posez les ramequins dans un plat rempli d’eau chaude à mi-hauteur et enfournez 12 à 15 min : les blancs doivent être pris et les jaunes encore coulants.'], ['Four', 'Ramequins'], 'Française', 1);
    });
}

const SHAKSHUKAS: { t: string; c: string; i: L[]; x: string }[] = [
  { t: 'classique', c: 'Orientale', i: [['Paprika', 1, 'cac'], ['Cumin', 1, 'cac']], x: 'Ajoutez le paprika et le cumin' },
  { t: 'à la feta', c: 'Orientale', i: [['Feta', 80, 'g'], ['Paprika', 1, 'cac']], x: 'Ajoutez le paprika' },
  { t: 'aux épinards', c: 'Orientale', i: [['Épinards frais', 120, 'g'], ['Cumin', 1, 'cac']], x: 'Ajoutez le cumin et les épinards, qui tombent en 2 min' },
  { t: 'aux merguez', c: 'Marocaine', i: [['Merguez', 200, 'g'], ['Harissa', 10, 'g']], x: 'Ajoutez la harissa et les merguez coupées en tronçons, déjà dorées' },
  { t: 'au chorizo', c: 'Espagnole', i: [['Chorizo', 80, 'g'], ['Paprika fumé', 1, 'cac']], x: 'Ajoutez le paprika fumé et le chorizo en rondelles' },
  { t: 'aux pois chiches', c: 'Orientale', i: [['Pois chiches (bte)', 240, 'g'], ['Cumin', 1, 'cac']], x: 'Ajoutez le cumin et les pois chiches égouttés' },
  { t: 'aux aubergines', c: 'Orientale', i: [['Aubergine', 250, 'g'], ['Paprika fumé', 1, 'cac']], x: 'Ajoutez le paprika fumé et l’aubergine en dés, déjà dorée' },
  { t: 'aux courgettes', c: 'Orientale', i: [['Courgette', 250, 'g'], ['Cumin', 1, 'cac']], x: 'Ajoutez le cumin et les courgettes en dés' },
  { t: 'à la ricotta', c: 'Italienne', i: [['Ricotta légère', 100, 'g'], ['Basilic', 5, 'g']], x: 'Ajoutez le basilic ciselé ; la ricotta sera déposée en fin de cuisson' },
  { t: 'aux haricots blancs', c: 'Méditerranéenne', i: [['Haricots blancs (bte)', 240, 'g'], ['Origan', 1, 'cac']], x: 'Ajoutez l’origan et les haricots blancs égouttés' },
];

export function shakshukas(): RecetteSaisie[] {
  return SHAKSHUKAS.map(s => recette('plat', `Shakshuka ${s.t}`, 10, 25,
    [['Tomate concassée (bte)', 400, 'g'], ['Poivron rouge', 150, 'g'], ['Oignon', 1, 'pcs'], ['Ail', 2, 'pcs'], ['Œuf', 4, 'pcs'], ['Huile d’olive', 15, 'ml'], ...s.i],
    ['Émincez l’oignon et le poivron, hachez l’ail.', 'Faites revenir l’oignon et le poivron 6 min dans l’huile d’olive à feu moyen, puis ajoutez l’ail 1 min.',
      `${s.x}, puis versez la tomate concassée. Salez, poivrez et laissez mijoter 10 min à feu doux jusqu’à ce que la sauce épaississe.`,
      'Creusez 4 petits puits dans la sauce, cassez un œuf dans chacun, couvrez et laissez cuire 5 à 6 min : les blancs doivent être pris et les jaunes encore coulants.',
      'Parsemez de feta, de ricotta ou d’herbes selon la version.'],
    ['Poêle à bord haut', 'Couvercle'], s.c, 2));
}

// ─── 8. Salades-repas ────────────────────────────────────────────────────────

interface BaseFroide { t: string; i: L[]; x: string; prep: number; cuis: number }
const BASES_FROIDES: BaseFroide[] = [
  { t: 'lentilles vertes', i: [['Lentilles vertes', 150, 'g']], x: 'Faites cuire les lentilles vertes 20 à 25 min à petit frémissement, égouttez-les et laissez-les tiédir', prep: 2, cuis: 25 },
  { t: 'quinoa', i: [['Quinoa', 150, 'g']], x: 'Rincez le quinoa et faites-le cuire 12 min à couvert dans 2 fois son volume d’eau salée, laissez-le refroidir', prep: 2, cuis: 14 },
  { t: 'boulgour', i: [['Boulgour', 150, 'g']], x: 'Faites gonfler le boulgour 10 min dans 2 fois son volume d’eau bouillante salée, à couvert, puis égrenez-le', prep: 2, cuis: 10 },
  { t: 'semoule', i: [['Semoule', 150, 'g']], x: 'Faites gonfler la semoule 5 min dans un volume égal d’eau bouillante salée, puis égrenez-la avec un filet d’huile d’olive', prep: 2, cuis: 5 },
  { t: 'riz', i: [['Riz basmati', 150, 'g']], x: 'Faites cuire le riz 12 min dans l’eau bouillante salée, égouttez-le et laissez-le refroidir', prep: 2, cuis: 12 },
  { t: 'pâtes', i: [['Pâtes (fussili)', 160, 'g']], x: 'Faites cuire les pâtes 10 min dans l’eau bouillante salée, rincez-les à l’eau froide et égouttez-les', prep: 2, cuis: 10 },
  { t: 'pois chiches', i: [['Pois chiches (bte)', 400, 'g']], x: 'Rincez et égouttez les pois chiches', prep: 2, cuis: 0 },
  { t: 'haricots blancs', i: [['Haricots blancs (bte)', 400, 'g']], x: 'Rincez et égouttez les haricots blancs', prep: 2, cuis: 0 },
  { t: 'épeautre', i: [['Épeautre', 150, 'g']], x: 'Faites cuire l’épeautre 18 à 20 min dans 3 fois son volume d’eau bouillante salée, égouttez-le et laissez-le tiédir', prep: 2, cuis: 20 },
  { t: 'pommes de terre', i: [['Pomme de terre', 500, 'g']], x: 'Faites cuire les pommes de terre entières 20 min à l’eau bouillante salée, puis coupez-les en rondelles tièdes', prep: 3, cuis: 20 },
  { t: 'millet', i: [['Millet', 150, 'g']], x: 'Faites cuire le millet 12 min dans 2 fois son volume d’eau salée, laissez gonfler 5 min et laissez refroidir', prep: 2, cuis: 17 },
];

const PROT_FROIDES: Remplissage[] = [
  ...FROIDS,
  { a: 'aux crevettes', i: [['Crevettes', 250, 'g']], x: 'Faites sauter les crevettes 3 min à la poêle dans un filet d’huile, jusqu’à ce qu’elles soient roses, puis laissez-les tiédir', prep: 3, cuis: 4 },
  { a: 'à la feta', i: [['Feta', 150, 'g'], ['Œuf', 2, 'pcs']], x: 'Coupez la feta en dés ; faites cuire les œufs 9 min à l’eau bouillante, écalez-les et coupez-les en quartiers', prep: 4, cuis: 10 },
  { a: 'au saumon', i: [['Pavé de saumon', 250, 'g']], x: 'Faites cuire le saumon 4 min côté peau puis 2 min de l’autre dans une poêle huilée, puis effeuillez-le', prep: 3, cuis: 7 },
  { a: 'au poulet rôti', i: [['Filet de poulet', 280, 'g']], x: 'Faites cuire le poulet 7 min à la poêle dans un filet d’huile (cuit à cœur), puis tranchez-le', prep: 4, cuis: 8 },
  { a: 'à la dinde', i: [['Filet de dinde', 280, 'g']], x: 'Faites cuire la dinde en lanières 6 min à la poêle dans un filet d’huile, jusqu’à cuisson à cœur', prep: 4, cuis: 7 },
  { a: 'au tofu grillé', i: [['Tofu ferme', 280, 'g']], x: 'Coupez le tofu en cubes et faites-le dorer 8 min à la poêle dans un filet d’huile', prep: 5, cuis: 8 },
  { a: 'au halloumi', i: [['Halloumi', 180, 'g']], x: 'Faites dorer le halloumi en tranches 2 min par face à la poêle sèche', prep: 3, cuis: 5 },
];

const LEGUMES_SALADE: Cru[] = [
  { t: 'concombre et tomates', i: [['Concombre', 1, 'pcs'], ['Tomate', 2, 'pcs']], x: 'Coupez le concombre et les tomates en dés' },
  { t: 'poivron et oignon rouge', i: [['Poivron rouge', 150, 'g'], ['Oignon rouge', 0.5, 'pcs']], x: 'Coupez le poivron en dés et émincez l’oignon rouge' },
  { t: 'carottes et radis', i: [['Carotte', 150, 'g'], ['Radis', 80, 'g']], x: 'Râpez les carottes et coupez les radis en rondelles' },
  { t: 'roquette et tomates cerises', i: [['Roquette', 50, 'g'], ['Tomates cerises', 150, 'g']], x: 'Rincez la roquette et coupez les tomates cerises en deux' },
  { t: 'courgette et menthe', i: [['Courgette', 200, 'g'], ['Menthe fraîche', 5, 'g']], x: 'Coupez la courgette en rubans fins et ciselez la menthe' },
  { t: 'betterave et mâche', i: [['Betterave cuite', 150, 'g'], ['Mâche', 50, 'g']], x: 'Coupez la betterave en dés et rincez la mâche' },
  { t: 'avocat et maïs', i: [['Avocat', 1, 'pcs'], ['Maïs doux (bte)', 100, 'g']], x: 'Coupez l’avocat en dés et égouttez le maïs' },
  { t: 'haricots verts et échalote', i: [['Haricots verts', 200, 'g'], ['Échalote', 1, 'pcs']], x: 'Faites cuire les haricots verts 8 min à l’eau bouillante salée, rafraîchissez-les et ciselez l’échalote' },
  { t: 'fenouil et orange', i: [['Fenouil', 200, 'g'], ['Orange', 1, 'pcs']], x: 'Émincez finement le fenouil et pelez l’orange à vif en quartiers' },
  { t: 'chou rouge et pomme', i: [['Chou rouge', 150, 'g'], ['Pomme', 1, 'pcs']], x: 'Émincez le chou rouge et coupez la pomme en fins bâtonnets' },
];

const VINAIGRETTES: { t: string; i: L[]; x: string }[] = [
  { t: 'à la moutarde', i: [['Moutarde', 15, 'g'], ['Vinaigre de cidre', 15, 'ml'], ['Huile d’olive', 30, 'ml']], x: 'Fouettez la moutarde, le vinaigre de cidre et l’huile d’olive avec du sel et du poivre' },
  { t: 'citron et huile d’olive', i: [['Citron', 1, 'pcs'], ['Huile d’olive', 30, 'ml']], x: 'Fouettez le jus du citron et l’huile d’olive avec du sel et du poivre' },
  { t: 'balsamique', i: [['Vinaigre balsamique', 20, 'ml'], ['Huile d’olive', 30, 'ml']], x: 'Fouettez le vinaigre balsamique et l’huile d’olive avec du sel et du poivre' },
  { t: 'au yaourt et aux herbes', i: [['Yaourt grec', 100, 'g'], ['Ciboulette', 5, 'g'], ['Citron', 0.5, 'pcs']], x: 'Mélangez le yaourt grec, la ciboulette ciselée et le jus du demi-citron, salez et poivrez' },
  { t: 'au tahini', i: [['Tahini', 25, 'g'], ['Citron', 1, 'pcs']], x: 'Fouettez le tahini avec le jus du citron et 3 cuillères à soupe d’eau jusqu’à obtenir une sauce lisse' },
  { t: 'soja et sésame', i: [['Sauce soja', 25, 'ml'], ['Huile de sésame', 10, 'ml'], ['Vinaigre de riz', 10, 'ml']], x: 'Fouettez la sauce soja, l’huile de sésame et le vinaigre de riz' },
];

export function saladesRepas(n: number): RecetteSaisie[] {
  return combiner<[BaseFroide, Remplissage, Cru, { t: string; i: L[]; x: string }]>([BASES_FROIDES, PROT_FROIDES, LEGUMES_SALADE, VINAIGRETTES], n, 108).map(([b, p, v, s]) =>
    recette('plat', `Salade ${de(b.t)} ${p.a}, ${v.t}, vinaigrette ${s.t}`,
      b.prep + p.prep + 6, Math.max(b.cuis, p.cuis),
      [...b.i, ...p.i, ...v.i, ...s.i],
      [`${b.x}.`, `${p.x}.`, `${v.x}.`, `${s.x}.`,
        'Dans un grand saladier, mélangez la base, la protéine et les légumes, versez la vinaigrette, mélangez délicatement et laissez reposer 5 min pour que les saveurs se rejoignent.'],
      ['Saladier', 'Casserole', 'Fouet'], 'Française', 2));
}

