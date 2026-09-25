import { PageSkeleton } from '@/components/AppSkeleton';

// Chargement de la route racine (navigations vers des pages sans loading dédié)
export default function Loading() {
  return <PageSkeleton />;
}
