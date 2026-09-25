import type { Metadata } from 'next';

// Métadonnées de la page (page.tsx est un composant client).
export const metadata: Metadata = {
  title: "Connexion",
  description: "Connectez-vous pour retrouver vos menus, favoris et liste de courses.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
