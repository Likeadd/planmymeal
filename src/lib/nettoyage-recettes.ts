// ============================================================================
// Nettoyage du catalogue de recettes — fonctions PURES (testées dans
// tests/nettoyage-recettes.test.ts), appliquées par scripts/nettoyer-recettes.ts.
//
// Le catalogue a été généré par modèles de phrases : fautes d'accord dans les
// titres (« au crevettes »), mots répétés (« Cake cake »), consignes absurdes
// (« épluchez le basilic », « faites mijoter le pesto »), « 2 jour(s) »… Ces
// règles corrigent ce qui est corrigeable mécaniquement, sans rien inventer.
// ============================================================================

/** Noms féminins singuliers fréquents : « au feta » → « à la feta » */
const FEMININS = new Set([
  'feta', 'dinde', 'mozzarella', 'burrata', 'ricotta', 'crème', 'sauce', 'moutarde', 'tomate', 'courgette',
  'carotte', 'betterave', 'truite', 'sardine', 'viande', 'vanille', 'cannelle', 'menthe', 'coriandre',
  'ciboulette', 'harissa', 'citronnelle', 'banane', 'pomme', 'poire', 'mangue', 'fraise', 'framboise',
  'patate', 'semoule', 'polenta', 'purée', 'salade', 'roquette', 'mâche', 'châtaigne', 'noisette', 'noix',
  'saucisse', 'chipolata', 'volaille', 'morue', 'dorade', 'lotte', 'crevette', 'moule', 'noix de coco',
  'aubergine', 'citrouille', 'courge', 'lentille', 'figue', 'cerise', 'pêche', 'orange', 'grenade', 'papaye',
]);
/** Mots au singulier terminés par « s » (ne pas les lire comme des pluriels) */
const SINGULIERS_EN_S = new Set(['jus', 'gras', 'cassis', 'ananas', 'anis', 'radis', 'riz', 'bois', 'maïs', 'couscous', 'tapas', 'mais']);
/** Mots commençant par une voyelle (ou h muet) : élision « de » → « d' » */
const ELISION = /^(agneau|avocats?|abricots?|amandes?|artichauts?|asperges?|aubergines?|olives?|oranges?|oignons?|ail|huile|herbes|œufs?|oeufs?|épinards|emmental|endives?|échalotes?|édamames?|ananas|épices|érable)\b/i;
/** Mots à voyelle initiale : « au avocat » → « à l'avocat » */
const VOYELLE = /^[aeiouéèêœh]/i;

function motSuivant(reste: string): string {
  return (reste.match(/^[\p{L}’'-]+/u)?.[0] ?? '').toLowerCase();
}

/** Corrige un titre de recette (accords, élisions, répétitions, « & » en série, majuscule). */
export function nettoyerTitre(titre: string): string {
  let t = titre.replace(/\s+/g, ' ').trim();

  // Mots répétés consécutifs : « Cake cake », « Verrine verrine »
  t = t.replace(/\b([\p{L}]{3,})\s+\1\b/giu, '$1');

  // « au X » : pluriel → « aux », féminin → « à la », voyelle → « à l’ »
  t = t.replace(/\bau ([\p{L}’'-]+(?: de [\p{L}]+)?)/giu, (m, groupe: string) => {
    const mot = motSuivant(groupe);
    if (!mot) return m;
    if (mot.endsWith('s') && !SINGULIERS_EN_S.has(mot) && mot.length > 3) return `aux ${groupe}`;
    if (FEMININS.has(mot) || FEMININS.has(groupe.toLowerCase())) return `à la ${groupe}`;
    if (VOYELLE.test(mot) && !/^h(aricot|ari)/i.test(mot)) return `à l’${groupe}`;
    return m;
  });

  // « de agneau » → « d’agneau » (mots français uniquement : « Bolinho de arroz » reste)
  t = t.replace(/\bde ([\p{L}’'-]+)/giu, (m, mot: string) => (ELISION.test(mot) ? `d’${mot}` : m));

  // « A & B & C & D » → « A & B, C et D »
  const parties = t.split(' & ');
  if (parties.length >= 3) {
    const [a, b, ...suite] = parties;
    const dernier = suite.pop()!;
    t = `${a} & ${b}${suite.length ? ', ' + suite.join(', ') : ''} et ${dernier}`;
  }

  // Tournures générées mal accordées ou redondantes
  t = t
    .replace(/(^|\s)à la (sucre|café|chocolat|citron|beurre|caramel|miel)(?=[\s,&]|$)/gi, '$1au $2')
    .replace(/(^|\s)à la (fruits rouges|amandes|noisettes|pépites)(?=[\s,&]|$)/gi, '$1aux $2')
    .replace(/^Gaufres à la sucrées nature$/i, 'Gaufres nature')
    .replace(/^(Aubergine) rôtis\b/i, 'Aubergines rôties')
    .replace(/^(Carotte) rôtis\b/i, 'Carottes rôties')
    .replace(/^(Courge butternut|Patate douce) rôtis\b/i, '$1 rôtie')
    .replace(/^(Chou-fleur) rôtis\b/i, '$1 rôti')
    .replace(/^Soupe froide de (.+?) soupe froide d’été$/i, 'Soupe froide de $1')
    .replace(/^Soupe de (.+?) potage rustique$/i, 'Potage rustique de $1')
    .replace(/^Soupe de (.+?) velouté à la crème$/i, 'Velouté de $1 à la crème')
    .replace(/^Soupe de (.+?) soupe épicée au lait de coco$/i, 'Soupe épicée de $1 au lait de coco')
    .replace(/^Bibimbap œufs \(bibimbap\)/i, 'Bibimbap aux œufs')
    .replace(/^Bibimbap (boeuf|bœuf|poulet|tofu) /i, (_m, p: string) => `Bibimbap au ${p.toLowerCase() === 'boeuf' ? 'bœuf' : p.toLowerCase()} `)
    .replace(/^Wot misir wot/i, 'Misir wot')
    .replace(/\s*\(bte\)/gi, '')
    .replace(/cauliflower rice/gi, 'riz de chou-fleur')
    .replace(/shii-takés/gi, 'shiitakés');

  // Majuscule initiale
  return t.charAt(0).toUpperCase() + t.slice(1);
}

const A_EPLUCHER = /^(ail|oignons?|échalotes?|carottes?|pommes? de terre|patates? douces?|poires?|pommes?|courges?|courge butternut|butternut|potimarron|gingembre|navets?|betteraves?|panais|mangues?|ananas|kiwis?|bananes?|céleri-rave|topinambours?|citrons? confits?)$/i;
const HERBES = /^(basilic|persil|coriandre|menthe|ciboulette|aneth|thym|estragon|romarin|sauge|cerfeuil|citronnelle)$/i;
const NE_PAS_EGOUTTER = /tomate|concass|coulis|lait de coco|crème|bouillon|purée/i;

function listeFr(items: string[]): string {
  return items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} et ${items[items.length - 1]}`;
}
function decouper(liste: string): string[] {
  return liste.split(/,\s*|\s+et\s+/).map(s => s.trim()).filter(Boolean);
}

/** Corrige une étape (formulations générées incohérentes). */
export function nettoyerEtape(etape: string): string {
  let e = etape;

  // « Lavez puis épluchez ail et basilic et réservez-les coupés dans un saladier. »
  e = e.replace(/Lavez puis épluchez (.+?) et réservez-les coupés dans un saladier\./, (_m, liste: string) => {
    const items = decouper(liste);
    const eplucher = items.filter(i => A_EPLUCHER.test(i));
    const herbes = items.filter(i => HERBES.test(i));
    const autres = items.filter(i => !eplucher.includes(i) && !herbes.includes(i));
    const phrases: string[] = [];
    if (eplucher.length) phrases.push(`épluchez ${listeFr(eplucher)}`);
    if (autres.length) phrases.push(`lavez ${listeFr(autres)}`);
    if (herbes.length) phrases.push(`rincez et ciselez ${listeFr(herbes)}`);
    const texte = phrases.join(' ; ');
    return texte ? `${texte.charAt(0).toUpperCase()}${texte.slice(1)}, puis réservez dans un saladier.` : '';
  });

  // « Ouvrez et égouttez tomate concassée (bte) dans une passoire » : on n'égoutte pas une sauce
  e = e.replace(/Ouvrez et égouttez (.+?) dans une passoire\./, (_m, liste: string) => {
    const items = decouper(liste).filter(i => !NE_PAS_EGOUTTER.test(i));
    return items.length ? `Ouvrez et égouttez ${listeFr(items)} dans une passoire.` : '';
  });

  // Le pesto ne se cuit pas
  if (/éléments de la sauce \(pesto/i.test(e)) {
    e = 'Préparez le pesto : mixez le basilic, l’ail, les pignons, le parmesan et 4 cas d’huile d’olive. Ne le faites pas cuire : il s’ajoute hors du feu, sur les pâtes.';
  }
  // Variante air fryer « pour les tomates » quand la sauce n'est pas à la tomate
  if (/\(Variante : 12 min à 180°C à l’air fryer pour les tomates\.\)/.test(e) && !/tomate/i.test(e.split('(Variante')[0])) {
    e = e.replace(/\s*\(Variante : 12 min à 180°C à l’air fryer pour les tomates\.\)/, '');
  }

  e = e
    .replace(/(\d+) jour\(s\)/g, (_m, n: string) => `${n} jour${Number(n) > 1 ? 's' : ''}`)
    .replace(/en deux en morceaux réguliers/g, 'en morceaux réguliers')
    .replace(/râpé à la râpe/g, 'râpé')
    // « Préparez les fruits : Coupez » → minuscule après les deux-points
    .replace(/^(Préparez [^:]{2,40} : )(\p{Lu})(\p{Ll})/u, (_m, a: string, b: string, c: string) => a + b.toLowerCase() + c)
    .replace(/\s{2,}/g, ' ')
    .trim();
  return e;
}

/**
 * Nettoie la liste d'étapes : corrige chaque étape, retire les vides, et remet
 * dans l'ordre les modèles « pâtes » (émincer AVANT la sauce, ajouter les
 * crevettes APRÈS la sauce).
 */
export function nettoyerInstructions(etapes: string[]): string[] {
  const out = etapes.map(nettoyerEtape).filter(Boolean);

  const iEau = out.findIndex(s => s.startsWith('Portez un grand volume'));
  const iEmincer = out.findIndex(s => s.startsWith('Émincez l’ail (et les oignons'));
  if (iEau >= 0 && iEmincer > iEau + 1) {
    const [etape] = out.splice(iEmincer, 1);
    out.splice(iEau + 1, 0, etape);
  }
  const iFin = out.findIndex(s => /en fin de cuisson de la sauce/.test(s));
  const iSauce = out.findIndex(s => /dans une grande poêle, ajoutez les éléments de la sauce|^Préparez le pesto/.test(s));
  if (iFin >= 0 && iSauce > iFin) {
    const [etape] = out.splice(iFin, 1);
    out.splice(iSauce, 0, etape); // iSauce a reculé d'un cran : insertion juste après la sauce
  }
  return out;
}

/** Mots-clés de saison (produits frais) — premier motif gagnant, sinon « toutes » */
const SAISONS: [string, RegExp][] = [
  ['printemps', /asperge|petits? pois|fèves?|radis|rhubarbe|fraises?\b|artichaut/i],
  ['ete', /gaspacho|tomates? fraîches?|courgettes?|aubergines?|poivrons?|melon|pastèque|pêches?|abricots?|nectarine|concombre|maïs frais|ratatouille|framboises?|myrtilles?/i],
  ['automne', /potimarron|potiron|citrouille|butternut|courges?|châtaignes?|marrons?|champignons? des bois|cèpes?|girolles?|coings?|raisins?|figues?/i],
  ['hiver', /chou(x)?\b|choux|poireaux?|endives?|panais|topinambours?|navets?|céleri-rave|pot-au-feu|raclette|tartiflette|potée|mandarine|clémentine|orange sanguine|kaki/i],
];

/** Saison d'une recette d'après son titre et ses ingrédients (fruits/légumes frais). */
export function deduireSaison(titre: string, ingredients: string[]): string {
  const frais = ingredients.filter(n => !/\(bte\)|surgel|conserve|sec|séché|en poudre|jus/i.test(n));
  const texte = `${titre} ${frais.join(' ')}`;
  const trouvees = SAISONS.filter(([, re]) => re.test(texte)).map(([s]) => s);
  return trouvees.length === 1 ? trouvees[0] : 'toutes';
}

/** Nouvelle « cuisine » pour le fourre-tout « World healthy » (sert à la diversité du moteur). */
export function recategoriserCuisine(titre: string): string {
  const t = titre.toLowerCase();
  if (/^bowl|buddha|poke/.test(t)) return 'Bowls';
  if (/^salade/.test(t)) return 'Salades composées';
  if (/^coupe|verrine/.test(t)) return 'Desserts fruités';
  if (/rôti|butternut|patate douce|aubergine|chou-fleur|carotte|courges?/.test(t)) return 'Légumes rôtis';
  if (/tortilla/.test(t)) return 'Espagnole';
  if (/pita|pain de/.test(t)) return 'Méditerranéenne';
  return 'Healthy';
}

/** Ingrédients trop génériques pour décrire un plat */
const BANALS = /^(sel|poivre|eau|huile|beurre|sucre|farine|ail|oignon|échalote|bouillon|vinaigre|levure|épices|cumin|paprika|curry|curcuma|laurier|thym|persil|citron|jus de citron|sauce soja|herbes)/i;

/** Description courte et factuelle (SEO + accroche), sans rien inventer. */
export function genererDescription(r: {
  titre: string; type_repas: string; cuisine: string | null; temps: number; kcal: number | null; ingredients: string[];
}): string {
  const principaux = r.ingredients.filter(n => !BANALS.test(n)).slice(0, 3).map(n => n.replace(/\s*\(bte\)/i, '').toLowerCase());
  const type = r.type_repas === 'dessert' ? 'Un dessert' : r.type_repas === 'entree' ? 'Une entrée' : 'Un plat';
  const cuisine = r.cuisine && !/healthy|fruités|composées|rôtis|bowls/i.test(r.cuisine) ? ` d’inspiration ${r.cuisine.toLowerCase()}` : '';
  const base = principaux.length ? `${type}${cuisine} à base de ${listeFr(principaux)}` : `${type}${cuisine} simple et équilibré`;
  const kcal = r.kcal ? `, environ ${Math.round(r.kcal)} kcal par portion` : '';
  return `${base}, prêt en ${r.temps} min${kcal}.`;
}
