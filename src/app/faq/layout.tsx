import type { Metadata } from 'next';
import { serialiserJsonLd } from '@/lib/seo';
import { FAQ_CATEGORIES } from './faq-data';

// Métadonnées de la page (page.tsx est un composant client).
export const metadata: Metadata = {
  title: "Questions fréquentes",
  description: "Tout savoir sur PlanMyMeal : menus, liste de courses, budget, abonnement.",
  alternates: { canonical: '/faq' },
};

// FAQPage schema.org : questions/réponses éligibles aux résultats enrichis.
const jsonLdFaq = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ_CATEGORIES.flatMap(c => c.items).map(item => ({
    '@type': 'Question',
    name: item.q,
    acceptedAnswer: { '@type': 'Answer', text: item.a },
  })),
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serialiserJsonLd(jsonLdFaq) }} />
      {children}
    </>
  );
}
