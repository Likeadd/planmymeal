import type { Metadata } from 'next';

// Métadonnées de la page (page.tsx est un composant client).
export const metadata: Metadata = {
  title: "Recettes",
  description: "Plus de 6 000 recettes équilibrées et protéinées, avec calories, protéines et coût par portion. Filtrez par régime, temps de préparation, cuisine et budget.",
  alternates: { canonical: '/recettes' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
