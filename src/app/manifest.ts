import type { MetadataRoute } from 'next';

/**
 * Manifeste PWA — servi sur /manifest.webmanifest (Next insère le <link>).
 * Display standalone : l'app s'ouvre plein écran depuis l'écran d'accueil,
 * comme une app native (usage supermarché, réseau faible).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'PlanMyMeal — la fin du « qu\'est-ce qu\'on mange ? »',
    short_name: 'PlanMyMeal',
    description:
      'Planificateur de repas intelligent avec mémoire de rotation, liste de courses automatique (offline) et suivi de budget.',
    id: '/',
    start_url: '/aujourdhui',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    lang: 'fr',
    background_color: '#FBF8F1', // gray-50 (crème)
    theme_color: '#C4552C',      // brand-500 (terracotta)
    categories: ['food', 'lifestyle', 'productivity'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
