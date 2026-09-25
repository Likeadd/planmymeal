// ============================================================================
// Service Worker PlanMyMeal — liste de courses disponible HORS LIGNE
// Stratégie :
//   - /_next/static, /icons, fonts  → cache-first (build fingerprinté)
//   - navigations (pages HTML)      → network-first, repli sur le cache,
//                                     puis /offline en dernier recours
//   - Supabase (données)            → JAMAIS intercepté : la donnée offline
//     de la liste de courses est gérée par un cache localStorage côté client
//     (src/lib/useWeeklyPlan.ts), pas par le SW (évite de servir des données
//     périmées ou d'un autre compte).
// ============================================================================

const VERSION = 'pmm-v1';
const STATIC_CACHE = `${VERSION}-static`;
const PAGES_CACHE = `${VERSION}-pages`;
const OFFLINE_URL = '/offline';

const PRECACHE = [
  OFFLINE_URL,
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-512-maskable.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE))
  );
  // Pas de skipWaiting automatique : la nouvelle version attend que les
  // onglets se ferment (pas de page à moitié migrée). clients.claim à l'activation.
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

/** true si la requête doit être laissée au réseau (données dynamiques) */
function bypass(request, url) {
  if (request.method !== 'GET') return true;
  if (url.origin !== self.location.origin) {
    // API Supabase / Resend / etc. → réseau uniquement
    return true;
  }
  // Next.js : payloads RSC et prefetchs navigations → pas de cache SW
  if (request.headers.get('RSC') === '1' || request.headers.get('Next-Router-Prefetch') === '1') {
    return true;
  }
  return false;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (bypass(request, url)) return;

  // Assets fingerprintés (/​_next/static, /icons) → cache-first
  if (url.pathname.startsWith('/_next/static') || url.pathname.startsWith('/icons')) {
    event.respondWith(
      (async () => {
        const cached = await caches.open(STATIC_CACHE).then((c) => c.match(request));
        if (cached) return cached;
        const res = await fetch(request);
        if (res.ok) {
          const cache = await caches.open(STATIC_CACHE);
          cache.put(request, res.clone());
        }
        return res;
      })()
    );
    return;
  }

  // Navigations (pages) → network-first avec repli cache puis /offline
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(request);
          if (res.ok) {
            const cache = await caches.open(PAGES_CACHE);
            cache.put(request, res.clone());
          }
          return res;
        } catch {
          const cached = await caches.open(PAGES_CACHE).then((c) => c.match(request));
          if (cached) return cached;
          const offline = await caches.open(STATIC_CACHE).then((c) => c.match(OFFLINE_URL));
          return offline || Response.error();
        }
      })()
    );
    return;
  }

  // Autres GET same-origin (images recettes, etc.) → network + cache opportuniste
  event.respondWith(
    (async () => {
      try {
        const res = await fetch(request);
        if (res.ok && (res.type === 'basic' || res.type === 'default')) {
          const cache = await caches.open(PAGES_CACHE);
          cache.put(request, res.clone());
        }
        return res;
      } catch {
        const cached = await caches.open(PAGES_CACHE).then((c) => c.match(request));
        return cached || Response.error();
      }
    })()
  );
});
