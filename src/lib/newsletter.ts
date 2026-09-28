// ============================================================================
// Newsletter dominicale — construit un exemple de menu de la semaine + sa
// liste de courses à partir du catalogue public, pour les abonnés sans
// compte (lead magnet). Sélection déterministe par semaine ISO : tout le
// monde reçoit le même menu un dimanche donné, et il change d'une semaine
// à l'autre.
// ============================================================================

import type { MealCatalogue } from '@/lib/db-rows';
import { prixParPortion, chiffrerListeCourses, type PricedShoppingSection } from '@/lib/budget';
import { getCategorieSeo } from '@/lib/categories-seo';
import { getMondayParis, formatWeekRange } from '@/lib/dates';
import type { NewsletterData, NewsletterMenuLigne } from '@/lib/email-templates';

const NB_PLATS = 5;

/** Semaine ISO (approx.) pour faire varier la sélection sans dépendance externe. */
function numeroSemaine(lundiIso: string): number {
  const d = new Date(`${lundiIso}T00:00:00Z`);
  const debutAnnee = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.floor((d.getTime() - debutAnnee.getTime()) / (7 * 86_400_000));
}

/** Sélectionne NB_PLATS plats parmi les moins chers du catalogue, en faisant
 *  tourner le point de départ chaque semaine pour varier les envois. */
export function choisirMenuSemaine(catalogue: MealCatalogue[]): MealCatalogue[] {
  const plats = catalogue
    .filter(m => m.type_repas === 'plat')
    .filter(getCategorieSeo('pas-cher')!.filtre)
    .sort(getCategorieSeo('pas-cher')!.tri);
  if (plats.length === 0) return [];

  const lundi = getMondayParis();
  const depart = (numeroSemaine(lundi) * NB_PLATS) % plats.length;
  const choisis: MealCatalogue[] = [];
  for (let i = 0; i < Math.min(NB_PLATS, plats.length); i++) {
    choisis.push(plats[(depart + i) % plats.length]);
  }
  return choisis;
}

/** Agrège les ingrédients des plats choisis (sommés par ingrédient) puis les
 *  chiffre avec le moteur budget existant — même logique que la vraie liste
 *  de courses de l'app. */
function construireListeCourses(meals: MealCatalogue[]): PricedShoppingSection[] {
  const parIngredient = new Map<
    number,
    { quantite_totale: number; unite: string; rayon: string; ingredient: { id: number; nom: string; prix_unitaire: number | null; unite_prix: string | null } }
  >();

  for (const meal of meals) {
    for (const li of meal.ingredients) {
      const existant = parIngredient.get(li.ingredient.id);
      if (existant && existant.unite === li.unite) {
        existant.quantite_totale += li.quantite;
      } else if (!existant) {
        parIngredient.set(li.ingredient.id, {
          quantite_totale: li.quantite,
          unite: li.unite,
          rayon: li.ingredient.rayon || 'Autre',
          ingredient: {
            id: li.ingredient.id,
            nom: li.ingredient.nom,
            prix_unitaire: li.ingredient.prix_unitaire,
            unite_prix: li.ingredient.unite_prix,
          },
        });
      }
      // Unités différentes pour le même ingrédient entre deux recettes : cas
      // rare, on garde la première ligne plutôt que de sommer des unités
      // incompatibles (mieux vaut une quantité un peu basse qu'une somme fausse).
    }
  }

  return chiffrerListeCourses(
    Array.from(parIngredient.entries()).map(([ingredient_id, v]) => ({
      ingredient_id,
      quantite_totale: v.quantite_totale,
      unite: v.unite,
      rayon: v.rayon,
      checked: false,
      ingredient: v.ingredient,
    }))
  );
}

/** Construit les données prêtes pour `newsletterEmailHtml`. */
export function construireNewsletterHebdo(catalogue: MealCatalogue[], baseUrl: string, token: string): NewsletterData | null {
  const meals = choisirMenuSemaine(catalogue);
  if (meals.length === 0) return null;

  const menu: NewsletterMenuLigne[] = meals.map(m => ({ titre: m.titre, prix: prixParPortion(m) }));
  const totalSemaine = Math.round(menu.reduce((s, m) => s + (m.prix ?? 0), 0) * 100) / 100;
  const sections = construireListeCourses(meals);

  return {
    semaineLabel: formatWeekRange(getMondayParis()),
    menu,
    totalSemaine,
    courses: sections.map(s => ({ rayon: s.label, items: s.items.map(i => i.nom) })),
    unsubscribeUrl: `${baseUrl}/api/newsletter/desinscription?token=${token}`,
  };
}
