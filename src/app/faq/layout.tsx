import type { Metadata } from 'next';

// Métadonnées de la page (page.tsx est un composant client).
export const metadata: Metadata = {
  title: "Questions fréquentes",
  description: "Tout savoir sur PlanMyMeal : menus, liste de courses, budget, abonnement.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
