// ============================================================================
// Générateur de recettes ORIGINALES (protéinées, healthy, variées).
//
// Aucun contenu copié : chaque famille de plat a ses étapes rédigées à la
// main, assemblées avec une protéine, un profil de saveurs (marinade, sauce
// ou base mijotée), une base (céréale, féculent, pain) et des légumes réels
// de la table `ingredients`. Les phrases sont accordées (genre / nombre).
//
// Utilisé par scripts/ajouter-recettes-generees.ts, qui calcule les macros,
// filtre (protéines, calories) et retire les doublons avant insertion.
// ============================================================================

import type { RecetteSaisie } from './recettes-proteinees';

type L = [string, number, string, boolean?];

// ─── Accords ────────────────────────────────────────────────────────────────

interface Genre { f: boolean; pl: boolean }
const acc = (adj: string, g: Genre) => adj + (g.f ? 'e' : '') + (g.pl ? 's' : '');
const il = (g: Genre) => (g.f ? 'elle' : 'il') + (g.pl ? 's' : '');
const pro = (g: Genre) => (g.pl ? 'les' : g.f ? 'la' : 'le');
const soit = (g: Genre) => (g.pl ? 'soient' : 'soit');
const doit = (g: Genre) => (g.pl ? 'doivent' : 'doit');
const maj = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** « de » élidé devant voyelle (pas devant h : haricots, halloumi sont aspirés) */
const de = (mot: string) => (/^[aeiouyéèêâîôœ]/i.test(mot) ? `d’${mot}` : `de ${mot}`);
/** Deux légumes sautés : le plus long d'abord, le second ajouté ensuite */
function sauterDeux(a: { le: string; saute?: number }, b: { le: string; saute?: number }, lieu: string): string {
  const [x, y] = (a.saute ?? 5) >= (b.saute ?? 5) ? [a, b] : [b, a];
  const dx = x.saute ?? 5, dy = y.saute ?? 5;
  return dx === dy
    ? `${lieu}, faites sauter ${x.le} et ${y.le} ${dx} min à feu vif.`
    : `${lieu}, faites sauter ${x.le} ${dx - dy} min à feu vif, puis ajoutez ${y.le} et prolongez ${dy} min.`;
}

// ─── Protéines ──────────────────────────────────────────────────────────────

type CatProt = 'volaille' | 'boeuf' | 'hache' | 'poisson' | 'crevette' | 'soja' | 'boite'
  | 'lentille' | 'corail' | 'oeuf' | 'thon' | 'halloumi' | 'cuisse';

interface Proteine extends Genre {
  cle: string; cat: CatProt; ings: L[];
  de: string; au: string; le: string; roti: string;
  croustille?: boolean;
}

const P = (p: Proteine) => p;
const PROTEINES: Proteine[] = [
  P({ cle: 'poulet', cat: 'volaille', ings: [['Filet de poulet', 600, 'g']], de: 'de poulet', au: 'au poulet', le: 'le poulet', roti: 'Poulet rôti', f: false, pl: false }),
  P({ cle: 'dinde', cat: 'volaille', ings: [['Filet de dinde', 600, 'g']], de: 'de dinde', au: 'à la dinde', le: 'la dinde', roti: 'Dinde rôtie', f: true, pl: false }),
  P({ cle: 'porc', cat: 'volaille', ings: [['Filet mignon de porc', 550, 'g']], de: 'de porc', au: 'au porc', le: 'le porc', roti: 'Filet mignon rôti', f: false, pl: false }),
  P({ cle: 'boeuf', cat: 'boeuf', ings: [['Bœuf maigre (filet)', 500, 'g']], de: 'de bœuf', au: 'au bœuf', le: 'le bœuf', roti: 'Bœuf saisi', f: false, pl: false }),
  P({ cle: 'dinde-hachee', cat: 'hache', ings: [['Haché de dinde 7 %', 500, 'g']], de: 'de dinde hachée', au: 'à la dinde hachée', le: 'la dinde hachée', roti: 'Dinde hachée', f: true, pl: false }),
  P({ cle: 'boeuf-hache', cat: 'hache', ings: [['Bœuf haché 5 %', 500, 'g']], de: 'de bœuf haché', au: 'au bœuf haché', le: 'le bœuf haché', roti: 'Bœuf haché', f: false, pl: false }),
  P({ cle: 'cuisses', cat: 'cuisse', ings: [['Cuisses de poulet sans peau', 8, 'pcs']], de: 'de cuisses de poulet', au: 'aux cuisses de poulet', le: 'les cuisses de poulet', roti: 'Cuisses de poulet rôties', f: true, pl: true }),
  P({ cle: 'saumon', cat: 'poisson', ings: [['Pavé de saumon', 4, 'pcs']], de: 'de saumon', au: 'au saumon', le: 'le saumon', roti: 'Saumon rôti', f: false, pl: false }),
  P({ cle: 'cabillaud', cat: 'poisson', ings: [['Filet de cabillaud', 640, 'g']], de: 'de cabillaud', au: 'au cabillaud', le: 'le cabillaud', roti: 'Cabillaud rôti', f: false, pl: false }),
  P({ cle: 'crevettes', cat: 'crevette', ings: [['Crevettes', 500, 'g']], de: 'de crevettes', au: 'aux crevettes', le: 'les crevettes', roti: 'Crevettes rôties', f: true, pl: true }),
  P({ cle: 'thon', cat: 'thon', ings: [['Thon au naturel', 420, 'g']], de: 'de thon', au: 'au thon', le: 'le thon', roti: 'Thon', f: false, pl: false }),
  P({ cle: 'tofu', cat: 'soja', ings: [['Tofu ferme', 500, 'g']], de: 'de tofu', au: 'au tofu', le: 'le tofu', roti: 'Tofu rôti', f: false, pl: false }),
  P({ cle: 'tempeh', cat: 'soja', ings: [['Tempeh', 400, 'g']], de: 'de tempeh', au: 'au tempeh', le: 'le tempeh', roti: 'Tempeh rôti', f: false, pl: false }),
  P({ cle: 'seitan', cat: 'soja', ings: [['Seitan', 400, 'g']], de: 'de seitan', au: 'au seitan', le: 'le seitan', roti: 'Seitan rôti', f: false, pl: false }),
  P({ cle: 'pois-chiches', cat: 'boite', croustille: true, ings: [['Pois chiches (bte)', 800, 'g']], de: 'de pois chiches', au: 'aux pois chiches', le: 'les pois chiches', roti: 'Pois chiches rôtis', f: false, pl: true }),
  P({ cle: 'haricots-rouges', cat: 'boite', ings: [['Haricots rouges (bte)', 800, 'g']], de: 'de haricots rouges', au: 'aux haricots rouges', le: 'les haricots rouges', roti: 'Haricots rouges', f: false, pl: true }),
  P({ cle: 'lentilles-vertes', cat: 'lentille', ings: [['Lentilles vertes', 300, 'g']], de: 'de lentilles', au: 'aux lentilles', le: 'les lentilles', roti: 'Lentilles', f: true, pl: true }),
  P({ cle: 'lentilles-corail', cat: 'corail', ings: [['Lentilles corail', 300, 'g']], de: 'de lentilles corail', au: 'aux lentilles corail', le: 'les lentilles corail', roti: 'Lentilles corail', f: true, pl: true }),
  P({ cle: 'oeufs', cat: 'oeuf', ings: [['Œuf', 8, 'pcs']], de: 'd’œufs', au: 'aux œufs', le: 'les œufs', roti: 'Œufs', f: false, pl: true }),
  P({ cle: 'halloumi', cat: 'halloumi', ings: [['Halloumi', 400, 'g']], de: 'de halloumi', au: 'au halloumi', le: 'le halloumi', roti: 'Halloumi grillé', f: false, pl: false }),
];

const vege = (p: Proteine) => ['soja', 'boite', 'lentille', 'corail', 'oeuf', 'halloumi'].includes(p.cat);

/** Préparation de la protéine (vide si rien à faire). `fin` : lanières (wok, wraps). */
function prepProt(p: Proteine, fin: boolean): string {
  switch (p.cat) {
    case 'volaille': case 'boeuf': return `Coupez ${p.le} en ${fin ? 'fines lanières' : 'morceaux de 3 cm'}.`;
    case 'poisson': return fin ? `Retirez la peau et coupez ${p.le} en gros cubes.` : `Épongez ${p.le} avec du papier absorbant.`;
    case 'crevette': return 'Décortiquez les crevettes et retirez le boyau noir.';
    case 'soja': return `Coupez ${p.le} en cubes et séchez-les dans un torchon propre.`;
    case 'boite': return `Égouttez et rincez ${p.le}.`;
    case 'lentille': case 'corail': return `Rincez ${p.le} sous l’eau froide.`;
    case 'thon': return 'Égouttez le thon et émiettez-le grossièrement.';
    case 'halloumi': return 'Coupez le halloumi en tranches épaisses.';
    case 'cuisse': return 'Entaillez les cuisses de poulet en deux ou trois endroits pour que la marinade pénètre.';
    default: return '';
  }
}

/** Cuisson à la poêle / au wok. */
function poeleProt(p: Proteine): string {
  switch (p.cat) {
    case 'volaille': return `Saisissez ${p.le} 6 à 8 min à feu vif dans un filet d’huile, en remuant, jusqu’à ce qu’${il(p)} ${soit(p)} ${acc('cuit', p)} à cœur.`;
    case 'boeuf': return 'Saisissez le bœuf 2 à 3 min à feu très vif dans un filet d’huile : il doit rester tendre et rosé.';
    case 'hache': return `Faites revenir ${p.le} 6 à 8 min dans un filet d’huile, en l’émiettant à la spatule.`;
    case 'poisson': return `Faites cuire ${p.le} 3 à 4 min par face dans un filet d’huile, sans le remuer : la chair doit rester nacrée à cœur.`;
    case 'crevette': return 'Faites sauter les crevettes 2 à 3 min dans un filet d’huile, jusqu’à ce qu’elles soient bien roses.';
    case 'soja': return `Faites dorer ${p.le} 8 min sur toutes les faces dans un filet d’huile, jusqu’à ce qu’il soit croustillant.`;
    case 'boite': return p.croustille
      ? `Faites rôtir ${p.le} 8 min à la poêle avec un filet d’huile, jusqu’à ce qu’${il(p)} ${soit(p)} ${acc('croustillant', p)}.`
      : `Réchauffez ${p.le} 3 min à la poêle avec un filet d’huile.`;
    case 'lentille': return `Faites cuire ${p.le} 20 min dans une grande casserole d’eau non salée, salez en fin de cuisson et égouttez.`;
    case 'oeuf': return 'Plongez les œufs 7 min dans l’eau bouillante, rafraîchissez-les dans l’eau froide, écalez-les et coupez-les en deux.';
    case 'halloumi': return 'Faites griller le halloumi 2 min par face dans une poêle sans matière grasse, jusqu’à ce qu’il soit bien doré.';
    case 'cuisse': return 'Faites dorer les cuisses de poulet 5 min par face, puis couvrez et laissez cuire 15 min à feu doux.';
    default: return '';
  }
}

/** Minutes de four (plaque) et phrase associée. */
function fourProt(p: Proteine): { min: number; phrase: string } {
  switch (p.cat) {
    case 'volaille': return { min: 20, phrase: `Ajoutez ${p.le} sur la plaque et poursuivez la cuisson 20 min : ${il(p)} ${doit(p)} être ${acc('doré', p)} et ${acc('cuit', p)} à cœur.` };
    case 'cuisse': return { min: 35, phrase: 'Posez les cuisses de poulet sur la plaque dès le début : elles cuisent 35 min, jusqu’à ce que le jus qui s’en écoule soit clair.' };
    case 'poisson': return { min: 12, phrase: `Posez ${p.le} sur la plaque pour les 12 dernières minutes : la chair doit se détacher en lamelles.` };
    case 'crevette': return { min: 8, phrase: 'Ajoutez les crevettes pour les 8 dernières minutes : elles doivent être bien roses.' };
    case 'soja': return { min: 20, phrase: `Ajoutez ${p.le} sur la plaque et poursuivez la cuisson 20 min, jusqu’à ce qu’il soit doré.` };
    case 'boite': return { min: 20, phrase: `Ajoutez ${p.le} sur la plaque et poursuivez la cuisson 20 min : ${il(p)} ${doit(p)} être ${acc('croustillant', p)}.` };
    case 'halloumi': return { min: 10, phrase: 'Ajoutez les tranches de halloumi pour les 10 dernières minutes, jusqu’à ce qu’elles soient dorées.' };
    default: return { min: 0, phrase: '' };
  }
}

// ─── Profils de saveurs ─────────────────────────────────────────────────────

type Tag = 'marinade' | 'asie' | 'mijote' | 'pates' | 'soupe' | 'oeuf' | 'shakshuka';

interface Profil {
  cle: string; titre: string; cuisine: string; tags: Tag[]; ings: L[];
  /** Phrase de préparation de la sauce / marinade */
  sauce?: string;
  /** Mijoté : aromates + épices, puis liquides */
  mijote1?: string; mijote2?: string;
  mijoteTitre?: (p: Proteine) => string;
  /** Titre dans les pâtes (« pesto », « citron et herbes »…) */
  titrePates?: string;
  /** Soupe : aromates + bouillon */
  soupe?: string;
  garniture?: string;
  exclut?: string[];
}

const PROFILS: Profil[] = [
  { cle: 'teriyaki', titre: 'teriyaki', cuisine: 'Japonaise', tags: ['marinade', 'asie'],
    ings: [['Sauce soja', 45, 'ml'], ['Miel', 20, 'g'], ['Gingembre', 15, 'g'], ['Ail', 2, 'pcs'], ['Graines de sésame', 10, 'g']],
    sauce: 'Préparez la sauce teriyaki : mélangez la sauce soja, le miel, le gingembre râpé, l’ail écrasé et 3 cuillères à soupe d’eau.',
    garniture: 'Parsemez de graines de sésame.' },
  { cle: 'gingembre-sesame', titre: 'gingembre-sésame', cuisine: 'Asiatique', tags: ['marinade', 'asie', 'soupe'],
    ings: [['Sauce soja', 40, 'ml'], ['Huile de sésame', 15, 'ml'], ['Gingembre', 20, 'g'], ['Vinaigre de riz', 15, 'ml'], ['Oignon nouveau', 2, 'pcs']],
    sauce: 'Préparez la sauce : mélangez la sauce soja, l’huile de sésame, le vinaigre de riz et le gingembre râpé.',
    soupe: 'Faites revenir le gingembre râpé et le blanc des oignons nouveaux 1 min dans l’huile de sésame, puis versez le bouillon, la sauce soja et le vinaigre de riz.',
    garniture: 'Parsemez du vert des oignons nouveaux émincé.' },
  { cle: 'cacahuete', titre: 'sauce cacahuète', cuisine: 'Thaïlandaise', tags: ['marinade', 'asie'],
    ings: [['Beurre de cacahuète', 60, 'g'], ['Sauce soja', 30, 'ml'], ['Citron vert', 1, 'pcs'], ['Ail', 1, 'pcs'], ['Cacahuètes', 20, 'g']],
    sauce: 'Préparez la sauce cacahuète : fouettez le beurre de cacahuète avec la sauce soja, le jus du citron vert, l’ail râpé et 4 cuillères à soupe d’eau chaude, jusqu’à obtenir une sauce lisse.',
    garniture: 'Parsemez de cacahuètes concassées.' },
  { cle: 'gochujang', titre: 'gochujang', cuisine: 'Coréenne', tags: ['marinade', 'asie'],
    ings: [['Gochujang', 30, 'g'], ['Sauce soja', 30, 'ml'], ['Miel', 15, 'g'], ['Huile de sésame', 10, 'ml'], ['Ail', 2, 'pcs'], ['Graines de sésame', 10, 'g']],
    sauce: 'Préparez la sauce : mélangez le gochujang, la sauce soja, le miel, l’huile de sésame et l’ail râpé.',
    garniture: 'Parsemez de graines de sésame.' },
  { cle: 'miso', titre: 'miso-érable', cuisine: 'Japonaise', tags: ['marinade', 'asie', 'soupe'],
    ings: [['Miso', 40, 'g'], ['Sirop d\'érable', 25, 'g'], ['Vinaigre de riz', 15, 'ml'], ['Gingembre', 10, 'g']],
    sauce: 'Préparez la sauce : délayez le miso avec le sirop d’érable, le vinaigre de riz, le gingembre râpé et 2 cuillères à soupe d’eau.',
    soupe: 'Faites frémir le bouillon avec le gingembre râpé et le vinaigre de riz.' },
  { cle: 'hoisin', titre: 'hoisin', cuisine: 'Asiatique', tags: ['marinade', 'asie'],
    ings: [['Sauce hoisin', 45, 'g'], ['Sauce soja', 15, 'ml'], ['Ail', 2, 'pcs'], ['Oignon nouveau', 2, 'pcs']],
    sauce: 'Préparez la sauce : mélangez la sauce hoisin, la sauce soja, l’ail écrasé et 2 cuillères à soupe d’eau.',
    garniture: 'Parsemez d’oignons nouveaux émincés.' },
  { cle: 'citron-vert-coriandre', titre: 'citron vert-coriandre', cuisine: 'Mexicaine', tags: ['marinade'],
    ings: [['Citron vert', 2, 'pcs'], ['Coriandre fraîche', 15, 'g'], ['Cumin', 1, 'cac'], ['Ail', 1, 'pcs'], ['Huile d’olive', 30, 'ml']],
    sauce: 'Préparez la marinade : mélangez le jus et le zeste des citrons verts, la coriandre ciselée, le cumin, l’ail râpé et l’huile d’olive.' },
  { cle: 'cajun', titre: 'cajun', cuisine: 'Américaine', tags: ['marinade'],
    ings: [['Paprika fumé', 2, 'cac'], ['Cumin', 1, 'cac'], ['Origan', 1, 'cac'], ['Ail', 2, 'pcs'], ['Huile d’olive', 30, 'ml'], ['Citron', 1, 'pcs']],
    sauce: 'Préparez le mélange cajun : paprika fumé, cumin, origan, ail écrasé, huile d’olive et jus du citron.' },
  { cle: 'barbecue', titre: 'barbecue', cuisine: 'Américaine', tags: ['marinade'],
    ings: [['Sauce barbecue', 60, 'g'], ['Paprika fumé', 1, 'cac'], ['Ail', 1, 'pcs']],
    sauce: 'Préparez la marinade : mélangez la sauce barbecue, le paprika fumé et l’ail écrasé.' },
  { cle: 'chimichurri', titre: 'chimichurri', cuisine: 'Péruvienne', tags: ['marinade'],
    ings: [['Persil', 30, 'g'], ['Origan', 1, 'cac'], ['Ail', 2, 'pcs'], ['Vinaigre de Xérès', 15, 'ml'], ['Huile d’olive', 45, 'ml']],
    sauce: 'Préparez le chimichurri : hachez finement le persil et l’ail, mélangez-les avec l’origan, le vinaigre et l’huile d’olive. Salez et poivrez.' },
  { cle: 'citron-herbes', titre: 'citron-herbes', cuisine: 'Méditerranéenne', tags: ['marinade', 'pates', 'soupe', 'oeuf'],
    ings: [['Citron', 1, 'pcs'], ['Herbes de Provence', 1, 'cac'], ['Ail', 2, 'pcs'], ['Huile d’olive', 30, 'ml'], ['Persil', 15, 'g']],
    sauce: 'Préparez la marinade : mélangez le jus et le zeste du citron, les herbes de Provence, l’ail écrasé, l’huile d’olive et le persil ciselé.',
    titrePates: 'citron-herbes',
    soupe: 'Faites revenir l’ail émincé 1 min dans l’huile d’olive, ajoutez les herbes de Provence puis le bouillon. Le jus du citron et le persil seront ajoutés au moment de servir.' },
  { cle: 'grecque', titre: 'à la grecque', cuisine: 'Grecque', tags: ['marinade'],
    ings: [['Citron', 1, 'pcs'], ['Origan', 2, 'cac'], ['Ail', 2, 'pcs'], ['Huile d’olive', 30, 'ml'], ['Yaourt grec 0 %', 150, 'g']],
    sauce: 'Mélangez le jus du citron, l’origan, l’ail écrasé et l’huile d’olive pour la marinade. Pour la sauce, assaisonnez le yaourt grec d’une pincée de sel et d’un filet de citron.' },
  { cle: 'tandoori', titre: 'tandoori', cuisine: 'Indienne', tags: ['marinade'],
    ings: [['Yaourt nature', 1, 'pcs'], ['Garam masala', 2, 'cac'], ['Paprika', 1, 'cac'], ['Curcuma', 1, 'cac'], ['Gingembre', 10, 'g'], ['Ail', 2, 'pcs'], ['Citron', 1, 'pcs']],
    sauce: 'Préparez la marinade tandoori : mélangez le yaourt, le garam masala, le paprika, le curcuma, le gingembre et l’ail râpés et le jus du citron.' },
  { cle: 'harissa-miel', titre: 'harissa-miel', cuisine: 'Marocaine', tags: ['marinade', 'shakshuka'],
    ings: [['Harissa', 20, 'g'], ['Miel', 15, 'g'], ['Citron', 1, 'pcs'], ['Cumin', 1, 'cac'], ['Huile d’olive', 20, 'ml']],
    sauce: 'Préparez la marinade : mélangez la harissa, le miel, le jus du citron, le cumin et l’huile d’olive.' },
  { cle: 'zaatar', titre: 'au zaatar', cuisine: 'Libanaise', tags: ['marinade', 'oeuf', 'shakshuka'],
    ings: [['Zaatar', 15, 'g'], ['Citron', 1, 'pcs'], ['Huile d’olive', 30, 'ml'], ['Ail', 1, 'pcs'], ['Yaourt grec', 150, 'g']],
    sauce: 'Mélangez le zaatar, le jus du citron, l’ail écrasé et l’huile d’olive pour la marinade. Réservez le yaourt grec, assaisonné de sel, pour servir.' },
  { cle: 'sumac', titre: 'sumac-oignon rouge', cuisine: 'Libanaise', tags: ['marinade'],
    ings: [['Sumac', 2, 'cac'], ['Oignon rouge', 1, 'pcs'], ['Citron', 1, 'pcs'], ['Huile d’olive', 30, 'ml'], ['Persil', 15, 'g']],
    sauce: 'Émincez finement l’oignon rouge et faites-le mariner dans le jus du citron avec le sumac. Mélangez l’huile d’olive et la moitié du persil pour enrober la protéine.' },
  { cle: 'tahini', titre: 'tahini-citron', cuisine: 'Libanaise', tags: ['marinade'],
    ings: [['Tahini', 40, 'g'], ['Citron', 1, 'pcs'], ['Ail', 1, 'pcs'], ['Cumin', 1, 'cac'], ['Persil', 10, 'g']],
    sauce: 'Préparez la sauce tahini : fouettez le tahini avec le jus du citron, l’ail râpé, le cumin et 4 à 5 cuillères à soupe d’eau froide, jusqu’à obtenir une sauce crémeuse.',
    garniture: 'Parsemez de persil ciselé.' },
  { cle: 'pesto', titre: 'au pesto', cuisine: 'Italienne', tags: ['marinade', 'pates', 'oeuf'],
    ings: [['Pesto', 60, 'g'], ['Parmesan', 30, 'g'], ['Citron', 1, 'pcs']],
    sauce: 'Détendez le pesto avec le jus du citron et 1 cuillère à soupe d’eau.', titrePates: 'pesto',
    garniture: 'Ajoutez des copeaux de parmesan.' },
  { cle: 'moutarde-miel', titre: 'moutarde-miel', cuisine: 'Française', tags: ['marinade'],
    ings: [['Moutarde à l’ancienne', 30, 'g'], ['Miel', 20, 'g'], ['Citron', 1, 'pcs'], ['Huile d’olive', 20, 'ml'], ['Thym', 2, 'g']],
    sauce: 'Préparez la sauce : mélangez la moutarde à l’ancienne, le miel, le jus du citron, l’huile d’olive et le thym effeuillé.' },
  { cle: 'paprika-fume', titre: 'au paprika fumé', cuisine: 'Espagnole', tags: ['marinade', 'pates', 'oeuf', 'shakshuka'],
    ings: [['Paprika fumé', 2, 'cac'], ['Ail', 2, 'pcs'], ['Huile d’olive', 30, 'ml'], ['Citron', 1, 'pcs']],
    sauce: 'Préparez la marinade : mélangez le paprika fumé, l’ail écrasé, l’huile d’olive et le jus du citron.', titrePates: 'paprika fumé' },
  { cle: 'yaourt-menthe', titre: 'sauce yaourt-menthe', cuisine: 'Turque', tags: ['marinade'],
    ings: [['Yaourt grec 0 %', 200, 'g'], ['Menthe fraîche', 15, 'g'], ['Citron', 1, 'pcs'], ['Ail', 1, 'pcs'], ['Cumin', 1, 'cac'], ['Huile d’olive', 20, 'ml']],
    sauce: 'Mélangez le cumin et l’huile d’olive pour parfumer la cuisson. Pour la sauce, mélangez le yaourt, la menthe ciselée, l’ail râpé et le jus du citron.' },
  { cle: 'ras-el-hanout', titre: 'au ras-el-hanout', cuisine: 'Marocaine', tags: ['marinade', 'shakshuka'],
    ings: [['Ras-el-hanout', 12, 'g'], ['Citron', 1, 'pcs'], ['Miel', 10, 'g'], ['Huile d’olive', 30, 'ml'], ['Coriandre fraîche', 10, 'g']],
    sauce: 'Préparez la marinade : mélangez le ras-el-hanout, le jus du citron, le miel et l’huile d’olive.',
    garniture: 'Parsemez de coriandre ciselée.' },
  { cle: 'ail-persil', titre: 'ail et persil', cuisine: 'Française', tags: ['marinade', 'pates', 'oeuf'],
    ings: [['Ail', 3, 'pcs'], ['Persil', 30, 'g'], ['Huile d’olive', 30, 'ml'], ['Citron', 1, 'pcs']],
    sauce: 'Hachez finement l’ail et le persil, mélangez-les avec l’huile d’olive et le jus du citron.', titrePates: 'ail-persil' },
  // ── Bases mijotées ──
  { cle: 'curry-coco', titre: 'au curry coco', cuisine: 'Indienne', tags: ['mijote', 'soupe'],
    ings: [['Oignon', 1, 'pcs'], ['Ail', 2, 'pcs'], ['Gingembre', 15, 'g'], ['Curry en poudre', 2, 'cac'], ['Lait de coco léger', 400, 'ml'], ['Tomate concassée (bte)', 200, 'g'], ['Coriandre fraîche', 10, 'g']],
    mijote1: 'Faites revenir l’oignon émincé 4 min dans un filet d’huile, ajoutez l’ail et le gingembre râpés puis le curry, et remuez 1 min pour torréfier les épices.',
    mijote2: 'Versez la tomate concassée et le lait de coco léger, portez à frémissement.',
    mijoteTitre: p => `Curry ${p.de} au lait de coco`,
    soupe: 'Faites revenir l’oignon, l’ail et le gingembre 3 min, ajoutez le curry puis le bouillon, la tomate concassée et le lait de coco léger.',
    garniture: 'Parsemez de coriandre ciselée.' },
  { cle: 'curry-vert', titre: 'au curry vert', cuisine: 'Thaïlandaise', tags: ['mijote', 'soupe'],
    ings: [['Pâte de curry vert', 30, 'g'], ['Lait de coco léger', 400, 'ml'], ['Citronnelle', 2, 'pcs'], ['Citron vert', 1, 'pcs'], ['Sauce nuoc mam', 15, 'ml'], ['Basilic thaï', 10, 'g']],
    mijote1: 'Faites revenir la pâte de curry vert 1 min dans un filet d’huile avec la citronnelle écrasée et coupée en tronçons.',
    mijote2: 'Versez le lait de coco léger et le nuoc-mâm, portez à frémissement.',
    mijoteTitre: p => `Curry vert ${p.de}`,
    soupe: 'Faites revenir la pâte de curry vert et la citronnelle écrasée 1 min, versez le bouillon, le lait de coco léger et le nuoc-mâm.',
    garniture: 'Ajoutez le jus du citron vert et le basilic thaï au moment de servir.' },
  { cle: 'tikka', titre: 'façon tikka masala', cuisine: 'Indienne', tags: ['mijote'],
    ings: [['Oignon', 1, 'pcs'], ['Ail', 2, 'pcs'], ['Gingembre', 15, 'g'], ['Garam masala', 2, 'cac'], ['Tomate concassée (bte)', 400, 'g'], ['Yaourt nature', 1, 'pcs']],
    mijote1: 'Faites revenir l’oignon émincé 5 min, ajoutez l’ail et le gingembre râpés et le garam masala, remuez 1 min.',
    mijote2: 'Versez la tomate concassée et laissez réduire 5 min, puis incorporez le yaourt hors du feu vif, en remuant.',
    mijoteTitre: p => `Mijoté ${p.de} façon tikka masala` },
  { cle: 'provencale', titre: 'à la provençale', cuisine: 'Française', tags: ['mijote', 'pates', 'soupe'],
    ings: [['Oignon', 1, 'pcs'], ['Ail', 2, 'pcs'], ['Tomate concassée (bte)', 400, 'g'], ['Herbes de Provence', 2, 'cac'], ['Olives noires', 50, 'g']],
    mijote1: 'Faites revenir l’oignon émincé 4 min dans un filet d’huile d’olive, puis l’ail haché 1 min.',
    mijote2: 'Ajoutez la tomate concassée, les herbes de Provence et les olives, laissez mijoter à couvert.',
    mijoteTitre: p => `Mijoté ${p.de} à la provençale`, titrePates: 'sauce tomate aux olives',
    soupe: 'Faites revenir l’oignon et l’ail 4 min, ajoutez la tomate concassée, les herbes de Provence et le bouillon.' },
  { cle: 'chili', titre: 'façon chili', cuisine: 'Mexicaine', tags: ['mijote'],
    ings: [['Oignon', 1, 'pcs'], ['Ail', 2, 'pcs'], ['Cumin', 2, 'cac'], ['Paprika fumé', 1, 'cac'], ['Tomate concassée (bte)', 400, 'g'], ['Maïs doux (bte)', 150, 'g']],
    mijote1: 'Faites revenir l’oignon émincé 4 min, ajoutez l’ail, le cumin et le paprika fumé et remuez 1 min.',
    mijote2: 'Versez la tomate concassée et le maïs égoutté, laissez mijoter à couvert.',
    mijoteTitre: p => `Chili ${p.de}`, exclut: ['crevettes', 'cabillaud', 'saumon', 'tofu', 'tempeh'] },
  { cle: 'tajine', titre: 'façon tajine', cuisine: 'Marocaine', tags: ['mijote'],
    ings: [['Oignon', 1, 'pcs'], ['Ras-el-hanout', 12, 'g'], ['Cannelle', 1, 'cac'], ['Tomate concassée (bte)', 200, 'g'], ['Bouillon de légumes', 300, 'ml'], ['Raisins secs', 40, 'g'], ['Coriandre fraîche', 10, 'g']],
    mijote1: 'Faites revenir l’oignon émincé 5 min dans un filet d’huile d’olive, ajoutez le ras-el-hanout et la cannelle et remuez 1 min.',
    mijote2: 'Ajoutez la tomate concassée, le bouillon et les raisins secs, couvrez et laissez mijoter.',
    mijoteTitre: p => `Tajine ${p.de}`, garniture: 'Parsemez de coriandre ciselée.',
    exclut: ['crevettes', 'tofu', 'tempeh', 'haricots-rouges'] },
  { cle: 'berbere', titre: 'au berbéré', cuisine: 'Éthiopienne', tags: ['mijote', 'shakshuka'],
    ings: [['Oignon', 1, 'pcs'], ['Ail', 2, 'pcs'], ['Gingembre', 10, 'g'], ['Berbere', 2, 'cac'], ['Tomate concassée (bte)', 400, 'g']],
    mijote1: 'Faites fondre l’oignon émincé 6 min à feu doux, ajoutez l’ail, le gingembre et le berbéré et remuez 1 min.',
    mijote2: 'Versez la tomate concassée et un verre d’eau, laissez mijoter à couvert.',
    mijoteTitre: p => `Mijoté ${p.de} au berbéré`,
    sauce: 'Faites revenir l’oignon émincé, l’ail et le berbéré 5 min, puis ajoutez la tomate concassée et laissez réduire 10 min.' },
  { cle: 'tomate-basilic', titre: 'tomate-basilic', cuisine: 'Italienne', tags: ['pates'],
    ings: [['Tomates cerises', 300, 'g'], ['Ail', 2, 'pcs'], ['Basilic', 15, 'g'], ['Huile d’olive', 30, 'ml'], ['Parmesan', 30, 'g']],
    titrePates: 'tomate-basilic' },
  { cle: 'ricotta', titre: 'ricotta-citron', cuisine: 'Italienne', tags: ['pates'],
    ings: [['Ricotta légère', 200, 'g'], ['Citron', 1, 'pcs'], ['Parmesan', 30, 'g'], ['Basilic', 10, 'g']],
    titrePates: 'ricotta citronnée' },
];

// ─── Bases ──────────────────────────────────────────────────────────────────

type KindBase = 'grain' | 'nouilles' | 'pates' | 'four' | 'pain';
interface Base extends Genre {
  cle: string; kind: KindBase; ings: L[]; label: string; le: string;
  cuisson: string; min: number; titreFormat?: string; titreSaute?: string;
}
const B = (b: Base) => b;
const BASES: Base[] = [
  B({ cle: 'basmati', kind: 'grain', ings: [['Riz basmati', 280, 'g']], label: 'riz basmati', le: 'le riz', min: 12, f: false, pl: false, titreSaute: 'Riz sauté',
    cuisson: 'Rincez le riz basmati et faites-le cuire 11 min dans une grande casserole d’eau bouillante salée, puis égouttez.' }),
  B({ cle: 'jasmin', kind: 'grain', ings: [['Riz jasmin', 280, 'g']], label: 'riz jasmin', le: 'le riz', min: 15, f: false, pl: false, titreSaute: 'Riz sauté',
    cuisson: 'Rincez le riz jasmin jusqu’à ce que l’eau soit claire et faites-le cuire 12 min à couvert dans 1,5 fois son volume d’eau, à feu doux.' }),
  B({ cle: 'complet', kind: 'grain', ings: [['Riz complet', 280, 'g']], label: 'riz complet', le: 'le riz', min: 25, f: false, pl: false, titreSaute: 'Riz complet sauté',
    cuisson: 'Faites cuire le riz complet 25 min dans une grande casserole d’eau bouillante salée, puis égouttez.' }),
  B({ cle: 'quinoa', kind: 'grain', ings: [['Quinoa', 240, 'g']], label: 'quinoa', le: 'le quinoa', min: 15, f: false, pl: false, titreSaute: 'Quinoa sauté',
    cuisson: 'Rincez le quinoa et faites-le cuire 12 min dans 2 fois son volume d’eau salée. Couvrez hors du feu 5 min, puis égrainez à la fourchette.' }),
  B({ cle: 'boulgour', kind: 'grain', ings: [['Boulgour', 240, 'g']], label: 'boulgour', le: 'le boulgour', min: 12, f: false, pl: false,
    cuisson: 'Versez 1,5 fois son volume d’eau bouillante salée sur le boulgour, couvrez et laissez gonfler 12 min.' }),
  B({ cle: 'semoule', kind: 'grain', ings: [['Semoule', 240, 'g']], label: 'semoule', le: 'la semoule', min: 5, f: true, pl: false,
    cuisson: 'Versez le même volume d’eau bouillante salée sur la semoule avec un filet d’huile d’olive, couvrez 5 min puis égrainez à la fourchette.' }),
  B({ cle: 'sarrasin', kind: 'grain', ings: [['Sarrasin', 240, 'g']], label: 'sarrasin', le: 'le sarrasin', min: 12, f: false, pl: false,
    cuisson: 'Faites cuire le sarrasin 10 à 12 min dans 2 fois son volume d’eau salée, puis égouttez s’il en reste.' }),
  B({ cle: 'epeautre', kind: 'grain', ings: [['Épeautre', 240, 'g']], label: 'épeautre', le: 'l’épeautre', min: 30, f: false, pl: false,
    cuisson: 'Faites cuire l’épeautre 30 min dans une grande casserole d’eau bouillante salée, puis égouttez.' }),
  B({ cle: 'millet', kind: 'grain', ings: [['Millet', 240, 'g']], label: 'millet', le: 'le millet', min: 15, f: false, pl: false,
    cuisson: 'Rincez le millet et faites-le cuire 15 min à couvert dans 2 fois son volume d’eau salée.' }),
  B({ cle: 'orzo', kind: 'grain', ings: [['Pâtes orzo', 280, 'g']], label: 'orzo', le: 'l’orzo', min: 10, f: false, pl: false,
    cuisson: 'Faites cuire l’orzo 9 min dans une grande casserole d’eau bouillante salée, égouttez et arrosez d’un filet d’huile d’olive.' }),
  B({ cle: 'soba', kind: 'nouilles', ings: [['Nouilles soba', 250, 'g']], label: 'nouilles soba', le: 'les nouilles', min: 5, f: true, pl: true,
    cuisson: 'Faites cuire les nouilles soba 4 min dans l’eau bouillante, rincez-les à l’eau froide et égouttez.' }),
  B({ cle: 'nouilles-riz', kind: 'nouilles', ings: [['Nouilles de riz', 250, 'g']], label: 'nouilles de riz', le: 'les nouilles', min: 5, f: true, pl: true,
    cuisson: 'Plongez les nouilles de riz 5 min dans l’eau bouillante hors du feu, rincez-les à l’eau froide et égouttez.' }),
  B({ cle: 'nouilles-chinoises', kind: 'nouilles', ings: [['Nouilles chinoises', 250, 'g']], label: 'nouilles chinoises', le: 'les nouilles', min: 4, f: true, pl: true,
    cuisson: 'Faites cuire les nouilles chinoises 3 à 4 min dans l’eau bouillante, égouttez et arrosez d’un filet d’huile pour qu’elles ne collent pas.' }),
  B({ cle: 'penne', kind: 'pates', ings: [['Pâtes complètes (penne)', 320, 'g']], label: 'penne complètes', le: 'les pâtes', min: 11, f: true, pl: true, titreFormat: 'Penne complètes',
    cuisson: 'Faites cuire les penne complètes dans une grande casserole d’eau bouillante salée selon le temps indiqué, en gardant une louche d’eau de cuisson.' }),
  B({ cle: 'spaghetti', kind: 'pates', ings: [['Spaghetti', 320, 'g']], label: 'spaghetti', le: 'les pâtes', min: 10, f: false, pl: true, titreFormat: 'Spaghetti',
    cuisson: 'Faites cuire les spaghetti dans une grande casserole d’eau bouillante salée selon le temps indiqué, en gardant une louche d’eau de cuisson.' }),
  B({ cle: 'fusilli', kind: 'pates', ings: [['Pâtes (fussili)', 320, 'g']], label: 'fusilli', le: 'les pâtes', min: 10, f: false, pl: true, titreFormat: 'Fusilli',
    cuisson: 'Faites cuire les fusilli dans une grande casserole d’eau bouillante salée selon le temps indiqué, en gardant une louche d’eau de cuisson.' }),
  B({ cle: 'tagliatelles', kind: 'pates', ings: [['Tagliatelles', 320, 'g']], label: 'tagliatelles', le: 'les pâtes', min: 8, f: true, pl: true, titreFormat: 'Tagliatelles',
    cuisson: 'Faites cuire les tagliatelles dans une grande casserole d’eau bouillante salée selon le temps indiqué, en gardant une louche d’eau de cuisson.' }),
  B({ cle: 'patate-douce', kind: 'four', ings: [['Patate douce', 3, 'pcs']], label: 'patate douce', le: 'la patate douce', min: 35, f: true, pl: false,
    cuisson: 'Épluchez les patates douces et coupez-les en cubes de 2 cm.' }),
  B({ cle: 'pdt', kind: 'four', ings: [['Pomme de terre', 800, 'g']], label: 'pommes de terre', le: 'les pommes de terre', min: 35, f: true, pl: true,
    cuisson: 'Lavez les pommes de terre et coupez-les en quartiers, sans les éplucher.' }),
  B({ cle: 'wrap', kind: 'pain', ings: [['Tortilla de blé complète', 8, 'pcs']], label: 'tortillas complètes', le: 'les tortillas', min: 2, f: true, pl: true, titreFormat: 'Wraps',
    cuisson: 'Réchauffez les tortillas 30 s par face dans une poêle sèche.' }),
  B({ cle: 'pita', kind: 'pain', ings: [['Pains pita', 4, 'pcs']], label: 'pains pita', le: 'les pitas', min: 2, f: false, pl: true, titreFormat: 'Pitas garnies',
    cuisson: 'Réchauffez les pains pita 1 min par face dans une poêle sèche, puis ouvrez-les en poche.' }),
  B({ cle: 'tacos', kind: 'pain', ings: [['Tortillas de maïs nixtamalisées', 12, 'pcs']], label: 'tortillas de maïs', le: 'les tortillas', min: 2, f: true, pl: true, titreFormat: 'Tacos',
    cuisson: 'Réchauffez les tortillas de maïs 30 s par face dans une poêle sèche et gardez-les au chaud dans un torchon.' }),
];

// ─── Légumes ────────────────────────────────────────────────────────────────

interface Legume extends Genre {
  cle: string; ings: L[]; label: string; au: string; le: string;
  prep: string; roti?: number; saute?: number; vapeur?: number; mijote?: number;
  cru?: string; brochette?: boolean;
}
const V = (v: Legume) => v;
const LEGUMES: Legume[] = [
  V({ cle: 'brocoli', ings: [['Brocoli', 500, 'g']], label: 'brocoli', au: 'au brocoli', le: 'le brocoli', f: false, pl: false,
    prep: 'Détaillez le brocoli en petits bouquets.', roti: 20, saute: 5, vapeur: 6, mijote: 6 }),
  V({ cle: 'courgettes', ings: [['Courgette', 3, 'pcs']], label: 'courgettes', au: 'aux courgettes', le: 'les courgettes', f: true, pl: true,
    prep: 'Coupez les courgettes en demi-rondelles.', roti: 20, saute: 5, mijote: 8, brochette: true }),
  V({ cle: 'poivrons', ings: [['Poivron rouge', 2, 'pcs']], label: 'poivrons', au: 'aux poivrons', le: 'les poivrons', f: false, pl: true,
    prep: 'Épépinez les poivrons et coupez-les en lanières.', roti: 25, saute: 6, mijote: 10, brochette: true,
    cru: 'Épépinez les poivrons et coupez-les en fines lanières.' }),
  V({ cle: 'haricots-verts', ings: [['Haricots verts', 400, 'g']], label: 'haricots verts', au: 'aux haricots verts', le: 'les haricots verts', f: false, pl: true,
    prep: 'Équeutez les haricots verts.', saute: 6, vapeur: 8, roti: 18, mijote: 10 }),
  V({ cle: 'epinards', ings: [['Épinards frais', 300, 'g']], label: 'épinards', au: 'aux épinards', le: 'les épinards', f: false, pl: true,
    prep: 'Lavez et essorez les épinards.', saute: 2, mijote: 2,
    cru: 'Lavez et essorez les jeunes pousses d’épinards.' }),
  V({ cle: 'kale', ings: [['Chou kale', 200, 'g']], label: 'chou kale', au: 'au chou kale', le: 'le chou kale', f: false, pl: false,
    prep: 'Retirez les grosses côtes du chou kale et émincez les feuilles.', saute: 4, roti: 10,
    cru: 'Retirez les côtes du chou kale, émincez les feuilles et massez-les 1 min avec un filet d’huile et une pincée de sel pour les attendrir.' }),
  V({ cle: 'carottes', ings: [['Carotte', 4, 'pcs']], label: 'carottes', au: 'aux carottes', le: 'les carottes', f: true, pl: true,
    prep: 'Épluchez les carottes et coupez-les en bâtonnets.', roti: 25, saute: 6, vapeur: 10, mijote: 15,
    cru: 'Épluchez et râpez les carottes.' }),
  V({ cle: 'champignons', ings: [['Champignons de Paris', 400, 'g']], label: 'champignons', au: 'aux champignons', le: 'les champignons', f: false, pl: true,
    prep: 'Nettoyez les champignons et coupez-les en lamelles.', roti: 15, saute: 6, mijote: 10, brochette: true }),
  V({ cle: 'aubergines', ings: [['Aubergine', 2, 'pcs']], label: 'aubergines', au: 'aux aubergines', le: 'les aubergines', f: true, pl: true,
    prep: 'Coupez les aubergines en cubes.', roti: 30, saute: 10, mijote: 15 }),
  V({ cle: 'chou-fleur', ings: [['Chou-fleur', 1, 'pcs']], label: 'chou-fleur', au: 'au chou-fleur', le: 'le chou-fleur', f: false, pl: false,
    prep: 'Détaillez le chou-fleur en petits bouquets.', roti: 25, vapeur: 8, mijote: 12 }),
  V({ cle: 'butternut', ings: [['Courge butternut', 700, 'g']], label: 'butternut', au: 'à la butternut', le: 'la butternut', f: true, pl: false,
    prep: 'Épluchez la butternut, retirez les graines et coupez la chair en cubes.', roti: 30, mijote: 18 }),
  V({ cle: 'pak-choi', ings: [['Chou pak choï', 400, 'g']], label: 'pak choï', au: 'au pak choï', le: 'le pak choï', f: false, pl: false,
    prep: 'Coupez les pak choï en quatre dans la longueur et rincez-les.', saute: 3, vapeur: 4, mijote: 3 }),
  V({ cle: 'petits-pois', ings: [['Petit pois (surg.)', 300, 'g']], label: 'petits pois', au: 'aux petits pois', le: 'les petits pois', f: false, pl: true,
    prep: 'Sortez les petits pois du congélateur.', saute: 4, vapeur: 5, mijote: 5 }),
  V({ cle: 'fenouil', ings: [['Fenouil', 2, 'pcs']], label: 'fenouil', au: 'au fenouil', le: 'le fenouil', f: false, pl: false,
    prep: 'Coupez les bulbes de fenouil en lamelles.', roti: 25, saute: 8,
    cru: 'Émincez très finement le fenouil.' }),
  V({ cle: 'asperges', ings: [['Asperge verte', 400, 'g']], label: 'asperges vertes', au: 'aux asperges vertes', le: 'les asperges', f: true, pl: true,
    prep: 'Cassez la base dure des asperges et coupez-les en tronçons.', roti: 12, saute: 5, vapeur: 6 }),
  V({ cle: 'tomates-cerises', ings: [['Tomates cerises', 300, 'g']], label: 'tomates cerises', au: 'aux tomates cerises', le: 'les tomates cerises', f: true, pl: true,
    prep: 'Rincez les tomates cerises.', roti: 15, brochette: true,
    cru: 'Coupez les tomates cerises en deux.' }),
  V({ cle: 'chou-rouge', ings: [['Chou rouge', 300, 'g']], label: 'chou rouge', au: 'au chou rouge', le: 'le chou rouge', f: false, pl: false,
    prep: 'Émincez finement le chou rouge.', saute: 6,
    cru: 'Émincez très finement le chou rouge et arrosez-le d’un filet de vinaigre.' }),
  V({ cle: 'concombre', ings: [['Concombre', 1, 'pcs']], label: 'concombre', au: 'au concombre', le: 'le concombre', f: false, pl: false,
    prep: 'Coupez le concombre en demi-rondelles.', cru: 'Coupez le concombre en demi-rondelles.' }),
  V({ cle: 'avocat', ings: [['Avocat', 2, 'pcs']], label: 'avocat', au: 'à l’avocat', le: 'l’avocat', f: false, pl: false,
    prep: 'Coupez l’avocat en tranches.', cru: 'Coupez les avocats en tranches et arrosez-les de quelques gouttes de citron.' }),
  V({ cle: 'edamame', ings: [['Edamame (surg.)', 250, 'g']], label: 'edamame', au: 'aux edamame', le: 'les edamame', f: false, pl: true,
    prep: 'Plongez les edamame 4 min dans l’eau bouillante salée.', saute: 4, vapeur: 5,
    cru: 'Plongez les edamame 4 min dans l’eau bouillante salée, puis rafraîchissez-les.' }),
  V({ cle: 'poireaux', ings: [['Poireau', 3, 'pcs']], label: 'poireaux', au: 'aux poireaux', le: 'les poireaux', f: false, pl: true,
    prep: 'Émincez les poireaux et rincez-les soigneusement.', saute: 8, mijote: 12 }),
  V({ cle: 'choux-bruxelles', ings: [['Chou de Bruxelles', 400, 'g']], label: 'choux de Bruxelles', au: 'aux choux de Bruxelles', le: 'les choux de Bruxelles', f: false, pl: true,
    prep: 'Parez les choux de Bruxelles et coupez-les en deux.', roti: 25, saute: 10 }),
  V({ cle: 'mais', ings: [['Maïs doux (bte)', 280, 'g']], label: 'maïs', au: 'au maïs', le: 'le maïs', f: false, pl: false,
    prep: 'Égouttez le maïs.', saute: 4, cru: 'Égouttez le maïs.' }),
  V({ cle: 'betterave', ings: [['Betterave cuite', 3, 'pcs']], label: 'betterave', au: 'à la betterave', le: 'la betterave', f: true, pl: false,
    prep: 'Coupez la betterave en cubes.', cru: 'Coupez la betterave cuite en cubes.' }),
  V({ cle: 'radis', ings: [['Radis', 200, 'g']], label: 'radis', au: 'aux radis', le: 'les radis', f: false, pl: true,
    prep: 'Coupez les radis en fines rondelles.', cru: 'Coupez les radis en fines rondelles.' }),
  V({ cle: 'roquette', ings: [['Roquette', 100, 'g']], label: 'roquette', au: 'à la roquette', le: 'la roquette', f: true, pl: false,
    prep: 'Rincez la roquette.', cru: 'Rincez et essorez la roquette.' }),
  V({ cle: 'pousses-soja', ings: [['Pousses de soja', 200, 'g']], label: 'pousses de soja', au: 'aux pousses de soja', le: 'les pousses de soja', f: true, pl: true,
    prep: 'Rincez les pousses de soja.', saute: 2, cru: 'Rincez et égouttez les pousses de soja.' }),
  V({ cle: 'chou-chinois', ings: [['Chou chinois', 400, 'g']], label: 'chou chinois', au: 'au chou chinois', le: 'le chou chinois', f: false, pl: false,
    prep: 'Émincez le chou chinois.', saute: 4, mijote: 4, cru: 'Émincez finement le chou chinois.' }),
];

const vegRoti = (v: Legume) => `${v.prep} Étalez-${pro(v)} sur une plaque recouverte de papier cuisson, arrosez d’un filet d’huile d’olive, salez et enfournez ${v.roti} min à 200 °C.`;
const vegSaute = (v: Legume) => v.cle === 'epinards'
  ? `${v.prep} Faites tomber les épinards 2 min à feu vif avec un filet d’huile.`
  : `${v.prep} Faites sauter ${v.le} ${v.saute} min à feu vif avec un filet d’huile : ${il(v)} ${doit(v)} rester ${acc('croquant', v)}.`;
const vegVapeur = (v: Legume) => `${v.prep} Faites cuire ${v.le} ${v.vapeur} min à la vapeur.`;
function vegCuit(v: Legume): { txt: string; min: number } {
  if (v.roti) return { txt: vegRoti(v), min: v.roti };
  if (v.vapeur) return { txt: vegVapeur(v), min: v.vapeur };
  return { txt: vegSaute(v), min: v.saute ?? 5 };
}

// ─── Assemblage ─────────────────────────────────────────────────────────────

const HUILE: L = ['Huile d’olive', 30, 'ml'];

function fusion(...listes: L[][]): L[] {
  const out: L[] = [];
  for (const l of listes.flat()) {
    const i = out.findIndex(o => o[0] === l[0]);
    if (i < 0) out.push([...l] as L);
    else if (out[i][2] === l[2]) out[i][1] = Math.round((out[i][1] + l[1]) * 100) / 100;
  }
  return out;
}

interface Contexte { p: Proteine; pr: Profil; b: Base; v1: Legume; v2?: Legume }
interface Format {
  cle: string; prots: (p: Proteine) => boolean; profils: (pr: Profil) => boolean;
  bases: (b: Base) => boolean; v1: (v: Legume) => boolean; v2?: (v: Legume) => boolean;
  variantes: number;
  build: (c: Contexte) => Omit<RecetteSaisie, 'type' | 'portions'> | null;
}

const garn = (pr: Profil) => (pr.garniture ? ` ${pr.garniture}` : '');
/** Texte de sauce sans parler de « marinade » quand rien ne marine (pâtes, poêlées…) */
const enSauce = (pr: Profil) => pr.sauce!
  .replace('Préparez la marinade', 'Préparez la sauce').replace('pour la marinade', 'pour la sauce')
  .replace(' pour enrober la protéine', ' pour la sauce');
/** Sauce à base de yaourt : servie à part, jamais chauffée */
const auYaourt = (pr: Profil) => pr.ings.some(([n]) => n.startsWith('Yaourt'));
const hors = (...cles: string[]) => (p: Proteine) => !cles.includes(p.cle);
const cuitPoele = (p: Proteine) => !['thon', 'corail'].includes(p.cat);

const FORMATS: Format[] = [
  { cle: 'bowl', variantes: 2,
    prots: p => !['corail', 'cuisse'].includes(p.cat), profils: pr => !!pr.sauce && pr.tags.some(t => t === 'marinade' || t === 'asie'),
    bases: b => b.kind === 'grain' || b.cle === 'soba', v1: v => !!(v.roti || v.vapeur || v.saute), v2: v => !!v.cru,
    build: ({ p, pr, b, v1, v2 }) => {
      if (!v2 || v1.cle === v2.cle) return null;
      const cv = vegCuit(v1);
      const etapes = [b.cuisson, cv.txt, enSauce(pr), [prepProt(p, false), poeleProt(p)].filter(Boolean).join(' '),
        v2.cru!, `Répartissez ${b.le} dans 4 bols, ajoutez ${v1.le}, ${v2.le} et ${p.le}. Nappez de sauce.${garn(pr)}`];
      return { titre: `Bowl ${p.de} ${pr.titre}, ${b.label} et ${v1.label}`, cuisine: pr.cuisine, prep: 20, cuisson: Math.max(b.min, cv.min, 10),
        difficulte: 'facile', conservation: 2, ustensiles: ['Casserole', 'Poêle', ...(v1.roti ? ['Four'] : [])],
        ingredients: fusion(p.ings, b.ings, v1.ings, v2.ings, pr.ings, [HUILE]), etapes };
    } },
  { cle: 'wok', variantes: 2,
    prots: p => ['volaille', 'boeuf', 'crevette', 'soja', 'hache'].includes(p.cat), profils: pr => pr.tags.includes('asie'),
    bases: b => b.kind === 'nouilles' || b.cle === 'jasmin', v1: v => !!v.saute, v2: v => !!v.saute,
    build: ({ p, pr, b, v1, v2 }) => {
      if (!v2 || v1.cle === v2.cle) return null;
      const etapes = [b.cuisson, pr.sauce!, [prepProt(p, true), poeleProt(p).replace('dans un filet d’huile', 'dans le wok avec un filet d’huile'), 'Réservez.'].filter(Boolean).join(' '),
        `${v1.prep} ${v2.prep} ${sauterDeux(v1, v2, 'Dans le wok')}`,
        `Remettez ${p.le} et ${b.le} dans le wok, versez la sauce et mélangez 1 à 2 min à feu vif pour tout enrober.${garn(pr)}`];
      return { titre: `Wok ${p.de} ${pr.titre}, ${b.label} ${v1.au}`, cuisine: pr.cuisine, prep: 15, cuisson: 15, difficulte: 'facile', conservation: 2,
        ustensiles: ['Wok', 'Casserole'], ingredients: fusion(p.ings, b.ings, v1.ings, v2.ings, pr.ings, [['Huile de tournesol', 20, 'ml']]), etapes };
    } },
  { cle: 'plaque', variantes: 1,
    prots: p => ['volaille', 'cuisse', 'poisson', 'crevette', 'soja', 'halloumi'].includes(p.cat) || p.cle === 'pois-chiches',
    profils: pr => !!pr.sauce && pr.tags.includes('marinade'), bases: b => b.kind === 'four', v1: v => !!v.roti,
    build: ({ p, pr, b, v1 }) => {
      const f = fourProt(p);
      const cuisson = p.cat === 'cuisse' ? 35 : 15 + Math.max(v1.roti!, f.min);
      const etapes = ['Préchauffez le four à 200 °C.', `${pr.sauce!} ${[prepProt(p, false), `Enrobez ${p.le} de la moitié de la marinade et laissez reposer pendant la préparation des légumes.`].filter(Boolean).join(' ')}`,
        `${b.cuisson} Étalez-les sur une grande plaque recouverte de papier cuisson avec un filet d’huile d’olive, salez et enfournez 15 min.`,
        `${v1.prep} Ajoutez-${pro(v1)} sur la plaque, mélangez et poursuivez la cuisson.`, f.phrase,
        `Arrosez le tout du reste de marinade à la sortie du four et servez aussitôt.${garn(pr)}`];
      if (p.cat === 'cuisse') [etapes[2], etapes[4]] = [`${b.cuisson} Étalez-les sur une grande plaque recouverte de papier cuisson avec un filet d’huile d’olive et salez.`, f.phrase + ' Ajoutez les légumes pour les 25 dernières minutes.'];
      return { titre: `${p.roti} ${pr.titre}, ${v1.label} et ${b.label} au four`, cuisine: pr.cuisine, prep: 20, cuisson, difficulte: 'facile', conservation: 2,
        ustensiles: ['Four', 'Plaque de cuisson', 'Papier cuisson'], ingredients: fusion(p.ings, b.ings, v1.ings, pr.ings, [HUILE]), etapes };
    } },
  { cle: 'salade', variantes: 1,
    prots: p => !['corail', 'cuisse', 'hache'].includes(p.cat), profils: pr => !!pr.sauce && pr.tags.includes('marinade'),
    bases: b => b.kind === 'grain' && !['semoule', 'basmati', 'jasmin'].includes(b.cle), v1: v => !!v.cru, v2: v => !!v.cru,
    build: ({ p, pr, b, v1, v2 }) => {
      if (!v2 || v1.cle === v2.cle || (p.cat === 'lentille' && b.kind !== 'grain')) return null;
      const etapes = [`${b.cuisson} Laissez tiédir.`, pr.sauce!.replace('la marinade', 'la vinaigrette').replace('Préparez la marinade', 'Préparez la vinaigrette'),
        [prepProt(p, false), poeleProt(p)].filter(Boolean).join(' '), v1.cru!, v2.cru!,
        `Dans un grand saladier, mélangez ${b.le}, ${v1.le}, ${v2.le} et ${p.le} avec la sauce. Laissez reposer 10 min au frais avant de servir.${garn(pr)}`];
      return { titre: `Salade ${de(b.label)} ${p.au} ${pr.titre}, ${v1.label} et ${v2.label}`, cuisine: pr.cuisine, prep: 20, cuisson: Math.max(b.min, 10),
        difficulte: 'facile', conservation: 2, ustensiles: ['Casserole', 'Saladier'], ingredients: fusion(p.ings, b.ings, v1.ings, v2.ings, pr.ings, [HUILE]), etapes };
    } },
  { cle: 'mijote', variantes: 3,
    prots: p => !['thon', 'oeuf', 'halloumi', 'hache'].includes(p.cat), profils: pr => pr.tags.includes('mijote'),
    bases: b => b.kind === 'grain' && !['orzo', 'sarrasin'].includes(b.cle), v1: v => !!v.mijote,
    build: ({ p, pr, b, v1 }) => {
      if (pr.exclut?.includes(p.cle)) return null;
      const seared = ['volaille', 'boeuf', 'cuisse', 'soja'].includes(p.cat);
      const lent = p.cat === 'lentille' ? 25 : p.cat === 'corail' ? 15 : 0;
      const temps = p.cat === 'cuisse' ? 30 : Math.max(v1.mijote!, 12, lent);
      const etapes = [b.cuisson];
      if (seared) etapes.push(`${prepProt(p, false)} Faites-${pro(p)} dorer 5 min dans une cocotte avec un filet d’huile, puis réservez.`);
      else if (prepProt(p, false)) etapes.push(prepProt(p, false));
      etapes.push(pr.mijote1!, `${pr.mijote2!} ${v1.prep} Ajoutez ${v1.le}${p.cat === 'corail' || p.cat === 'lentille' ? `, ${p.le} et 50 cl d’eau` : p.cat === 'boite' ? ` et ${p.le}` : ''}.`);
      if (seared) etapes.push(`Remettez ${p.le} dans la cocotte, couvrez et laissez mijoter ${temps} min à feu doux.`);
      else if (p.cat === 'poisson' || p.cat === 'crevette') etapes.push(`Laissez mijoter ${temps} min, puis ajoutez ${p.le} pour les 5 dernières minutes de cuisson.`);
      else etapes.push(`Couvrez et laissez mijoter ${temps} min à feu doux, en remuant de temps en temps.`);
      etapes.push(`Rectifiez l’assaisonnement et servez avec ${b.le}.${garn(pr)}`);
      return { titre: `${pr.mijoteTitre!(p)}, ${v1.label} et ${b.label}`, cuisine: pr.cuisine, prep: 15, cuisson: temps + 10, difficulte: 'facile', conservation: 3,
        ustensiles: ['Cocotte', 'Casserole'], ingredients: fusion(p.ings, b.ings, v1.ings, pr.ings, [HUILE]), etapes };
    } },
  { cle: 'pates', variantes: 3,
    prots: p => ['volaille', 'hache', 'crevette', 'poisson', 'thon', 'boite'].includes(p.cat) && p.cle !== 'haricots-rouges' && p.cle !== 'porc',
    profils: pr => pr.tags.includes('pates'), bases: b => b.kind === 'pates', v1: v => !!v.saute && !['edamame', 'pousses-soja', 'chou-chinois', 'mais', 'chou-rouge'].includes(v.cle),
    build: ({ p, pr, b, v1 }) => {
      const sauceTomate = pr.cle === 'provencale';
      const etapes = [b.cuisson, [prepProt(p, true), p.cat === 'thon' ? '' : poeleProt(p)].filter(Boolean).join(' ')];
      if (sauceTomate) etapes.push(`${pr.mijote1!} ${pr.mijote2!} ${v1.prep} Ajoutez ${v1.le} et laissez mijoter 10 min.`);
      else etapes.push(vegSaute(v1));
      if (pr.cle === 'tomate-basilic') etapes.push('Faites revenir l’ail émincé 1 min dans l’huile d’olive, ajoutez les tomates cerises coupées en deux et laissez-les compoter 5 min.');
      if (pr.cle === 'ricotta') etapes.push('Mélangez la ricotta avec le zeste et le jus du citron, le parmesan râpé et une petite louche d’eau de cuisson des pâtes.');
      if (pr.sauce && !sauceTomate) etapes.push(enSauce(pr));
      etapes.push(`Égouttez ${b.le} et mélangez-${pro(b)} aussitôt avec ${v1.le}, ${p.le} et la sauce, en ajoutant un peu d’eau de cuisson pour lier.${pr.cle === 'tomate-basilic' || pr.cle === 'ricotta' ? ' Parsemez de basilic ciselé.' : garn(pr)}`);
      return { titre: `${b.titreFormat} ${p.au}, ${v1.label} et ${pr.titrePates}`, cuisine: 'Italienne', prep: 10, cuisson: Math.max(b.min, 12), difficulte: 'facile', conservation: 2,
        ustensiles: ['Casserole', 'Poêle'], ingredients: fusion(p.ings, b.ings, v1.ings, pr.ings, [HUILE]), etapes };
    } },
  { cle: 'wraps', variantes: 1,
    prots: p => ['volaille', 'boeuf', 'crevette', 'thon', 'soja', 'boite', 'halloumi', 'hache', 'poisson'].includes(p.cat),
    profils: pr => !!pr.sauce && pr.tags.includes('marinade'), bases: b => b.kind === 'pain', v1: v => !!v.cru, v2: v => !!v.cru,
    build: ({ p, pr, b, v1, v2 }) => {
      if (!v2 || v1.cle === v2.cle) return null;
      const etapes = [enSauce(pr), [prepProt(p, true), p.cat === 'thon' ? '' : poeleProt(p)].filter(Boolean).join(' '), v1.cru!, v2.cru!, b.cuisson,
        `Garnissez ${b.le} ${de(v1.label)}, ${de(v2.label)} et ${de(p.le.replace(/^(le |la |les |l’)/, ''))}, nappez de sauce et ${b.cle === 'pita' ? 'servez aussitôt' : 'roulez ou pliez avant de servir'}.${garn(pr)}`];
      return { titre: `${b.titreFormat} ${p.de} ${pr.titre}, ${v1.label} et ${v2.label}`, cuisine: pr.cuisine, prep: 20, cuisson: 10, difficulte: 'facile', conservation: 1,
        ustensiles: ['Poêle'], ingredients: fusion(p.ings, b.ings, v1.ings, v2.ings, pr.ings, [HUILE]), etapes };
    } },
  { cle: 'brochettes', variantes: 1,
    prots: p => ['volaille', 'boeuf', 'crevette', 'soja', 'halloumi'].includes(p.cat) || p.cle === 'saumon',
    profils: pr => !!pr.sauce && pr.tags.includes('marinade'), bases: b => b.kind === 'grain', v1: v => !!v.brochette,
    build: ({ p, pr, b, v1 }) => {
      const min = p.cat === 'crevette' || p.cat === 'poisson' || p.cat === 'halloumi' ? 6 : p.cat === 'boeuf' ? 5 : 10;
      const etapes = [`${pr.sauce!} ${prepProt(p, false).replace('morceaux de 3 cm', 'cubes de 3 cm')} Enrobez ${p.le} de la moitié de la marinade et laissez reposer 20 min au frais.`,
        b.cuisson, `${v1.prep.replace('en demi-rondelles', 'en rondelles épaisses').replace('en lanières', 'en carrés').replace('en lamelles', 'en deux')} Enfilez ${p.le} et ${v1.le} en alternance sur les piques.`,
        `Faites cuire les brochettes ${min} min sur un gril ou dans une poêle-gril bien chaude, en les tournant régulièrement.`,
        `Servez avec ${b.le} et le reste de la sauce.${garn(pr)}`];
      return { titre: `Brochettes ${p.de} ${pr.titre}, ${b.label} et ${v1.label}`, cuisine: pr.cuisine, prep: 30, cuisson: Math.max(b.min, min), difficulte: 'moyen', conservation: 2,
        ustensiles: ['Piques à brochettes', 'Poêle-gril', 'Casserole'], ingredients: fusion(p.ings, b.ings, v1.ings, pr.ings, [HUILE]), etapes };
    } },
  { cle: 'soupe', variantes: 2,
    prots: p => ['volaille', 'crevette', 'poisson', 'soja', 'corail', 'boite'].includes(p.cat) && p.cle !== 'porc' && p.cle !== 'saumon',
    profils: pr => pr.tags.includes('soupe'), bases: b => b.kind === 'nouilles' || b.cle === 'orzo', v1: v => ['carottes', 'poireaux', 'courgettes', 'champignons', 'brocoli', 'chou-fleur', 'butternut', 'haricots-verts', 'petits-pois'].includes(v.cle), v2: v => ['epinards', 'pak-choi', 'chou-chinois', 'kale'].includes(v.cle),
    build: ({ p, pr, b, v1, v2 }) => {
      if (!v2 || v1.cle === v2.cle) return null;
      const bouillon: L = p.cat === 'volaille' ? ['Bouillon de volaille', 1200, 'ml'] : ['Bouillon de légumes', 1200, 'ml'];
      const cuitProt = p.cat === 'volaille' ? `Plongez les filets ${p.de} entiers dans le bouillon frémissant et laissez-les pocher 12 min, puis sortez-les et effilochez-les à la fourchette.`
        : p.cat === 'poisson' || p.cat === 'crevette' ? `${prepProt(p, true)} Plongez ${p.le} dans le bouillon pour les 4 dernières minutes.`
        : p.cat === 'corail' ? `Ajoutez ${p.le} rincées et laissez cuire 15 min.` : `${prepProt(p, true)} Ajoutez ${p.le} au bouillon.`;
      const etapes = [pr.soupe!, `${v1.prep} Ajoutez ${v1.le} et laissez frémir ${v1.mijote} min.`, cuitProt,
        `Faites cuire ${b.le} directement dans le bouillon ${b.min} min, en ajoutant ${v2.le} pour les 2 dernières minutes.`,
        `${p.cat === 'volaille' ? `Remettez ${p.le} effiloché${p.f ? 'e' : ''} dans la soupe, r` : 'R'}ectifiez l’assaisonnement et servez bien chaud.${pr.cle === 'citron-herbes' ? ' Ajoutez le jus du citron et le persil ciselé.' : pr.cle === 'miso' ? ' Hors du feu, délayez le miso et le sirop d’érable dans une louche de bouillon puis reversez-le dans la soupe : le miso ne doit pas bouillir.' : garn(pr)}`];
      return { titre: `Soupe-repas ${p.au} ${pr.titre}, ${v1.label} et ${b.label}`, cuisine: pr.cuisine, prep: 15, cuisson: 25, difficulte: 'facile', conservation: 2,
        ustensiles: ['Faitout'], ingredients: fusion(p.ings, b.ings, v1.ings, v2.ings, pr.ings, [bouillon, ['Huile d’olive', 15, 'ml']]), etapes };
    } },
  { cle: 'riz-saute', variantes: 2,
    prots: p => ['volaille', 'boeuf', 'crevette', 'soja', 'oeuf'].includes(p.cat), profils: pr => pr.tags.includes('asie'),
    bases: b => !!b.titreSaute, v1: v => !!v.saute,
    build: ({ p, pr, b, v1 }) => {
      const oeufs: L[] = p.cat === 'oeuf' ? [] : [['Œuf', 2, 'pcs']];
      const etapes = [`${b.cuisson} Étalez-le sur un plat et laissez-le refroidir complètement (idéalement la veille : il sautera sans coller).`, pr.sauce!,
        p.cat === 'oeuf' ? 'Battez les œufs en omelette, versez-les dans le wok chaud huilé et brouillez-les 1 min. Réservez.'
          : `${[prepProt(p, true), poeleProt(p)].filter(Boolean).join(' ')} Réservez, puis brouillez les 2 œufs battus 1 min dans le wok et réservez-les aussi.`,
        vegSaute(v1),
        `Ajoutez ${b.le} froid, faites-le sauter 3 min à feu vif, puis remettez ${p.cat === 'oeuf' ? 'les œufs' : `${p.le} et les œufs`} et versez la sauce. Mélangez 1 min.${garn(pr)}`];
      return { titre: `${b.titreSaute} ${p.au} ${pr.titre}, ${v1.label}`, cuisine: pr.cuisine, prep: 15, cuisson: b.min + 10, difficulte: 'facile', conservation: 2,
        ustensiles: ['Wok', 'Casserole'], ingredients: fusion(p.ings, b.ings, v1.ings, pr.ings, oeufs, [['Huile de tournesol', 20, 'ml']]), etapes };
    } },
  { cle: 'poelee', variantes: 1,
    prots: p => cuitPoele(p) && !['lentille', 'oeuf', 'cuisse'].includes(p.cat), profils: pr => !!pr.sauce && pr.tags.includes('marinade'),
    bases: b => b.kind === 'grain', v1: v => !!v.saute, v2: v => !!v.saute,
    build: ({ p, pr, b, v1, v2 }) => {
      if (!v2 || v1.cle === v2.cle) return null;
      const etapes = [b.cuisson, enSauce(pr), [prepProt(p, false), poeleProt(p), 'Réservez.'].filter(Boolean).join(' '),
        `${v1.prep} ${v2.prep} ${sauterDeux(v1, v2, 'Dans la même poêle')}`,
        auYaourt(pr)
          ? `Remettez ${p.le}, mélangez 1 min et servez avec ${b.le}, la sauce au yaourt à part.${garn(pr)}`
          : `Remettez ${p.le}, versez la sauce et mélangez 1 min. Servez avec ${b.le}.${garn(pr)}`];
      return { titre: `Poêlée ${p.de} ${pr.titre}, ${v1.label} et ${v2.label}`, cuisine: pr.cuisine, prep: 15, cuisson: Math.max(b.min, 15), difficulte: 'facile', conservation: 2,
        ustensiles: ['Poêle', 'Casserole'], ingredients: fusion(p.ings, b.ings, v1.ings, v2.ings, pr.ings, [HUILE]), etapes };
    } },
  { cle: 'frittata', variantes: 3,
    prots: p => p.cat === 'oeuf', profils: pr => pr.tags.includes('oeuf'), bases: b => b.cle === 'pita', v1: v => !!v.saute && !['edamame', 'pousses-soja', 'mais'].includes(v.cle),
    v2: v => ['epinards', 'kale', 'tomates-cerises', 'champignons', 'poivrons'].includes(v.cle),
    build: ({ p, pr, v1, v2 }) => {
      if (!v2 || v1.cle === v2.cle) return null;
      const etapes = ['Préchauffez le four à 180 °C.', vegSaute(v1).replace('Faites sauter', 'Dans une poêle allant au four, faites sauter'), `${v2.prep} Ajoutez ${v2.le} et prolongez 2 min.`,
        `Battez les œufs avec ${pr.cle === 'pesto' ? 'le pesto et le parmesan râpé' : pr.cle === 'zaatar' ? 'le zaatar' : pr.cle === 'paprika-fume' ? 'le paprika fumé et l’ail écrasé' : pr.cle === 'ail-persil' ? 'l’ail et le persil hachés' : 'le zeste du citron, les herbes et le persil'}. Salez, poivrez.`,
        'Versez les œufs sur les légumes, laissez prendre 3 min à feu doux, puis enfournez 12 min : le centre doit être juste pris.',
        `Laissez tiédir 5 min, coupez en parts et servez avec une salade verte.${pr.cle === 'zaatar' ? ' Ajoutez une cuillère de yaourt grec.' : ''}`];
      return { titre: `Frittata ${v1.au} et ${v2.label}, ${pr.titrePates ?? pr.titre.replace(/^au /, '')}`, cuisine: pr.cuisine, prep: 15, cuisson: 20, difficulte: 'facile', conservation: 2,
        ustensiles: ['Poêle allant au four', 'Four'], ingredients: fusion(p.ings, v1.ings, v2.ings, pr.ings.filter(i => i[0] !== 'Yaourt grec' || pr.cle === 'zaatar'), [HUILE]), etapes };
    } },
  { cle: 'shakshuka', variantes: 3,
    prots: p => p.cat === 'oeuf', profils: pr => pr.tags.includes('shakshuka'), bases: b => b.cle === 'pita', v1: v => ['poivrons', 'epinards', 'courgettes', 'aubergines'].includes(v.cle),
    build: ({ p, pr, b, v1 }) => {
      const etapes = [`Faites revenir un oignon émincé 5 min dans l’huile d’olive. ${v1.prep} Ajoutez ${v1.le} et faites cuire 5 min.`,
        `Ajoutez ${({ 'harissa-miel': 'la harissa et le cumin', zaatar: 'le zaatar et l’ail écrasé', 'paprika-fume': 'le paprika fumé et l’ail écrasé', 'ras-el-hanout': 'le ras-el-hanout', berbere: 'le berbéré, l’ail et le gingembre râpés' } as Record<string, string>)[pr.cle]}, remuez 1 min, puis versez la tomate concassée et laissez réduire 10 min à feu doux.`,
        'Creusez 8 puits dans la sauce, cassez-y les œufs, couvrez et laissez cuire 6 à 8 min : les blancs doivent être pris, les jaunes coulants.',
        `${b.cuisson} Servez la shakshuka dans la poêle, avec les pitas pour saucer${pr.cle === 'ras-el-hanout' ? ' et la coriandre ciselée' : pr.cle === 'harissa-miel' || pr.cle === 'zaatar' || pr.cle === 'paprika-fume' ? ' et un filet de citron' : ''}.`];
      return { titre: `Shakshuka ${pr.titre}, ${v1.label}`, cuisine: pr.cuisine, prep: 10, cuisson: 25, difficulte: 'facile', conservation: 1,
        ustensiles: ['Sauteuse avec couvercle'], ingredients: fusion(p.ings, b.ings, v1.ings, pr.ings.filter(i => !['Yaourt grec', 'Miel'].includes(i[0])), [['Tomate concassée (bte)', 400, 'g'], ['Oignon', 1, 'pcs'], HUILE]), etapes };
    } },
];

// ─── Desserts protéinés ─────────────────────────────────────────────────────

interface Fruit { nom: string; ings: L[]; label: string; au: string; prep: string }
const FRUITS: Fruit[] = [
  { nom: 'fraises', ings: [['Fraise', 300, 'g']], label: 'fraises', au: 'aux fraises', prep: 'Équeutez les fraises et coupez-les en quartiers.' },
  { nom: 'framboises', ings: [['Framboise', 250, 'g']], label: 'framboises', au: 'aux framboises', prep: 'Rincez délicatement les framboises.' },
  { nom: 'myrtilles', ings: [['Myrtilles', 250, 'g']], label: 'myrtilles', au: 'aux myrtilles', prep: 'Rincez les myrtilles.' },
  { nom: 'mangue', ings: [['Mangue', 1, 'pcs']], label: 'mangue', au: 'à la mangue', prep: 'Épluchez la mangue et coupez la chair en dés.' },
  { nom: 'banane', ings: [['Banane', 2, 'pcs']], label: 'banane', au: 'à la banane', prep: 'Coupez les bananes en rondelles.' },
  { nom: 'pomme', ings: [['Pomme', 2, 'pcs'], ['Cannelle', 1, 'cac']], label: 'pomme-cannelle', au: 'à la pomme et à la cannelle', prep: 'Coupez les pommes en dés et faites-les compoter 8 min à la poêle avec la cannelle et 2 cuillères à soupe d’eau.' },
  { nom: 'poire', ings: [['Poire', 2, 'pcs']], label: 'poire', au: 'à la poire', prep: 'Coupez les poires en dés.' },
  { nom: 'kiwi', ings: [['Kiwi', 300, 'g']], label: 'kiwi', au: 'au kiwi', prep: 'Épluchez les kiwis et coupez-les en dés.' },
  { nom: 'fruits-rouges', ings: [['Fruits rouges surgelés', 300, 'g']], label: 'fruits rouges', au: 'aux fruits rouges', prep: 'Faites décongeler les fruits rouges 10 min à température ambiante.' },
  { nom: 'peche', ings: [['Pêche', 3, 'pcs']], label: 'pêche', au: 'à la pêche', prep: 'Coupez les pêches en quartiers fins.' },
  { nom: 'ananas', ings: [['Ananas frais', 0.5, 'pcs']], label: 'ananas', au: 'à l’ananas', prep: 'Épluchez l’ananas et coupez la chair en petits dés.' },
  { nom: 'abricot', ings: [['Abricot', 300, 'g']], label: 'abricots', au: 'aux abricots', prep: 'Dénoyautez les abricots et coupez-les en quartiers.' },
];
interface Topping { ings: L[]; label: string; phrase: string }
const TOPPINGS: Topping[] = [
  { ings: [['Granola', 80, 'g']], label: 'granola', phrase: 'le granola' },
  { ings: [['Amandes', 40, 'g']], label: 'amandes grillées', phrase: 'les amandes concassées et grillées 2 min à sec' },
  { ings: [['Noix', 40, 'g']], label: 'noix', phrase: 'les noix concassées' },
  { ings: [['Graines de chia', 30, 'g']], label: 'graines de chia', phrase: 'les graines de chia' },
  { ings: [['Pistaches non salées', 40, 'g']], label: 'pistaches', phrase: 'les pistaches concassées' },
  { ings: [['Beurre de cacahuète', 40, 'g']], label: 'beurre de cacahuète', phrase: 'un filet de beurre de cacahuète' },
  { ings: [['Noisettes', 40, 'g']], label: 'noisettes', phrase: 'les noisettes concassées' },
  { ings: [['Coco râpée non sucrée', 20, 'g']], label: 'coco râpée', phrase: 'la noix de coco râpée' },
];
const LAITIERS: { nom: string; ings: L[]; label: string }[] = [
  { nom: 'skyr', ings: [['Skyr', 600, 'g']], label: 'skyr' },
  { nom: 'fromage-blanc', ings: [['Fromage blanc', 600, 'g']], label: 'fromage blanc' },
  { nom: 'yaourt-grec', ings: [['Yaourt grec 0 %', 600, 'g']], label: 'yaourt grec' },
];

function desserts(): RecetteSaisie[] {
  const out: RecetteSaisie[] = [];
  const D = (r: Omit<RecetteSaisie, 'type' | 'portions' | 'cuisine' | 'difficulte'> & { cuisine?: string }): RecetteSaisie =>
    ({ cuisine: 'Desserts fruités', difficulte: 'facile', ...r, type: 'dessert', portions: 4 });
  FRUITS.forEach((f, i) => {
    LAITIERS.forEach((l, j) => {
      for (const k of [0, 3]) {
        const t = TOPPINGS[(i + j + k) % TOPPINGS.length];
        out.push(D({ titre: `Bowl de ${l.label} ${f.au}, ${t.label}`, prep: 10, cuisson: f.nom === 'pomme' ? 8 : 0, conservation: 1, ustensiles: ['Bols'],
          ingredients: fusion(l.ings, f.ings, t.ings, [['Miel', 20, 'g']]),
          etapes: [f.prep, `Mélangez le ${l.label} avec le miel.`, `Répartissez-le dans 4 bols, ajoutez les fruits puis ${t.phrase}. Servez aussitôt pour garder le croquant.`] }));
      }
    });
    const t = TOPPINGS[(i + 1) % TOPPINGS.length];
    out.push(D({ titre: `Overnight oats ${f.au} et ${t.label}`, prep: 10, cuisson: f.nom === 'pomme' ? 8 : 0, conservation: 2, ustensiles: ['Bocaux'],
      ingredients: fusion([['Flocons d’avoine', 200, 'g'], ['Lait', 400, 'ml'], ['Skyr', 300, 'g'], ['Graines de chia', 20, 'g'], ['Miel', 20, 'g']], f.ings, t.ings),
      etapes: ['Mélangez les flocons d’avoine, le lait, le skyr, les graines de chia et le miel.', 'Répartissez dans 4 bocaux, fermez et laissez gonfler une nuit au réfrigérateur.', f.prep, `Au moment de servir, ajoutez les fruits et ${t.phrase}.`] }));
    out.push(D({ titre: `Pancakes protéinés à l’avoine ${f.au}`, prep: 10, cuisson: 15, conservation: 1, ustensiles: ['Mixeur', 'Poêle'],
      ingredients: fusion([['Flocons d’avoine', 120, 'g'], ['Œuf', 3, 'pcs'], ['Skyr', 250, 'g'], ['Levure chimique', 1, 'cac'], ['Miel', 20, 'g']], f.ings),
      etapes: ['Mixez les flocons d’avoine en farine, puis ajoutez les œufs, le skyr et la levure. Mixez jusqu’à obtenir une pâte épaisse.', 'Faites cuire de petits pancakes 2 min par face dans une poêle légèrement huilée, à feu moyen.', f.prep, 'Servez les pancakes chauds avec les fruits et un filet de miel.'] }));
  });
  for (const t of TOPPINGS.slice(0, 6)) {
    out.push(D({ titre: `Mousse de skyr au chocolat, ${t.label}`, prep: 10, cuisson: 2, conservation: 2, ustensiles: ['Fouet', 'Verrines'],
      ingredients: fusion([['Skyr', 500, 'g'], ['Cacao en poudre', 25, 'g'], ['Chocolat noir', 40, 'g'], ['Miel', 30, 'g']], t.ings),
      etapes: ['Faites fondre le chocolat noir 1 min au micro-ondes par tranches de 20 s.', 'Fouettez le skyr avec le cacao et le miel, puis incorporez le chocolat fondu.', `Répartissez dans 4 verrines, réservez 1 h au frais et servez avec ${t.phrase}.`] }));
  }
  for (const f of FRUITS.filter(x => ['pomme', 'poire', 'fruits-rouges', 'peche', 'abricot', 'framboises'].includes(x.nom))) {
    out.push(D({ titre: `Crumble ${f.au} à l’avoine, crème de skyr`, prep: 15, cuisson: 25, conservation: 2, ustensiles: ['Four', 'Plat à gratin'],
      ingredients: fusion(f.ings.map(([n, q, u]) => [n, u === 'pcs' ? q * 2 : q * 2, u] as L), [['Flocons d’avoine', 100, 'g'], ['Poudre d’amandes', 50, 'g'], ['Beurre', 40, 'g'], ['Miel', 30, 'g'], ['Skyr', 400, 'g']]),
      etapes: ['Préchauffez le four à 180 °C.', f.prep.replace(' et faites-les compoter 8 min à la poêle avec la cannelle et 2 cuillères à soupe d’eau', ' et mélangez-les à la cannelle'), 'Disposez les fruits dans un plat à gratin.', 'Mélangez du bout des doigts les flocons, la poudre d’amandes, le beurre froid et la moitié du miel, puis répartissez sur les fruits.', 'Enfournez 25 min, jusqu’à ce que le dessus soit doré.', 'Servez tiède avec le skyr, sucré avec le reste du miel.'] }));
  }
  return out;
}

// ─── Génération ─────────────────────────────────────────────────────────────

/** Générateur pseudo-aléatoire déterministe (mêmes recettes à chaque exécution). */
function hasard(graine: number) {
  let s = graine;
  return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
}

export function genererRecettes(): RecetteSaisie[] {
  const rnd = hasard(42);
  const melange = <T>(t: T[]) => t.map(x => [rnd(), x] as const).sort((a, b) => a[0] - b[0]).map(x => x[1]);
  const out: RecetteSaisie[] = [];
  const titres = new Set<string>();

  for (const f of FORMATS) {
    const bases = BASES.filter(f.bases);
    const v1s = LEGUMES.filter(f.v1);
    const v2s = f.v2 ? LEGUMES.filter(f.v2) : [];
    for (const p of PROTEINES.filter(f.prots)) {
      for (const pr of PROFILS.filter(f.profils)) {
        const bs = melange(bases), l1 = melange(v1s), l2 = melange(v2s);
        let faites = 0;
        for (let k = 0; k < l1.length * 2 && faites < f.variantes; k++) {
          const b = bs[k % bs.length], v1 = l1[k % l1.length], v2 = l2.length ? l2[(k + 1) % l2.length] : undefined;
          const r = f.build({ p, pr, b, v1, v2 });
          if (!r) continue;
          const titre = maj(r.titre.replace(/\s+/g, ' ').trim());
          if (titres.has(titre.toLowerCase())) continue;
          titres.add(titre.toLowerCase());
          out.push({ ...r, titre, etapes: r.etapes.filter(Boolean), type: 'plat', portions: 4 });
          faites++;
        }
      }
    }
  }
  for (const d of desserts()) {
    if (titres.has(d.titre.toLowerCase())) continue;
    titres.add(d.titre.toLowerCase());
    out.push(d);
  }
  return out;
}

export const estVege = (r: RecetteSaisie) =>
  !r.ingredients.some(([n]) => PROTEINES.some(p => !vege(p) && p.ings.some(i => i[0] === n)));
