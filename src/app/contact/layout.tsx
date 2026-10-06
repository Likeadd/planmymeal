import type { Metadata } from 'next';

// Métadonnées de la page (page.tsx est un composant client).
export const metadata: Metadata = {
  title: "Contact",
  description: "Une question, une suggestion ou un problème avec PlanMyMeal ? Écrivez à l’équipe, qui répond sous 48 h ouvrées.",
  alternates: { canonical: '/contact' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
