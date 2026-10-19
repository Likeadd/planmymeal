import type { Metadata } from 'next';

// Métadonnées de la page (page.tsx est un composant client).
// Rendu à chaque requête : nécessaire pour recevoir le nonce de la CSP stricte (audit VULN-010)
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: "Créer un compte",
  description: "Créez votre compte PlanMyMeal gratuit, sans carte bancaire : menus de la semaine, liste de courses et suivi du budget en quelques clics.",
  robots: { index: false, follow: true },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
