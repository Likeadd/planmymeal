// ============================================================================
// Layout serveur des pages recette : metadata SEO + données structurées
// JSON-LD schema.org/Recipe (résultats enrichis Google : temps, calories,
// ingrédients, étapes). La recette est lue UNE fois par rendu (data.ts).
// ============================================================================

import type { Metadata } from 'next';
import { SITE_URL, serialiserJsonLd, parseRecetteId, recetteHref } from '@/lib/seo';
import { getRecettePublique } from './data';

export const revalidate = 86400; // ISR : revalide 1× par jour

const CATEGORIES: Record<string, string> = {
  plat: 'Plat principal',
  entree: 'Entrée',
  dessert: 'Dessert',
  petit_dejeuner: 'Petit-déjeuner',
  snack: 'En-cas',
};

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const mealId = parseRecetteId(id);
  const meal = mealId ? await getRecettePublique(mealId) : null;
  if (!meal) return { title: 'Recette introuvable', robots: { index: false } };

  const url = `${SITE_URL}${recetteHref(meal)}`;
  const description = meal.description
    || `Recette ${meal.titre} : ${meal.temps_preparation + (meal.temps_cuisson || 0)} min, ${meal.calories_par_portion || '—'} kcal/portion. Planifiez-la avec PlanMyMeal.`;

  return {
    title: `${meal.titre} — Recette facile`,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: meal.titre,
      description,
      type: 'article',
      url,
      // Photo validée uniquement (image_source) ; sinon image de partage générée
      // (opengraph-image.tsx) — image_url seul contient d'anciennes images fausses.
      images: meal.image_url && meal.image_source ? [{ url: meal.image_url, alt: meal.titre }] : undefined,
    },
  };
}

export default async function RecetteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const mealId = parseRecetteId(id);
  const meal = mealId ? await getRecettePublique(mealId) : null;

  const jsonLd = meal
    ? {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: meal.titre,
        description: meal.description || undefined,
        // Pas de photo au catalogue : l'image de partage générée (opengraph-image.tsx)
        // tient lieu d'image — Google l'exige pour les résultats enrichis Recette.
        image: meal.image_url && meal.image_source ? meal.image_url : `${SITE_URL}${recetteHref(meal)}/opengraph-image`,
        url: `${SITE_URL}${recetteHref(meal)}`,
        inLanguage: 'fr-FR',
        author: { '@type': 'Organization', name: 'PlanMyMeal', url: SITE_URL },
        prepTime: `PT${meal.temps_preparation || 0}M`,
        cookTime: meal.temps_cuisson ? `PT${meal.temps_cuisson}M` : undefined,
        totalTime: `PT${(meal.temps_preparation || 0) + (meal.temps_cuisson || 0)}M`,
        recipeYield: `${meal.portions_par_defaut} portions`,
        recipeCategory: CATEGORIES[meal.type_repas] ?? 'Plat principal',
        recipeCuisine: meal.cuisine || undefined,
        keywords: ['recette', meal.cuisine, meal.difficulte].filter(Boolean).join(', '),
        recipeIngredient: meal.meal_ingredients
          .filter(mi => mi.ingredients?.nom)
          .map(mi => `${mi.quantite} ${mi.unite} ${mi.ingredients!.nom}`),
        recipeInstructions: (meal.instructions ?? []).map((texte, i) => ({
          '@type': 'HowToStep',
          position: i + 1,
          text: texte,
        })),
        nutrition: meal.calories_par_portion
          ? {
              '@type': 'NutritionInformation',
              calories: `${meal.calories_par_portion} kcal`,
              proteinContent: meal.proteines ? `${meal.proteines} g` : undefined,
              carbohydrateContent: meal.glucides ? `${meal.glucides} g` : undefined,
              fatContent: meal.lipides ? `${meal.lipides} g` : undefined,
            }
          : undefined,
      }
    : null;

  return (
    <>
      {jsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serialiserJsonLd(jsonLd) }} />
      )}
      {children}
    </>
  );
}
