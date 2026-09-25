import { expect, test } from '@playwright/test';

// ============================================================================
// E2E — Flow complet : login → (onboarding) → génération → liste de courses.
//
// Nécessite un Supabase joignable (.env.local) + un compte de test déjà créé :
//   E2E_EMAIL / E2E_PASSWORD (variables d'env locales ou CI).
// Sans compte de test, ce fichier est SKIPPED (les autres specs tournent quand
// même) — jamais de signup réel ici, pour ne pas polluer l'instance.
// ============================================================================

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

test.describe('Flow utilisateur complet', () => {
  test.skip(!email || !password, 'E2E_EMAIL / E2E_PASSWORD non définis — spec skipped');

  test('login → dashboard → génération de semaine → liste de courses', async ({ page }) => {
    // ── Login ──
    await page.goto('/login');
    await page.getByLabel('Adresse email').fill(email!);
    await page.getByLabel('Mot de passe').fill(password!);
    await page.getByRole('button', { name: /Se connecter/i }).click();

    // Le proxy redirige vers /onboarding si le profil est incomplet, sinon dashboard
    await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 20_000 });

    if (page.url().includes('/onboarding')) {
      // Onboarding : compléter le minimum (étapes guidées) pour atteindre le dashboard
      await completeOnboarding(page);
      await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
    }

    // ── Dashboard chargé ──
    await expect(page.getByText(/Semaine du/i).first()).toBeVisible({ timeout: 20_000 });

    // ── Génération (ou régénération) de la semaine — le CTA s'appelle
    // « Optimiser ma semaine » partout (états vides comme planning existant) ──
    const generate = page.getByRole('button', { name: /(Optimiser ma semaine|Optimiser cette semaine|Régénérer)/i }).first();
    await generate.click();

    // Le planning apparaît : onglet de jour mobile « LUN 7 » ou colonne
    // desktop « LUN » (vue onglets de jours depuis la refonte mobile-first)
    await expect(page.getByText(/^LUN$/i).first()).toBeVisible({ timeout: 60_000 });

    // ── Liste de courses ──
    await page.getByRole('button', { name: /Liste de courses/i }).click();
    // Soit des sections rayons, soit le message « aucune liste » (les deux = page fonctionnelle)
    await expect(
      page.getByText(/articles|Aucune liste de courses pour cette semaine/i).first()
    ).toBeVisible({ timeout: 15_000 });
  });
});

/** Onboarding minimal : répond aux étapes jusqu'au dashboard. */
async function completeOnboarding(page: import('@playwright/test').Page) {
  // Nombre d'étapes variable : on boucle tant qu'on est sur /onboarding
  for (let step = 0; step < 12; step++) {
    if (!page.url().includes('/onboarding')) return;

    const next = page.getByRole('button', { name: /^(Continuer|Suivant|Valider|Terminer)/i }).first();
    const visible = await next.isVisible().catch(() => false);

    // Sélection neutre si un choix est requis (première option cliquable)
    if (!visible) {
      const option = page.locator('button[type="button"]:not([disabled])').last();
      await option.click().catch(() => {});
    }
    await next.click().catch(() => {});
    await page.waitForTimeout(600);
  }
}
