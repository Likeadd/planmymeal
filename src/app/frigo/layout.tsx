import type { Metadata } from 'next';

// Métadonnées de la page (page.tsx est un composant client).
// Rendu à chaque requête : nécessaire pour recevoir le nonce de la CSP stricte (audit VULN-010)
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: "Mon frigo",
  description: "Les ingrédients de votre frigo, pris en compte dans vos menus.",
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
