import type { Metadata } from 'next';

// Métadonnées de la page (page.tsx est un composant client).
export const metadata: Metadata = {
  title: "Contact",
  description: "Une question, une suggestion ? Écrivez à l’équipe PlanMyMeal.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
