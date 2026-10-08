// ============================================================================
// Détail des étapes — rend une recette PRÉCISE et autonome.
//
// Ajoute autour des étapes rédigées :
//   1. une « Mise en place » : TOUS les ingrédients avec leur quantité exacte
//      (« Filet de poulet (360 g) »), le nombre de personnes, les ustensiles et
//      le temps (préparation, cuisson, total) — on peut tout peser avant de
//      commencer ;
//   2. à la fin : le rappel d'assaisonnement et de service, puis la durée de
//      conservation et le réchauffage quand la recette se garde.
// Les étapes d'origine (gestes, durées, températures) restent inchangées, au
// milieu. Fonction pure, appliquée à l'insertion (ajouter-recettes-generees.ts)
// et en rattrapage sur les recettes déjà insérées (--maj-etapes).
// ============================================================================

import type { RecetteSaisie } from './recettes-proteinees';

const UNITES: Record<string, string> = {
  g: 'g', ml: 'ml', cas: 'c. à soupe', cac: 'c. à café', pcs: 'pièce', tranche: 'tranche', botte: 'botte',
  boite: 'boîte', sachet: 'sachet', kg: 'kg', L: 'L', l: 'L',
};

const pluriel = (n: number, mot: string) => (n > 1 && ['pièce', 'tranche', 'botte', 'boîte', 'sachet'].includes(mot) ? `${mot}s` : mot);

/** « 360 g », « 1,5 kg », « 2 pièces », « 1 c. à soupe » */
export function formaterQuantite(quantite: number, unite: string): string {
  const mot = UNITES[unite] ?? unite;
  let q = quantite;
  let u = mot;
  if (u === 'g' && q >= 1000) { q = q / 1000; u = 'kg'; }
  if (u === 'ml' && q >= 1000) { q = q / 1000; u = 'L'; }
  const nombre = (Math.round(q * 10) / 10).toString().replace('.', ',');
  return `${nombre} ${pluriel(q, u)}`;
}

const minuscule = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

function dureeLisible(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), r = min % 60;
  return r === 0 ? `${h} h` : `${h} h ${String(r).padStart(2, '0')}`;
}

/** Plats servis froids ou crus : ni « assiettes chaudes » ni réchauffage. */
const PLAT_FROID = /salade|houmous|tartare|carpaccio|gaspacho|taboul|poke|bowl froid|crudit|sandwich|wrap|tartine|overnight|smoothie|yaourt|fromage blanc|skyr|granola|porridge/i;

/** Étapes finales : assaisonnement et service, puis conservation (sans doublon avec les étapes d'origine). */
function etapesFinales(r: RecetteSaisie): string[] {
  const fin: string[] = [];
  const texte = r.etapes.join(' ').toLowerCase();
  const derniere = r.etapes[r.etapes.length - 1]?.toLowerCase() ?? '';
  const froid = PLAT_FROID.test(r.titre);

  // Service : uniquement pour un plat (les desserts, petits-déjeuners et collations n'ont pas d'« assiette chaude »)
  if (r.type === 'plat' && !/servez|dégustez|buvez|dressez|répartissez/.test(derniere)) {
    fin.push(froid
      ? 'Goûtez et rectifiez l’assaisonnement (sel, poivre, citron ou herbes selon votre goût), puis servez frais.'
      : 'Goûtez et rectifiez l’assaisonnement (sel, poivre, citron ou herbes selon votre goût), puis servez aussitôt dans des assiettes chaudes.');
  }

  // Conservation : jamais deux fois (certaines recettes la mentionnent déjà)
  if (r.conservation >= 2 && !/conserv|se garde|se congèle/.test(texte)) {
    const duree = r.conservation <= 3 ? `jusqu’à ${r.conservation} jours` : `${r.conservation} jours`;
    fin.push(r.type === 'plat' && !froid
      ? `Conservation : laissez refroidir puis conservez ${duree} au réfrigérateur dans une boîte hermétique. Réchauffez à la poêle ou 2 min au micro-ondes en ajoutant une cuillerée d’eau.`
      : `Conservation : ${duree} au réfrigérateur dans une boîte hermétique.`);
  }
  return fin;
}

/** Recette complète : mise en place précise + étapes + service et conservation. */
export function enrichirEtapes(r: RecetteSaisie): string[] {
  const lignes = r.ingredients.map(([nom, q, u, optionnel]) => `${nom} (${formaterQuantite(q, u)}${optionnel ? ', facultatif' : ''})`);
  const total = r.prep + r.cuisson;
  const mise = [
    `Mise en place — pour ${r.portions} personne${r.portions > 1 ? 's' : ''}. Pesez et préparez : ${lignes.join(' ; ')}.`,
    r.ustensiles.length > 0 ? `Sortez : ${r.ustensiles.map(minuscule).join(', ')}.` : '',
    `Temps : ${dureeLisible(r.prep)} de préparation${r.cuisson > 0 ? `, ${dureeLisible(r.cuisson)} de cuisson` : ''}, soit environ ${dureeLisible(total)} au total.`,
  ].filter(Boolean).join(' ');
  return [mise, ...r.etapes, ...etapesFinales(r)];
}
