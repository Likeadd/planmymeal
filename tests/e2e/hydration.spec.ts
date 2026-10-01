import { expect, test, type Page } from '@playwright/test';

// ============================================================================
// Non-régression : erreurs d'hydratation (hydration mismatch)
//
// Bug corrigé : `Reveal` changeait l'arbre rendu selon `useReducedMotion()`.
// Le serveur ne connaît pas cette préférence — le hook vaut `null` au SSR —
// donc le HTML serveur contenait style="opacity:0; transform:translateY(24px)"
// alors que le premier rendu client, sur un appareil en « mouvement réduit »,
// produisait un <div> sans ce style :
//   « Hydration failed because the server rendered HTML didn't match the client »
//
// On rejoue donc les pages publiques dans les DEUX modes, dont
// `reducedMotion: 'reduce'` : c'est précisément l'état de l'appareil qui
// déclenchait le bug. Sans le correctif, ces tests échouent.
// ============================================================================

test.describe.configure({ timeout: 60_000 });

const PAGES_PUBLIQUES = [
  '/',
  '/login',
  '/signup',
  '/faq',
  '/cgv',
  '/mentions-legales',
  '/contact',
  '/recettes',
];

/** React signale le mismatch en clair (« Hydration failed because… ») */
const MOTIFS_HYDRATATION = /hydrat|did not match|didn't match|server rendered HTML/i;

async function verifierHydratation(page: Page, chemin: string): Promise<void> {
  const erreurs: string[] = [];
  page.on('console', msg => { if (msg.type() === 'error') erreurs.push(msg.text()); });
  page.on('pageerror', err => erreurs.push(err.message));

  await page.goto(chemin, { waitUntil: 'domcontentloaded' });
  // Laisse l'hydratation React et les fetch de données se terminer
  await page.waitForTimeout(2000);

  const hydration = erreurs.filter(e => MOTIFS_HYDRATATION.test(e));
  expect(hydration, `Hydration mismatch sur ${chemin} :\n${hydration.join('\n---\n')}`).toEqual([]);
}

for (const reducedMotion of ['reduce', 'no-preference'] as const) {
  test.describe(`mouvement: ${reducedMotion}`, () => {
    test.use({ reducedMotion });

    for (const chemin of PAGES_PUBLIQUES) {
      test(`aucune erreur d'hydratation sur ${chemin}`, async ({ page }) => {
        await verifierHydratation(page, chemin);
      });
    }
  });
}

// ─── Le catalogue charge bien ses données ──────────────────────────────────

// Non-régression sur l'embed ajouté pour les pastilles du foyer : la requête
// `/recettes` sélectionne désormais `meal_ingredients(...)`. Si PostgREST la
// refuse, la page n'affiche AUCUNE carte (branche `error`) — ce test le voit,
// là où la simple absence d'erreur d'hydratation ne verrait rien.

test.describe('catalogue de recettes', () => {  test('/recettes affiche des recettes (embed d\'ingrédients compris)', async ({ page }) => {
    await page.goto('/recettes', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('a[href^="/recette/"]').first()).toBeVisible({ timeout: 25_000 });
  });

  // Le catalogue dépasse le plafond de 1000 lignes d'une réponse PostgREST :
  // sans pagination, la page annoncerait moins de recettes qu'elle n'en a, et
  // les dernières ne seraient atteignables nulle part. On lit le compteur
  // affiché plutôt qu'un seuil en dur, qui vieillirait mal.
  test('/recettes pagine au-delà du plafond PostgREST', async ({ page }) => {
    await page.goto('/recettes', { waitUntil: 'domcontentloaded' });
    const sousTitre = page.locator('p').filter({ hasText: /recettes? ·/ }).first();
    await expect(sousTitre).toBeVisible({ timeout: 25_000 });
    const affiche = Number((await sousTitre.textContent())?.match(/(\d[\d\s]*)\s*recette/)?.[1]?.replace(/\s/g, ''));
    expect(Number.isFinite(affiche)).toBe(true);
    expect(affiche).toBeGreaterThan(1000);
  });
});

// ─── Les routes protégées renvoient vers /login ─────────────────────────────

// Vérifie aussi la protection ajoutée pour la nouvelle page /frigo (le proxy
// ne protégeait que dashboard / onboarding / compte / planning / favoris).

test.describe('routes protégées', () => {
  for (const chemin of ['/dashboard', '/frigo', '/compte', '/planning']) {
    test(`${chemin} redirige un visiteur anonyme vers /login`, async ({ page }) => {
      await page.goto(chemin, { waitUntil: 'domcontentloaded' });
      await page.waitForURL(/\/login/, { timeout: 20_000 });
      expect(new URL(page.url()).pathname).toBe('/login');
    });
  }
});

// ─── Les routes API de la mémoire alimentaire sont bien câblées ────────────

test.describe('API mémoire alimentaire & frigo', () => {
  const routes = [
    '/api/preferences',
    '/api/frigo',
    '/api/pourquoi?meal_id=1&jour=0&repas=diner',
    '/api/famille',
  ];

  for (const chemin of routes) {
    test(`${chemin} → 401 sans session (jamais 5xx)`, async ({ request }) => {
      const res = await request.get(chemin);
      expect(res.status()).toBe(401);
      expect(await res.json()).toHaveProperty('error');
    });
  }
});
