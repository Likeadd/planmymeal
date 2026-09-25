// ============================================================================
// Layout serveur des pages recette : metadata SEO + données structurées
// JSON-LD schema.org/Recipe (rich snippets Google : temps, note, ingrédients).
// La page elle-même reste un client component interactif.
// ============================================================================

import type { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';

export const revalidate = 86400; // ISR : revalide 1× par jour

async function getMeal(id: number) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const { data } = await supabase
      .from('meals')
      // Colonnes explicites, dans l'ordre du JSON-LD produit plus bas. Tout ce
      // qui est demandé ici est consommé : `created_at` n'y était plus lu depuis
      // que le `datePublished` a disparu des données structurées.
      .select('id, titre, description, image_url, temps_preparation, temps_cuisson, difficulte, cuisine, calories_par_portion, proteines, glucides, lipides, portions_par_defaut')
      .eq('id', id)
      .eq('is_public', true)
      .single();
    return data;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const meal = await getMeal(Number(id));
  if (!meal) return { title: 'Recette introuvable — PlanMyMeal' };

  const base = (process.env.NEXT_PUBLIC_SITE_URL || 'https://planmymeal.app').replace(/\/$/, '');
  const description = meal.description
    || `Recette ${meal.titre} : ${meal.temps_preparation + (meal.temps_cuisson || 0)} min, ${meal.calories_par_portion || '—'} kcal/portion. Planifiez-la avec PlanMyMeal.`;

  return {
    title: `${meal.titre} — Recette facile | PlanMyMeal`,
    description,
    alternates: { canonical: `${base}/recette/${meal.id}` },
    openGraph: {
      title: meal.titre,
      description,
      type: 'article',
      url: `${base}/recette/${meal.id}`,
      images: meal.image_url ? [{ url: meal.image_url, alt: meal.titre }] : undefined,
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
  const meal = await getMeal(Number(id));

  const jsonLd = meal
    ? {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: meal.titre,
        description: meal.description || undefined,
        image: meal.image_url || undefined,
        author: { '@type': 'Organization', name: 'PlanMyMeal' },
        prepTime: `PT${meal.temps_preparation || 0}M`,
        cookTime: meal.temps_cuisson ? `PT${meal.temps_cuisson}M` : undefined,
        totalTime: `PT${(meal.temps_preparation || 0) + (meal.temps_cuisson || 0)}M`,
        recipeYield: `${meal.portions_par_defaut} portions`,
        recipeCategory: 'Plat',
        recipeCuisine: meal.cuisine || undefined,
        keywords: ['recette', meal.cuisine, meal.difficulte].filter(Boolean).join(', '),
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      {children}
    </>
  );
}
