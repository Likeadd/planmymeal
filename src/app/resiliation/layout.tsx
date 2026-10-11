import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Résilier mon abonnement',
  description: 'Résiliez votre abonnement PlanMyMeal en un clic, sans motif ni frais, ou exercez votre droit de rétractation.',
  alternates: { canonical: '/resiliation' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
