import type { Metadata } from 'next';

// Métadonnées de la page (page.tsx est un composant client).
export const metadata: Metadata = {
  title: "Mes favoris",
  description: "Vos recettes préférées, prêtes à ajouter au planning.",
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
