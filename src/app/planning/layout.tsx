import type { Metadata } from 'next';

// Métadonnées de la page (page.tsx est un composant client).
export const metadata: Metadata = {
  title: "Historique des plannings",
  description: "Vos semaines de menus passées et à venir.",
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
