import type { Metadata } from 'next';

// Métadonnées de la page (page.tsx est un composant client).
export const metadata: Metadata = {
  title: "Bienvenue",
  description: "Configurez vos goûts, votre budget et votre foyer en quelques étapes.",
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
