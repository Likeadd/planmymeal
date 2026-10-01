// ============================================================================
// Plats CLASSIQUES revisités, 100 % produits bruts.
//
// De vrais plats du patrimoine culinaire (blanquette, tajine, paella, pad
// thaï, moussaka…) : les idées de plats et leurs ingrédients sont libres,
// les ÉTAPES sont rédigées ici (aucun texte copié). Chaque plat est décliné :
// protéine différente, touche d'épices ou garniture — c'est la « variation
// de paramètres et d'ingrédients » d'une recette existante.
//
// Produits bruts uniquement : viandes et poissons frais, légumes et fruits,
// légumineuses SÈCHES, céréales, produits laitiers de base, œufs, épices,
// herbes, huiles. Aucune sauce prête, conserve, bouillon ou pâte toute faite
// (garde-fou : INTERDITS, vérifié à la génération).
// ============================================================================

import type { RecetteSaisie } from './recettes-proteinees';

type L = [string, number, string, boolean?];

/** Produits transformés refusés dans cette série. */
const INTERDITS = /\(bte\)|\(surg\.\)|Bouillon|Sauce barbecue|Sauce hoisin|Sriracha|Ketchup|Mayonnaise|Pesto|Pâte de curry|Pâte feuilletée|Pâte brisée|Pâte filo|Concentré|Gochujang|Chorizo|Lardons|Bacon|Jambon|Merguez|Saucisse|Nuggets|Frites|Surimi|Tofu|Tempeh|Seitan|Ratatouille \(|Poêlée de légumes|Salsa|Tortilla|Pain|Chapelure|Biscuit|Spéculoos|Pâte à tartiner|Glace|Sorbet|Granola|Chantilly/;

// ─── Accords ────────────────────────────────────────────────────────────────

interface G { f: boolean; pl: boolean }
const acc = (adj: string, g: G) => adj + (g.f ? 'e' : '') + (g.pl ? 's' : '');
const il = (g: G) => (g.f ? 'elle' : 'il') + (g.pl ? 's' : '');
const pro = (g: G) => (g.pl ? 'les' : g.f ? 'la' : 'le');
const soit = (g: G) => (g.pl ? 'soient' : 'soit');
/** Durée lisible : 150 → « 2 h 30 », 45 → « 45 min » */
const dur = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${String(m % 60).padStart(2, '0')}` : ''}` : `${m} min`);
const S = (...xs: (string | false | undefined)[]) => xs.filter(Boolean).join(' ');

// ─── Protéines brutes ───────────────────────────────────────────────────────

type Kind = 'volaille' | 'viande' | 'rapide' | 'hache' | 'canard' | 'poisson' | 'sardines' | 'crustace'
  | 'calamar' | 'moule' | 'stjacques' | 'legume' | 'poischiche' | 'oeuf' | 'nature';

interface Prot extends G {
  k: string; kind: Kind; ings: L[]; le: string; de: string; au: string;
  /** Minutes de mijotage (viandes : braisage ; légumineuses : cuisson) */
  mij: number;
}
const PR: Record<string, Prot> = {};
const def = (p: Prot) => { PR[p.k] = p; };
def({ k: 'poulet', kind: 'volaille', ings: [['Filet de poulet', 600, 'g']], le: 'le poulet', de: 'de poulet', au: 'au poulet', f: false, pl: false, mij: 25 });
def({ k: 'cuisses', kind: 'volaille', ings: [['Cuisses de poulet', 1000, 'g']], le: 'les cuisses de poulet', de: 'de cuisses de poulet', au: 'aux cuisses de poulet', f: true, pl: true, mij: 40 });
def({ k: 'dinde', kind: 'volaille', ings: [['Filet de dinde', 600, 'g']], le: 'la dinde', de: 'de dinde', au: 'à la dinde', f: true, pl: false, mij: 25 });
def({ k: 'veau', kind: 'viande', ings: [['Veau (épaule)', 700, 'g']], le: 'le veau', de: 'de veau', au: 'au veau', f: false, pl: false, mij: 75 });
def({ k: 'boeuf-braise', kind: 'viande', ings: [['Bœuf à braiser', 700, 'g']], le: 'le bœuf', de: 'de bœuf', au: 'au bœuf', f: false, pl: false, mij: 150 });
def({ k: 'agneau', kind: 'viande', ings: [['Épaule d’agneau', 700, 'g']], le: 'l’agneau', de: 'd’agneau', au: 'à l’agneau', f: false, pl: false, mij: 90 });
def({ k: 'porc', kind: 'viande', ings: [['Échine de porc', 700, 'g']], le: 'le porc', de: 'de porc', au: 'au porc', f: false, pl: false, mij: 60 });
def({ k: 'boeuf', kind: 'rapide', ings: [['Rumsteck', 600, 'g']], le: 'le bœuf', de: 'de bœuf', au: 'au bœuf', f: false, pl: false, mij: 0 });
def({ k: 'filet-mignon', kind: 'rapide', ings: [['Filet mignon de porc', 600, 'g']], le: 'le filet mignon', de: 'de filet mignon', au: 'au filet mignon', f: false, pl: false, mij: 0 });
def({ k: 'hache', kind: 'hache', ings: [['Bœuf haché 5 %', 500, 'g']], le: 'le bœuf haché', de: 'de bœuf haché', au: 'au bœuf haché', f: false, pl: false, mij: 0 });
def({ k: 'canard', kind: 'canard', ings: [['Magret de canard', 700, 'g']], le: 'le canard', de: 'de canard', au: 'au canard', f: false, pl: false, mij: 0 });
def({ k: 'cabillaud', kind: 'poisson', ings: [['Dos de cabillaud', 600, 'g']], le: 'le cabillaud', de: 'de cabillaud', au: 'au cabillaud', f: false, pl: false, mij: 8 });
def({ k: 'saumon', kind: 'poisson', ings: [['Saumon frais', 600, 'g']], le: 'le saumon', de: 'de saumon', au: 'au saumon', f: false, pl: false, mij: 8 });
def({ k: 'dorade', kind: 'poisson', ings: [['Filet de dorade', 600, 'g']], le: 'la dorade', de: 'de dorade', au: 'à la dorade', f: true, pl: false, mij: 6 });
def({ k: 'colin', kind: 'poisson', ings: [['Colin', 600, 'g']], le: 'le colin', de: 'de colin', au: 'au colin', f: false, pl: false, mij: 8 });
def({ k: 'maquereau', kind: 'poisson', ings: [['Maquereau', 600, 'g']], le: 'le maquereau', de: 'de maquereau', au: 'au maquereau', f: false, pl: false, mij: 6 });
def({ k: 'sole', kind: 'poisson', ings: [['Sole', 600, 'g']], le: 'la sole', de: 'de sole', au: 'à la sole', f: true, pl: false, mij: 6 });
def({ k: 'truite', kind: 'poisson', ings: [['Truite', 600, 'g']], le: 'la truite', de: 'de truite', au: 'à la truite', f: true, pl: false, mij: 6 });
def({ k: 'sardines', kind: 'sardines', ings: [['Sardines fraîches', 800, 'g']], le: 'les sardines', de: 'de sardines', au: 'aux sardines', f: true, pl: true, mij: 5 });
def({ k: 'crevettes', kind: 'crustace', ings: [['Crevettes', 500, 'g']], le: 'les crevettes', de: 'de crevettes', au: 'aux crevettes', f: true, pl: true, mij: 4 });
def({ k: 'gambas', kind: 'crustace', ings: [['Gambas', 600, 'g']], le: 'les gambas', de: 'de gambas', au: 'aux gambas', f: true, pl: true, mij: 5 });
def({ k: 'calamars', kind: 'calamar', ings: [['Calamars', 600, 'g']], le: 'les calamars', de: 'de calamars', au: 'aux calamars', f: false, pl: true, mij: 30 });
def({ k: 'moules', kind: 'moule', ings: [['Moules', 1500, 'g']], le: 'les moules', de: 'de moules', au: 'aux moules', f: true, pl: true, mij: 6 });
def({ k: 'stjacques', kind: 'stjacques', ings: [['Noix de Saint-Jacques', 400, 'g']], le: 'les noix de Saint-Jacques', de: 'de Saint-Jacques', au: 'aux Saint-Jacques', f: true, pl: true, mij: 2 });
def({ k: 'lentilles', kind: 'legume', ings: [['Lentilles vertes', 250, 'g']], le: 'les lentilles', de: 'de lentilles', au: 'aux lentilles', f: true, pl: true, mij: 25 });
def({ k: 'corail', kind: 'legume', ings: [['Lentilles corail', 250, 'g']], le: 'les lentilles corail', de: 'de lentilles corail', au: 'aux lentilles corail', f: true, pl: true, mij: 15 });
def({ k: 'pois-chiches', kind: 'poischiche', ings: [['Pois chiches secs', 250, 'g']], le: 'les pois chiches', de: 'de pois chiches', au: 'aux pois chiches', f: false, pl: true, mij: 75 });
def({ k: 'oeufs', kind: 'oeuf', ings: [['Œuf', 8, 'pcs']], le: 'les œufs', de: 'd’œufs', au: 'aux œufs', f: false, pl: true, mij: 8 });
def({ k: 'nature', kind: 'nature', ings: [], le: '', de: '', au: '', f: false, pl: false, mij: 0 });

const estNature = (p: Prot) => p.kind === 'nature';
/** Nom sans article, avec majuscule (« Saumon », « Crevettes »…) */
const nomSeul = (p: Prot) => { const n = p.le.replace(/^(le |la |les |l’)/, ''); return n.charAt(0).toUpperCase() + n.slice(1); };
const deE = (m: string) => (/^[aeiouyéèêâîôœ]/i.test(m) ? `d’${m}` : `de ${m}`);
const avec = (p: Prot, base: string) => (estNature(p) ? base : `${base} ${p.au}`);
const titreDe = (p: Prot, base: string) => (estNature(p) ? base : `${base} ${p.de}`);

// ─── Phrases selon la protéine ──────────────────────────────────────────────

/** Préparation (découpe, trempage…). `fin` : lanières plutôt que morceaux. */
function prep(p: Prot, fin = false): string {
  switch (p.kind) {
    case 'volaille': return p.k === 'cuisses' ? '' : `Coupez ${p.le} en ${fin ? 'fines lanières' : 'morceaux de 4 cm'}.`;
    case 'viande': return `Coupez ${p.le} en morceaux de 4 cm, en retirant les plus gros morceaux de gras.`;
    case 'rapide': return `Coupez ${p.le} en ${fin ? 'fines lanières' : 'cubes de 3 cm'}.`;
    case 'canard': return `Retirez la moitié du gras des magrets et coupez-les en ${fin ? 'fines lanières' : 'cubes de 3 cm'}.`;
    case 'poisson': return `Retirez les arêtes et coupez ${p.le} en gros morceaux.`;
    case 'sardines': return 'Videz et rincez les sardines (ou demandez à votre poissonnier de les préparer en filets).';
    case 'crustace': return `Décortiquez ${p.le} et retirez le boyau noir.`;
    case 'calamar': return 'Nettoyez les calamars et coupez-les en anneaux.';
    case 'moule': return 'Grattez et rincez les moules ; jetez celles qui restent ouvertes quand on les tapote.';
    case 'stjacques': return 'Épongez les noix de Saint-Jacques avec du papier absorbant.';
    case 'legume': return `Rincez ${p.le} à l’eau froide.`;
    case 'poischiche': return 'La veille, faites tremper les pois chiches dans un grand volume d’eau froide, puis égouttez-les.';
    default: return '';
  }
}

/** Début de braisage : les viandes sont saisies puis réservées. */
function saisir(p: Prot): string {
  if (['volaille', 'viande', 'canard'].includes(p.kind)) return `${prep(p)} Faites dorer ${p.le} 5 min sur toutes les faces dans la cocotte avec un filet d’huile, puis réservez.`.trim();
  return prep(p);
}

/** Fin de braisage selon la protéine. */
function mijoter(p: Prot, base = 25): string {
  switch (p.kind) {
    case 'volaille': case 'viande': case 'canard':
      return `Remettez ${p.le} dans la cocotte, couvrez et laissez mijoter ${dur(p.mij)} à feu doux${p.mij >= 60 ? ' : la viande doit devenir fondante' : ''}.`;
    case 'poisson': case 'sardines': case 'crustace': case 'stjacques':
      return `Laissez mijoter ${base} min, puis déposez ${p.le} dans la sauce pour les ${Math.max(p.mij, 4)} dernières minutes, sans remuer.`;
    case 'calamar': return `Ajoutez les calamars, couvrez et laissez mijoter ${Math.max(base, 30)} min à feu doux : ils deviennent tendres en cuisant longtemps.`;
    case 'moule': return `Laissez mijoter ${base} min, puis ajoutez les moules, couvrez et laissez-les s’ouvrir 5 à 6 min à feu vif en secouant la cocotte.`;
    case 'legume': case 'poischiche':
      return `Ajoutez ${p.le} et 60 cl d’eau, couvrez et laissez mijoter ${dur(p.mij)}, jusqu’à ce qu’${il(p)} ${soit(p)} ${acc('tendre', { f: false, pl: p.pl }).replace('tendres', 'tendres')}.`.replace('tendree', 'tendre');
    case 'oeuf': return `Laissez mijoter ${base} min, puis creusez 8 petits puits dans la préparation, cassez-y les œufs, couvrez et laissez cuire 7 à 8 min : les blancs doivent être pris.`;
    case 'nature': return `Couvrez et laissez mijoter ${base} min à feu doux, en remuant de temps en temps.`;
    default: return `Laissez mijoter ${base} min.`;
  }
}
const tempsMijote = (p: Prot, base = 25) =>
  ['volaille', 'viande', 'canard'].includes(p.kind) ? p.mij + 15
    : p.kind === 'legume' || p.kind === 'poischiche' ? p.mij + 10
      : p.kind === 'calamar' ? Math.max(base, 30) + 10 : base + 10;

/** Cuisson vive (poêle, wok) puis réserve. */
function sauter(p: Prot): string {
  switch (p.kind) {
    case 'volaille': return `${prep(p, true)} Saisissez ${p.le} 5 à 6 min à feu vif dans un filet d’huile, jusqu’à ce qu’${il(p)} ${soit(p)} ${acc('cuit', p)} à cœur. Réservez.`.trim();
    case 'rapide': return p.k === 'boeuf'
      ? `${prep(p, true)} Saisissez le bœuf 2 min à feu très vif : il doit rester rosé. Réservez.`
      : `${prep(p, true)} Saisissez le filet mignon 4 à 5 min à feu vif, jusqu’à ce qu’il soit juste cuit. Réservez.`;
    case 'viande': return `Coupez ${p.le} en fines lanières et saisissez-${pro(p)} 4 min à feu très vif. Réservez.`;
    case 'hache': return 'Faites revenir le bœuf haché 6 min dans un filet d’huile, en l’émiettant à la spatule. Réservez.';
    case 'canard': return `${prep(p, true)} Saisissez le canard 3 min à feu vif, sans ajouter de matière grasse. Réservez et jetez l’excédent de graisse.`;
    case 'poisson': return `${prep(p)} Faites-${pro(p)} cuire 3 à 4 min dans un filet d’huile en ${pro(p)} retournant délicatement. Réservez.`;
    case 'sardines': return 'Faites cuire les filets de sardines 1 min par face dans un filet d’huile. Réservez.';
    case 'crustace': return `${prep(p)} Faites sauter ${p.le} 2 à 3 min, jusqu’à ce qu’elles soient roses. Réservez.`;
    case 'calamar': return `${prep(p)} Faites-les sauter 2 min à feu très vif (plus longtemps, ils durcissent). Réservez.`;
    case 'stjacques': return `${prep(p)} Saisissez-les 1 min 30 par face dans une poêle très chaude. Réservez.`;
    case 'moule': return `${prep(p)} Faites-les ouvrir 5 min à couvert dans une grande casserole avec un fond d’eau, puis décoquillez-les.`;
    case 'legume': return `${prep(p)} Faites cuire ${p.le} ${dur(p.mij)} dans une casserole d’eau non salée, salez en fin de cuisson et égouttez.`;
    case 'poischiche': return `${prep(p)} Faites cuire les pois chiches 1 h 15 dans une grande casserole d’eau, salez en fin de cuisson et égouttez.`;
    case 'oeuf': return 'Battez les œufs, versez-les dans la poêle chaude et brouillez-les 1 min. Réservez.';
    default: return '';
  }
}
const tempsSauter = (p: Prot) => (p.kind === 'legume' ? p.mij : p.kind === 'poischiche' ? 75 : 8);

/** Au four sur les légumes. */
function rotir(p: Prot): { txt: string; min: number } {
  const m: Record<Kind, number> = { volaille: p.k === 'cuisses' ? 40 : 20, viande: 45, rapide: 15, hache: 20, canard: 15, poisson: 14, sardines: 10, crustace: 8, calamar: 12, moule: 10, stjacques: 6, legume: 20, poischiche: 20, oeuf: 8, nature: 0 };
  const min = m[p.kind];
  switch (p.kind) {
    case 'nature': return { txt: '', min: 0 };
    case 'oeuf': return { txt: 'Creusez 8 nids dans les légumes, cassez-y les œufs et enfournez 8 min : les blancs doivent être pris.', min };
    case 'legume': case 'poischiche': return { txt: `${sauter(p)} Ajoutez-${pro(p)} sur la plaque pour les 20 dernières minutes.`, min };
    case 'hache': return { txt: 'Façonnez le bœuf haché en petites boulettes, posez-les sur les légumes et enfournez 20 min.', min };
    default: return { txt: `${prep(p)} Déposez ${p.le} sur les légumes, arrosez d’un filet d’huile et enfournez ${min} min${p.kind === 'poisson' || p.kind === 'sardines' ? ' : la chair doit se détacher en lamelles' : p.kind === 'volaille' ? ', jusqu’à ce que le jus soit clair' : ''}.`.trim(), min };
  }
}

/** Dans une soupe ou un bouillon maison. */
function pocher(p: Prot): string {
  switch (p.kind) {
    case 'volaille': return `Plongez ${p.le} ${p.k === 'cuisses' ? '' : 'entier '}dans la soupe frémissante et laissez pocher ${p.k === 'cuisses' ? 30 : 15} min, puis effilochez-${pro(p)} et remettez-${pro(p)} dans la soupe.`.replace('  ', ' ');
    case 'viande': return `${saisir(p)} Remettez ${p.le} dans la soupe dès le début et prolongez la cuisson de ${dur(p.mij)}.`;
    case 'rapide': return `${prep(p, true)} Répartissez les lanières crues dans les bols : le bouillon brûlant les cuit en 1 min.`;
    case 'hache': return 'Façonnez le bœuf haché en petites boulettes et faites-les pocher 8 min dans la soupe.';
    case 'poisson': case 'sardines': case 'crustace': case 'stjacques':
      return `${prep(p)} Plongez ${p.le} dans la soupe pour les ${Math.max(p.mij - 2, 3)} dernières minutes, à petit frémissement.`;
    case 'calamar': return `${prep(p)} Ajoutez-les pour les 5 dernières minutes.`;
    case 'moule': return `${prep(p)} Ajoutez-les pour les 6 dernières minutes, à couvert, jusqu’à ce qu’elles s’ouvrent.`;
    case 'legume': case 'poischiche': return `${prep(p)} Ajoutez ${p.le} en même temps que l’eau${p.kind === 'poischiche' ? ' et prolongez la cuisson d’1 h' : ''}.`;
    case 'oeuf': return 'Cassez les œufs un à un dans la soupe frémissante et laissez-les pocher 4 min.';
    default: return '';
  }
}

/** Grillé (brochettes, plancha). */
function griller(p: Prot): string {
  const m: Partial<Record<Kind, number>> = { volaille: 12, viande: 10, rapide: 6, hache: 10, canard: 6, poisson: 8, sardines: 3, crustace: 4, calamar: 4, stjacques: 3 };
  return `Faites griller ${p.kind === 'hache' ? 'les keftas' : p.le} ${m[p.kind] ?? 8} min sur un gril ou une poêle-gril bien chaude, en ${p.kind === 'sardines' ? 'les' : 'les brochettes'} retournant régulièrement.`;
}

// ─── Modèle de plat ─────────────────────────────────────────────────────────

interface Twist { s: string; i: L[]; e: string }
interface Plat {
  n: (p: Prot) => string; c: string; t?: 'plat' | 'entree'; pr: number; cu: (p: Prot) => number;
  d?: 'facile' | 'moyen' | 'difficile'; co: number; u: string[];
  p: string[]; i: L[]; e: (p: Prot) => string[]; tw?: Twist[];
}
const H: L = ['Huile d’olive', 2, 'cas'];
const OI: L = ['Oignon', 2, 'pcs'];
const AIL: L = ['Ail', 3, 'pcs'];
const TOM = (n = 6): L => ['Tomate', n, 'pcs'];
const THYM: L = ['Thym', 3, 'g'];
const LAU: L = ['Feuille de laurier', 2, 'pcs'];
const PER: L = ['Persil', 20, 'g'];
const CORI: L = ['Coriandre fraîche', 20, 'g'];
const CIT: L = ['Citron', 1, 'pcs'];
const CITV: L = ['Citron vert', 2, 'pcs'];
const GING: L = ['Gingembre', 20, 'g'];
const SOJA = (n = 3): L => ['Sauce soja', n, 'cas'];
const BEU = (n = 30): L => ['Beurre', n, 'g'];
const riz = (nom = 'Riz basmati', q = 280): L => [nom, q, 'g'];
const cuitRiz = 'Rincez le riz et faites-le cuire 11 min dans une grande casserole d’eau bouillante salée, puis égouttez.';
const tomatesConcassees = 'Plongez les tomates 30 s dans l’eau bouillante, pelez-les et concassez-les.';
const BRAISE = ['viande', 'volaille'].map(k => Object.values(PR).filter(p => p.kind === k).map(p => p.k)).flat();

const PLATS: Plat[] = [
  // ── France ──
  { n: p => titreDe(p, 'Blanquette'), c: 'Française', pr: 25, cu: p => tempsMijote(p, 20), d: 'moyen', co: 3, u: ['Cocotte', 'Casserole'],
    p: ['veau', 'poulet', 'dinde', 'porc', 'cabillaud', 'colin', 'lentilles'],
    i: [['Carotte', 3, 'pcs'], ['Champignons de Paris', 250, 'g'], OI, LAU, THYM, BEU(40), ['Farine', 40, 'g'], ['Crème fraîche', 3, 'cas'], ['Jaune d\'œuf', 1, 'pcs'], CIT, riz('Riz basmati', 250)],
    e: p => [S(prep(p), p.kind === 'viande' || p.kind === 'volaille' ? `Placez ${p.le} dans une cocotte, couvrez d’eau froide, portez à ébullition et écumez.` : ''),
      `Ajoutez les carottes en rondelles, les oignons coupés en quatre, le thym et le laurier${p.kind === 'viande' || p.kind === 'volaille' ? `, puis laissez frémir ${dur(p.mij)} à couvert` : ' dans 1 L d’eau salée et laissez frémir 20 min'}.`,
      p.kind === 'poisson' ? `Pochez ${p.le} 8 min dans ce bouillon frémissant, puis égouttez-${pro(p)} délicatement.` : p.kind === 'legume' ? `Faites cuire les lentilles 25 min dans ce bouillon.` : '',
      'Faites revenir les champignons émincés 5 min dans 10 g de beurre.', cuitRiz,
      'Préparez un roux : faites fondre le reste de beurre, ajoutez la farine, remuez 1 min, puis versez 60 cl du bouillon filtré en fouettant jusqu’à épaississement.',
      `Hors du feu, incorporez la crème mélangée au jaune d’œuf et au jus du citron. Ajoutez ${estNature(p) ? 'les légumes' : `${p.le}, les carottes`} et les champignons, réchauffez sans bouillir et servez avec le riz.`],
    tw: [{ s: 'à l’ancienne', i: [['Oignon nouveau', 6, 'pcs']], e: 'Ajoutez les petits oignons nouveaux entiers en même temps que les champignons.' }] },
  { n: p => (p.k === 'boeuf-braise' ? 'Bœuf bourguignon' : titreDe(p, 'Mijoté') + ' à la bourguignonne'), c: 'Française', pr: 25, cu: p => tempsMijote(p), d: 'moyen', co: 4, u: ['Cocotte'],
    p: ['boeuf-braise', 'porc', 'agneau', 'cuisses', 'lentilles'],
    i: [['Vin rouge', 500, 'ml'], ['Carotte', 3, 'pcs'], OI, AIL, ['Champignons de Paris', 250, 'g'], ['Farine', 20, 'g'], THYM, LAU, H, ['Pomme de terre', 800, 'g']],
    e: p => [saisir(p), 'Dans la même cocotte, faites revenir les oignons émincés et les carottes en rondelles 5 min, saupoudrez de farine et remuez 1 min.',
      'Versez le vin rouge et 20 cl d’eau, ajoutez l’ail écrasé, le thym et le laurier, et grattez le fond pour décoller les sucs.', mijoter(p, 45),
      'Ajoutez les champignons coupés en quatre 20 min avant la fin.', 'Faites cuire les pommes de terre 20 min à l’eau salée et servez-les avec le plat.'],
    tw: [{ s: 'au thym et à l’ail confit', i: [['Ail', 6, 'pcs']], e: 'Ajoutez des gousses d’ail entières en chemise 30 min avant la fin : elles deviennent confites.' }] },
  { n: p => (p.k === 'cuisses' ? 'Coq au vin façon rapide' : titreDe(p, 'Fricassée') + ' au vin blanc'), c: 'Française', pr: 20, cu: p => tempsMijote(p), co: 3, u: ['Cocotte'],
    p: ['cuisses', 'poulet', 'dinde', 'veau', 'porc', 'lentilles'],
    i: [['Vin blanc', 250, 'ml'], ['Échalote', 3, 'pcs'], ['Champignons de Paris', 300, 'g'], ['Crème fraîche', 3, 'cas'], THYM, H, ['Tagliatelles', 320, 'g']],
    e: p => [saisir(p), 'Faites fondre les échalotes émincées 3 min, ajoutez les champignons en lamelles et faites-les dorer 5 min.',
      'Déglacez avec le vin blanc, ajoutez le thym et 10 cl d’eau.', mijoter(p, 20), 'Incorporez la crème et laissez réduire 3 min à découvert.',
      'Faites cuire les tagliatelles et servez-les nappées de sauce.'] },
  { n: p => (estNature(p) ? 'Ratatouille' : avec(p, 'Ratatouille')), c: 'Française', pr: 25, cu: p => tempsMijote(p, 35), co: 4, u: ['Cocotte', 'Poêle'],
    p: ['nature', 'pois-chiches', 'oeufs', 'poulet', 'cabillaud', 'agneau', 'lentilles'],
    i: [['Aubergine', 2, 'pcs'], ['Courgette', 2, 'pcs'], ['Poivron rouge', 1, 'pcs'], ['Poivron vert', 1, 'pcs'], TOM(5), OI, AIL, ['Herbes de Provence', 2, 'cac'], ['Huile d’olive', 4, 'cas'], ['Basilic', 15, 'g'], ['Boulgour', 200, 'g']],
    e: p => [saisir(p), 'Coupez tous les légumes en cubes de 2 cm. Faites dorer séparément, dans l’huile d’olive, les aubergines, puis les courgettes, puis les poivrons : chaque légume garde ainsi son goût.',
      `Dans la cocotte, faites fondre les oignons et l’ail 5 min, ajoutez les tomates concassées et les herbes de Provence. ${tomatesConcassees}`,
      'Remettez tous les légumes dans la cocotte et mélangez délicatement.', mijoter(p, 35),
      'Versez 1,5 fois son volume d’eau bouillante salée sur le boulgour, couvrez 12 min, puis servez avec la ratatouille parsemée de basilic.'] },
  { n: p => titreDe(p, 'Tian provençal'), c: 'Française', pr: 25, cu: p => 45 + (p.kind === 'poischiche' ? 0 : 0), co: 3, u: ['Four', 'Plat à gratin'],
    p: ['nature', 'sardines', 'agneau', 'poulet', 'pois-chiches', 'dorade'],
    i: [['Courgette', 2, 'pcs'], ['Aubergine', 1, 'pcs'], TOM(5), ['Oignon rouge', 2, 'pcs'], AIL, ['Herbes de Provence', 2, 'cac'], ['Huile d’olive', 4, 'cas'], ['Parmesan', 40, 'g'], ['Quinoa', 200, 'g']],
    e: p => ['Préchauffez le four à 190 °C.', 'Coupez courgettes, aubergine, tomates et oignons rouges en fines rondelles, puis disposez-les debout en rangées serrées dans le plat, en alternant les couleurs.',
      'Parsemez d’ail haché et d’herbes, arrosez d’huile d’olive, salez et enfournez 30 min.', rotir(p).txt && `${rotir(p).txt.replace('sur les légumes', 'sur le tian')}`,
      'Parsemez de parmesan râpé 5 min avant la fin.', 'Faites cuire le quinoa 12 min dans 2 fois son volume d’eau salée et servez avec le tian.'] },
  { n: p => (p.k === 'hache' ? 'Hachis parmentier' : titreDe(p, 'Parmentier')), c: 'Française', pr: 30, cu: () => 50, co: 3, u: ['Four', 'Plat à gratin', 'Presse-purée'],
    p: ['hache', 'cabillaud', 'saumon', 'lentilles', 'canard', 'cuisses'],
    i: [['Pomme de terre', 1200, 'g'], ['Lait', 200, 'ml'], BEU(40), OI, AIL, PER, ['Gruyère râpé', 60, 'g'], ['Herbes de Provence', 1, 'cac']],
    e: p => ['Préchauffez le four à 200 °C. Épluchez les pommes de terre et faites-les cuire 25 min à l’eau salée.',
      'Écrasez-les en purée avec le lait chaud et le beurre. Salez, poivrez.',
      p.kind === 'hache' ? 'Faites revenir les oignons et l’ail hachés 3 min, ajoutez le bœuf haché et faites-le dorer 6 min en l’émiettant.'
        : p.kind === 'volaille' ? 'Faites dorer les cuisses de poulet 10 min, puis couvrez et laissez cuire 25 min. Effilochez la chair et mélangez-la aux oignons fondus.'
          : p.kind === 'canard' ? `${prep(p)} Faites dorer le canard 5 min, puis hachez-le grossièrement et mélangez-le aux oignons fondus.`
            : p.kind === 'legume' ? `${sauter(p).replace(' Réservez.', '')} Mélangez-les aux oignons fondus.` : `Pochez ${p.le} 6 min dans de l’eau frémissante, émiettez-${pro(p)} et mélangez-${pro(p)} aux oignons fondus.`,
      'Ajoutez le persil haché, étalez la garniture au fond du plat et recouvrez de purée.', 'Parsemez de gruyère râpé et enfournez 20 min, jusqu’à ce que le dessus soit bien doré.'] },
  { n: p => titreDe(p, 'Pot-au-feu'), c: 'Française', pr: 25, cu: p => (p.kind === 'viande' ? p.mij + 30 : 60), d: 'facile', co: 4, u: ['Faitout'],
    p: ['boeuf-braise', 'cuisses', 'veau', 'dinde'],
    i: [['Carotte', 4, 'pcs'], ['Poireau', 2, 'pcs'], ['Navet', 3, 'pcs'], ['Céleri branche', 2, 'pcs'], ['Pomme de terre', 600, 'g'], OI, LAU, THYM, ['Moutarde', 1, 'cas']],
    e: p => [prep(p), `Placez ${p.le} dans un grand faitout, couvrez largement d’eau froide, portez à ébullition et écumez soigneusement.`,
      `Ajoutez un oignon piqué du laurier et le thym, puis laissez frémir ${p.kind === 'viande' ? p.mij - 30 : 20} min à couvert.`,
      'Ajoutez les carottes, poireaux, navets et céleri coupés en gros tronçons, et laissez frémir encore 30 min.',
      'Ajoutez les pommes de terre épluchées pour les 20 dernières minutes.', 'Servez la viande et les légumes avec un peu de bouillon, du gros sel et la moutarde.'] },
  { n: p => titreDe(p, 'Navarin printanier'), c: 'Française', pr: 25, cu: p => tempsMijote(p), co: 3, u: ['Cocotte'],
    p: ['agneau', 'veau', 'poulet', 'pois-chiches'],
    i: [['Carotte', 4, 'pcs'], ['Navet', 3, 'pcs'], ['Petits pois frais', 250, 'g'], ['Haricots verts', 200, 'g'], ['Pomme de terre', 500, 'g'], ['Oignon nouveau', 4, 'pcs'], TOM(2), ['Farine', 15, 'g'], THYM, H],
    e: p => [saisir(p), 'Faites revenir les oignons nouveaux 3 min, saupoudrez de farine, ajoutez les tomates concassées et 50 cl d’eau.',
      'Ajoutez les carottes et navets coupés en tronçons, et le thym.', mijoter(p, 30), 'Ajoutez les pommes de terre en morceaux 25 min avant la fin, puis les petits pois et les haricots verts les 10 dernières minutes.', 'Rectifiez l’assaisonnement et servez bien chaud.'] },
  { n: p => avec(p, 'Gratin dauphinois'), c: 'Française', pr: 20, cu: () => 60, co: 3, u: ['Four', 'Plat à gratin'],
    p: ['poulet', 'saumon', 'dinde', 'filet-mignon', 'oeufs'],
    i: [['Pomme de terre', 1000, 'g'], ['Lait', 400, 'ml'], ['Crème liquide', 150, 'ml'], AIL, ['Beurre', 15, 'g'], ['Salade verte', 1, 'pcs']],
    e: p => ['Préchauffez le four à 170 °C. Frottez le plat avec une gousse d’ail coupée et beurrez-le.',
      'Épluchez les pommes de terre et coupez-les en rondelles fines, sans les rincer : leur amidon liera le gratin.',
      'Faites frémir le lait avec la crème, l’ail écrasé, du sel et du poivre, plongez-y les rondelles et laissez cuire 10 min en remuant.',
      'Versez dans le plat et enfournez 50 min, jusqu’à ce que le dessus soit doré et les pommes de terre fondantes.',
      p.kind === 'oeuf' ? 'Faites cuire les œufs 6 min dans l’eau bouillante (mollets) et servez-les sur le gratin.' : sauter(p).replace(' Réservez.', ' Servez avec le gratin.'), 'Accompagnez d’une salade verte.'] },
  { n: p => titreDe(p, 'Papillote') + ' aux petits légumes', c: 'Française', pr: 20, cu: () => 20, co: 1, u: ['Four', 'Papier cuisson'],
    p: ['cabillaud', 'saumon', 'dorade', 'colin', 'poulet', 'crevettes', 'maquereau'],
    i: [['Courgette', 1, 'pcs'], ['Carotte', 2, 'pcs'], ['Poireau', 1, 'pcs'], CIT, ['Aneth frais', 10, 'g'], ['Huile d’olive', 2, 'cas'], ['Riz basmati', 250, 'g']],
    e: p => ['Préchauffez le four à 200 °C.', 'Taillez la courgette, les carottes et le poireau en fins bâtonnets.',
      `Sur 4 grandes feuilles de papier cuisson, répartissez les légumes, posez ${p.le} par-dessus${p.kind === 'volaille' ? ' coupé en aiguillettes' : ''}, ajoutez une rondelle de citron, de l’aneth, un filet d’huile, du sel et du poivre.`,
      `Refermez hermétiquement les papillotes et enfournez ${p.kind === 'volaille' ? 20 : p.kind === 'crustace' ? 10 : 15} min.`, cuitRiz, 'Servez les papillotes fermées : chacun les ouvre à table.'],
    tw: [{ s: 'au lait de coco et citron vert', i: [['Lait de coco', 150, 'ml'], CITV], e: 'Arrosez chaque papillote de 2 cuillères à soupe de lait de coco et du jus de citron vert avant de fermer.' }] },
  { n: p => titreDe(p, 'Gratin') + ' de chou-fleur', c: 'Française', pr: 20, cu: () => 35, co: 3, u: ['Four', 'Casserole'],
    p: ['nature', 'poulet', 'colin', 'oeufs', 'lentilles'],
    i: [['Chou-fleur', 1, 'pcs'], ['Lait', 500, 'ml'], BEU(30), ['Farine', 30, 'g'], ['Comté', 80, 'g'], ['Herbes de Provence', 1, 'cac']],
    e: p => ['Préchauffez le four à 200 °C. Faites cuire les bouquets de chou-fleur 8 min à l’eau bouillante salée et égouttez-les.',
      'Préparez une béchamel : faites fondre le beurre, ajoutez la farine, puis le lait froid en fouettant jusqu’à épaississement. Salez, poivrez.',
      p.kind === 'oeuf' ? 'Faites durcir les œufs 9 min, écalez-les et coupez-les en quartiers.' : sauter(p).replace(' Réservez.', ''),
      `Disposez le chou-fleur${estNature(p) ? '' : ` et ${p.le}`} dans le plat, nappez de béchamel et parsemez de comté râpé.`, 'Enfournez 20 min, jusqu’à ce que le dessus soit doré.'] },
  { n: p => (p.k === 'poulet' ? 'Poulet basquaise' : titreDe(p, 'Mijoté') + ' à la basquaise'), c: 'Française', pr: 20, cu: p => tempsMijote(p), co: 3, u: ['Cocotte'],
    p: ['poulet', 'cuisses', 'dinde', 'calamars', 'cabillaud', 'oeufs', 'porc'],
    i: [['Poivron rouge', 2, 'pcs'], ['Poivron vert', 2, 'pcs'], TOM(5), OI, AIL, ['Piment doux', 1, 'cac'], ['Vin blanc', 100, 'ml'], H, riz()],
    e: p => [saisir(p), 'Faites fondre les oignons émincés et les poivrons en lanières 10 min à feu moyen.', `${tomatesConcassees} Ajoutez-les avec l’ail, le piment doux et le vin blanc.`,
      mijoter(p, 20), cuitRiz, 'Servez avec le riz.'] },
  { n: p => titreDe(p, 'Cassolette') + ' aux poireaux', c: 'Française', pr: 20, cu: () => 30, co: 2, u: ['Sauteuse'],
    p: ['saumon', 'stjacques', 'cabillaud', 'poulet', 'crevettes', 'moules'],
    i: [['Poireau', 4, 'pcs'], ['Crème fraîche', 4, 'cas'], ['Vin blanc', 100, 'ml'], BEU(20), ['Échalote', 2, 'pcs'], ['Riz basmati', 250, 'g']],
    e: p => ['Émincez finement les poireaux et les échalotes, faites-les fondre 15 min dans le beurre à feu doux, à couvert.',
      'Versez le vin blanc, laissez réduire 3 min, puis ajoutez la crème.', sauter(p).replace(' Réservez.', ''), `Ajoutez ${p.le} à la fondue de poireaux et réchauffez 2 min.`, cuitRiz, 'Servez aussitôt avec le riz.'] },
  // ── Italie ──
  { n: p => (p.k === 'hache' ? 'Spaghetti bolognaise maison' : titreDe(p, 'Spaghetti') + ' à la sauce tomate maison'), c: 'Italienne', pr: 15, cu: p => (p.k === 'hache' ? 60 : 30), co: 3, u: ['Sauteuse', 'Casserole'],
    p: ['hache', 'lentilles', 'crevettes', 'calamars', 'poulet', 'sardines'],
    i: [TOM(8), OI, ['Carotte', 1, 'pcs'], ['Céleri branche', 1, 'pcs'], AIL, ['Basilic', 15, 'g'], ['Origan', 1, 'cac'], ['Huile d’olive', 3, 'cas'], ['Spaghetti', 350, 'g'], ['Parmesan', 40, 'g']],
    e: p => [`${tomatesConcassees}`, 'Hachez finement oignon, carotte et céleri, faites-les fondre 8 min dans l’huile d’olive à feu doux.',
      p.kind === 'hache' ? 'Ajoutez le bœuf haché et faites-le dorer 5 min en l’émiettant.' : p.kind === 'legume' ? `${prep(p)} Ajoutez les lentilles avec les tomates et 30 cl d’eau.` : '',
      `Ajoutez l’ail, les tomates et l’origan, puis laissez mijoter ${p.k === 'hache' ? 45 : p.kind === 'legume' ? 30 : 20} min à feu doux.`,
      ['crustace', 'calamar', 'volaille', 'sardines'].includes(p.kind) ? sauter(p).replace(' Réservez.', ' Ajoutez-les à la sauce en fin de cuisson.') : '',
      'Faites cuire les spaghetti al dente, égouttez et mélangez à la sauce. Servez avec le basilic et le parmesan râpé.'] },
  { n: p => (estNature(p) ? 'Risotto aux champignons' : `Risotto ${p.au} et aux champignons`), c: 'Italienne', pr: 15, cu: () => 30, d: 'moyen', co: 1, u: ['Sauteuse'],
    p: ['nature', 'poulet', 'stjacques', 'crevettes', 'saumon', 'canard'],
    i: [['Riz Arborio', 300, 'g'], ['Champignons de Paris', 300, 'g'], ['Champignons shiitakés', 100, 'g'], ['Échalote', 2, 'pcs'], ['Vin blanc', 100, 'ml'], ['Parmesan', 60, 'g'], BEU(30), THYM],
    e: p => ['Faites chauffer 1,2 L d’eau salée avec le thym et les pieds des champignons : ce sera le bouillon.',
      'Faites revenir les échalotes hachées dans la moitié du beurre, ajoutez le riz et nacrez-le 2 min en remuant.',
      'Versez le vin blanc, laissez absorber, puis ajoutez le bouillon louche par louche en remuant, pendant 18 min.', 'Pendant ce temps, faites dorer les champignons émincés 6 min à la poêle.',
      sauter(p), 'Hors du feu, incorporez le reste de beurre, le parmesan et les champignons. Servez aussitôt' + (estNature(p) ? '.' : `, surmonté de ${p.le}.`)],
    tw: [{ s: 'au citron et aux herbes', i: [CIT, PER], e: 'Ajoutez le zeste et le jus du citron et le persil ciselé au moment de servir.' }] },
  { n: p => (estNature(p) ? 'Risotto aux asperges et petits pois' : `Risotto ${p.au}, asperges et petits pois`), c: 'Italienne', pr: 15, cu: () => 30, d: 'moyen', co: 1, u: ['Sauteuse'],
    p: ['nature', 'crevettes', 'poulet', 'saumon', 'oeufs'],
    i: [['Riz Arborio', 300, 'g'], ['Asperge verte', 300, 'g'], ['Petits pois frais', 200, 'g'], ['Échalote', 2, 'pcs'], ['Vin blanc', 100, 'ml'], ['Parmesan', 60, 'g'], BEU(30), CIT],
    e: p => ['Faites chauffer 1,2 L d’eau salée avec les parures des asperges.', 'Faites revenir les échalotes hachées dans le beurre, ajoutez le riz et nacrez-le 2 min.',
      'Versez le vin blanc puis le bouillon louche par louche en remuant, pendant 18 min. Ajoutez les asperges en tronçons et les petits pois à mi-cuisson.',
      p.kind === 'oeuf' ? 'Faites pocher les œufs 3 min dans une eau frémissante vinaigrée.' : sauter(p), 'Hors du feu, incorporez le parmesan et le zeste de citron.' + (estNature(p) ? '' : ` Servez avec ${p.le}.`)] },
  { n: p => titreDe(p, 'Lasagnes maison'), c: 'Italienne', pr: 40, cu: () => 75, d: 'moyen', co: 3, u: ['Four', 'Plat à gratin', 'Casserole'],
    p: ['hache', 'lentilles', 'saumon', 'poulet', 'nature'],
    i: [['Feuilles de lasagne', 250, 'g'], TOM(8), OI, AIL, ['Lait', 600, 'ml'], BEU(40), ['Farine', 40, 'g'], ['Parmesan', 60, 'g'], ['Mozzarella', 125, 'g'], ['Basilic', 10, 'g'], ['Épinards frais', 300, 'g']],
    e: p => [tomatesConcassees, `Faites fondre les oignons et l’ail, ajoutez ${p.kind === 'hache' ? 'le bœuf haché, faites-le dorer, puis ' : p.kind === 'legume' ? 'les lentilles rincées, 30 cl d’eau, puis ' : ''}les tomates, et laissez mijoter 30 min.`,
      'Préparez une béchamel avec le beurre, la farine et le lait.', p.kind === 'poisson' || p.kind === 'volaille' ? `${sauter(p).replace(' Réservez.', '')} Émiettez-${pro(p)}.` : '', 'Faites tomber les épinards 2 min à la poêle.',
      `Préchauffez le four à 180 °C. Alternez dans le plat : sauce tomate, feuilles de lasagne, ${estNature(p) ? '' : `${p.le}, `}épinards, béchamel. Terminez par la béchamel, la mozzarella et le parmesan.`, 'Enfournez 40 min et laissez reposer 10 min avant de couper.'] },
  { n: p => titreDe(p, 'Penne') + ' alla norma', c: 'Italienne', pr: 15, cu: () => 30, co: 2, u: ['Sauteuse', 'Casserole'],
    p: ['nature', 'poulet', 'sardines', 'crevettes', 'hache', 'pois-chiches'],
    i: [['Aubergine', 2, 'pcs'], TOM(6), AIL, ['Basilic', 15, 'g'], ['Huile d’olive', 4, 'cas'], ['Pâtes penne', 350, 'g'], ['Ricotta légère', 150, 'g']],
    e: p => ['Coupez les aubergines en cubes et faites-les dorer 10 min dans l’huile d’olive.', `${tomatesConcassees} Ajoutez-les avec l’ail et laissez compoter 15 min.`,
      sauter(p).replace(' Réservez.', ' Ajoutez-les à la sauce.'), 'Faites cuire les penne al dente, mélangez-les à la sauce et servez avec la ricotta émiettée et le basilic.'] },
  { n: p => avec(p, 'Minestrone'), c: 'Italienne', pr: 25, cu: p => 45 + (p.kind === 'poischiche' ? 60 : 0), co: 3, u: ['Faitout'],
    p: ['nature', 'pois-chiches', 'lentilles', 'poulet', 'oeufs'],
    i: [['Carotte', 2, 'pcs'], ['Courgette', 1, 'pcs'], ['Céleri branche', 2, 'pcs'], ['Poireau', 1, 'pcs'], ['Haricots verts', 150, 'g'], TOM(3), OI, AIL, ['Pâtes (fussili)', 120, 'g'], ['Parmesan', 40, 'g'], ['Basilic', 15, 'g'], H],
    e: p => ['Coupez tous les légumes en petits dés.', 'Faites revenir l’oignon, l’ail, la carotte et le céleri 5 min dans l’huile d’olive.',
      'Ajoutez les tomates concassées, le poireau et 1,5 L d’eau salée, portez à ébullition.', pocher(p), 'Ajoutez la courgette et les haricots verts, laissez cuire 15 min, puis les pâtes pour 10 min.', 'Servez avec le parmesan râpé et le basilic.'] },
  { n: p => titreDe(p, 'Piccata') + ' au citron', c: 'Italienne', pr: 15, cu: () => 20, co: 1, u: ['Poêle', 'Casserole'],
    p: ['dinde', 'poulet', 'veau', 'filet-mignon', 'cabillaud'],
    i: [CIT, ['Farine', 30, 'g'], BEU(30), ['Vin blanc', 100, 'ml'], PER, ['Spaghetti', 300, 'g'], ['Épinards frais', 300, 'g']],
    e: p => [`Coupez ${p.le} en escalopes fines et aplatissez-les entre deux feuilles de papier cuisson. Farinez-les légèrement.`,
      `Faites dorer les escalopes ${p.kind === 'poisson' ? 3 : 3} min par face dans le beurre moussant. Réservez au chaud.`,
      'Déglacez la poêle avec le vin blanc et le jus du citron, laissez réduire de moitié et ajoutez le persil haché.', 'Faites cuire les spaghetti et faites tomber les épinards 2 min à la poêle.',
      'Servez les escalopes nappées de sauce, avec les pâtes et les épinards.'] },
  { n: p => titreDe(p, 'Saltimbocca') + ' à la sauge et au citron', c: 'Italienne', pr: 15, cu: () => 20, co: 1, u: ['Poêle'],
    p: ['veau', 'dinde', 'poulet'],
    i: [['Menthe fraîche', 10, 'g'], CIT, BEU(20), ['Vin blanc', 100, 'ml'], ['Parmesan', 30, 'g'], ['Pomme de terre', 700, 'g'], ['Roquette', 80, 'g']],
    e: p => [`Coupez ${p.le} en escalopes fines, posez sur chacune une feuille de menthe et un copeau de parmesan, puis roulez-les et fermez avec un pic.`,
      'Faites cuire les pommes de terre en quartiers 20 min à l’eau salée, puis dorez-les 5 min à la poêle.', 'Faites dorer les roulés 8 min dans le beurre en les retournant.',
      'Déglacez au vin blanc et au jus de citron, laissez réduire 2 min.', 'Servez avec les pommes de terre et la roquette.'] },
  { n: p => titreDe(p, 'Orzotto') + ' au potiron', c: 'Italienne', pr: 15, cu: () => 30, co: 2, u: ['Sauteuse'],
    p: ['nature', 'poulet', 'saumon', 'canard', 'lentilles'],
    i: [['Pâtes orzo', 300, 'g'], ['Potiron', 500, 'g'], ['Échalote', 2, 'pcs'], ['Parmesan', 50, 'g'], BEU(20), THYM, ['Noisettes', 30, 'g']],
    e: p => ['Coupez le potiron en petits dés et faites-le revenir 10 min avec les échalotes dans le beurre.', 'Ajoutez l’orzo, le thym et 80 cl d’eau chaude salée, laissez cuire 12 min en remuant souvent, comme un risotto.',
      sauter(p), 'Incorporez le parmesan hors du feu et parsemez de noisettes concassées' + (estNature(p) ? '.' : `. Servez avec ${p.le}.`)] },
  // ── Espagne / Portugal ──
  { n: p => (estNature(p) ? 'Paella de légumes' : avec(p, 'Paella')), c: 'Espagnole', pr: 25, cu: () => 45, d: 'moyen', co: 2, u: ['Poêle à paella'],
    p: ['poulet', 'crevettes', 'moules', 'calamars', 'cuisses', 'nature', 'gambas'],
    i: [['Riz à paella', 320, 'g'], ['Poivron rouge', 1, 'pcs'], TOM(2), OI, AIL, ['Safran', 1, 'pincee'], ['Paprika', 1, 'cac'], ['Petits pois frais', 150, 'g'], CIT, ['Huile d’olive', 4, 'cas']],
    e: p => [p.kind === 'volaille' ? `${prep(p)} Faites dorer ${p.le} 8 min dans l’huile, puis réservez.` : prep(p), 'Faites revenir l’oignon, l’ail et le poivron en lanières 5 min, ajoutez les tomates râpées et le paprika.',
      'Ajoutez le riz, remuez 1 min pour bien l’enrober, puis versez 90 cl d’eau bouillante où vous aurez dilué le safran. Salez.',
      `Laissez cuire 18 min sans remuer${p.kind === 'volaille' ? `, en remettant ${p.le} dès le début` : ''}. Ajoutez les petits pois à mi-cuisson.`,
      ['crustace', 'moule', 'calamar'].includes(p.kind) ? `Enfoncez ${p.le} dans le riz pour les 8 dernières minutes.` : '', 'Couvrez d’un torchon 5 min hors du feu et servez avec des quartiers de citron.'] },
  { n: p => (p.k === 'oeufs' ? 'Tortilla española' : avec(p, 'Tortilla de pommes de terre')), c: 'Espagnole', pr: 15, cu: () => 35, co: 2, u: ['Poêle'],
    p: ['oeufs', 'crevettes', 'poulet', 'saumon'],
    i: [['Œuf', 8, 'pcs'], ['Pomme de terre', 700, 'g'], OI, ['Huile d’olive', 5, 'cas'], ['Salade verte', 1, 'pcs']],
    e: p => ['Épluchez les pommes de terre et coupez-les en fines lamelles, émincez l’oignon.', 'Faites-les cuire 20 min à feu doux dans l’huile d’olive, sans les dorer, puis égouttez-les.',
      p.k === 'oeufs' ? '' : sauter(p).replace(' Réservez.', ''), `Battez les œufs, ajoutez les pommes de terre${p.k === 'oeufs' ? '' : ` et ${p.le}`}, salez et laissez reposer 5 min.`,
      'Versez dans la poêle chaude huilée, laissez prendre 5 min, retournez à l’aide d’une assiette et cuisez encore 3 min.', 'Servez tiède avec la salade verte.'] },
  { n: p => (estNature(p) ? 'Gaspacho andalou' : avec(p, 'Gaspacho andalou')), t: 'entree', c: 'Espagnole', pr: 15, cu: () => 5, co: 2, u: ['Mixeur'],
    p: ['nature', 'crevettes', 'oeufs'],
    i: [TOM(8), ['Concombre', 1, 'pcs'], ['Poivron rouge', 1, 'pcs'], ['Oignon rouge', 1, 'pcs'], ['Ail', 1, 'pcs'], ['Huile d’olive', 4, 'cas'], ['Vinaigre de Xérès', 2, 'cas']],
    e: p => ['Coupez les légumes en morceaux et mixez-les longuement avec l’huile d’olive, le vinaigre, du sel et 10 cl d’eau glacée.', 'Réservez au moins 1 h au réfrigérateur.',
      p.kind === 'oeuf' ? 'Faites durcir 4 œufs 9 min et hachez-les.' : p.kind === 'crustace' ? sauter(p).replace(' Réservez.', ' Laissez refroidir.') : '', `Servez bien frais${estNature(p) ? ', avec un filet d’huile d’olive' : `, garni ${p.au.replace(/^à la /, 'de la ').replace(/^au /, 'du ').replace(/^aux /, 'des ')}`}.`] },
  { n: p => titreDe(p, 'Cataplana') + ' à la portugaise', c: 'Espagnole', pr: 20, cu: () => 35, co: 1, u: ['Cocotte'],
    p: ['moules', 'cabillaud', 'crevettes', 'porc', 'calamars'],
    i: [TOM(4), ['Poivron rouge', 1, 'pcs'], OI, AIL, ['Vin blanc', 150, 'ml'], ['Paprika fumé', 1, 'cac'], CORI, ['Pomme de terre', 600, 'g'], H],
    e: p => [saisir(p), 'Faites revenir l’oignon et le poivron émincés 5 min, ajoutez l’ail, le paprika fumé et les tomates concassées.',
      'Ajoutez les pommes de terre en rondelles fines et le vin blanc, couvrez et laissez cuire 15 min.', mijoter(p, 5), 'Parsemez de coriandre et servez directement dans la cocotte.'] },
  // ── Grèce / Turquie / Liban ──
  { n: p => titreDe(p, 'Moussaka'), c: 'Grecque', pr: 40, cu: () => 75, d: 'moyen', co: 3, u: ['Four', 'Plat à gratin'],
    p: ['hache', 'agneau', 'lentilles', 'nature'],
    i: [['Aubergine', 3, 'pcs'], TOM(5), OI, AIL, ['Cannelle', 1, 'cac'], ['Origan', 1, 'cac'], ['Lait', 400, 'ml'], BEU(30), ['Farine', 30, 'g'], ['Œuf', 1, 'pcs'], ['Parmesan', 40, 'g'], ['Huile d’olive', 3, 'cas']],
    e: p => ['Préchauffez le four à 200 °C. Coupez les aubergines en tranches, badigeonnez-les d’huile et faites-les rôtir 20 min sur une plaque.',
      `Faites fondre les oignons et l’ail, ajoutez ${p.kind === 'viande' ? `${p.le} haché au couteau très finement, faites-le dorer, puis ` : p.kind === 'hache' ? 'le bœuf haché, faites-le dorer, puis ' : p.kind === 'legume' ? 'les lentilles rincées et 30 cl d’eau, puis ' : ''}les tomates concassées, la cannelle et l’origan. Laissez mijoter 25 min.`,
      'Préparez la béchamel avec le beurre, la farine et le lait ; hors du feu, ajoutez l’œuf battu et la moitié du parmesan.',
      'Alternez aubergines et sauce dans le plat, nappez de béchamel et parsemez du reste de parmesan.', 'Baissez le four à 180 °C et enfournez 35 min. Laissez reposer 15 min avant de servir.'] },
  { n: p => titreDe(p, 'Souvlaki') + ', tzatziki et salade grecque', c: 'Grecque', pr: 30, cu: () => 15, co: 1, u: ['Piques à brochettes', 'Poêle-gril'],
    p: ['poulet', 'porc', 'agneau', 'dinde', 'crevettes', 'calamars'],
    i: [CIT, ['Origan', 2, 'cac'], AIL, ['Huile d’olive', 4, 'cas'], ['Yaourt grec', 250, 'g'], ['Concombre', 1, 'pcs'], TOM(3), ['Oignon rouge', 1, 'pcs'], ['Feta', 100, 'g'], ['Olives Kalamata', 50, 'g'], ['Menthe fraîche', 10, 'g']],
    e: p => [`${prep(p).replace('morceaux de 4 cm', 'cubes de 3 cm')} Faites mariner ${p.le} 30 min avec le jus du citron, l’origan, l’ail écrasé et la moitié de l’huile.`.trim(),
      'Préparez le tzatziki : râpez la moitié du concombre, pressez-le et mélangez-le au yaourt avec la menthe ciselée et une pointe d’ail.',
      'Coupez le reste du concombre, les tomates et l’oignon rouge, ajoutez la feta et les olives, arrosez du reste d’huile.', `Enfilez ${p.le} sur les piques. ${griller(p)}`, 'Servez les brochettes avec le tzatziki et la salade.'] },
  { n: p => titreDe(p, 'Stifado'), c: 'Grecque', pr: 20, cu: p => tempsMijote(p), co: 4, u: ['Cocotte'],
    p: ['boeuf-braise', 'agneau', 'cuisses', 'porc', 'lentilles'],
    i: [['Échalote', 8, 'pcs'], TOM(4), AIL, ['Vin rouge', 200, 'ml'], ['Vinaigre balsamique', 1, 'cas'], ['Cannelle', 1, 'cac'], LAU, H, ['Pâtes orzo', 280, 'g']],
    e: p => [saisir(p), 'Faites dorer les échalotes entières 5 min, ajoutez l’ail, la cannelle et le laurier.', 'Versez le vin rouge, le vinaigre et les tomates concassées.', mijoter(p, 40),
      'Faites cuire l’orzo 9 min à l’eau salée et servez avec le stifado.'] },
  { n: p => titreDe(p, 'Kefta') + ' grillées, taboulé libanais', c: 'Libanaise', pr: 30, cu: () => 15, co: 2, u: ['Poêle-gril'],
    p: ['hache', 'agneau', 'dinde', 'poulet'],
    i: [OI, PER, ['Menthe fraîche', 15, 'g'], ['Cumin', 1, 'cac'], ['Cannelle', 1, 'cac'], ['Boulgour', 120, 'g'], TOM(3), CIT, ['Huile d’olive', 4, 'cas'], ['Yaourt grec', 200, 'g']],
    e: p => [`${p.kind === 'hache' ? '' : `Hachez finement ${p.le} au couteau ou au robot. `}Mélangez la viande avec l’oignon râpé, la moitié du persil, le cumin et la cannelle. Salez, poivrez.`,
      'Façonnez des boudins allongés autour de piques.', 'Pour le taboulé, laissez gonfler le boulgour 15 min dans le jus du citron, puis mélangez avec le reste de persil et la menthe ciselés, les tomates en dés et l’huile.',
      griller({ ...p, kind: 'hache' }), 'Servez avec le taboulé et le yaourt.'] },
  { n: p => avec(p, 'Fattoush'), t: 'plat', c: 'Libanaise', pr: 20, cu: () => 10, co: 1, u: ['Saladier', 'Poêle'],
    p: ['poulet', 'pois-chiches', 'crevettes', 'oeufs'],
    i: [['Salade romaine', 1, 'pcs'], TOM(3), ['Concombre', 1, 'pcs'], ['Radis', 150, 'g'], ['Oignon nouveau', 3, 'pcs'], ['Menthe fraîche', 10, 'g'], PER, ['Sumac', 2, 'cac'], CIT, ['Huile d’olive', 4, 'cas'], ['Farine de pois chiches', 60, 'g']],
    e: p => ['Préparez des galettes croustillantes : mélangez la farine de pois chiches avec 12 cl d’eau et une pincée de sel, faites cuire de fines galettes 2 min par face, puis cassez-les en morceaux.',
      'Coupez la salade, les tomates, le concombre, les radis et les oignons nouveaux.', p.kind === 'oeuf' ? 'Faites cuire les œufs 7 min, écalez-les et coupez-les en quartiers.' : sauter(p).replace(' Réservez.', ''),
      'Assaisonnez avec le jus du citron, l’huile d’olive et le sumac.', `Mélangez les légumes, les herbes${estNature(p) ? '' : `, ${p.le}`} et les éclats de galette au dernier moment.`] },
  { n: p => avec(p, 'Mujaddara'), c: 'Libanaise', pr: 15, cu: () => 45, co: 3, u: ['Sauteuse', 'Casserole'],
    p: ['lentilles', 'oeufs', 'poulet', 'agneau'],
    i: [['Lentilles vertes', 200, 'g'], riz('Riz basmati', 150), ['Oignon', 4, 'pcs'], ['Cumin', 2, 'cac'], ['Huile d’olive', 4, 'cas'], ['Yaourt grec', 200, 'g'], ['Concombre', 1, 'pcs']],
    e: p => ['Émincez finement les oignons et faites-les caraméliser 25 min à feu moyen dans l’huile, jusqu’à ce qu’ils soient bruns et croustillants.',
      'Faites cuire les lentilles 15 min à l’eau, ajoutez le riz et le cumin, et poursuivez 12 min à couvert (ajoutez de l’eau si besoin).',
      p.k === 'lentilles' ? '' : p.kind === 'oeuf' ? 'Faites cuire les œufs au plat.' : sauter(p).replace(' Réservez.', ''), `Mélangez la moitié des oignons aux lentilles et au riz, et parsemez du reste. Servez avec le yaourt et le concombre en dés${p.k === 'lentilles' ? '' : `, et ${p.le}`}.`] },
  // ── Maghreb ──
  { n: p => titreDe(p, 'Tajine') + ' aux citrons et olives', c: 'Marocaine', pr: 20, cu: p => tempsMijote(p), co: 3, u: ['Cocotte ou tajine'],
    p: ['cuisses', 'poulet', 'agneau', 'dinde', 'cabillaud', 'pois-chiches'],
    i: [['Citron', 2, 'pcs'], ['Olives vertes', 100, 'g'], OI, AIL, GING, ['Curcuma', 1, 'cac'], ['Safran', 1, 'pincee'], CORI, PER, H, ['Semoule', 240, 'g']],
    e: p => [saisir(p), 'Faites fondre les oignons émincés avec l’ail, le gingembre râpé, le curcuma et le safran 5 min.', 'Ajoutez un citron coupé en fines rondelles, les olives et 30 cl d’eau.', mijoter(p, 25),
      'Versez le même volume d’eau bouillante salée sur la semoule, couvrez 5 min et égrainez.', 'Arrosez du jus du second citron, parsemez d’herbes et servez avec la semoule.'] },
  { n: p => titreDe(p, 'Tajine') + ' aux pruneaux et amandes', c: 'Marocaine', pr: 20, cu: p => tempsMijote(p), co: 3, u: ['Cocotte ou tajine'],
    p: ['agneau', 'boeuf-braise', 'cuisses', 'veau', 'pois-chiches'],
    i: [['Pruneaux', 150, 'g'], ['Amandes', 60, 'g'], OI, ['Cannelle', 2, 'cac'], GING, ['Miel', 1, 'cas'], ['Graines de sésame', 1, 'cas'], H, ['Semoule', 240, 'g']],
    e: p => [saisir(p), 'Faites fondre les oignons émincés avec la cannelle et le gingembre râpé.', 'Mouillez avec 40 cl d’eau.', mijoter(p, 35), 'Ajoutez les pruneaux et le miel 20 min avant la fin.',
      'Faites dorer les amandes et le sésame à sec, préparez la semoule et servez le tajine parsemé d’amandes.'] },
  { n: p => (estNature(p) ? 'Couscous aux sept légumes' : `Couscous aux sept légumes et ${p.au}`), c: 'Marocaine', pr: 30, cu: p => Math.max(tempsMijote(p), 60), d: 'moyen', co: 3, u: ['Faitout'],
    p: ['agneau', 'cuisses', 'poulet', 'pois-chiches', 'nature'],
    i: [['Carotte', 3, 'pcs'], ['Navet', 2, 'pcs'], ['Courgette', 2, 'pcs'], ['Potiron', 300, 'g'], ['Chou blanc', 300, 'g'], TOM(2), OI, ['Pois chiches secs', 120, 'g'], ['Ras-el-hanout', 10, 'g'], CORI, ['Semoule', 300, 'g'], BEU(20)],
    e: p => ['La veille, faites tremper les pois chiches.', saisir(p) || 'Faites revenir les oignons émincés 5 min dans un filet d’huile.', 'Ajoutez les tomates, le ras-el-hanout, les pois chiches et 2 L d’eau, portez à ébullition.',
      `Laissez frémir 40 min${['viande', 'volaille'].includes(p.kind) ? ` avec ${p.le}` : ''}, puis ajoutez carottes, navets et chou en gros morceaux pour 20 min, et enfin courgettes et potiron pour 15 min.`,
      'Préparez la semoule : arrosez-la du même volume d’eau bouillante salée avec le beurre, couvrez 5 min et égrainez.', 'Servez la semoule avec les légumes, le bouillon et la coriandre.'] },
  { n: p => titreDe(p, 'Chakchouka'), c: 'Marocaine', pr: 15, cu: () => 30, co: 1, u: ['Sauteuse'],
    p: ['oeufs', 'crevettes', 'hache', 'pois-chiches'],
    i: [['Œuf', 6, 'pcs'], ['Poivron rouge', 2, 'pcs'], ['Poivron vert', 1, 'pcs'], TOM(6), OI, AIL, ['Cumin', 1, 'cac'], ['Paprika', 1, 'cac'], ['Harissa', 1, 'cac'], CORI, H],
    e: p => ['Faites fondre l’oignon et les poivrons en lanières 10 min dans l’huile.', `Ajoutez l’ail, les épices, la harissa et les tomates concassées, laissez compoter 15 min. ${tomatesConcassees}`,
      p.k === 'oeufs' ? '' : sauter(p).replace(' Réservez.', ' Ajoutez-les à la sauce.'), 'Creusez des puits, cassez-y les œufs, couvrez et laissez cuire 6 à 8 min.', 'Parsemez de coriandre et servez dans la poêle.'] },
  { n: p => avec(p, 'Chorba'), c: 'Orientale', pr: 20, cu: p => Math.max(tempsMijote(p), 50), co: 3, u: ['Faitout'],
    p: ['agneau', 'poulet', 'lentilles', 'pois-chiches'],
    i: [TOM(4), OI, ['Céleri branche', 2, 'pcs'], ['Carotte', 2, 'pcs'], ['Pâtes orzo', 100, 'g'], ['Cumin', 1, 'cac'], ['Paprika', 1, 'cac'], ['Cannelle', 1, 'cac'], CORI, ['Menthe séchée', 1, 'cac'], CIT, H],
    e: p => [saisir(p) || 'Faites revenir l’oignon émincé dans l’huile.', 'Ajoutez l’oignon, le céleri et la carotte en dés, les épices, puis les tomates concassées et 1,5 L d’eau.', pocher(p).includes('Remettez') ? `Remettez ${p.le} et laissez frémir ${dur(p.mij)}.` : pocher(p),
      'Ajoutez l’orzo pour les 10 dernières minutes.', 'Servez avec la coriandre, la menthe séchée et un filet de citron.'] },
  // ── Afrique ──
  { n: p => titreDe(p, 'Mafé'), c: 'Afrique de l’Ouest', pr: 20, cu: p => tempsMijote(p), co: 3, u: ['Cocotte'],
    p: ['cuisses', 'boeuf-braise', 'agneau', 'poulet', 'pois-chiches', 'nature'],
    i: [['Cacahuètes', 150, 'g'], TOM(4), OI, AIL, GING, ['Patate douce', 2, 'pcs'], ['Carotte', 2, 'pcs'], ['Piment frais', 1, 'pcs', true], H, riz()],
    e: p => ['Mixez les cacahuètes avec 20 cl d’eau jusqu’à obtenir une pâte lisse.', saisir(p), 'Faites revenir les oignons, l’ail et le gingembre, ajoutez les tomates concassées et la pâte de cacahuètes, puis 50 cl d’eau.',
      'Ajoutez les patates douces et les carottes en gros morceaux, et le piment entier.', mijoter(p, 35), cuitRiz, 'Servez le mafé bien nappant avec le riz.'] },
  { n: p => titreDe(p, 'Yassa'), c: 'Afrique de l’Ouest', pr: 20, cu: p => tempsMijote(p), co: 3, u: ['Cocotte'],
    p: ['cuisses', 'poulet', 'dorade', 'porc', 'nature'],
    i: [['Oignon', 5, 'pcs'], ['Citron', 3, 'pcs'], ['Moutarde', 2, 'cas'], AIL, ['Piment frais', 1, 'pcs', true], H, riz()],
    e: p => [`Émincez les oignons et faites-les mariner 1 h${estNature(p) ? '' : ` avec ${p.le}`} dans le jus des citrons, la moutarde et l’ail écrasé.`,
      estNature(p) ? '' : `Égouttez ${p.le} et faites-${pro(p)} dorer 5 min dans la cocotte avec un filet d’huile.`, 'Faites fondre les oignons de la marinade 15 min à feu moyen, jusqu’à ce qu’ils soient tendres et dorés.',
      'Versez la marinade, 20 cl d’eau et le piment entier.', mijoter(p, 20), cuitRiz, 'Servez avec le riz.'] },
  { n: p => titreDe(p, 'Wot') + ' au berbéré', c: 'Éthiopienne', pr: 20, cu: p => tempsMijote(p, 30), co: 3, u: ['Cocotte'],
    p: ['corail', 'cuisses', 'boeuf-braise', 'pois-chiches', 'oeufs'],
    i: [['Oignon', 3, 'pcs'], AIL, GING, ['Berbere', 2, 'cac'], TOM(3), BEU(30), riz('Riz basmati', 250), ['Épinards frais', 200, 'g']],
    e: p => ['Faites fondre les oignons hachés très finement 15 min à sec, puis ajoutez le beurre, l’ail, le gingembre et le berbéré.', saisir(p), 'Ajoutez les tomates concassées et 30 cl d’eau.', mijoter(p, 30),
      'Faites tomber les épinards 2 min à la poêle.', cuitRiz, 'Servez le wot avec le riz et les épinards.'] },
  // ── Inde ──
  { n: p => titreDe(p, 'Dal'), c: 'Indienne', pr: 15, cu: () => 30, co: 4, u: ['Cocotte', 'Casserole'],
    p: ['corail', 'lentilles'],
    i: [OI, AIL, GING, ['Curcuma', 1, 'cac'], ['Cumin', 1, 'cac'], ['Garam masala', 1, 'cac'], TOM(3), ['Lait de coco', 200, 'ml'], ['Épinards frais', 200, 'g'], CORI, riz()],
    e: p => [`${prep(p)} Faites revenir l’oignon, l’ail et le gingembre 5 min, ajoutez les épices et remuez 1 min.`, `Ajoutez ${p.le}, les tomates concassées et 70 cl d’eau.`,
      `Laissez cuire ${p.mij + 5} min à feu doux en remuant souvent, jusqu’à ce que le dal soit crémeux.`, 'Incorporez le lait de coco et les épinards, laissez 3 min.', cuitRiz, 'Parsemez de coriandre et servez avec le riz.'],
    tw: [{ s: 'au tadka de cumin', i: [['Cumin', 1, 'cac'], ['Piment frais', 1, 'pcs'], BEU(20)], e: 'Au moment de servir, faites grésiller le beurre avec les graines de cumin et le piment émincé, et versez-le sur le dal.' },
      { s: 'à la butternut', i: [['Courge butternut', 400, 'g']], e: 'Ajoutez la butternut en petits dés en même temps que les lentilles.' }] },
  { n: p => titreDe(p, 'Curry') + ' korma aux amandes', c: 'Indienne', pr: 20, cu: p => tempsMijote(p), co: 3, u: ['Cocotte'],
    p: ['poulet', 'agneau', 'dinde', 'crevettes', 'pois-chiches', 'nature'],
    i: [['Amandes', 60, 'g'], ['Yaourt nature', 2, 'pcs'], OI, AIL, GING, ['Garam masala', 2, 'cac'], ['Cardamome', 1, 'cac'], ['Curcuma', 1, 'cac'], ['Chou-fleur', 1, 'pcs'], CORI, riz()],
    e: p => ['Mixez les amandes avec 15 cl d’eau.', saisir(p), 'Faites fondre les oignons, l’ail et le gingembre, ajoutez les épices et remuez 1 min.', 'Ajoutez la crème d’amandes, 20 cl d’eau et le chou-fleur en petits bouquets.', mijoter(p, 20),
      'Hors du feu, incorporez le yaourt en remuant.', cuitRiz, 'Parsemez de coriandre et servez.'] },
  { n: p => titreDe(p, 'Curry') + ' au lait de coco et épinards', c: 'Indienne', pr: 20, cu: p => tempsMijote(p), co: 3, u: ['Cocotte'],
    p: ['poulet', 'crevettes', 'cabillaud', 'pois-chiches', 'oeufs', 'agneau', 'nature'],
    i: [['Lait de coco', 400, 'ml'], ['Épinards frais', 300, 'g'], TOM(3), OI, AIL, GING, ['Curry en poudre', 2, 'cac'], ['Curcuma', 1, 'cac'], CORI, riz()],
    e: p => [saisir(p), 'Faites revenir les oignons, l’ail et le gingembre 5 min, ajoutez le curry et le curcuma.', 'Ajoutez les tomates concassées et le lait de coco.', mijoter(p, 20),
      'Ajoutez les épinards pour les 3 dernières minutes.', cuitRiz, 'Servez parsemé de coriandre.'],
    tw: [{ s: 'à la patate douce', i: [['Patate douce', 2, 'pcs']], e: 'Ajoutez les patates douces en dés avec le lait de coco.' }] },
  { n: p => titreDe(p, 'Biryani'), c: 'Indienne', pr: 30, cu: p => Math.max(tempsMijote(p, 15), 45), d: 'moyen', co: 3, u: ['Cocotte', 'Casserole'],
    p: ['poulet', 'agneau', 'crevettes', 'nature', 'oeufs'],
    i: [riz('Riz basmati', 320), ['Oignon', 3, 'pcs'], ['Yaourt nature', 2, 'pcs'], GING, AIL, ['Garam masala', 2, 'cac'], ['Cardamome', 1, 'cac'], ['Safran', 1, 'pincee'], ['Menthe fraîche', 15, 'g'], CORI, ['Raisins secs', 40, 'g'], ['Noix de cajou', 40, 'g'], BEU(30)],
    e: p => [`${estNature(p) || p.kind === 'oeuf' ? '' : `Faites mariner ${p.le} coupé${p.f ? 'e' : ''}${p.pl ? 's' : ''} 30 min dans le yaourt avec l’ail, le gingembre et le garam masala.`}`,
      'Faites dorer les oignons émincés 15 min dans le beurre, réservez-en la moitié.', 'Faites précuire le riz 6 min à l’eau salée avec la cardamome, égouttez.',
      estNature(p) ? 'Ajoutez aux oignons 300 g de légumes de saison en dés et le yaourt épicé.' : p.kind === 'oeuf' ? 'Faites durcir les œufs 9 min et écalez-les.' : `Faites cuire ${p.le} avec la marinade et les oignons 10 min.`,
      'Superposez dans la cocotte la garniture et le riz, arrosez du safran infusé dans 10 cl d’eau chaude, couvrez hermétiquement et laissez cuire 20 min à feu très doux.',
      'Servez avec les oignons réservés, les raisins, les noix de cajou et les herbes.'] },
  { n: p => titreDe(p, 'Tikka') + ' grillé, raïta au concombre', c: 'Indienne', pr: 20, cu: () => 20, co: 2, u: ['Four', 'Plaque'],
    p: ['poulet', 'dinde', 'saumon', 'crevettes', 'agneau'],
    i: [['Yaourt nature', 3, 'pcs'], ['Garam masala', 2, 'cac'], ['Paprika', 2, 'cac'], ['Curcuma', 1, 'cac'], AIL, GING, CITV, ['Concombre', 1, 'pcs'], ['Menthe fraîche', 10, 'g'], riz()],
    e: p => [`${prep(p)} Faites mariner ${p.le} au moins 1 h dans 2 yaourts mélangés aux épices, à l’ail et au gingembre râpés et au jus d’un citron vert.`.trim(),
      'Préchauffez le four en position gril.', `Étalez ${p.le} sur une plaque et enfournez ${p.kind === 'crustace' ? 6 : p.kind === 'poisson' ? 10 : 15} min, en retournant à mi-cuisson.`,
      'Pour la raïta, râpez le concombre, pressez-le et mélangez-le au dernier yaourt avec la menthe.', cuitRiz, 'Servez avec la raïta et des quartiers de citron vert.'] },
  { n: () => 'Chana masala', c: 'Indienne', pr: 15, cu: () => 100, co: 4, u: ['Cocotte'],
    p: ['pois-chiches'],
    i: [OI, AIL, GING, TOM(5), ['Cumin', 1, 'cac'], ['Garam masala', 2, 'cac'], ['Curcuma', 1, 'cac'], CORI, CIT, riz()],
    e: p => [prep(p), 'Faites cuire les pois chiches 1 h 15 dans une grande casserole d’eau, salez en fin de cuisson et égouttez-les en gardant un peu d’eau de cuisson.',
      'Faites revenir les oignons, l’ail et le gingembre, ajoutez les épices puis les tomates concassées, laissez réduire 10 min.', 'Ajoutez les pois chiches et 20 cl de leur eau de cuisson, laissez mijoter 15 min.', cuitRiz, 'Arrosez de citron, parsemez de coriandre et servez.'],
    tw: [{ s: 'aux épinards', i: [['Épinards frais', 300, 'g']], e: 'Ajoutez les épinards pour les 3 dernières minutes.' }, { s: 'à la patate douce', i: [['Patate douce', 2, 'pcs']], e: 'Ajoutez la patate douce en dés avec les pois chiches.' }] },
  // ── Asie ──
  { n: p => avec(p, 'Pad thaï'), c: 'Thaïlandaise', pr: 25, cu: () => 15, co: 1, u: ['Wok'],
    p: ['crevettes', 'poulet', 'oeufs', 'boeuf', 'calamars'],
    i: [['Nouilles de riz', 250, 'g'], ['Pousses de soja', 200, 'g'], ['Œuf', 2, 'pcs'], ['Cacahuètes', 50, 'g'], ['Oignon nouveau', 3, 'pcs'], AIL, CITV, ['Sauce nuoc mam', 3, 'cas'], ['Sucre', 20, 'g'], ['Huile de tournesol', 30, 'ml'], CORI],
    e: p => ['Faites tremper les nouilles 10 min dans l’eau tiède, puis égouttez.', 'Mélangez le nuoc-mâm, le sucre et le jus d’un citron vert : c’est la sauce.', p.k === 'oeufs' ? '' : sauter(p),
      'Dans le wok, faites revenir l’ail 30 s, ajoutez les nouilles et la sauce, faites sauter 3 min.', 'Poussez les nouilles sur le côté, brouillez les œufs, puis mélangez le tout avec les pousses de soja' + (p.k === 'oeufs' ? '' : ` et ${p.le}`) + '.',
      'Servez avec les cacahuètes concassées, les oignons nouveaux, la coriandre et le second citron vert.'] },
  { n: p => avec(p, 'Tom kha'), c: 'Thaïlandaise', pr: 15, cu: () => 25, co: 2, u: ['Faitout'],
    p: ['poulet', 'crevettes', 'cabillaud', 'nature', 'moules'],
    i: [['Lait de coco', 400, 'ml'], ['Citronnelle', 3, 'pcs'], GING, ['Champignons de Paris', 200, 'g'], CITV, ['Sauce nuoc mam', 2, 'cas'], ['Piment frais', 1, 'pcs', true], CORI, ['Riz jasmin', 200, 'g']],
    e: p => ['Faites frémir 60 cl d’eau avec le lait de coco, la citronnelle écrasée et le gingembre tranché, 10 min.', 'Ajoutez les champignons émincés.', pocher(p),
      'Hors du feu, ajoutez le nuoc-mâm, le jus des citrons verts et le piment émincé.', 'Faites cuire le riz jasmin et servez la soupe parsemée de coriandre, le riz à part.'] },
  { n: p => titreDe(p, 'Larb') + ' aux herbes', c: 'Thaïlandaise', pr: 20, cu: () => 15, co: 1, u: ['Poêle'],
    p: ['poulet', 'hache', 'dinde', 'porc', 'crevettes'],
    i: [['Riz jasmin', 280, 'g'], ['Échalote', 3, 'pcs'], ['Menthe fraîche', 20, 'g'], CORI, CITV, ['Sauce nuoc mam', 2, 'cas'], ['Piment frais', 1, 'pcs', true], ['Salade romaine', 1, 'pcs'], ['Concombre', 1, 'pcs']],
    e: p => ['Faites griller 2 cuillères à soupe de riz cru à sec 5 min, puis réduisez-le en poudre : c’est ce qui donne son goût au larb.', 'Faites cuire le reste du riz jasmin.',
      p.kind === 'hache' ? 'Faites revenir le bœuf haché 5 min sans matière grasse.' : `Hachez ${p.le} au couteau et faites-${pro(p)} revenir 5 min sans matière grasse, en émiettant.`,
      'Hors du feu, ajoutez les échalotes émincées, le nuoc-mâm, le jus des citrons verts, le piment, les herbes ciselées et la poudre de riz.', 'Servez dans les feuilles de romaine, avec le concombre et le riz.'] },
  { n: p => titreDe(p, 'Curry massaman') + ' maison', c: 'Thaïlandaise', pr: 25, cu: p => tempsMijote(p), co: 3, u: ['Cocotte'],
    p: ['boeuf-braise', 'cuisses', 'poulet', 'agneau', 'pois-chiches', 'nature'],
    i: [['Lait de coco', 400, 'ml'], ['Pomme de terre', 500, 'g'], OI, AIL, GING, ['Cannelle', 1, 'cac'], ['Cardamome', 1, 'cac'], ['Cumin', 1, 'cac'], ['Curry en poudre', 2, 'cac'], ['Cacahuètes', 50, 'g'], ['Sauce nuoc mam', 2, 'cas'], ['Riz jasmin', 250, 'g']],
    e: p => ['Faites torréfier à sec les épices 1 min, puis mixez-les avec l’oignon, l’ail, le gingembre et 3 cuillères de lait de coco : c’est la pâte de curry.', saisir(p),
      'Faites revenir la pâte 3 min, ajoutez le reste du lait de coco, 20 cl d’eau et le nuoc-mâm.', 'Ajoutez les pommes de terre en gros cubes.', mijoter(p, 25), 'Faites cuire le riz et servez parsemé de cacahuètes.'] },
  { n: p => titreDe(p, 'Phở') + ' au bouillon maison', c: 'Vietnamienne', pr: 20, cu: p => (p.kind === 'viande' ? p.mij : 60), d: 'moyen', co: 2, u: ['Faitout'],
    p: ['boeuf', 'poulet', 'crevettes', 'cuisses'],
    i: [['Oignon', 2, 'pcs'], GING, ['Anis étoilé (badiane)', 3, 'pcs'], ['Cannelle', 1, 'cac'], ['Sauce nuoc mam', 3, 'cas'], ['Nouilles de riz', 250, 'g'], ['Pousses de soja', 150, 'g'], ['Basilic thaï', 15, 'g'], CORI, CITV, ['Oignon nouveau', 3, 'pcs']],
    e: p => ['Faites noircir les oignons et le gingembre coupés en deux 5 min dans une poêle sèche.', 'Mettez-les dans 2 L d’eau avec la badiane et la cannelle, laissez frémir 45 min, puis filtrez et ajoutez le nuoc-mâm.',
      pocher(p), 'Faites tremper les nouilles de riz 5 min dans l’eau bouillante et répartissez-les dans les bols.', 'Versez le bouillon brûlant et servez avec les pousses de soja, les herbes, l’oignon nouveau et le citron vert.'] },
  { n: p => titreDe(p, 'Bò bún'), c: 'Vietnamienne', pr: 30, cu: () => 15, co: 1, u: ['Wok'],
    p: ['boeuf', 'poulet', 'crevettes', 'porc', 'dinde'],
    i: [['Nouilles de riz', 250, 'g'], ['Carotte', 2, 'pcs'], ['Concombre', 1, 'pcs'], ['Salade verte', 1, 'pcs'], ['Pousses de soja', 150, 'g'], ['Menthe fraîche', 15, 'g'], CORI, ['Cacahuètes', 50, 'g'], ['Citronnelle', 2, 'pcs'], ['Sauce nuoc mam', 4, 'cas'], CITV, ['Sucre', 20, 'g'], AIL],
    e: p => [`Faites mariner ${p.le} coupé${p.f ? 'e' : ''}${p.pl ? 's' : ''} en lanières 20 min avec la citronnelle hachée, l’ail et 1 cuillère de nuoc-mâm.`,
      'Préparez la sauce : le reste de nuoc-mâm, le jus des citrons verts, le sucre et 10 cl d’eau.', 'Faites cuire les nouilles, rincez-les à l’eau froide. Râpez les carottes, taillez le concombre en bâtonnets, émincez la salade.',
      sauter(p).replace(/^Coupez[^.]*\. /, ''), 'Dressez dans les bols : salade, nouilles, crudités, herbes, puis la garniture chaude. Arrosez de sauce et parsemez de cacahuètes.'] },
  { n: p => titreDe(p, 'Wok') + ' au gingembre et brocoli', c: 'Asiatique', pr: 20, cu: () => 15, co: 2, u: ['Wok'],
    p: ['boeuf', 'poulet', 'crevettes', 'filet-mignon', 'canard', 'calamars', 'dinde'],
    i: [['Brocoli', 400, 'g'], ['Poivron rouge', 1, 'pcs'], GING, AIL, SOJA(3), ['Miel', 1, 'cas'], ['Huile de sésame', 1, 'cas'], ['Oignon nouveau', 3, 'pcs'], ['Riz jasmin', 280, 'g']],
    e: p => ['Faites cuire le riz jasmin.', 'Mélangez la sauce soja, le miel, le gingembre râpé et l’ail haché.', sauter(p),
      'Faites sauter le brocoli en petits bouquets et le poivron en lanières 4 min à feu vif, avec 2 cuillères d’eau.', `Remettez ${p.le}, versez la sauce et l’huile de sésame, mélangez 1 min. Parsemez d’oignon nouveau et servez avec le riz.`] },
  { n: p => avec(p, 'Riz cantonais'), c: 'Asiatique', pr: 15, cu: () => 20, co: 2, u: ['Wok'],
    p: ['crevettes', 'poulet', 'oeufs', 'porc', 'nature'],
    i: [riz('Riz jasmin', 280), ['Œuf', 3, 'pcs'], ['Petits pois frais', 150, 'g'], ['Carotte', 1, 'pcs'], ['Oignon nouveau', 3, 'pcs'], SOJA(2), ['Huile de tournesol', 30, 'ml']],
    e: p => ['Faites cuire le riz la veille (ou 3 h avant) et laissez-le refroidir complètement : il sautera sans coller.', p.k === 'oeufs' ? '' : sauter(p),
      'Brouillez les œufs dans le wok, réservez.', 'Faites sauter la carotte en petits dés et les petits pois 3 min.', `Ajoutez le riz, la sauce soja, les œufs${estNature(p) || p.k === 'oeufs' ? '' : ` et ${p.le}`}, faites sauter 3 min à feu vif et servez avec l’oignon nouveau.`] },
  { n: p => avec(p, 'Bibimbap'), c: 'Coréenne', pr: 30, cu: () => 20, d: 'moyen', co: 1, u: ['Poêle', 'Casserole'],
    p: ['boeuf', 'poulet', 'oeufs', 'hache', 'crevettes'],
    i: [riz('Riz rond', 280), ['Œuf', 4, 'pcs'], ['Épinards frais', 200, 'g'], ['Carotte', 2, 'pcs'], ['Courgette', 1, 'pcs'], ['Champignons shiitakés', 150, 'g'], ['Pousses de soja', 150, 'g'], SOJA(3), ['Huile de sésame', 2, 'cas'], ['Graines de sésame', 1, 'cas'], AIL, ['Piment doux', 1, 'cac']],
    e: p => ['Faites cuire le riz rond.', 'Faites sauter séparément, 2 à 3 min chacun avec un peu d’huile de sésame : les épinards, la carotte et la courgette en julienne, les shiitakés émincés et les pousses de soja. Salez légèrement.',
      p.k === 'oeufs' ? '' : `${sauter(p).replace(' Réservez.', '')} Arrosez d’une cuillère de sauce soja.`, 'Faites cuire les œufs au plat, jaune coulant.',
      'Mélangez le reste de sauce soja avec l’ail râpé et le piment doux.', 'Répartissez le riz dans les bols, disposez les légumes en rosace, la garniture et l’œuf au centre. Parsemez de sésame et servez avec la sauce.'] },
  { n: p => avec(p, 'Poke bowl'), c: 'Hawaïenne', pr: 25, cu: () => 15, co: 1, u: ['Casserole'],
    p: ['saumon', 'crevettes', 'poulet', 'oeufs', 'dorade'],
    i: [riz('Riz rond', 280), ['Avocat', 2, 'pcs'], ['Concombre', 1, 'pcs'], ['Mangue', 1, 'pcs'], ['Radis', 100, 'g'], ['Chou rouge', 150, 'g'], SOJA(3), ['Vinaigre de riz', 2, 'cas'], ['Graines de sésame', 1, 'cas'], ['Oignon nouveau', 2, 'pcs']],
    e: p => ['Faites cuire le riz, assaisonnez-le avec le vinaigre de riz et laissez tiédir.',
      p.kind === 'poisson' ? `Taillez ${p.le}, très frais (qualité « à consommer cru », à demander au poissonnier), en cubes et faites-${pro(p)} mariner 10 min dans la sauce soja.` : p.kind === 'oeuf' ? 'Faites cuire les œufs 7 min, écalez-les et coupez-les en deux.' : sauter(p).replace(' Réservez.', ' Arrosez de sauce soja.'),
      'Coupez l’avocat, le concombre et la mangue en dés, les radis en rondelles, émincez finement le chou rouge.', 'Répartissez le riz dans les bols, disposez les garnitures et parsemez de sésame et d’oignon nouveau.'] },
  { n: p => titreDe(p, 'Yakitori') + ', riz et légumes croquants', c: 'Japonaise', pr: 25, cu: () => 20, co: 1, u: ['Piques à brochettes', 'Poêle-gril'],
    p: ['poulet', 'boeuf', 'saumon', 'crevettes', 'filet-mignon'],
    i: [SOJA(4), ['Mirin', 2, 'cas'], ['Sucre', 15, 'g'], ['Oignon nouveau', 4, 'pcs'], riz('Riz rond', 280), ['Chou chinois', 300, 'g'], ['Graines de sésame', 1, 'cas'], ['Vinaigre de riz', 1, 'cas']],
    e: p => ['Faites réduire de moitié la sauce soja, le mirin et le sucre : c’est la sauce tare.', `${prep(p).replace('morceaux de 4 cm', 'cubes de 2 cm')} Enfilez ${p.le} sur les piques en alternant avec des tronçons d’oignon nouveau.`,
      `${griller(p)} Badigeonnez de sauce en fin de cuisson.`, 'Faites cuire le riz. Émincez le chou chinois et assaisonnez-le avec le vinaigre de riz et le sésame.', 'Servez les brochettes laquées avec le riz et le chou.'] },
  // ── Amériques ──
  { n: p => (p.k === 'hache' ? 'Chili con carne maison' : titreDe(p, 'Chili') + ' maison'), c: 'Mexicaine', pr: 20, cu: p => (p.kind === 'poischiche' || p.kind === 'legume' ? 60 : 90), co: 4, u: ['Cocotte'],
    p: ['hache', 'lentilles', 'dinde', 'boeuf-braise', 'nature'],
    i: [['Haricots rouges secs', 200, 'g'], TOM(6), OI, AIL, ['Poivron rouge', 1, 'pcs'], ['Cumin', 2, 'cac'], ['Paprika fumé', 1, 'cac'], ['Piment doux', 1, 'cac'], ['Cacao en poudre', 5, 'g'], CORI, riz()],
    e: p => ['La veille, faites tremper les haricots rouges, puis faites-les cuire 1 h dans l’eau non salée.', p.kind === 'hache' ? 'Faites dorer le bœuf haché 6 min en l’émiettant.' : saisir(p),
      'Faites revenir l’oignon, l’ail et le poivron, ajoutez les épices et le cacao, puis les tomates concassées.', `Ajoutez les haricots${p.k === 'lentilles' ? ', les lentilles rincées et 40 cl d’eau' : ''}${['viande', 'volaille'].includes(p.kind) ? ` et ${p.le}` : ''}, et laissez mijoter ${p.kind === 'viande' ? p.mij : 40} min à couvert.`,
      cuitRiz, 'Servez parsemé de coriandre.'] },
  { n: p => titreDe(p, 'Fajitas') + ' maison', c: 'Mexicaine', pr: 25, cu: () => 20, co: 1, u: ['Poêle'],
    p: ['poulet', 'boeuf', 'crevettes', 'dinde', 'pois-chiches'],
    i: [['Farine', 250, 'g'], ['Poivron rouge', 1, 'pcs'], ['Poivron vert', 1, 'pcs'], ['Oignon rouge', 2, 'pcs'], ['Cumin', 1, 'cac'], ['Paprika', 1, 'cac'], CITV, ['Avocat', 2, 'pcs'], TOM(2), CORI, ['Yaourt grec', 150, 'g'], ['Huile d’olive', 4, 'cas']],
    e: p => ['Préparez les galettes : mélangez la farine, 2 cuillères d’huile, une pincée de sel et 13 cl d’eau tiède, pétrissez 3 min, divisez en 8 boules et étalez-les finement. Faites-les cuire 1 min par face à la poêle sèche.',
      `${sauter(p).replace(' Réservez.', '')} Assaisonnez avec le cumin, le paprika et le jus d’un citron vert.`, 'Faites sauter les poivrons et les oignons en lanières 6 min.',
      'Préparez un guacamole : écrasez les avocats avec le second citron vert, les tomates en dés et la coriandre.', 'Garnissez les galettes chaudes et servez avec le yaourt.'] },
  { n: p => titreDe(p, 'Ceviche') + ' à la mangue', t: 'plat', c: 'Péruvienne', pr: 25, cu: () => 25, co: 0, u: ['Saladier'],
    p: ['dorade', 'saumon', 'crevettes', 'stjacques'],
    i: [['Citron vert', 5, 'pcs'], ['Oignon rouge', 1, 'pcs'], ['Mangue', 1, 'pcs'], ['Piment frais', 1, 'pcs'], CORI, ['Patate douce', 2, 'pcs'], ['Avocat', 1, 'pcs']],
    e: p => ['Faites cuire les patates douces en rondelles 15 min à la vapeur et laissez refroidir.',
      p.kind === 'crustace' ? 'Faites pocher les crevettes 1 min dans l’eau bouillante, rafraîchissez-les et décortiquez-les.' : `Coupez ${p.le}, extra-frais (qualité « à consommer cru »), en petits cubes.`,
      'Arrosez du jus des citrons verts, ajoutez l’oignon rouge émincé très finement et le piment, et laissez « cuire » 10 min au frais.', 'Ajoutez la mangue et l’avocat en dés et la coriandre.', 'Servez aussitôt avec les rondelles de patate douce.'] },
  { n: p => (p.k === 'poulet' ? 'Arroz con pollo' : avec(p, 'Riz vert à la péruvienne')), c: 'Péruvienne', pr: 20, cu: () => 45, co: 3, u: ['Cocotte'],
    p: ['poulet', 'cuisses', 'crevettes', 'dinde', 'nature'],
    i: [riz('Riz basmati', 300), CORI, ['Poivron rouge', 1, 'pcs'], ['Petits pois frais', 150, 'g'], ['Carotte', 1, 'pcs'], OI, AIL, ['Cumin', 1, 'cac'], CITV, H],
    e: p => [p.kind === 'volaille' ? saisir(p) : prep(p), 'Mixez la coriandre avec 10 cl d’eau : elle donnera sa couleur verte au riz.', 'Faites revenir l’oignon, l’ail, le poivron et la carotte en dés, ajoutez le cumin et le riz, nacrez 2 min.',
      `Versez la purée de coriandre et 60 cl d’eau bouillante salée${p.kind === 'volaille' ? `, remettez ${p.le}` : ''}, couvrez et laissez cuire 20 min à feu doux.`, p.kind === 'crustace' ? `Ajoutez ${p.le} et les petits pois pour les 5 dernières minutes.` : 'Ajoutez les petits pois pour les 5 dernières minutes.', 'Servez avec des quartiers de citron vert.'] },
  { n: p => avec(p, 'Moqueca'), c: 'Brésilienne', pr: 20, cu: () => 30, co: 2, u: ['Cocotte'],
    p: ['cabillaud', 'crevettes', 'dorade', 'colin', 'pois-chiches'],
    i: [['Lait de coco', 400, 'ml'], TOM(3), ['Poivron rouge', 1, 'pcs'], ['Poivron jaune', 150, 'g'], OI, AIL, CITV, CORI, ['Paprika', 1, 'cac'], riz()],
    e: p => [`${prep(p)} Faites mariner ${p.le} 15 min avec le jus des citrons verts et l’ail.`, 'Dans la cocotte, alternez des couches d’oignons, de tomates et de poivrons en rondelles.',
      `Déposez ${p.le} dessus, versez le lait de coco mélangé au paprika.`, `Couvrez et laissez cuire ${p.kind === 'poischiche' ? 20 : 15} min à feu doux, sans remuer.`, cuitRiz, 'Parsemez de coriandre et servez avec le riz.'] },
  // ── Salades complètes ──
  { n: p => (p.k === 'oeufs' ? 'Salade niçoise' : titreDe(p, 'Salade niçoise')), c: 'Française', pr: 20, cu: () => 15, co: 1, u: ['Saladier', 'Casserole'],
    p: ['oeufs', 'saumon', 'maquereau', 'poulet', 'crevettes'],
    i: [['Œuf', 4, 'pcs'], ['Pomme de terre', 400, 'g'], ['Haricots verts', 250, 'g'], TOM(4), ['Poivron vert', 1, 'pcs'], ['Olives noires', 60, 'g'], ['Salade verte', 1, 'pcs'], ['Oignon nouveau', 2, 'pcs'], ['Huile d’olive', 4, 'cas'], ['Vinaigre de Xérès', 1, 'cas']],
    e: p => ['Faites cuire les pommes de terre 20 min, les haricots verts 8 min et les œufs 9 min. Rafraîchissez le tout.', p.k === 'oeufs' ? '' : sauter(p).replace(' Réservez.', ' Laissez refroidir.'),
      'Coupez les tomates en quartiers, le poivron en fines lanières, les pommes de terre en rondelles.', 'Préparez la vinaigrette avec l’huile, le vinaigre, du sel et du poivre.',
      `Disposez la salade, les légumes, les œufs en quartiers, les olives${p.k === 'oeufs' ? '' : ` et ${p.le}`}, arrosez de vinaigrette.`] },
  { n: p => avec(p, 'Salade César'), c: 'Américaine', pr: 20, cu: () => 15, co: 1, u: ['Poêle', 'Saladier'],
    p: ['poulet', 'crevettes', 'saumon', 'oeufs', 'dinde'],
    i: [['Salade romaine', 2, 'pcs'], ['Parmesan', 50, 'g'], ['Jaune d\'œuf', 1, 'pcs'], ['Moutarde', 1, 'cac'], AIL, CIT, ['Huile d’olive', 5, 'cas'], ['Farine', 100, 'g']],
    e: p => ['Préparez la sauce : fouettez le jaune d’œuf, la moutarde, l’ail râpé et le jus du citron, puis ajoutez l’huile en filet et la moitié du parmesan râpé.',
      'Pour les croûtons, mélangez la farine avec 6 cl d’eau, une pincée de sel et 1 cuillère d’huile, étalez finement et faites cuire en galette croustillante à la poêle, puis cassez-la en morceaux.',
      p.kind === 'oeuf' ? 'Faites cuire les œufs 6 min (mollets) et écalez-les.' : sauter(p).replace(' Réservez.', ''), `Mélangez la romaine avec la sauce, ajoutez ${p.le}, les croûtons et le reste de parmesan en copeaux.`] },
  { n: p => avec(p, 'Salade tiède de lentilles'), c: 'Française', pr: 15, cu: () => 25, co: 2, u: ['Casserole', 'Saladier'],
    p: ['saumon', 'oeufs', 'maquereau', 'poulet', 'canard', 'nature'],
    i: [['Lentilles vertes', 200, 'g'], ['Carotte', 2, 'pcs'], ['Échalote', 2, 'pcs'], ['Moutarde', 1, 'cac'], ['Vinaigre de Xérès', 2, 'cas'], ['Huile d’olive', 3, 'cas'], PER, LAU],
    e: p => ['Faites cuire les lentilles 20 min avec le laurier et les carottes en petits dés, salez en fin de cuisson et égouttez.', 'Préparez la vinaigrette avec la moutarde, le vinaigre, l’huile et les échalotes ciselées.',
      p.kind === 'oeuf' ? 'Faites cuire les œufs 6 min, écalez-les.' : sauter(p).replace(' Réservez.', ''), `Mélangez les lentilles tièdes à la vinaigrette et au persil${estNature(p) ? '' : `, et servez avec ${p.le}`}.`] },
  { n: p => avec(p, 'Taboulé aux herbes'), c: 'Libanaise', pr: 25, cu: () => 10, co: 2, u: ['Saladier'],
    p: ['poulet', 'pois-chiches', 'crevettes', 'oeufs', 'agneau'],
    i: [['Boulgour', 150, 'g'], ['Persil', 60, 'g'], ['Menthe fraîche', 20, 'g'], TOM(4), ['Concombre', 1, 'pcs'], ['Oignon nouveau', 3, 'pcs'], ['Citron', 2, 'pcs'], ['Huile d’olive', 4, 'cas']],
    e: p => ['Laissez gonfler le boulgour 15 min dans le jus des citrons et 5 cl d’eau.', 'Ciselez finement persil et menthe, coupez tomates et concombre en petits dés, émincez les oignons nouveaux.',
      p.kind === 'oeuf' ? 'Faites durcir les œufs 9 min et coupez-les en quartiers.' : sauter(p).replace(' Réservez.', ''), `Mélangez le tout avec l’huile d’olive, salez et servez avec ${p.le}.`] },
  // ── Soupes-repas ──
  { n: p => avec(p, 'Soupe de poissons façon bouillabaisse'), c: 'Française', pr: 30, cu: () => 40, d: 'moyen', co: 1, u: ['Faitout'],
    p: ['cabillaud', 'dorade', 'moules', 'colin', 'gambas'],
    i: [TOM(4), OI, ['Fenouil', 1, 'pcs'], ['Poireau', 1, 'pcs'], AIL, ['Safran', 1, 'pincee'], ['Pomme de terre', 500, 'g'], ['Huile d’olive', 3, 'cas'], PER, LAU],
    e: p => ['Faites revenir l’oignon, le fenouil et le poireau émincés 8 min dans l’huile.', 'Ajoutez l’ail, les tomates concassées, le laurier, le safran et 1,5 L d’eau, laissez frémir 15 min.',
      'Ajoutez les pommes de terre en rondelles épaisses et laissez cuire 15 min.', pocher(p), 'Parsemez de persil et servez bien chaud.'] },
  { n: p => titreDe(p, 'Velouté') + ' de potiron au lait de coco', t: 'entree', c: 'Healthy', pr: 15, cu: () => 30, co: 3, u: ['Faitout', 'Mixeur plongeant'],
    p: ['nature', 'crevettes', 'stjacques', 'corail'],
    i: [['Potiron', 900, 'g'], OI, GING, ['Lait de coco', 200, 'ml'], ['Curry en poudre', 1, 'cac'], ['Graines de courge', 30, 'g']],
    e: p => ['Faites revenir l’oignon et le gingembre, ajoutez le potiron en cubes, le curry et 80 cl d’eau salée.', `Laissez cuire 20 min${p.kind === 'legume' ? ' avec les lentilles corail rincées' : ''}, puis mixez avec le lait de coco.`,
      ['crustace', 'stjacques'].includes(p.kind) ? sauter(p).replace(' Réservez.', '') : '', `Servez parsemé de graines de courge grillées${['crustace', 'stjacques'].includes(p.kind) ? ` et garni ${p.au.replace(/^aux /, 'des ')}` : ''}.`] },
  { n: p => avec(p, 'Soupe de pois cassés'), c: 'Française', pr: 15, cu: () => 60, co: 4, u: ['Faitout', 'Mixeur plongeant'],
    p: ['nature', 'oeufs', 'porc', 'poulet'],
    i: [['Pois cassés', 250, 'g'], ['Carotte', 2, 'pcs'], OI, ['Poireau', 1, 'pcs'], THYM, LAU, ['Crème fraîche', 2, 'cas']],
    e: p => ['Rincez les pois cassés.', 'Faites revenir l’oignon, la carotte et le poireau émincés, ajoutez les pois cassés, le thym, le laurier et 1,5 L d’eau.',
      p.kind === 'viande' ? `${prep(p)} Ajoutez ${p.le} dès le début.` : '', 'Laissez cuire 50 min à feu doux, retirez le laurier et mixez (en réservant la viande s’il y en a).',
      p.kind === 'volaille' ? sauter(p).replace(' Réservez.', '') : p.kind === 'oeuf' ? 'Faites pocher les œufs 3 min.' : '', `Servez avec la crème${estNature(p) ? '' : ` et ${p.le}`}.`] },
  { n: p => avec(p, 'Harira'), c: 'Marocaine', pr: 20, cu: () => 60, co: 3, u: ['Faitout'],
    p: ['agneau', 'poulet', 'lentilles', 'pois-chiches'],
    i: [['Lentilles vertes', 100, 'g'], ['Pois chiches secs', 100, 'g'], TOM(5), OI, ['Céleri branche', 2, 'pcs'], ['Curcuma', 1, 'cac'], ['Cannelle', 1, 'cac'], GING, CORI, PER, ['Farine', 30, 'g'], CIT],
    e: p => ['La veille, faites tremper les pois chiches.', saisir(p) || 'Faites revenir l’oignon et le céleri dans un filet d’huile.', 'Ajoutez l’oignon, le céleri, les épices, les tomates concassées, les lentilles, les pois chiches et 2 L d’eau.',
      `Laissez mijoter 50 min${['viande', 'volaille'].includes(p.kind) ? ` avec ${p.le}` : ''}.`, 'Délayez la farine dans 10 cl d’eau et versez-la en remuant pour épaissir. Laissez cuire 5 min.', 'Ajoutez les herbes ciselées et servez avec le citron.'] },
  // ── Four ──
  { n: p => titreDe(p, 'Légumes farcis') + ' à la provençale', c: 'Française', pr: 30, cu: () => 50, d: 'moyen', co: 3, u: ['Four', 'Plat à gratin'],
    p: ['hache', 'agneau', 'lentilles', 'dinde', 'nature'],
    i: [['Tomate', 4, 'pcs'], ['Courgette', 2, 'pcs'], ['Poivron rouge', 2, 'pcs'], OI, AIL, PER, ['Riz rond', 100, 'g'], ['Herbes de Provence', 1, 'cac'], ['Parmesan', 40, 'g'], H],
    e: p => ['Préchauffez le four à 180 °C. Évidez les tomates, les courgettes coupées en deux et les poivrons ; hachez la chair des tomates et des courgettes.', 'Faites précuire le riz 8 min et égouttez.',
      `Faites revenir l’oignon, l’ail et la chair hachée 5 min, puis ${p.kind === 'hache' ? 'le bœuf haché 5 min' : p.kind === 'viande' ? 'l’agneau haché au couteau 5 min' : p.kind === 'volaille' ? 'la dinde hachée au couteau 5 min' : p.kind === 'legume' ? 'les lentilles cuites 20 min à part' : 'le parmesan'}.`,
      'Mélangez avec le riz, le persil et les herbes, farcissez les légumes et parsemez de parmesan.', 'Enfournez 45 min en arrosant d’un filet d’huile à mi-cuisson.'] },
  { n: p => avec(p, 'Légumes racines rôtis'), c: 'Healthy', pr: 20, cu: p => 25 + rotir(p).min, co: 2, u: ['Four', 'Plaque'],
    p: ['cuisses', 'saumon', 'pois-chiches', 'porc', 'sardines', 'oeufs', 'canard'],
    i: [['Panais', 300, 'g'], ['Carotte', 3, 'pcs'], ['Betterave cuite', 2, 'pcs'], ['Oignon rouge', 2, 'pcs'], ['Topinambour', 300, 'g'], THYM, ['Miel', 1, 'cas'], ['Huile d’olive', 3, 'cas'], ['Noix', 30, 'g']],
    e: p => ['Préchauffez le four à 200 °C.', 'Coupez panais, carottes, topinambours, betteraves et oignons rouges en morceaux, mélangez avec l’huile, le thym et le miel, salez.', 'Enfournez 25 min.',
      rotir(p).txt, 'Parsemez de noix concassées et servez.'] },
  { n: p => titreDe(p, 'Quiche maison') + ' aux poireaux', c: 'Française', pr: 30, cu: () => 45, d: 'moyen', co: 2, u: ['Four', 'Moule à tarte'],
    p: ['nature', 'saumon', 'poulet', 'crevettes'],
    i: [['Farine', 200, 'g'], BEU(100), ['Poireau', 3, 'pcs'], ['Œuf', 3, 'pcs'], ['Crème liquide', 200, 'ml'], ['Lait', 100, 'ml'], ['Comté', 60, 'g'], ['Salade verte', 1, 'pcs']],
    e: p => ['Préparez la pâte : sablez la farine et le beurre froid du bout des doigts, ajoutez une pincée de sel et 5 cl d’eau froide, formez une boule et réservez 30 min au frais.',
      'Préchauffez le four à 180 °C. Émincez les poireaux et faites-les fondre 15 min à couvert avec une noix de beurre.', ['poisson', 'volaille', 'crustace'].includes(p.kind) ? sauter(p).replace(' Réservez.', '') : '',
      `Étalez la pâte dans le moule, garnissez de poireaux${estNature(p) ? '' : ` et ${p.le}`}, puis versez les œufs battus avec la crème, le lait et le comté râpé.`, 'Enfournez 35 min et servez avec la salade.'] },
  { n: p => titreDe(p, 'Crumble salé') + ' de légumes', c: 'Française', pr: 25, cu: () => 40, co: 2, u: ['Four', 'Plat à gratin'],
    p: ['nature', 'poulet', 'saumon', 'lentilles', 'cabillaud'],
    i: [['Courgette', 2, 'pcs'], ['Poivron rouge', 1, 'pcs'], TOM(3), ['Farine', 100, 'g'], ['Flocons d’avoine', 50, 'g'], BEU(60), ['Parmesan', 50, 'g'], ['Herbes de Provence', 1, 'cac']],
    e: p => ['Préchauffez le four à 190 °C. Coupez les légumes en dés et faites-les revenir 8 min.', p.kind === 'volaille' || p.kind === 'poisson' ? sauter(p).replace(' Réservez.', '') : p.kind === 'legume' ? sauter(p).replace(' Réservez.', '') : '',
      `Répartissez les légumes${estNature(p) ? '' : ` et ${p.le}`} dans le plat.`, 'Sablez la farine, les flocons, le beurre froid, le parmesan et les herbes, et émiettez sur les légumes.', 'Enfournez 25 min, jusqu’à ce que le crumble soit doré.'] },
];

// ─── Familles à variantes libres (entrées, accompagnements, desserts) ──────

interface Var { t: string; i: L[]; x: string }
interface Famille {
  titre: (v: Var) => string; type: 'entree' | 'dessert' | 'plat'; c: string; pr: number; cu: number; co: number; u: string[];
  d?: 'facile' | 'moyen' | 'difficile'; base: L[]; vars: Var[]; e: (v: Var) => string[];
}
const FAMILLES: Famille[] = [
  { titre: v => `Velouté ${deE(v.t)}`, type: 'entree', c: 'Française', pr: 15, cu: 30, co: 3, u: ['Faitout', 'Mixeur plongeant'],
    base: [OI, ['Pomme de terre', 200, 'g'], ['Crème fraîche', 2, 'cas'], ['Huile d’olive', 1, 'cas']],
    vars: [
      { t: 'carottes au cumin', i: [['Carotte', 8, 'pcs'], ['Cumin', 1, 'cac']], x: 'les carottes en rondelles et le cumin' },
      { t: 'courgettes au basilic', i: [['Courgette', 4, 'pcs'], ['Basilic', 15, 'g']], x: 'les courgettes en morceaux (le basilic sera ajouté au mixage)' },
      { t: 'poireaux', i: [['Poireau', 4, 'pcs']], x: 'les poireaux émincés' },
      { t: 'champignons', i: [['Champignons de Paris', 500, 'g'], THYM], x: 'les champignons émincés et le thym' },
      { t: 'chou-fleur au curcuma', i: [['Chou-fleur', 1, 'pcs'], ['Curcuma', 1, 'cac']], x: 'le chou-fleur en bouquets et le curcuma' },
      { t: 'butternut à la muscade', i: [['Courge butternut', 900, 'g'], ['Cannelle', 1, 'cac']], x: 'la butternut en cubes et une pincée de cannelle' },
      { t: 'petits pois à la menthe', i: [['Petits pois frais', 500, 'g'], ['Menthe fraîche', 10, 'g']], x: 'les petits pois (la menthe sera ajoutée au mixage)' },
      { t: 'panais et poire', i: [['Panais', 600, 'g'], ['Poire', 1, 'pcs']], x: 'les panais et la poire en morceaux' },
      { t: 'topinambours', i: [['Topinambour', 700, 'g']], x: 'les topinambours épluchés' },
      { t: 'cresson', i: [['Cresson', 200, 'g']], x: 'le cresson (ajouté 3 min avant la fin pour garder sa couleur)' },
      { t: 'patate douce au gingembre', i: [['Patate douce', 3, 'pcs'], GING], x: 'la patate douce en cubes et le gingembre râpé' },
      { t: 'brocoli', i: [['Brocoli', 600, 'g']], x: 'le brocoli en bouquets' },
      { t: 'céleri et pomme', i: [['Céleri branche', 4, 'pcs'], ['Pomme', 1, 'pcs']], x: 'le céleri et la pomme en morceaux' },
      { t: 'fenouil à l’orange', i: [['Fenouil', 3, 'pcs'], ['Orange', 1, 'pcs']], x: 'le fenouil émincé (le jus d’orange sera ajouté au mixage)' },
      { t: 'tomates rôties', i: [['Tomate', 10, 'pcs'], ['Basilic', 10, 'g']], x: 'les tomates rôties 20 min au four au préalable' },
    ],
    e: v => ['Émincez l’oignon et faites-le fondre 3 min dans l’huile.', `Ajoutez ${v.x} et la pomme de terre en dés, couvrez d’eau à hauteur et salez.`,
      'Laissez cuire 20 à 25 min, jusqu’à ce que les légumes soient tendres.', 'Mixez finement avec la crème, rectifiez l’assaisonnement et servez bien chaud.'] },
  { titre: v => `Salade ${deE(v.t)}`, type: 'entree', c: 'Française', pr: 15, cu: 0, co: 1, u: ['Saladier'],
    base: [['Huile d’olive', 3, 'cas'], ['Vinaigre de Xérès', 1, 'cas'], ['Moutarde', 1, 'cac']],
    vars: [
      { t: 'mâche, betterave et noix', i: [['Mâche', 150, 'g'], ['Betterave cuite', 2, 'pcs'], ['Noix', 40, 'g']], x: 'la mâche, la betterave en dés et les noix' },
      { t: 'roquette, poire et parmesan', i: [['Roquette', 120, 'g'], ['Poire', 2, 'pcs'], ['Parmesan', 40, 'g']], x: 'la roquette, les poires en lamelles et les copeaux de parmesan' },
      { t: 'endives, pomme et comté', i: [['Endive', 4, 'pcs'], ['Pomme', 1, 'pcs'], ['Comté', 60, 'g']], x: 'les endives émincées, la pomme en bâtonnets et le comté en dés' },
      { t: 'fenouil, orange et olives', i: [['Fenouil', 2, 'pcs'], ['Orange', 2, 'pcs'], ['Olives noires', 40, 'g']], x: 'le fenouil très finement émincé, les suprêmes d’orange et les olives' },
      { t: 'chou rouge, pomme et noisettes', i: [['Chou rouge', 400, 'g'], ['Pomme', 1, 'pcs'], ['Noisettes', 40, 'g']], x: 'le chou rouge émincé, la pomme râpée et les noisettes' },
      { t: 'carottes, orange et cumin', i: [['Carotte', 6, 'pcs'], ['Orange', 1, 'pcs'], ['Cumin', 1, 'cac']], x: 'les carottes râpées, le jus d’orange et le cumin' },
      { t: 'concombre, radis et menthe', i: [['Concombre', 1, 'pcs'], ['Radis', 200, 'g'], ['Menthe fraîche', 10, 'g']], x: 'le concombre et les radis en fines rondelles, la menthe ciselée' },
      { t: 'tomates anciennes et mozzarella', i: [['Tomate', 5, 'pcs'], ['Mozzarella', 250, 'g'], ['Basilic', 15, 'g']], x: 'les tomates et la mozzarella en tranches, le basilic' },
      { t: 'lentilles, carottes et feta', i: [['Lentilles vertes', 150, 'g'], ['Carotte', 2, 'pcs'], ['Feta', 100, 'g']], x: 'les lentilles cuites 20 min et refroidies, les carottes râpées et la feta émiettée' },
      { t: 'pastèque, feta et menthe', i: [['Pastèque', 800, 'g'], ['Feta', 150, 'g'], ['Menthe fraîche', 10, 'g']], x: 'la pastèque en cubes, la feta et la menthe' },
      { t: 'melon, concombre et basilic', i: [['Melon', 1, 'pcs'], ['Concombre', 1, 'pcs'], ['Basilic', 10, 'g']], x: 'le melon et le concombre en billes ou en dés, le basilic' },
      { t: 'haricots verts, échalote et amandes', i: [['Haricots verts', 400, 'g'], ['Échalote', 2, 'pcs'], ['Amandes', 40, 'g']], x: 'les haricots verts cuits 8 min et rafraîchis, l’échalote ciselée et les amandes grillées' },
      { t: 'avocat, pamplemousse et crevettes', i: [['Avocat', 2, 'pcs'], ['Pamplemousse', 350, 'g'], ['Crevettes', 200, 'g']], x: 'l’avocat en tranches, les suprêmes de pamplemousse et les crevettes cuites 2 min' },
      { t: 'chou kale, grenade et graines', i: [['Chou kale', 200, 'g'], ['Grenade', 1, 'pcs'], ['Graines de courge', 30, 'g']], x: 'le chou kale émincé et massé avec la vinaigrette, les grains de grenade et les graines' },
    ],
    e: v => ['Préparez la vinaigrette : fouettez la moutarde, le vinaigre, du sel, du poivre, puis l’huile.', `Préparez ${v.x}.`, 'Assaisonnez au dernier moment et servez frais.'] },
  { titre: v => `Tarte fine aux ${v.t}`, type: 'dessert', c: 'Desserts fruités', pr: 30, cu: 30, co: 2, u: ['Four', 'Rouleau à pâtisserie'], d: 'moyen',
    base: [['Farine', 200, 'g'], BEU(100), ['Sucre', 60, 'g'], ['Œuf', 1, 'pcs']],
    vars: [
      { t: 'pommes', i: [['Pomme', 4, 'pcs'], ['Cannelle', 1, 'cac']], x: 'les pommes en fines lamelles, saupoudrées de cannelle' },
      { t: 'poires et amandes', i: [['Poire', 4, 'pcs'], ['Poudre d’amandes', 50, 'g']], x: 'la poudre d’amandes puis les poires en lamelles' },
      { t: 'abricots', i: [['Abricot', 600, 'g']], x: 'les abricots coupés en deux, face bombée dessous' },
      { t: 'pêches et romarin', i: [['Pêche', 4, 'pcs'], ['Thym', 2, 'g']], x: 'les pêches en quartiers fins et quelques feuilles de thym' },
      { t: 'figues et miel', i: [['Figue fraîche', 400, 'g'], ['Miel', 2, 'cas']], x: 'les figues en quartiers arrosées de miel' },
      { t: 'rhubarbe', i: [['Rhubarbe', 500, 'g']], x: 'la rhubarbe en tronçons, saupoudrée de sucre' },
      { t: 'nectarines et framboises', i: [['Nectarine', 450, 'g'], ['Framboise', 150, 'g']], x: 'les nectarines en lamelles et les framboises' },
      { t: 'coings', i: [['Coing', 750, 'g']], x: 'les coings pochés 20 min puis tranchés' },
    ],
    e: v => ['Préparez la pâte : sablez la farine, le beurre froid et la moitié du sucre, ajoutez l’œuf et formez une boule. Réservez 30 min au frais.', 'Préchauffez le four à 190 °C. Étalez la pâte finement sur une plaque recouverte de papier cuisson.',
      `Disposez ${v.x} en rosace, en laissant un bord de 2 cm que vous replierez.`, 'Saupoudrez du reste de sucre et enfournez 25 à 30 min, jusqu’à ce que la pâte soit dorée.'] },
  { titre: v => `Clafoutis aux ${v.t}`, type: 'dessert', c: 'Française', pr: 15, cu: 35, co: 2, u: ['Four', 'Plat à gratin'],
    base: [['Œuf', 4, 'pcs'], ['Farine', 80, 'g'], ['Sucre', 80, 'g'], ['Lait', 400, 'ml'], BEU(15)],
    vars: [
      { t: 'cerises', i: [['Cerise', 500, 'g']], x: 'les cerises (non dénoyautées, comme le veut la tradition limousine)' },
      { t: 'abricots', i: [['Abricot', 500, 'g']], x: 'les abricots coupés en deux' },
      { t: 'poires et chocolat', i: [['Poire', 3, 'pcs'], ['Chocolat noir pâtissier', 50, 'g']], x: 'les poires en dés et le chocolat haché' },
      { t: 'framboises', i: [['Framboise', 300, 'g']], x: 'les framboises' },
      { t: 'pommes et cannelle', i: [['Pomme', 3, 'pcs'], ['Cannelle', 1, 'cac']], x: 'les pommes en dés poêlées 5 min avec la cannelle' },
      { t: 'myrtilles', i: [['Myrtilles', 300, 'g']], x: 'les myrtilles' },
      { t: 'prunes du jardin', i: [['Nectarine', 600, 'g']], x: 'les nectarines en quartiers' },
    ],
    e: v => ['Préchauffez le four à 180 °C et beurrez le plat.', `Répartissez ${v.x} dans le plat.`, 'Fouettez les œufs avec le sucre, ajoutez la farine puis le lait petit à petit, sans grumeaux.',
      'Versez sur les fruits et enfournez 35 min : le clafoutis doit être doré et juste pris.', 'Servez tiède.'] },
  { titre: v => `Crumble ${v.t}`, type: 'dessert', c: 'Desserts fruités', pr: 15, cu: 30, co: 2, u: ['Four', 'Plat à gratin'],
    base: [['Farine', 100, 'g'], ['Poudre d’amandes', 50, 'g'], ['Sucre', 70, 'g'], BEU(80)],
    vars: [
      { t: 'pommes-cannelle', i: [['Pomme', 6, 'pcs'], ['Cannelle', 1, 'cac']], x: 'les pommes en dés avec la cannelle' },
      { t: 'poires-chocolat', i: [['Poire', 5, 'pcs'], ['Chocolat noir pâtissier', 60, 'g']], x: 'les poires en dés et le chocolat haché' },
      { t: 'aux fruits rouges', i: [['Fruits rouges', 500, 'g']], x: 'les fruits rouges' },
      { t: 'rhubarbe-fraises', i: [['Rhubarbe', 400, 'g'], ['Fraise', 250, 'g']], x: 'la rhubarbe en tronçons et les fraises coupées' },
      { t: 'abricots-amandes', i: [['Abricot', 700, 'g'], ['Amandes', 30, 'g']], x: 'les abricots en quartiers et les amandes effilées' },
      { t: 'mangue-coco', i: [['Mangue', 2, 'pcs'], ['Coco râpée non sucrée', 40, 'g']], x: 'la mangue en dés (la coco remplace la moitié de la poudre d’amandes)' },
      { t: 'pêches-framboises', i: [['Pêche', 4, 'pcs'], ['Framboise', 150, 'g']], x: 'les pêches en quartiers et les framboises' },
      { t: 'pommes-coings', i: [['Pomme', 4, 'pcs'], ['Coing', 250, 'g']], x: 'les pommes et le coing en petits dés' },
      { t: 'banane-chocolat', i: [['Banane', 4, 'pcs'], ['Chocolat noir pâtissier', 60, 'g']], x: 'les bananes en rondelles et le chocolat haché' },
    ],
    e: v => ['Préchauffez le four à 180 °C.', `Disposez ${v.x} dans le plat.`, 'Sablez du bout des doigts la farine, la poudre d’amandes, le sucre et le beurre froid en dés, jusqu’à obtenir un sable grossier.',
      'Répartissez sur les fruits et enfournez 30 min, jusqu’à ce que le dessus soit bien doré.'] },
  { titre: v => `Riz au lait ${v.t}`, type: 'dessert', c: 'Française', pr: 5, cu: 40, co: 3, u: ['Casserole'],
    base: [['Riz rond', 120, 'g'], ['Lait', 1000, 'ml'], ['Sucre', 70, 'g']],
    vars: [
      { t: 'à la vanille', i: [['Gousse de vanille', 1, 'pcs']], x: 'la gousse de vanille fendue et grattée' },
      { t: 'à la cannelle et à l’orange', i: [['Cannelle', 1, 'cac'], ['Orange', 1, 'pcs']], x: 'la cannelle et le zeste de l’orange' },
      { t: 'coco-mangue', i: [['Lait de coco', 200, 'ml'], ['Mangue', 1, 'pcs']], x: 'le lait de coco (la mangue en dés sera ajoutée au service)' },
      { t: 'à la cardamome et pistaches', i: [['Cardamome', 1, 'cac'], ['Pistaches non salées', 40, 'g']], x: 'la cardamome (les pistaches concassées seront ajoutées au service)' },
      { t: 'au caramel de pommes', i: [['Pomme', 2, 'pcs'], ['Beurre', 20, 'g']], x: 'la vanille ; les pommes seront caramélisées à part avec le beurre et 20 g de sucre' },
    ],
    e: v => ['Rincez le riz et faites-le blanchir 2 min à l’eau bouillante, puis égouttez.', `Faites chauffer le lait avec ${v.x}.`, 'Ajoutez le riz et laissez cuire 35 min à feu très doux, en remuant souvent.',
      'Ajoutez le sucre en fin de cuisson, laissez tiédir et servez tiède ou frais.'] },
  { titre: v => `Crêpes ${v.t}`, type: 'dessert', c: 'Française', pr: 10, cu: 20, co: 2, u: ['Poêle à crêpes'],
    base: [['Farine', 250, 'g'], ['Œuf', 4, 'pcs'], ['Lait', 500, 'ml'], BEU(30), ['Sucre', 30, 'g']],
    vars: [
      { t: 'aux pommes caramélisées', i: [['Pomme', 3, 'pcs']], x: 'les pommes en lamelles poêlées 8 min avec un peu de beurre et de sucre' },
      { t: 'banane-chocolat', i: [['Banane', 3, 'pcs'], ['Chocolat noir pâtissier', 80, 'g']], x: 'les bananes en rondelles et le chocolat fondu' },
      { t: 'au citron et au sucre', i: [['Citron', 2, 'pcs']], x: 'un filet de citron et une pincée de sucre' },
      { t: 'aux fraises et fromage blanc', i: [['Fraise', 300, 'g'], ['Fromage blanc', 200, 'g']], x: 'les fraises en quartiers et le fromage blanc' },
      { t: 'orange et miel', i: [['Orange', 3, 'pcs'], ['Miel', 2, 'cas']], x: 'les suprêmes d’orange et le miel tiédi' },
      { t: 'poires et noisettes', i: [['Poire', 3, 'pcs'], ['Noisettes', 40, 'g']], x: 'les poires poêlées et les noisettes concassées' },
    ],
    e: v => ['Mélangez la farine et le sucre, ajoutez les œufs puis le lait petit à petit en fouettant, et enfin le beurre fondu. Laissez reposer 30 min.', 'Faites cuire les crêpes 1 min par face dans une poêle légèrement beurrée.',
      `Garnissez-les avec ${v.x} et pliez-les en quatre.`] },
  { titre: v => `Poêlée de légumes de saison, ${v.t}`, type: 'plat', c: 'Healthy', pr: 15, cu: 25, co: 2, u: ['Poêle', 'Casserole'],
    base: [['Huile d’olive', 3, 'cas'], AIL, PER, ['Quinoa', 200, 'g'], ['Œuf', 4, 'pcs']],
    vars: [
      { t: 'printemps', i: [['Asperge verte', 300, 'g'], ['Petits pois frais', 200, 'g'], ['Oignon nouveau', 4, 'pcs']], x: 'les asperges en tronçons, les petits pois et les oignons nouveaux' },
      { t: 'été', i: [['Courgette', 2, 'pcs'], ['Poivron rouge', 1, 'pcs'], ['Tomates cerises', 250, 'g']], x: 'les courgettes, le poivron et les tomates cerises' },
      { t: 'automne', i: [['Potiron', 400, 'g'], ['Champignons de Paris', 250, 'g'], ['Blette', 300, 'g']], x: 'le potiron en dés, les champignons et les blettes émincées' },
      { t: 'hiver', i: [['Chou de Bruxelles', 300, 'g'], ['Panais', 300, 'g'], ['Poireau', 2, 'pcs']], x: 'les choux de Bruxelles coupés en deux, les panais en dés et les poireaux' },
      { t: 'racines', i: [['Salsifis', 300, 'g'], ['Carotte', 3, 'pcs'], ['Rutabaga', 300, 'g']], x: 'les salsifis, les carottes et le rutabaga en bâtonnets' },
    ],
    e: v => ['Faites cuire le quinoa 12 min dans 2 fois son volume d’eau salée.', `Faites sauter ${v.x} 10 à 15 min à feu moyen dans l’huile, en commençant par les légumes les plus fermes.`,
      'Ajoutez l’ail et le persil hachés en fin de cuisson.', 'Faites cuire les œufs au plat et servez-les sur la poêlée, avec le quinoa.'] },
];

// ─── Seconde série de classiques ────────────────────────────────────────────

const PLATS2: Plat[] = [
  // France
  { n: p => titreDe(p, 'Fricassée') + ' à la moutarde', c: 'Française', pr: 15, cu: p => tempsMijote(p), co: 3, u: ['Cocotte'],
    p: ['poulet', 'cuisses', 'dinde', 'porc', 'veau'],
    i: [['Moutarde à l’ancienne', 3, 'cas'], ['Crème fraîche', 3, 'cas'], ['Échalote', 3, 'pcs'], ['Vin blanc', 150, 'ml'], THYM, H, ['Haricots verts', 400, 'g']],
    e: p => [saisir(p), 'Faites fondre les échalotes émincées 3 min, déglacez avec le vin blanc et ajoutez le thym et 10 cl d’eau.', mijoter(p, 20),
      'Incorporez la moutarde et la crème, laissez épaissir 3 min à découvert.', 'Faites cuire les haricots verts 8 min à l’eau salée et servez avec la fricassée.'] },
  { n: p => titreDe(p, 'Mijoté') + ' vallée d’Auge', c: 'Française', pr: 20, cu: p => tempsMijote(p), co: 3, u: ['Cocotte'],
    p: ['poulet', 'cuisses', 'porc', 'dinde', 'filet-mignon'],
    i: [['Pomme', 3, 'pcs'], ['Champignons de Paris', 250, 'g'], ['Crème fraîche', 3, 'cas'], ['Échalote', 2, 'pcs'], BEU(30), THYM, ['Pomme de terre', 700, 'g']],
    e: p => [p.kind === 'rapide' ? `${prep(p)} Faites dorer ${p.le} 5 min dans le beurre, puis réservez.` : saisir(p), 'Faites revenir les échalotes et les champignons 5 min dans la moitié du beurre, ajoutez 20 cl d’eau et le thym.',
      p.kind === 'rapide' ? `Remettez ${p.le} et laissez mijoter 12 min à couvert.` : mijoter(p, 20), 'Faites dorer les pommes en quartiers 8 min dans le reste de beurre.', 'Incorporez la crème à la sauce, ajoutez les pommes et servez avec les pommes de terre cuites à l’eau.'] },
  { n: p => titreDe(p, 'Daube') + ' provençale', c: 'Française', pr: 20, cu: p => tempsMijote(p), co: 4, u: ['Cocotte'],
    p: ['boeuf-braise', 'agneau', 'porc', 'cuisses'],
    i: [['Vin rouge', 400, 'ml'], ['Carotte', 3, 'pcs'], OI, AIL, TOM(3), ['Orange', 1, 'pcs'], ['Olives noires', 60, 'g'], THYM, LAU, H, ['Pâtes (fussili)', 320, 'g']],
    e: p => [`${prep(p)} Faites mariner ${p.le} une nuit dans le vin rouge avec l’ail, les herbes et le zeste de l’orange.`, `Égouttez ${p.le} et faites-${pro(p)} dorer 5 min dans la cocotte, puis réservez.`,
      'Faites revenir les oignons et les carottes, ajoutez les tomates concassées et la marinade.', mijoter(p, 45), 'Ajoutez les olives 15 min avant la fin.', 'Faites cuire les pâtes et servez-les avec la daube.'] },
  { n: p => titreDe(p, 'Marengo'), c: 'Française', pr: 20, cu: p => tempsMijote(p), co: 3, u: ['Cocotte'],
    p: ['veau', 'poulet', 'dinde', 'cuisses', 'calamars'],
    i: [TOM(5), ['Champignons de Paris', 250, 'g'], OI, AIL, ['Vin blanc', 150, 'ml'], THYM, PER, H, riz()],
    e: p => [saisir(p), 'Faites revenir les oignons, ajoutez l’ail, les tomates concassées, le vin blanc et le thym.', 'Ajoutez les champignons coupés en quatre.', mijoter(p, 25), cuitRiz, 'Parsemez de persil et servez avec le riz.'] },
  { n: p => `${nomSeul(p)} meunière, pommes vapeur`, c: 'Française', pr: 10, cu: () => 25, co: 1, u: ['Poêle', 'Cuit-vapeur'],
    p: ['sole', 'truite', 'dorade', 'cabillaud', 'colin'],
    i: [['Farine', 30, 'g'], BEU(50), CIT, PER, ['Pomme de terre', 800, 'g']],
    e: p => ['Faites cuire les pommes de terre épluchées 20 min à la vapeur.', `Épongez ${p.le}, salez et farinez légèrement en tapotant pour retirer l’excédent.`,
      `Faites cuire ${p.le} dans la moitié du beurre moussant, 3 min par face, en l’arrosant du beurre. Réservez sur les assiettes.`, 'Dans la même poêle, faites blondir le reste de beurre, ajoutez le jus du citron et le persil haché.', 'Nappez le poisson de ce beurre et servez avec les pommes vapeur.'] },
  { n: p => (p.k === 'cabillaud' ? 'Brandade de cabillaud maison' : titreDe(p, 'Brandade') + ' maison'), c: 'Française', pr: 25, cu: () => 45, co: 2, u: ['Four', 'Plat à gratin'],
    p: ['cabillaud', 'colin', 'saumon', 'maquereau'],
    i: [['Pomme de terre', 800, 'g'], ['Lait', 300, 'ml'], AIL, ['Huile d’olive', 4, 'cas'], PER, LAU, ['Salade verte', 1, 'pcs']],
    e: p => ['Faites cuire les pommes de terre épluchées 25 min à l’eau salée.', `Faites pocher ${p.le} 8 min dans le lait frémissant avec l’ail et le laurier.`, `Émiettez ${p.le} en retirant la peau et les arêtes.`,
      'Écrasez les pommes de terre avec le lait de cuisson filtré et l’huile d’olive, puis incorporez le poisson et le persil.', 'Versez dans le plat et faites gratiner 15 min à 200 °C. Servez avec la salade.'] },
  { n: p => avec(p, 'Grand aïoli'), c: 'Française', pr: 25, cu: () => 30, co: 1, u: ['Faitout', 'Mortier ou fouet'],
    p: ['cabillaud', 'colin', 'oeufs', 'crevettes', 'poulet'],
    i: [['Ail', 4, 'pcs'], ['Jaune d\'œuf', 1, 'pcs'], ['Huile d’olive', 12, 'cas'], ['Carotte', 4, 'pcs'], ['Pomme de terre', 600, 'g'], ['Haricots verts', 300, 'g'], ['Chou-fleur', 0.5, 'pcs'], CIT],
    e: p => ['Préparez l’aïoli : écrasez l’ail en purée avec une pincée de sel, ajoutez le jaune d’œuf, puis l’huile d’olive en filet en fouettant sans arrêt, comme une mayonnaise. Terminez avec un trait de citron.',
      'Faites cuire les légumes à la vapeur ou à l’eau salée, chacun juste tendre (pommes de terre 20 min, carottes 15 min, chou-fleur 10 min, haricots 8 min).',
      p.kind === 'oeuf' ? 'Faites durcir les œufs 9 min.' : p.kind === 'poisson' ? `Pochez ${p.le} 8 min dans une eau frémissante salée avec du laurier.` : sauter(p).replace(' Réservez.', ''), 'Servez tiède, avec l’aïoli à part.'] },
  { n: p => avec(p, 'Soupe au pistou'), c: 'Française', pr: 25, cu: () => 45, co: 3, u: ['Faitout', 'Mortier'],
    p: ['nature', 'poulet', 'pois-chiches', 'oeufs'],
    i: [['Courgette', 2, 'pcs'], ['Haricots verts', 200, 'g'], ['Carotte', 2, 'pcs'], ['Pomme de terre', 300, 'g'], TOM(2), ['Pâtes coquillettes', 100, 'g'], ['Basilic', 40, 'g'], AIL, ['Parmesan', 40, 'g'], ['Huile d’olive', 4, 'cas']],
    e: p => ['Coupez tous les légumes en petits dés et mettez-les dans 2 L d’eau salée avec les tomates concassées. Portez à ébullition.', pocher(p), 'Laissez cuire 30 min, puis ajoutez les pâtes pour 10 min.',
      'Pilez le basilic et l’ail avec l’huile d’olive et le parmesan : c’est le pistou.', 'Hors du feu, incorporez le pistou à la soupe et servez aussitôt.'] },
  { n: p => avec(p, 'Garbure'), c: 'Française', pr: 20, cu: p => Math.max(tempsMijote(p), 60), co: 4, u: ['Faitout'],
    p: ['canard', 'porc', 'cuisses', 'nature'],
    i: [['Chou blanc', 500, 'g'], ['Pomme de terre', 500, 'g'], ['Carotte', 3, 'pcs'], ['Navet', 2, 'pcs'], ['Poireau', 2, 'pcs'], OI, AIL, THYM, LAU],
    e: p => [p.kind === 'canard' ? `${prep(p)} Faites dorer ${p.le} 5 min dans le faitout, puis réservez.` : saisir(p), 'Faites revenir l’oignon et les poireaux émincés 5 min, ajoutez 2 L d’eau, le thym et le laurier.',
      `${['viande', 'volaille', 'canard'].includes(p.kind) ? `Remettez ${p.le} et l` : 'L'}aissez frémir 30 min.`, 'Ajoutez le chou émincé, les carottes, les navets et les pommes de terre en morceaux, et laissez cuire encore 30 min.', 'Servez très chaud, la cuillère doit presque tenir debout dans la soupe.'] },
  // Italie
  { n: p => (p.k === 'veau' ? 'Osso buco à la milanaise' : titreDe(p, 'Mijoté') + ' façon osso buco'), c: 'Italienne', pr: 20, cu: p => tempsMijote(p), d: 'moyen', co: 3, u: ['Cocotte'],
    p: ['veau', 'cuisses', 'boeuf-braise', 'porc'],
    i: [TOM(5), ['Carotte', 2, 'pcs'], ['Céleri branche', 2, 'pcs'], OI, ['Vin blanc', 200, 'ml'], ['Farine', 20, 'g'], CIT, PER, AIL, H, ['Riz Arborio', 280, 'g'], ['Parmesan', 40, 'g']],
    e: p => [`${prep(p)} Farinez légèrement ${p.le} et faites-${pro(p)} dorer 5 min dans la cocotte, puis réservez.`.trim(), 'Faites revenir l’oignon, la carotte et le céleri en petits dés, déglacez au vin blanc, ajoutez les tomates concassées.', mijoter(p, 30),
      'Préparez la gremolata : hachez ensemble le zeste du citron, l’ail et le persil.', 'Faites cuire le riz comme un risotto au parmesan, ou simplement à l’eau.', 'Servez parsemé de gremolata.'] },
  { n: p => titreDe(p, 'Cacciatore'), c: 'Italienne', pr: 15, cu: p => tempsMijote(p), co: 3, u: ['Cocotte'],
    p: ['cuisses', 'poulet', 'dinde', 'porc'],
    i: [TOM(5), ['Poivron rouge', 1, 'pcs'], ['Champignons de Paris', 200, 'g'], ['Olives noires', 50, 'g'], OI, AIL, ['Vin rouge', 150, 'ml'], ['Origan', 1, 'cac'], H, ['Pâtes penne', 320, 'g']],
    e: p => [saisir(p), 'Faites revenir l’oignon, le poivron et les champignons 6 min, ajoutez l’ail et l’origan.', 'Versez le vin, laissez réduire 2 min, puis ajoutez les tomates concassées et les olives.', mijoter(p, 25), 'Servez avec les penne.'] },
  { n: p => titreDe(p, 'Polpette') + ' à la sauce tomate', c: 'Italienne', pr: 25, cu: () => 35, co: 3, u: ['Sauteuse'],
    p: ['hache', 'dinde', 'poulet', 'lentilles'],
    i: [TOM(8), OI, AIL, ['Œuf', 1, 'pcs'], ['Parmesan', 40, 'g'], ['Flocons d’avoine', 40, 'g'], PER, ['Basilic', 10, 'g'], H, ['Spaghetti', 320, 'g']],
    e: p => [p.kind === 'hache' ? '' : p.kind === 'legume' ? `${sauter(p).replace(' Réservez.', '')} Écrasez-les grossièrement.` : `Hachez ${p.le} au couteau ou au robot.`,
      `Mélangez ${p.kind === 'legume' ? 'les lentilles' : 'la viande'} avec l’œuf, le parmesan, les flocons d’avoine, le persil et la moitié de l’ail haché. Façonnez des boulettes.`,
      'Faites dorer les boulettes 5 min dans l’huile, puis réservez.', `Faites revenir l’oignon et le reste d’ail, ajoutez les tomates concassées. ${tomatesConcassees}`, 'Remettez les boulettes et laissez mijoter 20 min.', 'Servez avec les spaghetti et le basilic.'] },
  { n: () => 'Pasta e ceci', c: 'Italienne', pr: 15, cu: () => 100, co: 3, u: ['Faitout'],
    p: ['pois-chiches'],
    i: [TOM(3), OI, AIL, ['Céleri branche', 1, 'pcs'], ['Pâtes coquillettes', 200, 'g'], ['Parmesan', 40, 'g'], THYM, ['Huile d’olive', 3, 'cas']],
    e: p => [prep(p), 'Faites cuire les pois chiches 1 h 15 dans l’eau, salez en fin de cuisson et gardez l’eau de cuisson.', 'Faites revenir l’oignon, l’ail et le céleri, ajoutez les tomates et le thym.',
      'Ajoutez les pois chiches et 80 cl de leur eau, écrasez-en un tiers pour épaissir.', 'Ajoutez les pâtes et laissez cuire 10 min en remuant.', 'Servez avec le parmesan et un filet d’huile.'] },
  { n: p => avec(p, 'Pâtes primavera'), c: 'Italienne', pr: 15, cu: () => 20, co: 2, u: ['Sauteuse', 'Casserole'],
    p: ['nature', 'poulet', 'crevettes', 'saumon', 'oeufs'],
    i: [['Tagliatelles', 320, 'g'], ['Asperge verte', 250, 'g'], ['Petits pois frais', 150, 'g'], ['Courgette', 1, 'pcs'], ['Tomates cerises', 200, 'g'], AIL, ['Parmesan', 50, 'g'], CIT, ['Huile d’olive', 3, 'cas']],
    e: p => ['Faites cuire les tagliatelles en gardant une louche d’eau de cuisson.', p.kind === 'oeuf' ? 'Faites pocher les œufs 3 min.' : sauter(p),
      'Faites sauter les asperges en tronçons, la courgette en dés et les petits pois 5 min, ajoutez l’ail et les tomates cerises coupées.', `Mélangez avec les pâtes, l’eau de cuisson, le zeste du citron et le parmesan${estNature(p) ? '' : `, puis ajoutez ${p.le}`}.`] },
  { n: p => (estNature(p) ? 'Spaghetti aglio, olio e peperoncino' : `Spaghetti ${p.au}, ail et piment`), c: 'Italienne', pr: 10, cu: () => 15, co: 1, u: ['Poêle', 'Casserole'],
    p: ['nature', 'crevettes', 'calamars', 'sardines', 'gambas'],
    i: [['Spaghetti', 350, 'g'], ['Ail', 5, 'pcs'], ['Piment frais', 1, 'pcs'], ['Huile d’olive', 5, 'cas'], PER, ['Roquette', 80, 'g'], CIT],
    e: p => ['Faites cuire les spaghetti al dente en gardant une louche d’eau.', 'Faites dorer doucement l’ail en lamelles et le piment dans l’huile d’olive, sans les brûler.', sauter(p).replace(' Réservez.', ''),
      'Ajoutez les pâtes et l’eau de cuisson, mélangez vivement pour émulsionner.', 'Servez avec le persil, la roquette et un filet de citron.'] },
  { n: p => titreDe(p, 'Gnocchis maison') + ' à la sauce tomate', c: 'Italienne', pr: 40, cu: () => 35, d: 'moyen', co: 1, u: ['Casserole', 'Sauteuse'],
    p: ['nature', 'hache', 'poulet', 'crevettes'],
    i: [['Pomme de terre', 800, 'g'], ['Farine', 200, 'g'], ['Jaune d\'œuf', 1, 'pcs'], TOM(6), AIL, ['Basilic', 15, 'g'], ['Parmesan', 60, 'g'], ['Mozzarella', 125, 'g']],
    e: p => ['Faites cuire les pommes de terre en robe des champs 25 min, épluchez-les chaudes et écrasez-les finement.', 'Ajoutez la farine, le jaune d’œuf et du sel, pétrissez juste assez pour obtenir une pâte souple. Roulez en boudins et coupez des tronçons de 2 cm.',
      `${tomatesConcassees} Faites-les compoter 15 min avec l’ail.`, sauter(p).replace(' Réservez.', ' Ajoutez-les à la sauce.'), 'Plongez les gnocchis dans l’eau bouillante salée : dès qu’ils remontent, égouttez-les.', 'Mélangez à la sauce, parsemez de mozzarella, de parmesan et de basilic.'] },
  { n: p => avec(p, 'Caponata'), c: 'Italienne', pr: 20, cu: () => 35, co: 4, u: ['Sauteuse'],
    p: ['nature', 'cabillaud', 'poulet', 'pois-chiches', 'oeufs'],
    i: [['Aubergine', 3, 'pcs'], ['Céleri branche', 2, 'pcs'], OI, TOM(4), ['Olives vertes', 60, 'g'], ['Raisins secs', 30, 'g'], ['Pignons de pin', 30, 'g'], ['Vinaigre de Xérès', 3, 'cas'], ['Sucre', 15, 'g'], ['Huile d’olive', 5, 'cas'], ['Semoule', 200, 'g']],
    e: p => ['Coupez les aubergines en cubes et faites-les dorer 10 min dans l’huile. Réservez.', 'Faites revenir l’oignon et le céleri, ajoutez les tomates concassées, les olives, les raisins, le vinaigre et le sucre : c’est l’aigre-doux sicilien.',
      'Remettez les aubergines et laissez mijoter 15 min.', p.kind === 'oeuf' ? 'Faites cuire les œufs mollets 6 min.' : sauter(p), `Servez tiède, parsemé de pignons grillés, avec la semoule${estNature(p) ? '' : ` et ${p.le}`}.`] },
  // Espagne
  { n: p => (p.kind === 'crustace' ? `${p.k === 'gambas' ? 'Gambas' : 'Crevettes'} al ajillo, riz safrané` : titreDe(p, 'Sauté') + ' al ajillo, riz safrané'), c: 'Espagnole', pr: 10, cu: () => 20, co: 1, u: ['Poêle', 'Casserole'],
    p: ['gambas', 'crevettes', 'poulet', 'calamars', 'dinde'],
    i: [['Ail', 8, 'pcs'], ['Piment frais', 1, 'pcs'], ['Huile d’olive', 5, 'cas'], ['Paprika', 1, 'cac'], PER, CIT, riz(), ['Safran', 1, 'pincee']],
    e: p => ['Faites cuire le riz avec le safran.', 'Faites chauffer doucement l’huile avec l’ail en lamelles et le piment, jusqu’à ce que l’ail blondisse.', `${prep(p, true)} Ajoutez ${p.le} et le paprika, faites cuire à feu vif ${p.kind === 'volaille' ? '6' : '3'} min.`,
      'Parsemez de persil, arrosez de citron et servez grésillant, avec le riz.'] },
  { n: p => titreDe(p, 'Albóndigas') + ' en sauce', c: 'Espagnole', pr: 25, cu: () => 35, co: 3, u: ['Sauteuse'],
    p: ['hache', 'dinde', 'poulet', 'porc'],
    i: [TOM(6), OI, AIL, ['Paprika fumé', 1, 'cac'], ['Œuf', 1, 'pcs'], ['Farine', 30, 'g'], PER, ['Vin blanc', 100, 'ml'], H, ['Pomme de terre', 700, 'g']],
    e: p => [`${p.kind === 'hache' ? '' : `Hachez ${p.le} au couteau. `}Mélangez la viande avec l’œuf, le persil et la moitié de l’ail, façonnez des boulettes et roulez-les dans la farine.`.trim(), 'Faites-les dorer 5 min dans l’huile, puis réservez.',
      'Faites revenir l’oignon, le reste d’ail et le paprika fumé, déglacez au vin blanc et ajoutez les tomates concassées.', 'Remettez les boulettes et laissez mijoter 20 min.', 'Servez avec les pommes de terre en cubes rôties au four 30 min.'] },
  { n: p => (estNature(p) ? 'Pisto manchego' : titreDe(p, 'Pisto manchego')), c: 'Espagnole', pr: 20, cu: () => 35, co: 3, u: ['Sauteuse'],
    p: ['nature', 'oeufs', 'poulet', 'cabillaud'],
    i: [['Courgette', 2, 'pcs'], ['Poivron rouge', 1, 'pcs'], ['Poivron vert', 1, 'pcs'], TOM(5), OI, AIL, ['Huile d’olive', 4, 'cas'], ['Pomme de terre', 500, 'g']],
    e: p => ['Coupez tous les légumes en petits dés.', 'Faites fondre l’oignon et les poivrons 10 min dans l’huile, ajoutez la courgette 5 min, puis l’ail et les tomates concassées.', 'Laissez compoter 15 min à feu doux.',
      p.kind === 'oeuf' ? 'Cassez les œufs sur le pisto, couvrez et laissez cuire 6 min.' : sauter(p).replace(' Réservez.', ' Posez-le sur le pisto.'), 'Servez avec les pommes de terre cuites à l’eau.'] },
  // Méditerranée orientale
  { n: p => titreDe(p, 'Shawarma') + ' maison, sauce tahini', c: 'Libanaise', pr: 25, cu: () => 30, co: 2, u: ['Four', 'Plaque'],
    p: ['poulet', 'agneau', 'boeuf', 'dinde', 'pois-chiches'],
    i: [['Cumin', 1, 'cac'], ['Paprika', 1, 'cac'], ['Curcuma', 1, 'cac'], ['Cannelle', 1, 'cac'], AIL, CIT, ['Tahini', 2, 'cas'], ['Yaourt nature', 1, 'pcs'], ['Oignon rouge', 1, 'pcs'], TOM(2), ['Concombre', 1, 'pcs'], PER, ['Boulgour', 200, 'g'], ['Huile d’olive', 3, 'cas']],
    e: p => [`${prep(p, true)} Faites mariner ${p.le} 1 h avec les épices, l’ail, l’huile et le jus du citron.`.trim(), `Étalez sur une plaque et enfournez ${p.kind === 'poischiche' ? 25 : 20} min à 220 °C, jusqu’à ce que les bords caramélisent.`,
      'Mélangez le tahini et le yaourt avec un peu d’eau.', 'Préparez le boulgour (gonflé 12 min à couvert dans 1,5 fois son volume d’eau bouillante salée) et une salade de tomates, concombre, oignon rouge et persil.', 'Servez en assiette, nappé de sauce tahini.'] },
  { n: p => (estNature(p) ? 'Imam bayildi' : titreDe(p, 'Aubergines farcies') + ' façon imam bayildi'), c: 'Turque', pr: 25, cu: () => 50, co: 3, u: ['Four', 'Sauteuse'],
    p: ['nature', 'agneau', 'hache', 'lentilles'],
    i: [['Aubergine', 4, 'pcs'], OI, AIL, TOM(4), PER, ['Cumin', 1, 'cac'], ['Huile d’olive', 5, 'cas'], ['Yaourt grec', 200, 'g'], ['Boulgour', 200, 'g']],
    e: p => ['Préchauffez le four à 190 °C. Coupez les aubergines en deux, quadrillez la chair et faites-les rôtir 25 min, face coupée huilée.',
      `Faites fondre les oignons émincés et l’ail 10 min, ajoutez ${p.kind === 'viande' ? 'l’agneau haché au couteau, faites-le dorer, puis ' : p.kind === 'hache' ? 'le bœuf haché, faites-le dorer, puis ' : p.kind === 'legume' ? 'les lentilles cuites 20 min, puis ' : ''}les tomates concassées et le cumin.`,
      'Creusez un peu la chair des aubergines, mélangez-la à la farce et garnissez.', 'Enfournez 20 min, parsemez de persil. Servez tiède avec le yaourt et le boulgour.'] },
  { n: p => titreDe(p, 'Shish taouk'), c: 'Libanaise', pr: 20, cu: () => 15, co: 1, u: ['Piques à brochettes', 'Poêle-gril'],
    p: ['poulet', 'dinde', 'crevettes', 'filet-mignon'],
    i: [['Yaourt nature', 1, 'pcs'], AIL, CIT, ['Paprika', 1, 'cac'], THYM, ['Huile d’olive', 3, 'cas'], ['Poivron vert', 1, 'pcs'], ['Oignon rouge', 1, 'pcs'], ['Riz basmati', 250, 'g'], ['Pâtes orzo', 60, 'g']],
    e: p => [`${prep(p).replace('morceaux de 4 cm', 'cubes de 3 cm')} Faites mariner ${p.le} 2 h dans le yaourt, l’ail écrasé, le jus du citron, le paprika, le thym et l’huile.`.trim(),
      'Faites dorer l’orzo 2 min dans un filet d’huile, ajoutez le riz rincé et 1,5 fois son volume d’eau bouillante salée, couvrez et laissez cuire 12 min : c’est le riz libanais.',
      `Enfilez ${p.le} sur les piques avec le poivron et l’oignon en morceaux. ${griller(p)}`, 'Servez avec le riz.'] },
  { n: p => titreDe(p, 'Menemen'), c: 'Turque', pr: 10, cu: () => 20, co: 1, u: ['Poêle'],
    p: ['oeufs'],
    i: [['Poivron vert', 2, 'pcs'], TOM(4), OI, ['Piment doux', 1, 'cac'], ['Feta', 80, 'g'], PER, ['Huile d’olive', 3, 'cas'], ['Pomme de terre', 500, 'g']],
    e: p => ['Faites fondre l’oignon et les poivrons émincés 8 min dans l’huile.', 'Ajoutez les tomates en dés et le piment doux, laissez compoter 8 min.', 'Versez les œufs battus et remuez doucement 2 min : ils doivent rester crémeux.', 'Parsemez de feta et de persil, servez avec les pommes de terre sautées.'] },
  { n: p => (p.k === 'corail' ? 'Mercimek çorbası (soupe de lentilles corail)' : `Soupe de lentilles corail ${p.au} et citron`), c: 'Turque', pr: 10, cu: () => 30, co: 3, u: ['Faitout', 'Mixeur plongeant'],
    p: ['corail', 'poulet', 'crevettes', 'oeufs'],
    i: [['Lentilles corail', 200, 'g'], OI, ['Carotte', 2, 'pcs'], ['Cumin', 1, 'cac'], ['Paprika', 1, 'cac'], ['Menthe séchée', 1, 'cac'], CIT, BEU(20)],
    e: p => ['Faites revenir l’oignon et les carottes 5 min dans le beurre, ajoutez le cumin.', 'Ajoutez les lentilles rincées et 1,2 L d’eau, laissez cuire 20 min, puis mixez.',
      p.k === 'corail' ? '' : pocher(p), 'Faites grésiller le paprika et la menthe dans une noix de beurre et versez sur la soupe. Servez avec des quartiers de citron.'] },
  // Maghreb, Afrique, Antilles
  { n: p => titreDe(p, 'Tajine kefta') + ' aux œufs', c: 'Marocaine', pr: 20, cu: () => 35, co: 2, u: ['Sauteuse ou tajine'],
    p: ['hache', 'dinde', 'agneau', 'poulet'],
    i: [TOM(6), OI, AIL, ['Cumin', 2, 'cac'], ['Paprika', 1, 'cac'], CORI, PER, ['Œuf', 4, 'pcs'], ['Semoule', 240, 'g'], H],
    e: p => [`${p.kind === 'hache' ? '' : `Hachez ${p.le} au couteau. `}Mélangez la viande avec la moitié des herbes, 1 cuillère de cumin, sel et poivre, et façonnez de petites boulettes.`.trim(),
      'Faites revenir l’oignon et l’ail, ajoutez les tomates concassées, le reste de cumin et le paprika, laissez réduire 10 min.', 'Déposez les boulettes dans la sauce, couvrez et laissez cuire 15 min.',
      'Cassez les œufs entre les boulettes, couvrez 6 min.', 'Parsemez du reste d’herbes et servez avec la semoule.'] },
  { n: p => titreDe(p, 'Chermoula') + ' au four', c: 'Marocaine', pr: 20, cu: () => 35, co: 1, u: ['Four', 'Plat à four'],
    p: ['dorade', 'cabillaud', 'sardines', 'crevettes', 'poulet', 'maquereau'],
    i: [CORI, PER, AIL, ['Cumin', 1, 'cac'], ['Paprika', 2, 'cac'], CIT, ['Huile d’olive', 5, 'cas'], ['Pomme de terre', 600, 'g'], TOM(3), ['Poivron rouge', 1, 'pcs']],
    e: p => ['Mixez la coriandre, le persil, l’ail, les épices, le jus du citron et l’huile : c’est la chermoula.', `${prep(p)} Enduisez ${p.le} de la moitié de la chermoula et laissez mariner 30 min.`.trim(),
      'Préchauffez le four à 200 °C. Disposez les pommes de terre en rondelles fines, les tomates et le poivron dans le plat avec le reste de chermoula, et enfournez 20 min.', rotir(p).txt, 'Servez directement dans le plat.'] },
  { n: p => titreDe(p, 'Colombo'), c: 'Tropicale', pr: 20, cu: p => tempsMijote(p), co: 3, u: ['Cocotte'],
    p: ['cuisses', 'poulet', 'porc', 'crevettes', 'cabillaud', 'pois-chiches'],
    i: [['Curry en poudre', 2, 'cac'], ['Curcuma', 1, 'cac'], ['Cumin', 1, 'cac'], OI, AIL, ['Piment frais', 1, 'pcs', true], CITV, ['Pomme de terre', 400, 'g'], ['Courgette', 1, 'pcs'], ['Aubergine', 1, 'pcs'], THYM, riz()],
    e: p => [`${prep(p)} Faites mariner ${p.le} 1 h avec la moitié des épices, l’ail et le jus des citrons verts.`.trim(), ['volaille', 'viande'].includes(p.kind) ? `Faites dorer ${p.le} 5 min dans la cocotte, puis réservez.` : '',
      'Faites revenir l’oignon, ajoutez le reste des épices, puis les pommes de terre, la courgette et l’aubergine en cubes, le thym, le piment entier et 40 cl d’eau.', mijoter(p, 25), cuitRiz, 'Servez le colombo avec le riz.'] },
  { n: p => titreDe(p, 'Rougail') + ' aux tomates', c: 'Tropicale', pr: 15, cu: () => 30, co: 3, u: ['Sauteuse'],
    p: ['crevettes', 'cabillaud', 'poulet', 'oeufs', 'pois-chiches'],
    i: [TOM(8), OI, AIL, GING, ['Curcuma', 1, 'cac'], ['Piment frais', 1, 'pcs'], THYM, H, riz(), ['Lentilles vertes', 150, 'g']],
    e: p => ['Faites cuire les lentilles 20 min et le riz, séparément.', 'Faites fondre l’oignon émincé, ajoutez l’ail et le gingembre pilés, le curcuma et le thym.', `Ajoutez les tomates en dés et le piment, laissez compoter 15 min.`,
      p.kind === 'oeuf' ? 'Cassez les œufs dans le rougail, couvrez 6 min.' : sauter(p).replace(' Réservez.', ' Ajoutez-les au rougail pour 5 min.'), 'Servez avec le riz et les lentilles, à la réunionnaise.'] },
  { n: p => titreDe(p, 'Thiéboudienne'), c: 'Afrique de l’Ouest', pr: 30, cu: () => 60, d: 'moyen', co: 2, u: ['Faitout'],
    p: ['dorade', 'cabillaud', 'colin', 'poulet'],
    i: [['Riz rond', 300, 'g'], TOM(6), OI, AIL, PER, ['Carotte', 3, 'pcs'], ['Chou blanc', 300, 'g'], ['Aubergine', 1, 'pcs'], ['Patate douce', 1, 'pcs'], ['Piment frais', 1, 'pcs', true], H],
    e: p => [`${prep(p)} Farcissez ${p.le} d’un hachis d’ail, de persil et de piment (entailles dans la chair).`.trim(), 'Faites revenir l’oignon, ajoutez les tomates concassées et 1,5 L d’eau.',
      'Ajoutez les légumes en gros morceaux et laissez cuire 25 min.', `Pochez ${p.le} ${p.kind === 'volaille' ? 15 : 10} min dans ce bouillon, puis retirez-${pro(p)} avec les légumes.`,
      'Versez le riz dans le bouillon (il doit juste le couvrir), couvrez et laissez cuire 20 min à feu doux.', `Servez le riz avec les légumes et ${p.le} par-dessus.`] },
  { n: p => titreDe(p, 'Gombo') + ' mijoté', c: 'Afrique de l’Ouest', pr: 20, cu: p => tempsMijote(p), co: 3, u: ['Cocotte'],
    p: ['crevettes', 'poulet', 'cuisses', 'boeuf-braise'],
    i: [['Gombo', 400, 'g'], TOM(4), OI, AIL, ['Piment frais', 1, 'pcs', true], ['Huile de palme (dendê)', 2, 'cas'], riz()],
    e: p => [saisir(p), 'Faites revenir l’oignon et l’ail dans l’huile de palme, ajoutez les tomates concassées.', 'Ajoutez les gombos en rondelles et 30 cl d’eau.', mijoter(p, 20), cuitRiz, 'Servez avec le riz.'] },
  // Inde
  { n: p => (p.k === 'poulet' ? 'Butter chicken maison' : `Curry ${p.de} façon butter chicken`), c: 'Indienne', pr: 20, cu: p => tempsMijote(p), co: 3, u: ['Cocotte'],
    p: ['poulet', 'dinde', 'crevettes', 'pois-chiches', 'cuisses'],
    i: [['Yaourt nature', 1, 'pcs'], TOM(6), BEU(30), ['Crème liquide', 100, 'ml'], OI, AIL, GING, ['Garam masala', 2, 'cac'], ['Paprika', 1, 'cac'], ['Miel', 1, 'cac'], CORI, riz()],
    e: p => [`${prep(p)} Faites mariner ${p.le} 1 h dans le yaourt avec la moitié des épices.`.trim(), ['volaille'].includes(p.kind) ? `Faites dorer ${p.le} 5 min dans la cocotte, puis réservez.` : '',
      'Faites fondre l’oignon dans le beurre, ajoutez l’ail, le gingembre et le reste des épices, puis les tomates concassées et le miel. Laissez réduire 10 min et mixez.', mijoter(p, 15), 'Incorporez la crème, faites cuire le riz et servez parsemé de coriandre.'] },
  { n: p => avec(p, 'Aloo gobi'), c: 'Indienne', pr: 15, cu: () => 30, co: 3, u: ['Sauteuse'],
    p: ['nature', 'pois-chiches', 'poulet', 'oeufs'],
    i: [['Chou-fleur', 1, 'pcs'], ['Pomme de terre', 500, 'g'], OI, TOM(2), GING, ['Curcuma', 1, 'cac'], ['Cumin', 1, 'cac'], ['Garam masala', 1, 'cac'], CORI, ['Huile d’olive', 3, 'cas'], ['Yaourt nature', 2, 'pcs']],
    e: p => ['Faites griller les graines de cumin 30 s dans l’huile, ajoutez l’oignon et le gingembre.', 'Ajoutez les pommes de terre en dés et le chou-fleur en bouquets, le curcuma, et faites revenir 5 min.', 'Ajoutez les tomates et 10 cl d’eau, couvrez et laissez cuire 15 min.',
      p.kind === 'oeuf' ? 'Faites durcir les œufs 9 min et ajoutez-les coupés en deux.' : sauter(p).replace(' Réservez.', ' Ajoutez-les en fin de cuisson.'), 'Saupoudrez de garam masala et de coriandre, servez avec le yaourt.'] },
  { n: p => titreDe(p, 'Vindaloo'), c: 'Indienne', pr: 20, cu: p => tempsMijote(p), co: 4, u: ['Cocotte'],
    p: ['porc', 'poulet', 'agneau', 'cuisses', 'pois-chiches'],
    i: [['Vinaigre de cidre', 40, 'ml'], OI, AIL, GING, ['Piment doux', 2, 'cac'], ['Cumin', 1, 'cac'], ['Cannelle', 1, 'cac'], ['Curcuma', 1, 'cac'], TOM(3), ['Pomme de terre', 400, 'g'], riz()],
    e: p => [`${prep(p)} Faites mariner ${p.le} 2 h avec le vinaigre, l’ail, le gingembre et les épices : c’est ce qui donne au vindaloo son acidité.`.trim(), ['volaille', 'viande'].includes(p.kind) ? `Faites dorer ${p.le} égoutté 5 min dans la cocotte, puis réservez.` : '',
      'Faites fondre les oignons, ajoutez les tomates concassées, la marinade, les pommes de terre en cubes et 20 cl d’eau.', mijoter(p, 25), cuitRiz, 'Servez avec le riz.'] },
  { n: p => titreDe(p, 'Rogan josh'), c: 'Indienne', pr: 20, cu: p => tempsMijote(p), co: 4, u: ['Cocotte'],
    p: ['agneau', 'boeuf-braise', 'cuisses', 'poulet'],
    i: [['Yaourt nature', 2, 'pcs'], OI, AIL, GING, ['Paprika', 2, 'cac'], ['Garam masala', 2, 'cac'], ['Cardamome', 1, 'cac'], TOM(3), ['Épinards frais', 200, 'g'], riz()],
    e: p => [saisir(p), 'Faites fondre les oignons, ajoutez l’ail, le gingembre, le paprika, la cardamome et le garam masala.', 'Ajoutez les tomates concassées puis le yaourt, cuillère par cuillère, en remuant.', mijoter(p, 30),
      'Ajoutez les épinards les 3 dernières minutes.', cuitRiz, 'Servez avec le riz.'] },
  { n: p => `Curry ${p.de} du Kerala`, c: 'Indienne', pr: 20, cu: () => 30, co: 2, u: ['Sauteuse'],
    p: ['cabillaud', 'dorade', 'crevettes', 'colin', 'maquereau'],
    i: [['Lait de coco', 400, 'ml'], TOM(2), OI, GING, AIL, ['Curcuma', 1, 'cac'], ['Piment doux', 1, 'cac'], CITV, ['Feuille de laurier', 2, 'pcs'], riz()],
    e: p => [`${prep(p)} Frottez ${p.le} de curcuma et de sel.`.trim(), 'Faites fondre l’oignon, le gingembre et l’ail, ajoutez le piment et les tomates en dés.', 'Versez le lait de coco, ajoutez le laurier.', mijoter(p, 10),
      'Arrosez du jus des citrons verts.', cuitRiz, 'Servez avec le riz.'] },
  { n: p => avec(p, 'Khichdi'), c: 'Indienne', pr: 10, cu: () => 35, co: 3, u: ['Cocotte'],
    p: ['corail', 'oeufs', 'poulet'],
    i: [['Lentilles corail', 150, 'g'], ['Riz basmati', 150, 'g'], ['Curcuma', 1, 'cac'], ['Cumin', 1, 'cac'], GING, BEU(20), ['Petits pois frais', 150, 'g'], ['Carotte', 2, 'pcs'], CORI, ['Yaourt nature', 2, 'pcs']],
    e: p => ['Rincez le riz et les lentilles ensemble.', 'Faites grésiller le cumin dans le beurre, ajoutez le gingembre, le curcuma et les carottes en dés.', 'Ajoutez le riz, les lentilles, les petits pois et 1 L d’eau salée, couvrez et laissez cuire 25 min à feu doux : la texture doit être crémeuse.',
      p.k === 'corail' ? '' : p.kind === 'oeuf' ? 'Faites cuire les œufs au plat.' : sauter(p).replace(' Réservez.', ''), `Servez avec le yaourt et la coriandre${p.k === 'corail' ? '' : `, et ${p.le}`}.`] },
  // Asie
  { n: p => titreDe(p, 'Teriyaki') + ' maison, riz et brocoli', c: 'Japonaise', pr: 15, cu: () => 20, co: 2, u: ['Poêle', 'Casserole'],
    p: ['poulet', 'saumon', 'boeuf', 'dinde', 'filet-mignon', 'cuisses'],
    i: [SOJA(4), ['Mirin', 3, 'cas'], ['Sucre', 20, 'g'], GING, riz('Riz rond', 280), ['Brocoli', 400, 'g'], ['Graines de sésame', 1, 'cas'], ['Oignon nouveau', 2, 'pcs']],
    e: p => ['Faites cuire le riz rond.', 'Mélangez la sauce soja, le mirin, le sucre et le gingembre râpé : c’est la sauce teriyaki.', `${p.k === 'cuisses' ? 'Désossez les cuisses et aplatissez-les. ' : prep(p)} Faites dorer ${p.le} ${p.kind === 'poisson' ? '3 min par face' : '6 à 8 min'} à la poêle.`.trim(),
      'Versez la sauce et laissez-la réduire 2 min en arrosant jusqu’à ce qu’elle laque.', 'Faites cuire le brocoli 5 min à la vapeur.', 'Servez sur le riz, parsemé de sésame et d’oignon nouveau.'] },
  { n: p => titreDe(p, 'Bulgogi'), c: 'Coréenne', pr: 20, cu: () => 20, co: 2, u: ['Poêle', 'Casserole'],
    p: ['boeuf', 'filet-mignon', 'poulet', 'dinde'],
    i: [SOJA(4), ['Poire', 1, 'pcs'], AIL, GING, ['Sucre', 15, 'g'], ['Huile de sésame', 2, 'cas'], ['Oignon', 1, 'pcs'], ['Carotte', 1, 'pcs'], ['Oignon nouveau', 3, 'pcs'], riz('Riz rond', 280), ['Salade romaine', 1, 'pcs'], ['Graines de sésame', 1, 'cas']],
    e: p => [`Coupez ${p.le} en tranches très fines (plus facile s’il a passé 30 min au congélateur).`, 'Râpez la poire et mélangez-la avec la sauce soja, l’ail, le gingembre, le sucre et l’huile de sésame. Faites mariner la viande au moins 30 min.',
      'Faites cuire le riz.', 'Faites saisir la viande égouttée avec l’oignon émincé et la carotte en julienne 4 à 5 min à feu très vif.', 'Servez avec le riz et les feuilles de romaine pour faire des bouchées, parsemé de sésame et d’oignon nouveau.'] },
  { n: p => avec(p, 'Japchae'), c: 'Coréenne', pr: 25, cu: () => 20, co: 2, u: ['Wok'],
    p: ['boeuf', 'poulet', 'nature', 'crevettes', 'oeufs'],
    i: [['Nouilles de riz', 250, 'g'], ['Épinards frais', 200, 'g'], ['Carotte', 2, 'pcs'], ['Champignons shiitakés', 150, 'g'], ['Oignon', 1, 'pcs'], ['Poivron rouge', 1, 'pcs'], SOJA(4), ['Sucre', 15, 'g'], ['Huile de sésame', 2, 'cas'], ['Graines de sésame', 1, 'cas'], AIL],
    e: p => ['Faites cuire les nouilles, rincez-les à l’eau froide et coupez-les aux ciseaux.', 'Mélangez la sauce soja, le sucre, l’huile de sésame et l’ail.', p.kind === 'oeuf' ? 'Faites une omelette fine, roulez-la et coupez-la en lanières.' : sauter(p),
      'Faites sauter séparément les légumes en julienne 2 min chacun.', `Mélangez les nouilles, les légumes${estNature(p) ? '' : `, ${p.le}`} et la sauce dans le wok 2 min, parsemez de sésame.`] },
  { n: p => avec(p, 'Nasi goreng'), c: 'Asiatique', pr: 15, cu: () => 20, co: 2, u: ['Wok'],
    p: ['poulet', 'crevettes', 'oeufs', 'porc', 'nature'],
    i: [riz('Riz jasmin', 280), ['Œuf', 4, 'pcs'], ['Échalote', 3, 'pcs'], AIL, ['Piment frais', 1, 'pcs'], SOJA(3), ['Sucre', 10, 'g'], ['Chou chinois', 200, 'g'], ['Concombre', 1, 'pcs'], TOM(2), ['Huile de tournesol', 30, 'ml']],
    e: p => ['Faites cuire le riz la veille et laissez-le refroidir.', 'Pilez les échalotes, l’ail et le piment.', p.k === 'oeufs' ? '' : sauter(p), 'Faites revenir la pâte d’échalotes 2 min, ajoutez le chou émincé puis le riz, la sauce soja et le sucre. Faites sauter 4 min à feu vif.',
      `${estNature(p) || p.k === 'oeufs' ? '' : `Remettez ${p.le}. `}Servez chaque assiette surmontée d’un œuf au plat, avec concombre et tomate en tranches.`] },
  { n: p => titreDe(p, 'Satay') + ', sauce cacahuète maison', c: 'Asiatique', pr: 25, cu: () => 20, co: 1, u: ['Piques à brochettes', 'Poêle-gril', 'Mixeur'],
    p: ['poulet', 'boeuf', 'crevettes', 'porc', 'dinde'],
    i: [['Cacahuètes', 120, 'g'], ['Lait de coco', 200, 'ml'], SOJA(3), ['Curcuma', 1, 'cac'], ['Cumin', 1, 'cac'], AIL, CITV, ['Sucre', 15, 'g'], ['Concombre', 1, 'pcs'], riz('Riz jasmin', 250)],
    e: p => [`${prep(p, true)} Faites mariner ${p.le} 1 h avec le curcuma, le cumin, l’ail, 1 cuillère de sauce soja et la moitié du lait de coco.`.trim(),
      'Mixez les cacahuètes grillées avec le reste du lait de coco, la sauce soja, le sucre, le jus d’un citron vert et un peu d’eau, puis chauffez 3 min : c’est la sauce satay.',
      `Enfilez ${p.le} en serpentin sur les piques. ${griller(p)}`, 'Servez avec le riz, le concombre et la sauce.'] },
  { n: p => titreDe(p, 'Rendang'), c: 'Asiatique', pr: 25, cu: p => tempsMijote(p) + 20, d: 'moyen', co: 4, u: ['Cocotte', 'Mixeur'],
    p: ['boeuf-braise', 'agneau', 'cuisses'],
    i: [['Lait de coco', 400, 'ml'], ['Échalote', 5, 'pcs'], AIL, GING, ['Citronnelle', 2, 'pcs'], ['Piment frais', 2, 'pcs'], ['Curcuma', 1, 'cac'], ['Coco râpée non sucrée', 40, 'g'], ['Cannelle', 1, 'cac'], riz('Riz jasmin', 280)],
    e: p => ['Mixez les échalotes, l’ail, le gingembre, la citronnelle, les piments et le curcuma en pâte.', 'Faites torréfier la coco râpée à sec jusqu’à ce qu’elle soit brune, puis pilez-la.', saisir(p),
      'Faites revenir la pâte 5 min, ajoutez le lait de coco et la cannelle.', `${mijoter(p)} Retirez ensuite le couvercle et laissez réduire 20 min en remuant : la sauce doit presque disparaître et enrober la viande.`, 'Ajoutez la coco torréfiée et servez avec le riz.'] },
  { n: p => titreDe(p, 'Adobo'), c: 'Asiatique', pr: 10, cu: p => tempsMijote(p), co: 4, u: ['Cocotte'],
    p: ['cuisses', 'porc', 'poulet', 'calamars'],
    i: [SOJA(5), ['Vinaigre de cidre', 80, 'ml'], ['Ail', 8, 'pcs'], LAU, ['Sucre', 10, 'g'], riz('Riz jasmin', 280), ['Chou pak choï', 300, 'g']],
    e: p => [`${prep(p)} Faites mariner ${p.le} 30 min avec la sauce soja, le vinaigre, l’ail écrasé et le laurier.`.trim(), `Faites dorer ${p.le} égoutté dans la cocotte, versez la marinade, 20 cl d’eau et le sucre.`,
      p.kind === 'calamar' ? 'Couvrez et laissez mijoter 35 min.' : `Couvrez et laissez mijoter ${dur(p.mij)}, puis retirez le couvercle et laissez réduire 10 min.`, 'Faites cuire le riz et le pak choï 3 min à la vapeur. Servez avec la sauce.'] },
  { n: p => (p.k === 'poulet' ? 'Poulet kung pao' : avec(p, 'Kung pao')), c: 'Asiatique', pr: 15, cu: () => 15, co: 1, u: ['Wok'],
    p: ['poulet', 'crevettes', 'dinde', 'filet-mignon'],
    i: [['Cacahuètes', 60, 'g'], ['Poivron rouge', 1, 'pcs'], ['Courgette', 1, 'pcs'], ['Oignon nouveau', 4, 'pcs'], ['Piment frais', 2, 'pcs'], AIL, GING, SOJA(3), ['Vinaigre de riz', 1, 'cas'], ['Sucre', 10, 'g'], ['Farine', 10, 'g'], riz('Riz jasmin', 280)],
    e: p => ['Faites cuire le riz.', 'Mélangez la sauce soja, le vinaigre, le sucre, la farine et 5 cl d’eau.', `${prep(p).replace('morceaux de 4 cm', 'dés de 2 cm')} Faites sauter ${p.le} 5 min à feu vif, puis réservez.`.trim(),
      'Faites revenir les piments, l’ail et le gingembre 30 s, ajoutez le poivron et la courgette en dés 3 min.', `Remettez ${p.le}, versez la sauce, ajoutez les cacahuètes et les oignons nouveaux, et mélangez 1 min.`] },
  { n: p => `${nomSeul(p)} au caramel à la vietnamienne`, c: 'Vietnamienne', pr: 15, cu: p => tempsMijote(p), co: 4, u: ['Cocotte'],
    p: ['porc', 'cuisses', 'saumon', 'crevettes', 'poulet'],
    i: [['Sucre', 60, 'g'], ['Sauce nuoc mam', 4, 'cas'], ['Échalote', 3, 'pcs'], AIL, GING, ['Oignon nouveau', 3, 'pcs'], riz('Riz jasmin', 280), ['Concombre', 1, 'pcs']],
    e: p => ['Faites un caramel ambré avec le sucre et 3 cuillères d’eau, puis versez prudemment 15 cl d’eau chaude pour le détendre.', 'Ajoutez les échalotes, l’ail et le gingembre émincés et le nuoc-mâm.', `${prep(p)}`.trim(),
      ['viande', 'volaille'].includes(p.kind) ? `Ajoutez ${p.le}, couvrez et laissez mijoter ${dur(p.mij)}, puis laissez réduire à découvert jusqu’à ce que la sauce soit sirupeuse.` : `Déposez ${p.le} dans le caramel et laissez cuire ${p.kind === 'crustace' ? 4 : 8} min en l’arrosant.`, 'Servez avec le riz, le concombre et l’oignon nouveau.'] },
  { n: p => titreDe(p, 'Okonomiyaki'), c: 'Japonaise', pr: 20, cu: () => 20, co: 1, u: ['Poêle'],
    p: ['crevettes', 'porc', 'nature', 'calamars', 'poulet'],
    i: [['Farine', 150, 'g'], ['Œuf', 4, 'pcs'], ['Chou blanc', 400, 'g'], ['Oignon nouveau', 4, 'pcs'], GING, SOJA(2), ['Miel', 1, 'cas'], ['Jaune d\'œuf', 1, 'pcs'], ['Huile de tournesol', 100, 'ml'], ['Graines de sésame', 1, 'cas']],
    e: p => ['Mélangez la farine, les œufs et 12 cl d’eau, puis ajoutez le chou très finement émincé, les oignons nouveaux et le gingembre.', `${prep(p, true)} Incorporez ${p.le} à la pâte.`.replace(/^ Incorporez  à la pâte\./, ''),
      'Faites cuire 4 galettes épaisses 5 min par face à feu moyen dans un peu d’huile.', 'Préparez une sauce avec la sauce soja et le miel, et une mayonnaise express au jaune d’œuf et à l’huile.', 'Servez les galettes zébrées des deux sauces et parsemées de sésame.'] },
  { n: p => titreDe(p, 'Donburi'), c: 'Japonaise', pr: 10, cu: () => 20, co: 1, u: ['Poêle', 'Casserole'],
    p: ['poulet', 'boeuf', 'saumon', 'porc'],
    i: [riz('Riz rond', 300), ['Œuf', 4, 'pcs'], ['Oignon', 2, 'pcs'], SOJA(4), ['Mirin', 3, 'cas'], ['Sucre', 10, 'g'], ['Oignon nouveau', 2, 'pcs']],
    e: p => ['Faites cuire le riz rond.', 'Dans une poêle, portez à frémissement la sauce soja, le mirin, le sucre et 15 cl d’eau, ajoutez les oignons émincés et laissez cuire 5 min.', `${prep(p, true)} Ajoutez ${p.le} et laissez cuire ${p.kind === 'poisson' ? 4 : 6} min.`.trim(),
      'Versez les œufs à peine battus, couvrez 1 min : ils doivent rester baveux.', 'Faites glisser sur les bols de riz et parsemez d’oignon nouveau.'] },
  { n: p => titreDe(p, 'Soupe miso') + ' complète', t: 'entree', c: 'Japonaise', pr: 10, cu: () => 15, co: 1, u: ['Casserole'],
    p: ['nature', 'saumon', 'crevettes', 'oeufs'],
    i: [['Miso', 3, 'cas'], ['Algue wakame séchée', 1, 'cas'], ['Champignons shiitakés', 100, 'g'], ['Chou pak choï', 200, 'g'], ['Oignon nouveau', 2, 'pcs'], GING],
    e: p => ['Réhydratez la wakame 5 min dans l’eau froide.', 'Faites frémir 1 L d’eau avec le gingembre et les shiitakés émincés 5 min.', pocher(p), 'Ajoutez le pak choï 2 min.',
      'Hors du feu, délayez le miso dans une louche de bouillon et reversez-le : il ne doit pas bouillir. Ajoutez la wakame et l’oignon nouveau.'] },
  { n: p => avec(p, 'Laksa') + ' au lait de coco', c: 'Asiatique', pr: 25, cu: () => 30, co: 1, u: ['Faitout', 'Mixeur'],
    p: ['crevettes', 'poulet', 'cabillaud', 'oeufs'],
    i: [['Lait de coco', 400, 'ml'], ['Échalote', 3, 'pcs'], AIL, GING, ['Citronnelle', 2, 'pcs'], ['Curcuma', 1, 'cac'], ['Piment frais', 1, 'pcs'], ['Nouilles de riz', 250, 'g'], ['Pousses de soja', 150, 'g'], ['Sauce nuoc mam', 2, 'cas'], CITV, CORI],
    e: p => ['Mixez les échalotes, l’ail, le gingembre, la citronnelle, le curcuma et le piment en pâte.', 'Faites revenir la pâte 3 min, ajoutez le lait de coco, 60 cl d’eau et le nuoc-mâm, laissez frémir 10 min.', pocher(p),
      'Faites tremper les nouilles et répartissez-les dans les bols.', 'Versez le bouillon et servez avec les pousses de soja, la coriandre et le citron vert.'] },
  // Amériques
  { n: p => avec(p, 'Jambalaya'), c: 'Américaine', pr: 20, cu: () => 40, co: 3, u: ['Cocotte'],
    p: ['crevettes', 'poulet', 'cuisses', 'dinde', 'nature'],
    i: [riz('Riz basmati', 300), ['Poivron vert', 1, 'pcs'], ['Céleri branche', 2, 'pcs'], OI, AIL, TOM(3), ['Paprika fumé', 2, 'cac'], THYM, ['Piment doux', 1, 'cac'], ['Oignon nouveau', 3, 'pcs'], H],
    e: p => [p.kind === 'volaille' ? saisir(p) : prep(p), 'Faites revenir l’oignon, le poivron et le céleri en dés 6 min (la « sainte trinité » cajun), ajoutez l’ail et les épices.',
      `Ajoutez les tomates concassées, le riz et 60 cl d’eau${p.kind === 'volaille' ? `, remettez ${p.le}` : ''}, couvrez et laissez cuire 20 min.`, p.kind === 'crustace' ? `Ajoutez ${p.le} pour les 5 dernières minutes.` : '', 'Parsemez d’oignon nouveau et servez.'] },
  { n: p => avec(p, 'Gumbo'), c: 'Américaine', pr: 25, cu: () => 50, d: 'moyen', co: 3, u: ['Cocotte'],
    p: ['crevettes', 'poulet', 'cuisses'],
    i: [['Farine', 40, 'g'], ['Huile de tournesol', 40, 'ml'], ['Gombo', 200, 'g'], ['Poivron vert', 1, 'pcs'], ['Céleri branche', 2, 'pcs'], OI, AIL, TOM(2), THYM, LAU, ['Paprika fumé', 1, 'cac'], riz()],
    e: p => ['Préparez un roux brun : faites cuire la farine dans l’huile 10 à 15 min à feu doux en remuant sans arrêt, jusqu’à une couleur noisette.', 'Ajoutez l’oignon, le poivron et le céleri en dés, puis l’ail, les épices, les tomates et 1 L d’eau.',
      p.kind === 'volaille' ? `${prep(p)} Ajoutez ${p.le} et laissez mijoter ${dur(p.mij)}.`.trim() : 'Laissez mijoter 25 min.', 'Ajoutez les gombos en rondelles pour 10 min' + (p.kind === 'crustace' ? ', puis les crevettes pour les 4 dernières.' : '.'), cuitRiz, 'Servez le gumbo sur le riz.'] },
  { n: p => (p.k === 'porc' ? 'Effiloché de porc façon pulled pork' : titreDe(p, 'Effiloché') + ' façon pulled pork'), c: 'Américaine', pr: 20, cu: p => (p.k === 'porc' ? 200 : 90), co: 4, u: ['Cocotte', 'Four'],
    p: ['porc', 'cuisses', 'boeuf-braise'],
    i: [['Paprika fumé', 2, 'cac'], ['Cumin', 1, 'cac'], ['Sucre', 30, 'g'], ['Vinaigre de cidre', 60, 'ml'], TOM(3), OI, AIL, ['Chou rouge', 300, 'g'], ['Carotte', 2, 'pcs'], ['Yaourt grec', 150, 'g'], ['Pomme de terre', 700, 'g']],
    e: p => [`Frottez ${p.le} en un seul morceau avec le paprika, le cumin, la moitié du sucre et du sel.`, `Faites-${pro(p)} dorer, puis ajoutez l’oignon, l’ail, les tomates concassées, le vinaigre et le reste de sucre.`,
      `Couvrez et enfournez ${p.k === 'porc' ? '3 h' : '1 h 30'} à 150 °C, jusqu’à ce que la viande se défasse à la fourchette. Effilochez-la dans la sauce.`, 'Préparez un coleslaw : chou rouge et carottes râpés, yaourt, un trait de vinaigre.', 'Servez avec les pommes de terre au four et le coleslaw.'] },
  { n: p => avec(p, 'Burrito bowl'), c: 'Mexicaine', pr: 25, cu: () => 60, co: 2, u: ['Casserole', 'Poêle'],
    p: ['poulet', 'boeuf', 'crevettes', 'dinde', 'nature'],
    i: [['Haricots rouges secs', 150, 'g'], riz(), CITV, CORI, ['Avocat', 1, 'pcs'], TOM(3), ['Oignon rouge', 1, 'pcs'], ['Poivron rouge', 1, 'pcs'], ['Cumin', 1, 'cac'], ['Paprika', 1, 'cac'], ['Yaourt grec', 150, 'g']],
    e: p => ['La veille, faites tremper les haricots rouges, puis cuisez-les 1 h à l’eau non salée.', 'Faites cuire le riz et mélangez-le au jus d’un citron vert et à la coriandre hachée.', `${sauter(p).replace(' Réservez.', '')} Assaisonnez de cumin et de paprika.`,
      'Préparez un pico de gallo : tomates, oignon rouge, coriandre et citron vert. Faites griller le poivron en lanières.', 'Composez les bols : riz, haricots, garniture, pico de gallo, avocat et une cuillère de yaourt.'] },
  { n: p => titreDe(p, 'Enchiladas') + ' maison', c: 'Mexicaine', pr: 40, cu: () => 45, d: 'moyen', co: 2, u: ['Four', 'Plat à gratin'],
    p: ['poulet', 'hache', 'dinde', 'nature'],
    i: [['Farine', 250, 'g'], ['Huile d’olive', 3, 'cas'], TOM(6), OI, AIL, ['Cumin', 1, 'cac'], ['Piment doux', 1, 'cac'], ['Haricots rouges secs', 150, 'g'], ['Cheddar', 100, 'g'], CORI],
    e: p => ['La veille, faites tremper puis cuire les haricots rouges 1 h.', 'Préparez 8 galettes : farine, huile, sel et 13 cl d’eau tiède, étalées finement et cuites 1 min par face.',
      'Faites une sauce avec l’oignon, l’ail, les épices et les tomates concassées, laissez réduire 15 min.', `${p.kind === 'hache' ? 'Faites revenir le bœuf haché 6 min.' : estNature(p) ? '' : sauter(p).replace(' Réservez.', '')} Mélangez avec les haricots et la moitié de la sauce.`.trim(),
      'Garnissez et roulez les galettes, rangez-les dans le plat, nappez du reste de sauce et du cheddar.', 'Enfournez 20 min à 190 °C et parsemez de coriandre.'] },
  { n: p => (p.k === 'boeuf' ? 'Lomo saltado' : avec(p, 'Lomo saltado')), c: 'Péruvienne', pr: 20, cu: () => 35, co: 1, u: ['Wok', 'Four'],
    p: ['boeuf', 'poulet', 'filet-mignon', 'crevettes'],
    i: [['Pomme de terre', 700, 'g'], ['Oignon rouge', 2, 'pcs'], TOM(3), AIL, SOJA(3), ['Vinaigre de Xérès', 2, 'cas'], ['Cumin', 1, 'cac'], CORI, riz(), ['Huile d’olive', 3, 'cas']],
    e: p => ['Coupez les pommes de terre en frites, mélangez-les à l’huile et enfournez 30 min à 220 °C.', cuitRiz, sauter(p),
      'Faites sauter à feu très vif l’oignon rouge en quartiers et l’ail 2 min, ajoutez les tomates en quartiers 1 min.', `Remettez ${p.le}, versez la sauce soja, le vinaigre et le cumin, ajoutez les frites et mélangez 30 s. Servez avec le riz et la coriandre.`] },
  { n: p => titreDe(p, 'Ají') + ' crémeux à la péruvienne', c: 'Péruvienne', pr: 20, cu: p => tempsMijote(p), co: 3, u: ['Cocotte', 'Mixeur'],
    p: ['poulet', 'dinde', 'crevettes', 'cuisses'],
    i: [['Poivron jaune', 300, 'g'], ['Piment frais', 1, 'pcs'], OI, AIL, ['Noix', 50, 'g'], ['Lait', 250, 'ml'], ['Parmesan', 40, 'g'], ['Curcuma', 1, 'cac'], ['Œuf', 4, 'pcs'], ['Olives noires', 40, 'g'], riz(), ['Pomme de terre', 500, 'g']],
    e: p => [p.kind === 'volaille' ? `${prep(p)} Pochez ${p.le} ${dur(p.mij)} dans l’eau frémissante, puis effilochez-${pro(p)}.`.trim() : sauter(p),
      'Faites revenir l’oignon, l’ail, le poivron jaune et le piment 10 min, puis mixez avec les noix, le lait, le parmesan et le curcuma.', `Réchauffez cette sauce 5 min et ajoutez ${p.le}.`,
      'Faites cuire le riz, les pommes de terre et les œufs durs (9 min).', 'Servez l’ají sur les pommes de terre, avec le riz, les œufs en quartiers et les olives.'] },
  { n: p => titreDe(p, 'Chowder'), c: 'Américaine', pr: 20, cu: () => 35, co: 2, u: ['Faitout'],
    p: ['cabillaud', 'moules', 'saumon', 'crevettes', 'colin'],
    i: [['Pomme de terre', 500, 'g'], OI, ['Céleri branche', 2, 'pcs'], ['Poireau', 1, 'pcs'], ['Lait', 500, 'ml'], ['Crème liquide', 100, 'ml'], BEU(30), ['Farine', 20, 'g'], THYM, ['Ciboulette', 10, 'g']],
    e: p => ['Faites fondre l’oignon, le céleri et le poireau dans le beurre 6 min, saupoudrez de farine.', 'Ajoutez les pommes de terre en dés, le thym, 50 cl d’eau et le lait, laissez cuire 15 min.', pocher(p), 'Incorporez la crème, rectifiez l’assaisonnement et servez parsemé de ciboulette.'] },
  { n: p => (p.k === 'agneau' ? 'Shepherd’s pie' : titreDe(p, 'Shepherd’s pie')), c: 'Britannique', pr: 30, cu: () => 60, co: 3, u: ['Four', 'Plat à gratin'],
    p: ['agneau', 'hache', 'lentilles', 'dinde'],
    i: [['Pomme de terre', 1000, 'g'], ['Lait', 150, 'ml'], BEU(40), OI, ['Carotte', 2, 'pcs'], ['Petits pois frais', 150, 'g'], THYM, ['Farine', 15, 'g'], ['Cheddar', 60, 'g']],
    e: p => ['Faites cuire les pommes de terre 25 min et écrasez-les avec le lait chaud et le beurre.', `Faites revenir l’oignon et les carottes en dés, ajoutez ${p.kind === 'hache' ? 'le bœuf haché' : p.kind === 'legume' ? 'les lentilles rincées et 40 cl d’eau' : `${p.le} haché${p.f ? 'e' : ''} au couteau`} et faites cuire ${p.kind === 'legume' ? 25 : 8} min.`,
      'Saupoudrez de farine, ajoutez le thym, 15 cl d’eau et les petits pois, laissez épaissir 5 min.', 'Étalez dans le plat, recouvrez de purée, strie-la à la fourchette et parsemez de cheddar.', 'Enfournez 25 min à 200 °C.'] },
];

const FAMILLES2: Famille[] = [
  { titre: v => `Moules ${v.t}`, type: 'plat', c: 'Française', pr: 20, cu: 15, co: 0, u: ['Faitout'],
    base: [['Moules', 2000, 'g'], ['Échalote', 3, 'pcs'], PER, ['Pomme de terre', 800, 'g'], BEU(20)],
    vars: [
      { t: 'marinières', i: [['Vin blanc', 200, 'ml'], THYM], x: 'le vin blanc et le thym' },
      { t: 'à la crème', i: [['Vin blanc', 150, 'ml'], ['Crème fraîche', 4, 'cas']], x: 'le vin blanc (la crème sera ajoutée à la fin)' },
      { t: 'au curry', i: [['Curry en poudre', 2, 'cac'], ['Crème liquide', 150, 'ml']], x: 'le curry et la crème' },
      { t: 'au lait de coco et citronnelle', i: [['Lait de coco', 200, 'ml'], ['Citronnelle', 2, 'pcs'], GING], x: 'le lait de coco, la citronnelle écrasée et le gingembre' },
      { t: 'à la provençale', i: [TOM(3), AIL, ['Herbes de Provence', 1, 'cac']], x: 'les tomates concassées, l’ail et les herbes' },
      { t: 'au safran', i: [['Safran', 1, 'pincee'], ['Vin blanc', 150, 'ml'], ['Crème liquide', 100, 'ml']], x: 'le vin blanc, le safran et la crème' },
      { t: 'au comté', i: [['Comté', 60, 'g'], ['Crème liquide', 100, 'ml']], x: 'la crème et le comté râpé' },
    ],
    e: v => ['Coupez les pommes de terre en frites, mélangez-les à un filet d’huile et enfournez 30 min à 220 °C.', 'Grattez et rincez les moules, jetez celles qui restent ouvertes.',
      `Faites fondre les échalotes dans le beurre, ajoutez ${v.x}.`, 'Ajoutez les moules, couvrez et faites cuire 5 à 6 min à feu vif en secouant, jusqu’à ce qu’elles soient toutes ouvertes.', 'Parsemez de persil et servez avec les frites maison.'] },
  { titre: v => `Omelette ${v.t}, salade verte`, type: 'plat', c: 'Française', pr: 10, cu: 10, co: 0, u: ['Poêle'],
    base: [['Œuf', 10, 'pcs'], BEU(20), ['Salade verte', 1, 'pcs']],
    vars: [
      { t: 'aux champignons', i: [['Champignons de Paris', 300, 'g']], x: 'les champignons émincés, poêlés 5 min' },
      { t: 'aux fines herbes', i: [['Ciboulette', 10, 'g'], PER, ['Aneth frais', 5, 'g']], x: 'les herbes ciselées, ajoutées aux œufs battus' },
      { t: 'au comté', i: [['Comté', 100, 'g']], x: 'le comté râpé' },
      { t: 'aux épinards et feta', i: [['Épinards frais', 200, 'g'], ['Feta', 80, 'g']], x: 'les épinards tombés 2 min et la feta émiettée' },
      { t: 'aux tomates et basilic', i: [TOM(3), ['Basilic', 10, 'g']], x: 'les tomates en dés et le basilic' },
      { t: 'aux poivrons', i: [['Poivron rouge', 2, 'pcs']], x: 'les poivrons en lanières, fondus 8 min' },
      { t: 'aux pommes de terre', i: [['Pomme de terre', 400, 'g']], x: 'les pommes de terre en dés, rissolées 12 min' },
      { t: 'aux courgettes et menthe', i: [['Courgette', 2, 'pcs'], ['Menthe fraîche', 10, 'g']], x: 'les courgettes râpées, poêlées 4 min, et la menthe' },
      { t: 'au chèvre et poireaux', i: [['Poireau', 2, 'pcs'], ['Chèvre frais', 100, 'g']], x: 'les poireaux fondus 10 min et le chèvre' },
    ],
    e: v => [`Préparez ${v.x}.`, 'Battez les œufs à la fourchette avec du sel et du poivre, sans les faire mousser.', 'Faites mousser le beurre dans la poêle, versez les œufs et ramenez les bords vers le centre pendant 1 min.',
      'Répartissez la garniture, laissez prendre 1 à 2 min (le centre doit rester baveux) et pliez l’omelette.', 'Servez aussitôt avec la salade verte.'] },
  { titre: v => `Gâteau au yaourt ${v.t}`, type: 'dessert', c: 'Française', pr: 15, cu: 35, co: 4, u: ['Four', 'Moule à cake'],
    base: [['Yaourt nature', 1, 'pcs'], ['Farine', 250, 'g'], ['Sucre', 150, 'g'], ['Œuf', 3, 'pcs'], ['Huile de tournesol', 80, 'ml'], ['Levure chimique', 1, 'sachet']],
    vars: [
      { t: 'au citron', i: [CIT], x: 'le zeste et le jus du citron' },
      { t: 'aux pommes', i: [['Pomme', 2, 'pcs']], x: 'les pommes en petits dés' },
      { t: 'aux pépites de chocolat', i: [['Chocolat noir pâtissier', 80, 'g']], x: 'le chocolat haché' },
      { t: 'aux framboises', i: [['Framboise', 150, 'g']], x: 'les framboises (ajoutées délicatement)' },
      { t: 'à l’orange', i: [['Orange', 1, 'pcs']], x: 'le zeste et le jus de l’orange' },
      { t: 'marbré au cacao', i: [['Cacao en poudre', 20, 'g']], x: 'le cacao dans la moitié de la pâte, pour marbrer' },
      { t: 'aux poires et amandes', i: [['Poire', 2, 'pcs'], ['Amandes', 30, 'g']], x: 'les poires en dés et les amandes effilées' },
      { t: 'à la banane', i: [['Banane', 2, 'pcs']], x: 'les bananes écrasées' },
    ],
    e: v => ['Préchauffez le four à 180 °C et beurrez le moule.', 'Mélangez le yaourt, le sucre et les œufs, puis la farine et la levure, et enfin l’huile.', `Incorporez ${v.x}.`, 'Versez dans le moule et enfournez 35 min : une lame doit ressortir sèche.'] },
  { titre: v => `Poires pochées ${v.t}`, type: 'dessert', c: 'Française', pr: 10, cu: 25, co: 3, u: ['Casserole'],
    base: [['Poire', 4, 'pcs'], ['Sucre', 60, 'g']],
    vars: [
      { t: 'au vin rouge et aux épices', i: [['Vin rouge', 500, 'ml'], ['Cannelle', 1, 'cac'], ['Anis étoilé (badiane)', 2, 'pcs']], x: 'le vin rouge, la cannelle et la badiane' },
      { t: 'à la vanille', i: [['Gousse de vanille', 1, 'pcs']], x: '75 cl d’eau et la gousse de vanille fendue' },
      { t: 'au thé et gingembre', i: [['Thé', 5, 'g'], GING], x: '75 cl de thé infusé et le gingembre tranché' },
      { t: 'à l’orange et cardamome', i: [['Orange', 2, 'pcs'], ['Cardamome', 1, 'cac']], x: 'le jus des oranges, 50 cl d’eau et la cardamome' },
      { t: 'au miel et romarin', i: [['Miel', 3, 'cas'], THYM], x: '75 cl d’eau, le miel et le thym' },
    ],
    e: v => ['Épluchez les poires en gardant la queue.', `Portez à frémissement ${v.x} avec le sucre.`, 'Plongez les poires, couvrez d’un disque de papier cuisson et laissez pocher 20 à 25 min : la pointe d’un couteau doit s’enfoncer sans résistance.',
      'Retirez les poires et faites réduire le sirop de moitié.', 'Servez tiède ou froid, nappé de sirop.'] },
  { titre: v => `Salade de fruits ${v.t}`, type: 'dessert', c: 'Desserts fruités', pr: 15, cu: 0, co: 1, u: ['Saladier'],
    base: [['Miel', 1, 'cas'], ['Menthe fraîche', 10, 'g']],
    vars: [
      { t: 'exotiques', i: [['Mangue', 1, 'pcs'], ['Ananas frais', 0.5, 'pcs'], ['Kiwi', 250, 'g'], CITV], x: 'la mangue, l’ananas et les kiwis en dés' },
      { t: 'rouges', i: [['Fraise', 250, 'g'], ['Framboise', 125, 'g'], ['Myrtilles', 125, 'g'], CIT], x: 'les fraises coupées, les framboises et les myrtilles' },
      { t: 'd’hiver', i: [['Orange', 3, 'pcs'], ['Pamplemousse', 350, 'g'], ['Grenade', 1, 'pcs']], x: 'les suprêmes d’agrumes et les grains de grenade' },
      { t: 'd’automne', i: [['Pomme', 2, 'pcs'], ['Poire', 2, 'pcs'], ['Raisin', 200, 'g'], CIT], x: 'les pommes et poires en dés et les grains de raisin' },
      { t: 'd’été', i: [['Pêche', 3, 'pcs'], ['Melon', 0.5, 'pcs'], ['Cerise', 200, 'g'], CIT], x: 'les pêches, le melon en billes et les cerises dénoyautées' },
    ],
    e: v => [`Préparez ${v.x}.`, 'Arrosez de jus d’agrume et de miel, mélangez délicatement.', 'Réservez 30 min au frais et servez parsemé de menthe ciselée.'] },
  { titre: v => `Houmous ${v.t} et crudités`, type: 'entree', c: 'Libanaise', pr: 20, cu: 75, co: 4, u: ['Mixeur', 'Casserole'],
    base: [['Pois chiches secs', 200, 'g'], ['Tahini', 3, 'cas'], CIT, ['Ail', 1, 'pcs'], ['Huile d’olive', 3, 'cas'], ['Carotte', 3, 'pcs'], ['Concombre', 1, 'pcs']],
    vars: [
      { t: 'classique', i: [['Cumin', 1, 'cac']], x: 'le cumin' },
      { t: 'à la betterave', i: [['Betterave cuite', 2, 'pcs']], x: 'la betterave en morceaux' },
      { t: 'aux carottes rôties', i: [['Carotte', 3, 'pcs'], ['Cumin', 1, 'cac']], x: 'les carottes rôties 25 min au four et le cumin' },
      { t: 'aux poivrons grillés', i: [['Poivron rouge', 2, 'pcs'], ['Paprika fumé', 1, 'cac']], x: 'les poivrons grillés et pelés et le paprika fumé' },
      { t: 'aux herbes', i: [CORI, PER], x: 'la coriandre et le persil' },
      { t: 'à la patate douce', i: [['Patate douce', 1, 'pcs']], x: 'la patate douce rôtie 30 min au four' },
    ],
    e: v => ['La veille, faites tremper les pois chiches, puis faites-les cuire 1 h 15 à l’eau.', `Mixez les pois chiches chauds avec le tahini, le jus du citron, l’ail, ${v.x} et 5 à 8 cuillères d’eau de cuisson, jusqu’à obtenir une texture très lisse.`,
      'Salez, versez dans un plat, creusez un sillon et arrosez d’huile d’olive.', 'Servez avec les carottes et le concombre en bâtonnets.'] },
];

const FAMILLES3: Famille[] = [
  { titre: v => `Gratin ${deE(v.t)} au comté`, type: 'plat', c: 'Française', pr: 20, cu: 45, co: 3, u: ['Four', 'Plat à gratin', 'Casserole'],
    base: [['Lait', 500, 'ml'], BEU(30), ['Farine', 30, 'g'], ['Comté', 120, 'g'], ['Œuf', 3, 'pcs'], ['Quinoa', 160, 'g']],
    vars: [
      { t: 'courgettes', i: [['Courgette', 4, 'pcs']], x: 'les courgettes en rondelles, poêlées 5 min pour qu’elles rendent leur eau' },
      { t: 'poireaux', i: [['Poireau', 5, 'pcs']], x: 'les poireaux émincés, fondus 10 min' },
      { t: 'épinards', i: [['Épinards frais', 600, 'g']], x: 'les épinards tombés 2 min et bien pressés' },
      { t: 'brocoli', i: [['Brocoli', 700, 'g']], x: 'le brocoli en bouquets, cuit 5 min à l’eau salée' },
      { t: 'butternut', i: [['Courge butternut', 900, 'g']], x: 'la butternut en fines tranches, précuite 8 min à la vapeur' },
      { t: 'blettes', i: [['Blette', 700, 'g']], x: 'les côtes de blettes en tronçons cuites 8 min, et les feuilles émincées' },
      { t: 'endives', i: [['Endive', 6, 'pcs']], x: 'les endives coupées en deux, braisées 15 min à couvert' },
      { t: 'potiron', i: [['Potiron', 900, 'g']], x: 'le potiron en cubes, précuit 10 min à la vapeur' },
      { t: 'fenouil', i: [['Fenouil', 4, 'pcs']], x: 'le fenouil en lamelles, précuit 8 min' },
      { t: 'chou-fleur et brocoli', i: [['Chou-fleur', 0.5, 'pcs'], ['Brocoli', 400, 'g']], x: 'le chou-fleur et le brocoli en bouquets, cuits 6 min' },
    ],
    e: v => ['Préchauffez le four à 200 °C.', `Préparez ${v.x}, et disposez-les dans le plat.`, 'Préparez une béchamel : faites fondre le beurre, ajoutez la farine, puis le lait en fouettant jusqu’à épaississement. Hors du feu, ajoutez les œufs battus et la moitié du comté râpé.',
      'Nappez les légumes, parsemez du reste de comté et enfournez 25 min.', 'Faites cuire le quinoa 12 min dans 2 fois son volume d’eau salée et servez avec le gratin.'] },
  { titre: v => `Buddha bowl ${v.t}`, type: 'plat', c: 'Bowls', pr: 25, cu: 80, co: 2, u: ['Four', 'Casserole'],
    base: [['Pois chiches secs', 200, 'g'], ['Quinoa', 200, 'g'], ['Tahini', 3, 'cas'], CIT, ['Huile d’olive', 3, 'cas'], ['Cumin', 1, 'cac'], ['Œuf', 4, 'pcs']],
    vars: [
      { t: 'patate douce et chou kale', i: [['Patate douce', 2, 'pcs'], ['Chou kale', 150, 'g']], x: 'la patate douce en cubes rôtie 25 min, le chou kale massé à l’huile' },
      { t: 'betterave et avocat', i: [['Betterave cuite', 2, 'pcs'], ['Avocat', 2, 'pcs']], x: 'la betterave en dés et l’avocat en tranches' },
      { t: 'butternut et épinards', i: [['Courge butternut', 600, 'g'], ['Épinards frais', 150, 'g']], x: 'la butternut rôtie 25 min et les jeunes pousses d’épinards' },
      { t: 'brocoli et carottes rôties', i: [['Brocoli', 400, 'g'], ['Carotte', 3, 'pcs']], x: 'le brocoli et les carottes rôtis 20 min' },
      { t: 'chou rouge et mangue', i: [['Chou rouge', 250, 'g'], ['Mangue', 1, 'pcs']], x: 'le chou rouge émincé et la mangue en dés' },
      { t: 'aubergine et tomates cerises', i: [['Aubergine', 2, 'pcs'], ['Tomates cerises', 250, 'g']], x: 'l’aubergine en cubes rôtie 25 min et les tomates cerises' },
      { t: 'chou-fleur rôti au curcuma', i: [['Chou-fleur', 1, 'pcs'], ['Curcuma', 1, 'cac']], x: 'le chou-fleur en bouquets rôti 25 min avec le curcuma' },
      { t: 'courgettes et radis', i: [['Courgette', 2, 'pcs'], ['Radis', 150, 'g']], x: 'les courgettes grillées à la poêle et les radis en rondelles' },
      { t: 'fenouil et orange', i: [['Fenouil', 2, 'pcs'], ['Orange', 2, 'pcs']], x: 'le fenouil rôti 20 min et les suprêmes d’orange' },
      { t: 'asperges et petits pois', i: [['Asperge verte', 300, 'g'], ['Petits pois frais', 200, 'g']], x: 'les asperges et les petits pois cuits 5 min' },
    ],
    e: v => ['La veille, faites tremper les pois chiches, puis faites-les cuire 1 h 15 à l’eau. Égouttez-les et faites-les rôtir 20 min à 200 °C avec l’huile et le cumin.', 'Faites cuire le quinoa 12 min dans 2 fois son volume d’eau salée.',
      `Préparez ${v.x}.`, 'Faites cuire les œufs 7 min, écalez-les et coupez-les en deux.', 'Fouettez le tahini avec le jus du citron et un peu d’eau pour la sauce.', 'Composez les bols et nappez de sauce.'] },
  { titre: v => `Curry de légumes ${v.t} aux lentilles corail`, type: 'plat', c: 'Indienne', pr: 15, cu: 30, co: 3, u: ['Cocotte'],
    base: [['Lentilles corail', 200, 'g'], ['Lait de coco', 400, 'ml'], OI, AIL, GING, ['Curry en poudre', 2, 'cac'], TOM(3), CORI, riz('Riz basmati', 250)],
    vars: [
      { t: 'au chou-fleur', i: [['Chou-fleur', 1, 'pcs']], x: 'le chou-fleur en petits bouquets' },
      { t: 'à la butternut', i: [['Courge butternut', 700, 'g']], x: 'la butternut en cubes' },
      { t: 'aux épinards', i: [['Épinards frais', 400, 'g']], x: 'les épinards (en fin de cuisson)' },
      { t: 'à la patate douce', i: [['Patate douce', 2, 'pcs']], x: 'les patates douces en cubes' },
      { t: 'aux aubergines', i: [['Aubergine', 2, 'pcs']], x: 'les aubergines en cubes' },
      { t: 'aux haricots verts', i: [['Haricots verts', 400, 'g']], x: 'les haricots verts en tronçons' },
      { t: 'aux courgettes', i: [['Courgette', 3, 'pcs']], x: 'les courgettes en demi-rondelles' },
      { t: 'aux petits pois et carottes', i: [['Petits pois frais', 250, 'g'], ['Carotte', 3, 'pcs']], x: 'les carottes en rondelles et les petits pois' },
    ],
    e: v => ['Faites revenir l’oignon, l’ail et le gingembre 5 min, ajoutez le curry et remuez 1 min.', 'Ajoutez les tomates concassées, les lentilles rincées, le lait de coco et 40 cl d’eau.',
      `Ajoutez ${v.x} et laissez mijoter 20 min en remuant de temps en temps.`, cuitRiz, 'Parsemez de coriandre et servez avec le riz.'] },
  { titre: v => `Mousse au chocolat ${v.t}`, type: 'dessert', c: 'Française', pr: 20, cu: 5, co: 2, u: ['Fouet', 'Verrines'],
    base: [['Chocolat noir pâtissier', 200, 'g'], ['Œuf', 6, 'pcs'], ['Sucre', 20, 'g']],
    vars: [
      { t: 'noir intense', i: [], x: 'une pincée de sel' },
      { t: 'à l’orange', i: [['Orange', 1, 'pcs']], x: 'le zeste de l’orange' },
      { t: 'au café', i: [['Café soluble', 1, 'cas']], x: 'le café dissous dans une cuillère d’eau chaude' },
      { t: 'à la fleur de sel et aux noisettes', i: [['Noisettes', 40, 'g']], x: 'une pincée de fleur de sel (les noisettes concassées seront ajoutées au service)' },
      { t: 'à la cardamome', i: [['Cardamome', 1, 'cac']], x: 'la cardamome moulue' },
    ],
    e: v => ['Faites fondre le chocolat au bain-marie.', `Hors du feu, ajoutez les jaunes d’œufs un à un et ${v.x}.`, 'Montez les blancs en neige ferme en ajoutant le sucre à la fin.',
      'Incorporez délicatement les blancs au chocolat en trois fois, sans les casser.', 'Répartissez en verrines et réservez au moins 3 h au frais.'] },
  { titre: v => `Pommes au four ${v.t}`, type: 'dessert', c: 'Française', pr: 10, cu: 35, co: 2, u: ['Four', 'Plat à four'],
    base: [['Pomme', 4, 'pcs'], BEU(20), ['Miel', 2, 'cas']],
    vars: [
      { t: 'à la cannelle', i: [['Cannelle', 1, 'cac']], x: 'la cannelle et une noisette de beurre' },
      { t: 'aux amandes et raisins', i: [['Amandes', 40, 'g'], ['Raisins secs', 40, 'g']], x: 'les amandes concassées et les raisins' },
      { t: 'aux noix et au miel', i: [['Noix', 40, 'g']], x: 'les noix concassées et le miel' },
      { t: 'aux dattes et à l’orange', i: [['Datte', 6, 'pcs'], ['Orange', 1, 'pcs']], x: 'les dattes hachées et le zeste d’orange' },
      { t: 'au crumble d’avoine', i: [['Flocons d’avoine', 50, 'g'], ['Sucre', 20, 'g']], x: 'un crumble d’avoine, de beurre et de sucre' },
    ],
    e: v => ['Préchauffez le four à 180 °C.', 'Évidez les pommes avec un vide-pomme sans les percer jusqu’au fond.', `Garnissez-les avec ${v.x}, arrosez de miel.`, 'Enfournez 30 à 35 min, jusqu’à ce qu’elles soient fondantes. Servez tiède avec le jus de cuisson.'] },
  { titre: v => `Far breton ${v.t}`, type: 'dessert', c: 'Française', pr: 15, cu: 45, co: 3, u: ['Four', 'Plat à gratin'],
    base: [['Farine', 125, 'g'], ['Sucre', 100, 'g'], ['Œuf', 4, 'pcs'], ['Lait', 750, 'ml'], BEU(30)],
    vars: [
      { t: 'aux pruneaux', i: [['Pruneaux', 200, 'g']], x: 'les pruneaux dénoyautés' },
      { t: 'aux pommes', i: [['Pomme', 3, 'pcs']], x: 'les pommes en dés, poêlées 5 min' },
      { t: 'aux raisins secs', i: [['Raisins secs', 100, 'g']], x: 'les raisins secs gonflés 10 min dans l’eau tiède' },
      { t: 'aux abricots', i: [['Abricot', 400, 'g']], x: 'les abricots en quartiers' },
    ],
    e: v => ['Préchauffez le four à 200 °C et beurrez le plat.', 'Fouettez la farine, le sucre et les œufs, puis versez le lait petit à petit pour obtenir une pâte fluide et lisse.', `Répartissez ${v.x} dans le plat et versez la pâte.`,
      'Enfournez 10 min à 200 °C, puis 35 min à 180 °C.', 'Laissez refroidir avant de couper.'] },
];

/** Protéines supplémentaires par plat (clé : titre avec sa première protéine). */
const EXTRA: Record<string, string[]> = {
 "Bœuf bourguignon": [
  "veau",
  "canard"
 ],
 "Ratatouille": [
  "dorade",
  "crevettes",
  "dinde",
  "hache"
 ],
 "Tian provençal": [
  "cabillaud",
  "crevettes",
  "oeufs"
 ],
 "Hachis parmentier": [
  "colin",
  "truite"
 ],
 "Pot-au-feu de bœuf": [
  "porc"
 ],
 "Navarin printanier d’agneau": [
  "dinde",
  "cuisses",
  "lentilles"
 ],
 "Gratin dauphinois au poulet": [
  "truite",
  "cabillaud",
  "canard",
  "boeuf"
 ],
 "Papillote de cabillaud aux petits légumes": [
  "truite",
  "sole",
  "stjacques",
  "gambas",
  "dinde"
 ],
 "Gratin de chou-fleur": [
  "saumon",
  "dinde",
  "pois-chiches"
 ],
 "Poulet basquaise": [
  "crevettes",
  "veau",
  "pois-chiches"
 ],
 "Cassolette de saumon aux poireaux": [
  "truite",
  "colin",
  "gambas",
  "dinde"
 ],
 "Spaghetti bolognaise maison": [
  "gambas",
  "dinde",
  "saumon"
 ],
 "Risotto aux champignons": [
  "dinde",
  "gambas",
  "veau"
 ],
 "Risotto aux asperges et petits pois": [
  "stjacques",
  "gambas",
  "truite"
 ],
 "Lasagnes maison de bœuf haché": [
  "dinde",
  "cabillaud"
 ],
 "Penne alla norma": [
  "dinde",
  "calamars",
  "cabillaud"
 ],
 "Minestrone": [
  "dinde",
  "crevettes",
  "cabillaud"
 ],
 "Piccata de dinde au citron": [
  "sole",
  "truite"
 ],
 "Orzotto au potiron": [
  "crevettes",
  "dinde",
  "stjacques"
 ],
 "Paella au poulet": [
  "cabillaud",
  "dinde",
  "stjacques"
 ],
 "Tortilla española": [
  "cabillaud",
  "dinde"
 ],
 "Cataplana de moules à la portugaise": [
  "gambas",
  "dorade",
  "poulet"
 ],
 "Souvlaki de poulet, tzatziki et salade grecque": [
  "boeuf",
  "filet-mignon",
  "saumon",
  "gambas"
 ],
 "Stifado de bœuf": [
  "veau",
  "dinde"
 ],
 "Fattoush au poulet": [
  "saumon",
  "dinde",
  "gambas"
 ],
 "Mujaddara aux lentilles": [
  "saumon",
  "dinde"
 ],
 "Tajine de cuisses de poulet aux citrons et olives": [
  "veau",
  "dorade",
  "lentilles"
 ],
 "Tajine d’agneau aux pruneaux et amandes": [
  "porc",
  "dinde"
 ],
 "Couscous aux sept légumes et à l’agneau": [
  "dinde",
  "boeuf-braise",
  "veau"
 ],
 "Chakchouka d’œufs": [
  "dinde",
  "cabillaud"
 ],
 "Chorba à l’agneau": [
  "dinde",
  "boeuf-braise",
  "corail"
 ],
 "Mafé de cuisses de poulet": [
  "dinde",
  "porc",
  "crevettes"
 ],
 "Yassa de cuisses de poulet": [
  "dinde",
  "cabillaud",
  "crevettes"
 ],
 "Wot de lentilles corail au berbéré": [
  "agneau",
  "poulet",
  "lentilles"
 ],
 "Curry de poulet korma aux amandes": [
  "cabillaud",
  "cuisses",
  "veau"
 ],
 "Curry de poulet au lait de coco et épinards": [
  "dinde",
  "gambas",
  "dorade",
  "corail",
  "lentilles"
 ],
 "Biryani de poulet": [
  "dinde",
  "cabillaud",
  "gambas"
 ],
 "Tikka de poulet grillé, raïta au concombre": [
  "cabillaud",
  "filet-mignon",
  "gambas"
 ],
 "Pad thaï aux crevettes": [
  "dinde",
  "gambas",
  "porc"
 ],
 "Tom kha au poulet": [
  "dinde",
  "gambas",
  "stjacques",
  "dorade"
 ],
 "Larb de poulet aux herbes": [
  "canard",
  "calamars"
 ],
 "Curry massaman de bœuf maison": [
  "porc",
  "dinde",
  "crevettes"
 ],
 "Phở de bœuf au bouillon maison": [
  "dinde"
 ],
 "Bò bún de bœuf": [
  "gambas",
  "filet-mignon",
  "saumon"
 ],
 "Wok de bœuf au gingembre et brocoli": [
  "gambas",
  "stjacques",
  "saumon",
  "porc"
 ],
 "Riz cantonais aux crevettes": [
  "dinde",
  "gambas",
  "canard"
 ],
 "Bibimbap au bœuf": [
  "saumon",
  "dinde",
  "filet-mignon"
 ],
 "Poke bowl au saumon": [
  "truite",
  "gambas",
  "dinde"
 ],
 "Yakitori de poulet, riz et légumes croquants": [
  "dinde",
  "canard",
  "gambas"
 ],
 "Chili con carne maison": [
  "pois-chiches",
  "poulet",
  "porc"
 ],
 "Fajitas de poulet maison": [
  "filet-mignon",
  "gambas",
  "saumon",
  "cabillaud"
 ],
 "Ceviche de dorade à la mangue": [
  "cabillaud",
  "truite",
  "colin"
 ],
 "Arroz con pollo": [
  "porc",
  "gambas",
  "calamars"
 ],
 "Moqueca au cabillaud": [
  "gambas",
  "saumon",
  "stjacques",
  "poulet"
 ],
 "Salade niçoise": [
  "truite",
  "cabillaud",
  "sardines"
 ],
 "Salade César au poulet": [
  "gambas",
  "canard",
  "filet-mignon"
 ],
 "Salade tiède de lentilles au saumon": [
  "truite",
  "sardines",
  "dinde",
  "crevettes"
 ],
 "Taboulé aux herbes au poulet": [
  "saumon",
  "dinde",
  "gambas"
 ],
 "Soupe de poissons façon bouillabaisse au cabillaud": [
  "sole",
  "stjacques",
  "crevettes",
  "calamars"
 ],
 "Velouté de potiron au lait de coco": [
  "poulet",
  "gambas",
  "saumon"
 ],
 "Soupe de pois cassés": [
  "dinde"
 ],
 "Harira à l’agneau": [
  "dinde",
  "boeuf-braise",
  "corail"
 ],
 "Légumes racines rôtis aux cuisses de poulet": [
  "poulet",
  "dinde",
  "truite",
  "maquereau",
  "lentilles",
  "filet-mignon"
 ],
 "Quiche maison aux poireaux": [
  "dinde",
  "stjacques",
  "truite",
  "cabillaud"
 ],
 "Crumble salé de légumes": [
  "dinde",
  "crevettes",
  "pois-chiches"
 ],
 "Fricassée de poulet à la moutarde": [
  "saumon",
  "cabillaud",
  "lentilles"
 ],
 "Mijoté de poulet vallée d’Auge": [
  "veau",
  "saumon"
 ],
 "Daube de bœuf provençale": [
  "veau",
  "calamars"
 ],
 "Marengo de veau": [
  "porc",
  "crevettes"
 ],
 "Sole meunière, pommes vapeur": [
  "stjacques",
  "maquereau",
  "sardines"
 ],
 "Brandade de cabillaud maison": [
  "truite",
  "dorade"
 ],
 "Grand aïoli au cabillaud": [
  "dorade",
  "saumon",
  "dinde",
  "pois-chiches"
 ],
 "Soupe au pistou": [
  "dinde",
  "lentilles",
  "crevettes"
 ],
 "Garbure au canard": [
  "dinde",
  "agneau"
 ],
 "Osso buco à la milanaise": [
  "agneau",
  "dinde"
 ],
 "Cacciatore de cuisses de poulet": [
  "veau",
  "agneau",
  "calamars"
 ],
 "Polpette de bœuf haché à la sauce tomate": [
  "porc",
  "veau",
  "saumon"
 ],
 "Pâtes primavera": [
  "dinde",
  "gambas",
  "stjacques",
  "truite"
 ],
 "Spaghetti aglio, olio e peperoncino": [
  "poulet",
  "stjacques",
  "saumon"
 ],
 "Gnocchis maison à la sauce tomate": [
  "dinde",
  "saumon",
  "calamars"
 ],
 "Caponata": [
  "dinde",
  "crevettes",
  "saumon"
 ],
 "Gambas al ajillo, riz safrané": [
  "stjacques",
  "cabillaud",
  "filet-mignon"
 ],
 "Albóndigas de bœuf haché en sauce": [
  "veau",
  "agneau",
  "saumon"
 ],
 "Pisto manchego": [
  "crevettes",
  "dinde",
  "pois-chiches",
  "saumon"
 ],
 "Shawarma de poulet maison, sauce tahini": [
  "filet-mignon",
  "crevettes",
  "cuisses",
  "saumon"
 ],
 "Shish taouk de poulet": [
  "saumon",
  "gambas",
  "cabillaud"
 ],
 "Mercimek çorbası (soupe de lentilles corail)": [
  "dinde",
  "saumon",
  "cabillaud"
 ],
 "Tajine kefta de bœuf haché aux œufs": [
  "veau",
  "porc"
 ],
 "Chermoula de dorade au four": [
  "gambas",
  "calamars",
  "cuisses",
  "dinde",
  "truite"
 ],
 "Colombo de cuisses de poulet": [
  "dinde",
  "agneau",
  "gambas",
  "dorade",
  "lentilles"
 ],
 "Rougail de crevettes aux tomates": [
  "gambas",
  "dinde",
  "dorade",
  "calamars"
 ],
 "Thiéboudienne de dorade": [
  "maquereau",
  "dinde",
  "cuisses"
 ],
 "Gombo de crevettes mijoté": [
  "dinde",
  "gambas",
  "agneau"
 ],
 "Butter chicken maison": [
  "gambas",
  "cabillaud",
  "lentilles"
 ],
 "Aloo gobi": [
  "dinde",
  "crevettes",
  "lentilles"
 ],
 "Vindaloo de porc": [
  "boeuf-braise",
  "dinde",
  "crevettes"
 ],
 "Rogan josh d’agneau": [
  "porc",
  "dinde",
  "pois-chiches"
 ],
 "Curry de cabillaud du Kerala": [
  "gambas",
  "saumon",
  "sole",
  "stjacques"
 ],
 "Khichdi aux lentilles corail": [
  "crevettes",
  "dinde"
 ],
 "Teriyaki de poulet maison, riz et brocoli": [
  "truite",
  "gambas",
  "stjacques",
  "crevettes"
 ],
 "Bulgogi de bœuf": [
  "porc",
  "calamars",
  "crevettes"
 ],
 "Japchae au bœuf": [
  "filet-mignon",
  "dinde",
  "gambas"
 ],
 "Nasi goreng au poulet": [
  "dinde",
  "gambas",
  "boeuf"
 ],
 "Satay de poulet, sauce cacahuète maison": [
  "filet-mignon",
  "gambas",
  "saumon"
 ],
 "Rendang de bœuf": [
  "porc",
  "veau"
 ],
 "Adobo de cuisses de poulet": [
  "dinde",
  "veau",
  "crevettes"
 ],
 "Poulet kung pao": [
  "boeuf",
  "gambas",
  "calamars"
 ],
 "Porc au caramel à la vietnamienne": [
  "dinde",
  "gambas",
  "cabillaud",
  "boeuf-braise"
 ],
 "Okonomiyaki de crevettes": [
  "gambas",
  "dinde",
  "saumon"
 ],
 "Donburi de poulet": [
  "dinde",
  "crevettes",
  "filet-mignon"
 ],
 "Soupe miso complète": [
  "poulet",
  "dinde",
  "cabillaud"
 ],
 "Laksa aux crevettes au lait de coco": [
  "gambas",
  "stjacques",
  "dinde",
  "pois-chiches"
 ],
 "Jambalaya aux crevettes": [
  "gambas"
 ],
 "Gumbo aux crevettes": [
  "gambas",
  "dinde"
 ],
 "Effiloché de porc façon pulled pork": [
  "agneau"
 ],
 "Burrito bowl au poulet": [
  "filet-mignon",
  "saumon",
  "pois-chiches"
 ],
 "Enchiladas de poulet maison": [
  "crevettes",
  "saumon",
  "boeuf"
 ],
 "Lomo saltado": [
  "dinde",
  "gambas",
  "canard"
 ],
 "Ají de poulet crémeux à la péruvienne": [
  "gambas",
  "cabillaud"
 ],
 "Chowder de cabillaud": [
  "gambas",
  "stjacques",
  "truite",
  "poulet"
 ],
 "Shepherd’s pie": [
  "poulet",
  "veau",
  "porc"
 ]
};

// ─── Génération ─────────────────────────────────────────────────────────────

const maj = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
function fusion(...listes: L[][]): L[] {
  const out: L[] = [];
  for (const l of listes.flat()) {
    const i = out.findIndex(o => o[0] === l[0]);
    if (i < 0) out.push([...l] as L);
    else if (out[i][2] === l[2]) out[i][1] += l[1];
  }
  return out;
}

export function genererClassiques(): RecetteSaisie[] {
  const out: RecetteSaisie[] = [];
  const titres = new Set<string>();
  const utilisees = new Set<string>();
  const pousser = (r: RecetteSaisie) => {
    const t = maj(r.titre.replace(/\s+/g, ' ').trim());
    if (titres.has(t.toLowerCase())) return;
    const interdit = r.ingredients.find(([n]) => INTERDITS.test(n));
    if (interdit) throw new Error(`Produit transformé dans « ${t} » : ${interdit[0]}`);
    titres.add(t.toLowerCase());
    out.push({ ...r, titre: t, etapes: r.etapes.map(e => e.replace(/\s+/g, ' ').trim()).filter(Boolean) });
  };

  for (const d of [...PLATS, ...PLATS2]) {
    const cle = maj(d.n(PR[d.p[0]]));
    utilisees.add(cle);
    const prots = [...new Set([...d.p, ...(EXTRA[cle] ?? [])])].map(k => PR[k]).filter(Boolean);
    for (const p of prots) {
      pousser({ titre: d.n(p), type: d.t ?? 'plat', cuisine: d.c, prep: d.pr, cuisson: d.cu(p), difficulte: d.d ?? 'facile', portions: 4, conservation: d.co,
        ustensiles: d.u, ingredients: fusion(p.ings, d.i), etapes: d.e(p) });
    }
    for (const tw of d.tw ?? []) {
      const p = prots[0];
      const e = d.e(p);
      pousser({ titre: `${d.n(p)} ${tw.s}`, type: d.t ?? 'plat', cuisine: d.c, prep: d.pr + 5, cuisson: d.cu(p), difficulte: d.d ?? 'facile', portions: 4, conservation: d.co,
        ustensiles: d.u, ingredients: fusion(p.ings, d.i, tw.i), etapes: [...e.slice(0, -1), tw.e, e[e.length - 1]] });
    }
  }
  for (const f of [...FAMILLES, ...FAMILLES2, ...FAMILLES3]) {
    for (const v of f.vars) {
      pousser({ titre: f.titre(v), type: f.type, cuisine: f.c, prep: f.pr, cuisson: f.cu, difficulte: f.d ?? 'facile', portions: 4, conservation: f.co,
        ustensiles: f.u, ingredients: fusion(f.base, v.i), etapes: f.e(v) });
    }
  }
  const orphelines = Object.keys(EXTRA).filter(k => !utilisees.has(k));
  if (orphelines.length) throw new Error(`EXTRA sans plat : ${orphelines.join(' | ')}`);
  return out;
}

/** Recettes sans viande ni poisson (seuil protéines plus bas). */
export const estVegeClassique = (r: RecetteSaisie) =>
  !r.ingredients.some(([n]) => Object.values(PR).some(p => !['legume', 'poischiche', 'oeuf', 'nature'].includes(p.kind) && p.ings.some(i => i[0] === n)));
