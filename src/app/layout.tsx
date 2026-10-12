import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { Suspense } from 'react';
import Script from 'next/script';
import './globals.css';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/components/AuthProvider';
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister';
import { ScrollAncre } from '@/components/ScrollAncre';
import { CookieBanner } from '@/components/CookieBanner';
import { SuiviSource } from '@/components/SuiviSource';
import { GlobalLoadingBar } from '@/components/GlobalLoadingBar';
import { ScrollReveal } from '@/components/ScrollReveal';
import { SITE_URL, serialiserJsonLd } from '@/lib/seo';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

const siteUrl = SITE_URL;
const siteDescription = 'PlanMyMeal — L\'appli qui se souvient de ce que tu as mangé pour toi. Plans de repas personnalisés, liste de courses automatique et rotation intelligente.';

// Identité du site pour les moteurs (panneau de marque, nom du site dans les résultats)
const jsonLdSite = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${siteUrl}/#organisation`,
      name: 'PlanMyMeal',
      url: siteUrl,
      logo: `${siteUrl}/icons/icon-512.png`,
    },
    {
      '@type': 'WebSite',
      '@id': `${siteUrl}/#site`,
      name: 'PlanMyMeal',
      url: siteUrl,
      inLanguage: 'fr-FR',
      publisher: { '@id': `${siteUrl}/#organisation` },
    },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'PlanMyMeal — Mangez mieux. Planifiez moins.',
    template: '%s — PlanMyMeal',
  },
  description: siteDescription,
  applicationName: 'PlanMyMeal',
  category: 'food',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    url: '/',
    siteName: 'PlanMyMeal',
    title: 'PlanMyMeal — Mangez mieux. Planifiez moins.',
    description: siteDescription,
    // Image injectée automatiquement par src/app/opengraph-image.tsx (1200×630)
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PlanMyMeal — Mangez mieux. Planifiez moins.',
    description: siteDescription,
    // Retombe sur l'image openGraph si pas de twitter-image dédiée
  },
  icons: {
    // Logo dans l'onglet/navigateur : SVG vectoriel (crisp à toute taille,
    // servi depuis src/app/icon.svg) + fallbacks PNG pour les vieux navigateurs
    // + icône iOS. Next insère les <link rel="icon"> correspondants.
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    shortcut: '/icon.svg',
    apple: '/icons/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'PlanMyMeal',
  },
};

export const viewport: Viewport = {
  themeColor: '#C4552C', // brand-500 terracotta
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className={`${inter.variable} min-h-screen flex flex-col`}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serialiserJsonLd(jsonLdSite) }} />
        <AuthProvider>
          {children}
          {/* Repositionne les ancres /#section après stabilisation des polices
              et images — sinon la section atterrit décalée sous le header. */}
          <Suspense fallback={null}>
            <ScrollAncre />
          </Suspense>
        </AuthProvider>
        <ServiceWorkerRegister />
        <CookieBanner />
        <SuiviSource />
        <GlobalLoadingBar />
        {/* Sans JavaScript, les animations d'apparition ne se déclencheraient
            jamais : le contenu reste alors visible. */}
        <noscript>
          <style>{'[data-reveal],[style*="opacity:0"]{opacity:1!important;transform:none!important}'}</style>
        </noscript>
        <ScrollReveal />
        <Toaster position="bottom-right" toastOptions={{ style: { background: '#332A1E', color: '#FBF8F1', border: 'none' } }} />
        {/* Plausible : mesure d'audience sans cookie ni donnée personnelle
            (CNIL : exempté de consentement). Production uniquement — le
            trafic de dev/preview ne doit pas polluer les statistiques. */}
        {process.env.NODE_ENV === 'production' && (
          <Script
            defer
            data-domain="getplanmymeal.com"
            src="https://plausible.io/js/script.js"
            strategy="afterInteractive"
          />
        )}
      </body>
    </html>
  );
}