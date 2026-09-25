import type { Metadata } from 'next';

// Métadonnées de la page (page.tsx est un composant client).
export const metadata: Metadata = {
  title: "Mon frigo",
  description: "Les ingrédients de votre frigo, pris en compte dans vos menus.",
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
