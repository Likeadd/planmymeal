import { defineConfig, devices } from '@playwright/test';

// ============================================================================
// Playwright E2E — PlanMyMeal (filet de sécurité avant chaque deploy)
// Lancer : npm run test:e2e
// Première fois : npx playwright install chromium
//
// Le serveur Next démarre automatiquement (webServer) et charge .env.local —
// le flow complet (génération) a besoin d'un Supabase joignable + d'un compte
// de test (E2E_EMAIL / E2E_PASSWORD). Sans compte, ce spec est skipped.
// ============================================================================

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    locale: 'fr-FR',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
