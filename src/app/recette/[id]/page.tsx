import { redirect } from 'next/navigation';
import RecetteClient from './RecetteClient';
import { getRecettePublique } from './data';
import { parseRecetteId, recetteHref } from '@/lib/seo';
import { recettesSimilaires } from '@/lib/catalogue-index';
import { prixParPortion } from '@/lib/budget';

// Rendu serveur de la recette : titre, ingrédients et étapes sont dans le HTML
// initial (indexables, affichés sans attendre le JavaScript). L'interactivité
// (avis, prix personnalisés) reste dans RecetteClient.
// ISR à la demande : chaque recette est rendue à sa première visite puis
// servie depuis le cache (revalidée 1×/jour, cf. layout) au lieu d'être
// recalculée — et de solliciter la base — à chaque requête.
export async function generateStaticParams() {
  return [];
}

export default async function RecettePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const mealId = parseRecetteId(id);
  const initial = mealId ? await getRecettePublique(mealId) : null;

  // URL canonique /recette/{id}-{slug} : redirige les anciens liens (id seul)
  // et toute variante du slug (titre modifié) vers la forme à jour.
  if (initial) {
    const canonique = recetteHref(initial);
    if (`/recette/${id}` !== canonique) redirect(canonique);
  }

  // Recettes proches (maillage interne) : lues dans l'index du catalogue ; jamais bloquant pour la fiche
  const similaires = initial
    ? await recettesSimilaires(initial.id, 6)
        .then(liste => liste.map(m => ({
          id: m.id, titre: m.titre, href: recetteHref(m), cuisine: m.cuisine,
          minutes: m.temps_preparation + (m.temps_cuisson ?? 0), kcal: m.calories_par_portion, prix: prixParPortion(m),
        })))
        .catch(() => [])
    : [];

  return <RecetteClient mealId={mealId ?? -1} initial={initial} similaires={similaires} />;
}
