// ============================================================================
// Menus de la semaine PUBLICS (pages /menu-semaine/[slug]) : un menu complet de
// 14 repas (7 déjeuners + 7 dîners) qui respecte un budget pour un nombre de
// personnes, composé à partir du catalogue — sans compte, sans profil. Il change
// chaque lundi (graine = lundi de la semaine) et reste identique toute la semaine.
//
// Ce n'est PAS le moteur de planification des utilisateurs (rotation-engine.ts) :
// c'est une version simple et déterministe, destinée à la vitrine et au SEO.
// Le coût annoncé est celui de la liste de courses réelle (arrondie aux
// conditionnements), jamais une somme de prix par portion.
// ============================================================================

import type { Entree, Index } from '@/lib/catalogue-index';
import type { MealCatalogue } from '@/lib/db-rows';
import { recetteServable } from '@/lib/regimes';
import { profilPlat } from '@/lib/diversite';
import { construireListeCourses } from '@/lib/newsletter';
import type { PricedShoppingSection } from '@/lib/budget';
import type { Regime, RecetteMoteur } from '@/types';

export interface VarianteMenu {
  slug: string;
  /** « Menu de la semaine à 50 € pour 2 personnes » */
  titre: string;
  budget: number;
  personnes: number;
  regimes?: Regime[];
  /** Temps total max par plat (minutes) */
  tempsMax?: number;
  /** Protéines minimales par portion (g) */
  proteinesMin?: number;
  /** Phrase d'accroche de la page */
  accroche: string;
  conseils: string[];
}

const conseilsCommuns = [
  'Faites les courses le même jour pour toute la semaine : la liste ci-dessous est triée par rayon, dans l’ordre du magasin.',
  'Cuisinez en double les plats qui se conservent (conservation indiquée sur chaque recette) : le déjeuner du lendemain est prêt.',
];

export const VARIANTES: VarianteMenu[] = [
  { slug: '30-euros-1-personne', titre: 'Menu de la semaine à 30 € pour 1 personne', budget: 30, personnes: 1,
    accroche: 'Trente euros pour sept jours de déjeuners et de dîners quand on cuisine pour soi : c’est possible en choisissant des plats complets, de saison et sans gaspillage.',
    conseils: ['Congelez les portions en trop : un plat cuisiné pour deux se mange sur deux repas.', ...conseilsCommuns] },
  { slug: '25-euros-etudiant', titre: 'Menu de la semaine étudiant à 25 €', budget: 25, personnes: 1, tempsMax: 30,
    accroche: 'Un menu étudiant à petit budget : des plats rapides (30 minutes maximum), simples à préparer dans une petite cuisine et peu coûteux.',
    conseils: ['Les féculents et les légumineuses font la base du budget : riz, pâtes, lentilles, pois chiches.', ...conseilsCommuns] },
  { slug: '50-euros-2-personnes', titre: 'Menu de la semaine à 50 € pour 2 personnes', budget: 50, personnes: 2,
    accroche: 'Cinquante euros pour deux personnes et quatorze repas : un menu équilibré pour un budget serré, avec sa liste de courses chiffrée.',
    conseils: ['Comparez les prix au kilo plutôt qu’au paquet : les marques de distributeur font souvent la différence.', ...conseilsCommuns] },
  { slug: '70-euros-2-personnes', titre: 'Menu de la semaine à 70 € pour 2 personnes', budget: 70, personnes: 2,
    accroche: 'Soixante-dix euros pour deux : de quoi varier les protéines (poisson, viande, œufs, légumineuses) tout en gardant la liste de courses sous contrôle.',
    conseils: ['Réservez le poisson frais pour le début de semaine et les plats mijotés pour le week-end.', ...conseilsCommuns] },
  { slug: '80-euros-4-personnes', titre: 'Menu de la semaine à 80 € pour 4 personnes', budget: 80, personnes: 4,
    accroche: 'Quatre personnes, quatorze repas, quatre-vingts euros : un menu de famille économique, avec des plats qui plaisent à tout le monde.',
    conseils: ['Pour les enfants, servez les sauces à part : le même plat convient à toute la tablée.', ...conseilsCommuns] },
  { slug: '100-euros-4-personnes', titre: 'Menu de la semaine à 100 € pour 4 personnes', budget: 100, personnes: 4,
    accroche: 'Cent euros pour une famille de quatre : plus de variété, plus de poisson et de viande, et toujours une liste de courses prête à imprimer.',
    conseils: ['Prévoyez un repas « grand classique » le week-end : les plats mijotés se préparent à l’avance.', ...conseilsCommuns] },
  { slug: '120-euros-5-personnes', titre: 'Menu de la semaine à 120 € pour 5 personnes', budget: 120, personnes: 5,
    accroche: 'Une grande tablée de cinq personnes pour cent vingt euros : des plats généreux et des quantités calculées pour tout le monde.',
    conseils: ['Pour cinq personnes, les plats au four (une seule plaque) font gagner beaucoup de temps.', ...conseilsCommuns] },
  { slug: 'vegetarien-40-euros-2-personnes', titre: 'Menu de la semaine végétarien à 40 € pour 2 personnes', budget: 40, personnes: 2, regimes: ['vegetarien'],
    accroche: 'Une semaine entière sans viande ni poisson pour quarante euros : légumineuses, œufs, produits laitiers et légumes de saison.',
    conseils: ['Associez légumineuses et céréales (lentilles et riz, pois chiches et semoule) pour des protéines complètes.', ...conseilsCommuns] },
  { slug: 'rapide-60-euros-2-personnes', titre: 'Menu de la semaine rapide à 60 € pour 2 personnes', budget: 60, personnes: 2, tempsMax: 25,
    accroche: 'Quatorze repas prêts en 25 minutes ou moins, pour deux personnes et soixante euros : le menu des semaines chargées.',
    conseils: ['Préparez les légumes le dimanche soir : lavés et coupés, ils se gardent trois jours au frais.', ...conseilsCommuns] },
  { slug: 'proteine-70-euros-sportif', titre: 'Menu de la semaine riche en protéines à 70 €', budget: 70, personnes: 1, proteinesMin: 30,
    accroche: 'Un menu pour sportif : au moins 30 g de protéines par plat, soit de quoi couvrir les besoins d’une semaine d’entraînement pour soixante-dix euros.',
    conseils: ['Répartissez les protéines sur tous les repas plutôt que de tout concentrer au dîner.', ...conseilsCommuns] },
];

export const varianteParSlug = (slug: string) => VARIANTES.find(v => v.slug === slug);

/**
 * Variante (budget, foyer, régime) mise en avant la semaine du `lundi` : une par semaine, en rotation
 * sur les 10 variantes. Deux semaines consécutives n'ont jamais le même budget (garanti par l'ordre
 * de VARIANTES, vérifié par un test).
 */
export function varianteDeLaSemaine(lundi: string): VarianteMenu {
  const semaines = Math.floor(Date.parse(`${lundi}T12:00:00Z`) / (7 * 86_400_000));
  return VARIANTES[semaines % VARIANTES.length];
}

export interface JourMenu { jour: string; dejeuner: MealCatalogue; diner: MealCatalogue }
export interface MenuPublic {
  variante: VarianteMenu;
  semaineDebut: string;
  jours: JourMenu[];
  courses: PricedShoppingSection[];
  /** Coût de la liste de courses réelle (€) */
  total: number;
  /** € par personne et par jour */
  parPersonneParJour: number;
  kcalMoyen: number | null;
  minutesMoyennes: number;
}

const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

/** Générateur pseudo-aléatoire déterministe (mulberry32) */
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

const hash = (texte: string) => { let h = 2166136261; for (const c of texte) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

const coutListe = (repas: MealCatalogue[], personnes: number) => {
  const courses = construireListeCourses(repas, personnes);
  return { courses, total: Math.round(courses.reduce((s, c) => s + c.total, 0) * 100) / 100 };
};

/** Compose le menu de la semaine pour une variante ; null si le budget est intenable avec le catalogue. */
export function composerMenu(idx: Index, v: VarianteMenu, semaineDebut: string, graine: string = semaineDebut): MenuPublic | null {
  const filtres = (e: Entree) =>
    e.m.type_repas === 'plat' && e.prix != null
    && (v.tempsMax == null || e.temps <= v.tempsMax)
    && (v.proteinesMin == null || (e.m.proteines ?? 0) >= v.proteinesMin)
    && (!v.regimes || recetteServable(e.ingredientsRegime, v.regimes));
  const admissibles = idx.entrees.filter(filtres);
  // Les fiches rédigées à la main d'abord (ce sont celles que Google indexe) ; le reste en complément
  const redigees = admissibles.filter(e => e.m.indexable);
  const bassins = [redigees.length >= 40 ? redigees : admissibles, admissibles];

  for (const bassin of bassins) {
    for (let essai = 0; essai < 6; essai++) {
      const rng = aleatoire(hash(`${graine}|${v.slug}|${essai}`));
      const melange = [...bassin].sort(() => rng() - 0.5);
      const choisis: Entree[] = [];
      const cuisines = new Map<string, number>();
      const proteines = new Map<string, number>();
      const plafondProteine = 3;
      const cible = v.budget / v.personnes;       // € par personne pour la semaine
      let somme = 0;

      for (const e of melange) {
        if (choisis.length === 14) break;
        const restants = 14 - choisis.length;
        const moyenneRestante = (cible * 0.9 - somme) / restants;
        if (e.prix! > moyenneRestante * 1.5) continue;
        const cuisine = e.m.cuisine ?? '';
        if ((cuisines.get(cuisine) ?? 0) >= 4) continue;
        const proteine = profilPlat(e.m as unknown as RecetteMoteur).proteine;
        if ((proteines.get(proteine) ?? 0) >= plafondProteine) continue;
        if (choisis.some(c => c.m.titre.split(/[,(]/)[0].trim().toLowerCase() === e.m.titre.split(/[,(]/)[0].trim().toLowerCase())) continue;
        choisis.push(e);
        somme += e.prix!;
        cuisines.set(cuisine, (cuisines.get(cuisine) ?? 0) + 1);
        proteines.set(proteine, (proteines.get(proteine) ?? 0) + 1);
      }
      if (choisis.length < 14) continue;

      // Contrôle du coût réel : on remplace le plat le plus cher tant que la liste dépasse le budget
      let resultat = coutListe(choisis.map(c => c.m), v.personnes);
      for (let i = 0; i < 40 && resultat.total > v.budget; i++) {
        const pire = choisis.reduce((a, b) => (b.prix! > a.prix! ? b : a));
        const moinsCher = melange.find(e => !choisis.includes(e) && e.prix! < pire.prix! * 0.8);
        if (!moinsCher) break;
        choisis[choisis.indexOf(pire)] = moinsCher;
        resultat = coutListe(choisis.map(c => c.m), v.personnes);
      }
      if (resultat.total > v.budget) continue;

      // Répartition : les plats les plus rapides en semaine (déjeuners), les plus longs le week-end (dîners)
      const tries = [...choisis].sort((a, b) => a.temps - b.temps || a.m.id - b.m.id);
      const dejeuners = tries.slice(0, 7);
      const diners = tries.slice(7).sort((a, b) => a.temps - b.temps || a.m.id - b.m.id);
      const jours: JourMenu[] = JOURS.map((jour, i) => ({ jour, dejeuner: dejeuners[i].m, diner: diners[i].m }));

      const kcal = choisis.map(c => c.m.calories_par_portion).filter((k): k is number => k != null);
      return {
        variante: v,
        semaineDebut,
        jours,
        courses: resultat.courses,
        total: resultat.total,
        parPersonneParJour: Math.round((resultat.total / v.personnes / 7) * 100) / 100,
        kcalMoyen: kcal.length ? Math.round(kcal.reduce((s, k) => s + k, 0) / kcal.length / 10) * 10 : null,
        minutesMoyennes: Math.round(choisis.reduce((s, c) => s + c.temps, 0) / 14),
      };
    }
  }
  return null;
}
