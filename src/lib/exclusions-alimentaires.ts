// ============================================================================
// Allergies, intolérances et aliments détestés — catalogue de l'onboarding
//
// Chaque choix est une FAMILLE d'aliments décrite par des mots-clés, résolue
// en identifiants d'ingrédients réels au moment de l'enregistrement
// (`resoudreExclusions`). Auparavant l'onboarding stockait des id en dur
// (1 à 17) qui ne correspondaient pas au catalogue : « Arachides » excluait
// le poulet entier, « Lactose » les herbes de Provence…
//
// Mots-clés comparés au nom NORMALISÉ (minuscules, sans accents, œ → oe),
// `sauf` retire les faux positifs (lait de coco pour le lait, etc.).
// ============================================================================

import { normaliserNom } from '@/lib/regimes';

export interface FamilleAliments {
  code: string;
  nom: string;
  emoji: string;
  motifs: string[];
  sauf?: string[];
}

export interface GroupeFamilles {
  titre: string;
  familles: FamilleAliments[];
}

const GLUTEN: FamilleAliments = {
  code: 'gluten', nom: 'Gluten', emoji: '🌾',
  motifs: ['ble', 'farine', 'pain', 'pains', 'pates', 'spaghetti', 'tagliatelle', 'macaroni', 'lasagne', 'gnocchi',
    'semoule', 'boulgour', 'couscous', 'seigle', 'orge', 'epeautre', 'chapelure', 'biscotte', 'biscuit',
    'speculoos', 'pate feuilletee', 'pate brisee', 'pate filo', 'feuilles de brick', 'crozets',
    'nouilles chinoises', 'nouilles soba', 'seitan', 'granola', 'flocons d’avoine', 'flocons d\'avoine',
    'sauce soja', 'nuggets', 'sauce worcestershire'],
  sauf: ['farine de pois chiches', 'farine de manioc', 'pain de riz', 'sarrasin', 'tortilla de mais',
    'tortillas de mais', 'nouilles de riz', 'injera'],
};

const LAIT: FamilleAliments = {
  code: 'lait', nom: 'Lait & lactose', emoji: '🥛',
  motifs: ['lait', 'creme', 'beurre', 'yaourt', 'fromage', 'parmesan', 'mozzarella', 'emmental', 'gruyere',
    'comte', 'brie', 'camembert', 'reblochon', 'cheddar', 'feta', 'halloumi', 'labneh', 'skyr', 'mascarpone',
    'ricotta', 'chevre', 'chantilly', 'glace vanille', 'pate a tartiner'],
  sauf: ['lait de coco', 'lait de soja', 'lait d’amande', 'lait d\'amande', 'lait d’avoine',
    'lait d\'avoine', 'creme vegetale', 'beurre de cacahuete', 'arachide beurre'],
};

export const GROUPES_ALLERGIES: GroupeFamilles[] = [
  {
    titre: 'Allergènes majeurs',
    familles: [
      GLUTEN,
      LAIT,
      { code: 'oeufs', nom: 'Œufs', emoji: '🥚', motifs: ['oeuf', 'jaune d', 'mayonnaise', 'biscuits a la cuillere'] },
      { code: 'arachides', nom: 'Arachides', emoji: '🥜', motifs: ['cacahuete', 'arachide'] },
      {
        code: 'fruits_coque', nom: 'Fruits à coque', emoji: '🌰',
        motifs: ['noix', 'noisette', 'amande', 'cajou', 'pistache', 'pecan', 'pignons de pin', 'pesto', 'pate a tartiner'],
        sauf: ['noix de coco', 'noix de saint-jacques'],
      },
      {
        code: 'poisson', nom: 'Poisson', emoji: '🐟',
        motifs: ['saumon', 'cabillaud', 'colin', 'merlan', 'thon', 'truite', 'sole', 'bar (poisson)', 'dorade',
          'tilapia', 'sardine', 'maquereau', 'anchois', 'surimi', 'nuoc mam', 'sauce worcestershire'],
      },
      { code: 'crustaces', nom: 'Crustacés', emoji: '🦐', motifs: ['crevette', 'gambas', 'fruits de mer', 'surimi'] },
      { code: 'mollusques', nom: 'Mollusques', emoji: '🦪', motifs: ['moules', 'calamar', 'poulpe', 'saint-jacques', 'encornet', 'fruits de mer'] },
      {
        code: 'soja', nom: 'Soja', emoji: '🫘',
        motifs: ['soja', 'tofu', 'tempeh', 'edamame', 'miso'], sauf: ['pousses de soja'],
      },
      { code: 'sesame', nom: 'Sésame', emoji: '⚪', motifs: ['sesame', 'tahini', 'zaatar'] },
      { code: 'moutarde', nom: 'Moutarde', emoji: '🟡', motifs: ['moutarde'] },
      { code: 'celeri', nom: 'Céleri', emoji: '🥬', motifs: ['celeri'] },
      { code: 'sulfites', nom: 'Sulfites', emoji: '🍷', motifs: ['vin ', 'vin blanc', 'vin rouge', 'raisins secs', 'pruneau', 'vinaigre', 'cidre'] },
      { code: 'lupin', nom: 'Lupin', emoji: '🌼', motifs: ['lupin'] },
    ],
  },
  {
    titre: 'Intolérances & sensibilités',
    familles: [
      { code: 'ail_oignon', nom: 'Ail & oignon', emoji: '🧄', motifs: ['ail', 'oignon', 'echalote', 'poireau', 'ciboulette'], sauf: ['aile', 'caille'] },
      { code: 'legumineuses', nom: 'Légumineuses', emoji: '🫛', motifs: ['lentille', 'pois chiche', 'haricots rouges', 'haricots blancs', 'haricots noirs', 'pois casses', 'farine de pois chiches', 'edamame'] },
      { code: 'agrumes', nom: 'Agrumes', emoji: '🍊', motifs: ['citron', 'orange', 'pamplemousse', 'clementine'], sauf: ['citronnelle'] },
      { code: 'fruits_noyau', nom: 'Fruits à noyau & pépins (rosacées)', emoji: '🍑', motifs: ['pomme', 'poire', 'peche', 'abricot', 'cerise', 'nectarine', 'prune', 'coing'], sauf: ['pomme de terre', 'poireau', 'tomates cerises'] },
      { code: 'fruits_exotiques', nom: 'Fruits exotiques (latex)', emoji: '🥝', motifs: ['kiwi', 'banane', 'avocat', 'mangue', 'papaye', 'ananas', 'fruit de la passion'] },
      { code: 'fraise', nom: 'Fraises & fruits rouges', emoji: '🍓', motifs: ['fraise', 'framboise', 'fruits rouges', 'myrtille'] },
      { code: 'tomate', nom: 'Tomate', emoji: '🍅', motifs: ['tomate', 'ketchup', 'ratatouille', 'salsa'] },
      { code: 'mais', nom: 'Maïs', emoji: '🌽', motifs: ['mais'] },
      { code: 'epice', nom: 'Piment & épicé', emoji: '🌶️', motifs: ['piment', 'harissa', 'sriracha', 'tabasco', 'gochujang', 'pate de curry', 'berbere'], sauf: ['piment doux'] },
      { code: 'cafeine', nom: 'Caféine', emoji: '☕', motifs: ['cafe', 'the', 'cacao', 'chocolat'], sauf: ['theme'] },
      { code: 'champignons', nom: 'Champignons', emoji: '🍄', motifs: ['champignon'] },
      { code: 'alcool', nom: 'Alcool (cuisson comprise)', emoji: '🚫', motifs: ['vin ', 'vin blanc', 'vin rouge', 'biere', 'rhum', 'mirin', 'cidre'], sauf: ['vinaigre'] },
    ],
  },
];

export const DETESTES: FamilleAliments[] = [
  { code: 'champignons', nom: 'Champignons', emoji: '🍄', motifs: ['champignon'] },
  { code: 'chou_fleur', nom: 'Chou-fleur', emoji: '🥦', motifs: ['chou-fleur'] },
  { code: 'brocoli', nom: 'Brocoli', emoji: '🥦', motifs: ['brocoli'] },
  { code: 'choux', nom: 'Choux (blanc, rouge, kale…)', emoji: '🥬', motifs: ['chou blanc', 'chou rouge', 'chou kale', 'chou chinois', 'pak choi'] },
  { code: 'choux_bruxelles', nom: 'Choux de Bruxelles', emoji: '🥬', motifs: ['chou de bruxelles'] },
  { code: 'epinards', nom: 'Épinards', emoji: '🍃', motifs: ['epinard'] },
  { code: 'poivrons', nom: 'Poivrons', emoji: '🫑', motifs: ['poivron'] },
  { code: 'aubergine', nom: 'Aubergine', emoji: '🍆', motifs: ['aubergine'] },
  { code: 'courgette', nom: 'Courgette', emoji: '🥒', motifs: ['courgette'] },
  { code: 'betterave', nom: 'Betterave', emoji: '🟣', motifs: ['betterave'] },
  { code: 'fenouil', nom: 'Fenouil', emoji: '🌿', motifs: ['fenouil'] },
  { code: 'celeri', nom: 'Céleri', emoji: '🥬', motifs: ['celeri'] },
  { code: 'poireau', nom: 'Poireau', emoji: '🥬', motifs: ['poireau'] },
  { code: 'navet', nom: 'Navet & radis', emoji: '🥕', motifs: ['navet', 'radis', 'rutabaga'] },
  { code: 'endive', nom: 'Endive', emoji: '🥬', motifs: ['endive'] },
  { code: 'petits_pois', nom: 'Petits pois', emoji: '🟢', motifs: ['petits pois', 'petit pois'] },
  { code: 'olives', nom: 'Olives', emoji: '🫒', motifs: ['olive'], sauf: ['huile d’olive', 'huile d\'olive'] },
  { code: 'coriandre', nom: 'Coriandre', emoji: '🌿', motifs: ['coriandre'] },
  { code: 'menthe_aneth', nom: 'Menthe & aneth', emoji: '🌱', motifs: ['menthe', 'aneth'] },
  { code: 'cumin', nom: 'Cumin & épices fortes', emoji: '🧂', motifs: ['cumin', 'ras-el-hanout', 'garam masala', 'curry'] },
  { code: 'gingembre', nom: 'Gingembre', emoji: '🫚', motifs: ['gingembre'] },
  { code: 'avocat', nom: 'Avocat', emoji: '🥑', motifs: ['avocat'] },
  { code: 'concombre', nom: 'Concombre', emoji: '🥒', motifs: ['concombre'] },
  { code: 'coco', nom: 'Noix de coco', emoji: '🥥', motifs: ['coco'] },
  { code: 'raisins_secs', nom: 'Raisins secs & pruneaux', emoji: '🍇', motifs: ['raisins secs', 'pruneau', 'datte'] },
  { code: 'abats', nom: 'Abats & boudin', emoji: '🫀', motifs: ['foie', 'boudin'] },
  { code: 'agneau', nom: 'Agneau', emoji: '🐑', motifs: ['agneau'] },
  { code: 'canard', nom: 'Canard', emoji: '🦆', motifs: ['canard'] },
  { code: 'poissons_gras', nom: 'Poissons gras (sardine, maquereau…)', emoji: '🐟', motifs: ['sardine', 'maquereau', 'anchois'] },
  { code: 'fruits_mer', nom: 'Fruits de mer', emoji: '🦐', motifs: ['crevette', 'gambas', 'moules', 'calamar', 'poulpe', 'saint-jacques', 'fruits de mer'] },
  { code: 'tofu', nom: 'Tofu & tempeh', emoji: '🧈', motifs: ['tofu', 'tempeh', 'seitan'] },
  { code: 'fromages_forts', nom: 'Fromages forts (chèvre, bleu…)', emoji: '🧀', motifs: ['chevre', 'reblochon', 'roquefort', 'camembert'] },
];

export const TOUTES_ALLERGIES: FamilleAliments[] = GROUPES_ALLERGIES.flatMap(g => g.familles);

/** L'ingrédient appartient-il à la famille ? */
export function correspond(nom: string, famille: FamilleAliments): boolean {
  const n = normaliserNom(nom);
  if (famille.sauf?.some(s => n.includes(s))) return false;
  // Mots courts (ail, the, ble…) : on exige un mot entier pour éviter
  // « ail » dans « aile », « the » dans « thym », « ble » dans « comestible ».
  return famille.motifs.some(m => (m.length <= 4 ? new RegExp(`(^|[^a-z])${m}([^a-z]|$)`).test(n) : n.includes(m)));
}

/** Résout des codes de familles en identifiants d'ingrédients du catalogue. */
export function resoudreExclusions(
  codes: string[],
  familles: FamilleAliments[],
  ingredients: { id: number; nom: string }[]
): number[] {
  const choisies = familles.filter(f => codes.includes(f.code));
  if (choisies.length === 0) return [];
  const ids = new Set<number>();
  for (const ing of ingredients) {
    if (choisies.some(f => correspond(ing.nom, f))) ids.add(ing.id);
  }
  return [...ids];
}
