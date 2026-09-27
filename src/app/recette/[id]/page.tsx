import RecetteClient from './RecetteClient';
import { getRecettePublique } from './data';

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
  const mealId = Number(id);
  const initial = await getRecettePublique(mealId);
  return <RecetteClient mealId={mealId} initial={initial} />;
}
