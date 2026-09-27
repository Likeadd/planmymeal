import type { Metadata } from 'next';

// Métadonnées de la page (page.tsx est un composant client).
export const metadata: Metadata = {
  title: "Recettes",
  description: "Des centaines de recettes équilibrées, filtrables par régime, temps et budget.",
  alternates: { canonical: '/recettes' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
