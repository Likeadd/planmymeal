import type { Metadata } from 'next';

// Rendu à chaque requête : nécessaire pour recevoir le nonce de la CSP stricte (audit VULN-010)
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Nouveau mot de passe',
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
