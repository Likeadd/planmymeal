import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { Suspense } from 'react';
import './globals.css';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/components/AuthProvider';
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister';
import { ScrollAncre } from '@/components/ScrollAncre';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://planmymeal.app').replace(/\/$/, '');
const siteDescription = 'PlanMyMeal — L\'appli qui se souvient de ce que tu as mangé pour toi. Plans de repas personnalisés, liste de courses automatique et rotation intelligente.';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'PlanMyMeal — Mangez mieux. Planifiez moins.',
    template: '%s — PlanMyMeal',
  },
  description: siteDescription,
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
        <AuthProvider>
          {children}
          {/* Repositionne les ancres /#section après stabilisation des polices
              et images — sinon la section atterrit décalée sous le header. */}
          <Suspense fallback={null}>
            <ScrollAncre />
          </Suspense>
        </AuthProvider>
        <ServiceWorkerRegister />
        <Toaster position="bottom-right" toastOptions={{ style: { background: '#332A1E', color: '#FBF8F1', border: 'none' } }} />
      </body>
    </html>
  );
}