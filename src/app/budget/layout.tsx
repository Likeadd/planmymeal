import type { Metadata } from 'next';

// Métadonnées de la page (page.tsx est un composant client).
export const metadata: Metadata = {
  title: "Mon budget",
  description: "Suivez vos dépenses de courses et vos économies semaine après semaine.",
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
