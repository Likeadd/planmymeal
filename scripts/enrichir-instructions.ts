// ============================================================================
// ENRICHIR INSTRUCTIONS — pas-à-pas détaillé type Marmiton, sans IA
// Usage :
//   npx tsx scripts/enrichir-instructions.ts --dry          (constat, 0 écriture)
//   npx tsx scripts/enrichir-instructions.ts                (applique)
//   npx tsx scripts/enrichir-instructions.ts --id=121       (une recette)
//   npx tsx scripts/enrichir-instructions.ts --limit=20     (les N premières)
//
// Diagnostic mesuré sur la base :
//   • 31 recettes portent des étapes TÉLÉGRAPHIQUES (infinitif « Étaler la
//     pâte », nominal « Miel + noix », durée seule « 35 min 190°C ») —
//     ce sont les desserts 100-160 du seed-catalogue ;
//   • toutes les autres (1 107) ont déjà un pas-à-pas impératif correct.
//
// Trois transformations, idempotentes :
//
// (A) DÉPLIAGE des étapes télégraphiques → phrases à l'impératif. Les verbes
//     reconnus sont une LISTE FERMÉE (jamais une regex générique : « Sucre »
//     est un nom, pas l'infinitif de « sucer »).
//
// (B) COMPLÉTION de TOUTE recette publique :
//     - « Mise en place — » : préchauffage four / air fryer (ustensiles) ;
//     - « Préparation — » : geste par rayon depuis les ingrédients réels ;
//     - « Astuce — » : conservation (conservation_jours + type_repas).
//
// (C) USTENSILE FOUR manquant : le four cité dans les étapes mais absent de
//     meals.ustensiles y est ajouté (fiche + filtres équipement).
//
// Idempotence : marqueurs en tête d'étape générée ; une étape qui commence
// déjà par un impératif connu n'est jamais retraitée. Rejouer = 0 changement.
// ============================================================================

import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ─── Options CLI ─────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const ecrire = !args.includes('--dry');
const argId = args.find(a => a.startsWith('--id='));
const argLimit = args.find(a => a.startsWith('--limit='));

// ─── Marqueurs des étapes générées ───────────────────────────────────────────
const MARQUEUR_MISE_EN_PLACE = 'Mise en place — ';
const MARQUEUR_PREPARATION = 'Préparation — ';
const MARQUEUR_ASTUCE = 'Astuce — ';

// ─── Verbes à l'infinitif vus en tête d'étape télégraphique (liste fermée) ───
const VERBES_INFINITIFS = new Set([
  'étaler', 'beurrer', 'fariner', 'mélanger', 'verser', 'cuire', 'parsemer',
  'disposer', 'réserver', 'fondre', 'sabler', 'crémer', 'émietter', 'tremper',
  'mariner', 'peler', 'enfiler', 'éplucher', 'laver', 'couper', 'alterner',
  'servir', 'frire', 'compoter', 'écraser', 'épépiner', 'dénoyauter',
  'répartir', 'ajouter', 'saupoudrer', 'napper', 'incorporer', 'réfrigérer',
  'torréfier', 'griller', 'mixer', 'assaisonner', 'saler', 'poivrer',
  'badigeonner', 'rouler', 'filmer', 'replier', 'recouvrir', 'plonger',
  'placer', 'poser', 'empiler', 'retourner', 'prélever', 'assembler',
  'garnir', 'décorer', 'dresser', 'arroser', 'tartiner', 'râper', 'ciser',
  'ciselez', 'trancher', 'émincer', 'laisser', 'mettre', 'monter', 'faire',
]);

/** Impératifs reconnus : l'étape est déjà une phrase correcte. */
const IMPERATIFS =
  'Faites|Laissez|Prenez|Mettez|Sortez|Retirez|Rincez|Couvrez|Servez|Ouvrez|' +
  'Découvrez|Éteignez|Remuez|Ajoutez|Incorporez|Versez|Mélangez|Fouettez|' +
  'Battez|Salez|Pochez|Pelez|Coupez|Émincez|Épluchez|Étalez|Égouttez|Écrasez|' +
  'Réservez|Répartissez|Réchauffez|Préchauffez|Préparez|Parsemez|Saupoudrez|' +
  'Disposez|Dressez|Placez|Enfournez|Badigeonnez|Beurrez|Farinez|Huilez|' +
  'Garnissez|Nappez|Imbibez|Trempez|Montez|Séparez|Cassez|Chauffez|' +
  'Assaisonnez|Goûtez|Ajustez|Détaillez|Découpez|Émiettez|Étendez|Filtrez|' +
  'Fondez|Lissez|Malaxez|Moulez|Piquez|Pressez|Roulez|Torréfiez|Videz|' +
  'Assemblez|Blanchissez|Déglacez|Dénoyautez|Enveloppez|Farcissez|Triez|' +
  'Vérifiez|Arrosez|Caramélisez|Concassez|Décorez|Équeutez|Frottez|Grillez|' +
  'Liez|Macérez|Marinez|Mondez|Tamisez|Prolongez|Poursuivez|Terminez|' +
  'Saisissez|Cuisez|Portez|Enrobez|Remettez|Lancez|Rendez|Rajoutez|Mixez|' +
  'Réfrigérez|Conservez|Précuisez|Tranchez|Décortiquez|Dégustez|Consommez|' +
  'Posez|Créez|Filmez|Retournez|Prélevez|Empilez|Mijotez|Râpez|Rectifiez|' +
  'Tartinez|Ciselez|Séchez|Nettoyez|Essuyez|Repliez|Reposez|Plongez|' +
  'Recouvrez|Réunissez|Formez|Compensez|Épépinez|Compotez';

/** Connecteurs : l'étape est une phrase, même sans impératif en tête. */
const CONNECTEURS =
  'Pendant|Hors|Dans|Si|Quand|Une fois|Facultatif|Option|Attention|' +
  "C'est|Ajout|Astuce|Variante|Le|La|Les|Un|Au|À|A|Sur|Pour|Avec|\\d";

const RE_DEJA_PHRASE = new RegExp(`^(?:${IMPERATIFS}|${CONNECTEURS})\\b`);

function dejaPhrase(etape: string): boolean {
  return RE_DEJA_PHRASE.test(etape.trim());
}

// ─── (A) Dépliage télégraphique ──────────────────────────────────────────────
/** Impératif 2e pers. pluriel d'un infinitif (étaler → étalez, manger → mangez). */
function imperatif(infinitif: string): string {
  const radical = infinitif.slice(0, -2);
  const e = /g$/.test(radical) ? 'e' : '';
  return `${radical}${e}ez`;
}

/** Compléments techniques par verbe. */
const COMPLEMENTS: Record<string, string> = {
  étaler: 'sur un plan légèrement fariné, en gardant une épaisseur régulière.',
  beurrer: 'généreusement le moule pour que la préparation n\'accroche pas.',
  fariner: 'le moule, puis tapotez pour retirer l\'excédent.',
  mélanger: 'jusqu\'à obtenir une préparation homogène, sans grumeaux.',
  cuire: 'à couvert pour garder l\'humidité, en remuant à mi-cuisson.',
  parsemer: 'uniformément sur toute la surface.',
  disposer: 'en une seule couche, sans chevaucher.',
  réserver: 'de côté pendant que vous préparez la suite.',
  fondre: 'au bain-marie ou au micro-ondes par tranches de 20 s, en remuant entre chaque.',
  sabler: 'du bout des doigts jusqu\'à obtenir une texture sableuse et grumeleuse.',
  crémer: 'au fouet jusqu\'à obtenir un mélange pâle et crémeux.',
  émietter: 'sur toute la surface en grosses miettes, sans tasser.',
  tremper: 'rapidement (1-2 s par biscuit) : trop imbibé, il s\'effondre.',
  mariner: 'au réfrigérateur, à couvert, en remuant à mi-parcours.',
  peler: 'les agrumes à vif, au-dessus d\'un bol pour recueillir le jus.',
  enfiler: 'sur des piques en alternant les couleurs.',
  éplucher: 'puis coupez selon la forme indiquée (dés, rondelles, julienne).',
  laver: 'sous l\'eau froide, puis séchez dans un torchon propre.',
  couper: 'en morceaux réguliers pour une cuisson homogène.',
  épépiner: 'soigneusement (ni noyaux ni pépins dans l\'assiette).',
  dénoyauter: 'délicatement, sans abîmer la chair.',
  écraser: 'à la fourchette, en gardant quelques morceaux pour la texture.',
  compoter: 'à feu doux et à couvert, en remuant de temps en temps.',
  frire: 'par petites quantités : l\'huile ne doit pas baisser en température.',
  alterner: 'les couches en terminant par la crème, pour un dressage net.',
  monter: 'en neige ferme avec une pincée de sel : ils doivent former des pics.',
  incorporer: 'délicatement à la maryse, en soulevant la masse pour garder l\'air.',
  répartir: 'uniformément entre les coupes ou le moule.',
};

/** « 35 min 190°C » ou « 4 h au frais » seul → phrase complète. */
function deplierTempsSeul(s: string): string | null {
  const m = /^(\d+)\s*(min|minutes|h|heures)\b\s*(?:(\d{2,3})\s*°?\s*C)?(.*)$/i.exec(s.trim());
  if (!m) return null;
  const [, duree, unite, degres, suite] = m;
  const u = unite.toLowerCase().startsWith('h') ? 'h' : 'min';
  const reste = suite.trim().replace(/^[,;.]\s*/, '');
  const compl = reste.length > 0 ? `, ${reste}` : '';
  if (degres) return `Enfournez ${duree} ${u} à ${degres} °C${compl ? ', en surveillant la coloration en fin de cuisson' : ''}.`;
  if (u === 'h' || /frais|frigo/i.test(reste))
    return `Laissez reposer ${duree} ${u} au réfrigérateur : la préparation se raffermit et les saveurs se mélangent${compl}.`;
  return `Laissez reposer ${duree} ${u} hors du feu avant de servir${compl}.`;
}

/** « four 200°C 25 min » en fin d'étape → {deg, min} + texte nettoyé. */
function extraireFour(s: string): { deg: string; min: string; reste: string } | null {
  const m = /[,\s]+(?:four\s+)?(\d{2,3})\s*°?\s*C\s+(\d+)\s*min\b/i.exec(s);
  if (!m) return null;
  return { deg: m[1], min: m[2], reste: (s.slice(0, m.index) + s.slice(m.index + m[0].length)).trim().replace(/[,;]\s*$/, '') };
}

/** « Étaler la pâte » / « Miel + noix » → phrase complète. */
function deplierTele(s: string): string {
  const t = s.trim();

  // 1. Durée seule (« 35 min 190°C », « 4 h au frais »)
  const temps = deplierTempsSeul(t);
  if (temps) return temps;

  // 2. Température+durée en fin d'étape (« Miel + vanille, four 200°C 25 min »)
  const four = extraireFour(t);
  if (four && four.reste.length > 0 && four.reste.length < 80) {
    const corps = deplierTele(four.reste).replace(/\.$/, '');
    return `${corps}. Enfournez ensuite ${four.min} min à ${four.deg} °C.`;
  }

  // 3. Verbe infinitif EN LISTE FERMÉE en tête (casse indifférente : les
  //    segments secondaires d'une étape coordonnée commencent en minuscule)
  const mVerbe = /^([A-Za-zÀ-ÿ][a-zéèêàçùûôïîœ'-]+)\b/.exec(t);
  if (mVerbe) {
    const mot = mVerbe[1].toLowerCase();
    if (VERBES_INFINITIFS.has(mot)) {
      const reste = t.slice(mVerbe[1].length).trimStart();
      // Pas de complément si la phrase contient déjà une durée, est déjà
      // explicite, ou répéterait un mot du reste (« à la fourchette… »)
      const aDuree = /\d+\s*(?:min|h)\b/i.test(reste);
      const complementBrut = COMPLEMENTS[mot] ?? '';
      // Empêche la répétition d'un complément déjà présent en substance :
      // au moins un mot significatif (≥ 4 lettres) du complément figure
      // déjà dans le reste (« à la fourchette » + reste « à la fourchette »).
      const motDuReste = new Set(
        reste.toLowerCase().split(/[^a-zà-ÿ]+/).filter(w => w.length >= 4)
      );
      const redondant = complementBrut
        .toLowerCase()
        .split(/[^a-zà-ÿ]+/)
        .some(w => w.length >= 4 && motDuReste.has(w));
      const complement =
        !aDuree && reste.length < 45 && complementBrut.length > 0 && !redondant
          ? complementBrut
          : '';
      const phrase = `${majuscule(imperatif(mot))} ${reste}${complement ? ` ${complement}` : ''}`.replace(/\s+/g, ' ').trim();
      return phrase.endsWith('.') ? phrase : `${phrase}.`;
    }
    // Verbe inconnu mais phrase longue et déjà explicite → ponctuation seule
    if (t.length > 60) return t.endsWith('.') ? t : `${t}.`;
  }

  // 4. Nominal avec « + » (« Miel + noix concassées »)
  if (t.includes(' + ')) {
    const morceaux = t.split(' + ').map(p => p.trim());
    const dernier = morceaux[morceaux.length - 1];
    return `Ajoutez ${morceaux.slice(0, -1).join(', ').toLowerCase()} et ${dernier.toLowerCase()}, puis mélangez délicatement.`;
  }

  // 4bis. Nominal court inconnu (« Servez tiède » sans point, « Rondelles »…)
  // → phrase simple avec ponctuation, sans inventer de geste.

  // 5. Dernier recours : normalise « 190°C » → « 190 °C », garde la phrase
  const out = t.replace(/(\d{2,3})\s*°?\s*C\b/g, '$1 °C');
  return out.endsWith('.') ? out : `${out}.`;
}

/** Découpe « Couper les poires en deux, épépiner » en 2 phrases si chaque
 *  segment commence par un verbe infinitif connu (casse indifférente) ;
 *  sinon 1 seule phrase. */
function deplierEtape(s: string): string[] {
  const t = s.trim();
  const segments = t.split(/,\s+/);
  if (segments.length < 2) return [deplierTele(t)];
  const tousVerbes = segments.every(seg => {
    const m = /^([A-Za-zÀ-ÿ][a-zéèêàçùûôïîœ'-]+)\b/.exec(seg.trim());
    return m ? VERBES_INFINITIFS.has(m[1].toLowerCase()) : false;
  });
  if (!tousVerbes) return [deplierTele(t)];
  return segments.map(seg => deplierTele(seg.trim()));
}

// ─── (B) Complétion ──────────────────────────────────────────────────────────
type Rayon =
  | 'fruits_legumes' | 'viande_poisson' | 'frais' | 'epicerie_salee'
  | 'epicerie_sucree' | 'epices' | 'conserves' | 'boulangerie'
  | 'surgeles' | 'boissons';

interface LigneIng {
  nom: string;
  rayon: string;
  est_optionnel: boolean | null;
}

const EXCLUS_PREPARATION = new Set([
  'huile d\'olive', 'huile de tournesol', 'huile de colza', 'huile', 'vinaigre',
  'sel', 'poivre', 'eau', 'sucre', 'farine', 'levure', 'levure chimique',
  'sucre vanillé', 'café soluble', 'fond de volaille', 'bouillon de légumes',
  'sel fin', 'poivre noir', 'herbes de provence',
]);

const GESTE_PAR_RAYON: Partial<Record<Rayon, (noms: string[]) => string>> = {
  fruits_legumes: noms =>
    `Lavez puis épluchez ${lister(noms)} et réservez-les coupés dans un saladier.`,
  viande_poisson: noms =>
    `Sortez ${lister(noms)} du réfrigérateur, épongez-les avec du papier absorbant et réservez au frais.`,
  frais: noms =>
    `Sortez ${lister(noms)} du réfrigérateur 15 min avant de commencer (texture et goût optimums).`,
  boulangerie: noms => `Sortez ${lister(noms)} et placez-les à portée de main sur le plan de travail.`,
  conserves: noms => `Ouvrez et égouttez ${lister(noms)} dans une passoire.`,
  surgeles: noms => `Sortez ${lister(noms)} du congélateur 10 min avant de les utiliser.`,
};

function lister(noms: string[]): string {
  if (noms.length === 0) return '';
  if (noms.length === 1) return noms[0];
  return `${noms.slice(0, -1).join(', ')} et ${noms[noms.length - 1]}`;
}

function majuscule(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function etapeMiseEnPlace(ustensiles: string[]): string | null {
  const aAirFryer = ustensiles.some(u => /air fryer/i.test(u));
  const aFour = ustensiles.some(u => /four/i.test(u) && !/friture/i.test(u));
  if (aAirFryer) return `${MARQUEUR_MISE_EN_PLACE}Préchauffez l'air fryer et sortez tous les ingrédients : la recette s'enchaîne vite.`;
  if (aFour) return `${MARQUEUR_MISE_EN_PLACE}Préchauffez le four à la température indiquée ci-dessous (comptez 10-15 min de montée).`;
  return null;
}

function etapePreparation(lignes: LigneIng[]): string | null {
  const parRayon = new Map<Rayon, string[]>();
  for (const l of lignes) {
    if (l.est_optionnel) continue;
    if (EXCLUS_PREPARATION.has(l.nom.toLowerCase())) continue;
    const rayon = l.rayon as Rayon;
    if (!GESTE_PAR_RAYON[rayon]) continue;
    const g = parRayon.get(rayon) ?? [];
    g.push(l.nom.toLowerCase());
    parRayon.set(rayon, g);
  }
  const gestes: string[] = [];
  for (const rayon of ['fruits_legumes', 'viande_poisson', 'frais', 'surgeles', 'conserves', 'boulangerie'] as Rayon[]) {
    const noms = parRayon.get(rayon);
    if (noms && noms.length > 0) gestes.push(GESTE_PAR_RAYON[rayon]!(noms));
  }
  if (gestes.length === 0) return null;
  const prep = gestes.join(' ');
  return `${MARQUEUR_PREPARATION}${prep}`;
}

function etapeAstuce(conservationJours: number | null, typeRepas: string): string {
  const jours = conservationJours ?? 0;
  if (typeRepas === 'dessert') {
    if (jours >= 2)
      return `${MARQUEUR_ASTUCE}Se conserve ${jours} jours au réfrigérateur, couvert au contact : les saveurs se développent même le lendemain.`;
    return `${MARQUEUR_ASTUCE}Dégustez bien frais, tout juste sorti du réfrigérateur.`;
  }
  if (jours >= 3)
    return `${MARQUEUR_ASTUCE}Se conserve jusqu'à ${jours} jours au réfrigérateur en boîte hermétique : parfait pour les lunchs de la semaine.`;
  if (jours <= 1)
    return `${MARQUEUR_ASTUCE}À consommer dans la journée : c'est le jour même qu'il est le meilleur.`;
  return `${MARQUEUR_ASTUCE}Se garde ${jours} jour(s) au réfrigérateur en boîte hermétique.`;
}

// ─── Construction du patch d'une recette ─────────────────────────────────────
interface Recette {
  id: number;
  titre: string;
  instructions: string[] | null;
  ustensiles: string[] | null;
  type_repas: string;
  conservation_jours: number | null;
}

function construire(recette: Recette, lignes: LigneIng[]): { instructions?: string[]; ustensiles?: string[] } | null {
  const existantes = (recette.instructions ?? []).filter(s => s.trim().length > 0);
  const ustensiles = [...(recette.ustensiles ?? [])];
  let changeUstensiles = false;

  // (C) Four cité mais absent des ustensiles
  const texte = existantes.join(' ');
  const fourUtilise = /(?:^|[^foch])\bfour\b/i.test(texte) && !/fourchette|friture/i.test(texte);
  const aDejaFour = ustensiles.some(u => /four/i.test(u));
  if (fourUtilise && !aDejaFour) {
    ustensiles.push('Four');
    changeUstensiles = true;
  }

  // (A) Dépliage des étapes télégraphiques
  const depliees: string[] = [];
  for (const s of existantes) {
    if (
      s.startsWith(MARQUEUR_MISE_EN_PLACE) ||
      s.startsWith(MARQUEUR_PREPARATION) ||
      s.startsWith(MARQUEUR_ASTUCE) ||
      dejaPhrase(s)
    ) {
      depliees.push(s);
      continue;
    }
    depliees.push(...deplierEtape(s));
  }

  // (B) Complétion
  const avant: string[] = [];
  const apres: string[] = [];
  if (!depliees.some(s => s.startsWith(MARQUEUR_MISE_EN_PLACE))) {
    const m = etapeMiseEnPlace(ustensiles);
    if (m) avant.push(m);
  }
  if (!depliees.some(s => s.startsWith(MARQUEUR_PREPARATION))) {
    const p = etapePreparation(lignes);
    if (p) avant.push(p);
  }
  if (!depliees.some(s => s.startsWith(MARQUEUR_ASTUCE))) {
    apres.push(etapeAstuce(recette.conservation_jours, recette.type_repas));
  }

  const nouvelles = [...avant, ...depliees, ...apres];
  const memesInstructions =
    nouvelles.length === existantes.length &&
    nouvelles.every((s, i) => s === existantes[i]);
  if (memesInstructions && !changeUstensiles) return null;

  const patch: { instructions?: string[]; ustensiles?: string[] } = {};
  if (!memesInstructions) patch.instructions = nouvelles;
  if (changeUstensiles) patch.ustensiles = ustensiles;
  return patch;
}

// ─── Lecture DB ──────────────────────────────────────────────────────────────
async function lireIngredients(mealIds: number[]): Promise<Map<number, LigneIng[]>> {
  const resultat = new Map<number, LigneIng[]>();
  for (let i = 0; i < mealIds.length; i += 200) {
    const lot = mealIds.slice(i, i + 200);
    const { data, error } = await supabase
      .from('meal_ingredients')
      .select('meal_id, est_optionnel, ingredients(nom, rayon)')
      .in('meal_id', lot);
    if (error) throw error;
    for (const l of (data ?? []) as unknown as {
      meal_id: number;
      est_optionnel: boolean | null;
      ingredients: { nom: string; rayon: string } | null;
    }[]) {
      if (!l.ingredients) continue;
      const liste = resultat.get(l.meal_id) ?? [];
      liste.push({ nom: l.ingredients.nom, rayon: l.ingredients.rayon, est_optionnel: l.est_optionnel });
      resultat.set(l.meal_id, liste);
    }
  }
  return resultat;
}

async function main() {
  const recettes: Recette[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from('meals')
      .select('id, titre, instructions, ustensiles, type_repas, conservation_jours')
      .eq('is_public', true)
      .order('id')
      .range(from, from + 999);
    if (error) throw error;
    if (!data || data.length === 0) break;
    recettes.push(...(data as unknown as Recette[]));
    from += 1000;
  }

  let cibles = recettes;
  if (argId) {
    const id = Number(argId.split('=')[1]);
    cibles = recettes.filter(r => r.id === id);
    if (cibles.length === 0) { console.error(`❌ Recette #${id} introuvable (ou non publique).`); process.exit(1); }
  }
  if (argLimit) cibles = cibles.slice(0, Number(argLimit.split('=')[1]));

  console.log(`📚 ${recettes.length} recettes publiques, ${cibles.length} ciblée(s).${ecrire ? '' : ' (DRY RUN)'}`);

  const ingredientsParMeal = await lireIngredients(cibles.map(r => r.id));

  let modifiees = 0, ignorees = 0, echecs = 0;
  for (const recette of cibles) {
    const lignes = ingredientsParMeal.get(recette.id) ?? [];
    const patch = construire(recette, lignes);
    if (!patch) { ignorees++; continue; }

    if (!ecrire) {
      console.log(`\n📝 #${recette.id} ${recette.titre}`);
      (patch.instructions ?? recette.instructions ?? []).forEach((s, i) =>
        console.log(`   ${i + 1}. ${s.slice(0, 135)}${s.length > 135 ? '…' : ''}`)
      );
      if (patch.ustensiles) console.log(`   ustensiles → ${JSON.stringify(patch.ustensiles)}`);
      modifiees++;
      continue;
    }

    const { error } = await supabase.from('meals').update(patch).eq('id', recette.id);
    if (error) { console.error(`❌ #${recette.id} : ${error.message}`); echecs++; continue; }
    modifiees++;
    if (modifiees % 200 === 0) console.log(`   … ${modifiees} recettes mises à jour`);
  }

  console.log('');
  console.log(
    ecrire
      ? `✅ ${modifiees} recette(s) modifiée(s), ${ignorees} déjà à jour, ${echecs} échec(s).`
      : `🔍 DRY RUN : ${modifiees} recette(s) seraient modifiées, ${ignorees} inchangées.`
  );
}

main().catch(e => { console.error(e); process.exit(1); });
