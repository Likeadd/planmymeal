import type { Metadata } from 'next';

// Métadonnées de la page (page.tsx est un composant client).
export const metadata: Metadata = {
  title: "Connexion",
  description: "Connectez-vous à PlanMyMeal pour retrouver vos menus de la semaine, vos recettes favorites, votre frigo et votre liste de courses.",
  robots: { index: false, follow: true },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
