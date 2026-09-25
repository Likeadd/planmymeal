import { expect, test } from '@playwright/test';

// ============================================================================
// E2E — Landing page publique (aucune auth requise, tourne partout)
// ============================================================================

test.describe('Landing', () => {
  test('affiche le hero, les sections et le CTA principal', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(/PlanMyMeal/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Mangez mieux');

    // CTA principal (visiteur non connecté)
    await expect(page.getByRole('link', { name: /Planifier ma semaine/i })).toBeVisible();

    // Sections clés de la landing
    await expect(page.locator('#collection')).toBeAttached();
    await expect(page.locator('#tarifs')).toBeAttached();
    await expect(page.getByText('Commencer gratuitement')).toBeVisible();
    await expect(page.getByText('Passer à Pro')).toBeVisible();

    // Pas d'erreur JS bloquante en console
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.waitForTimeout(500);
    expect(errors).toEqual([]);
  });

  test('la page 404 affiche le design dédié avec retour accueil', async ({ page }) => {
    await page.goto('/page-inexistante-pmm');
    await expect(page.getByText('Cette page a quitté la cuisine')).toBeVisible();
    await expect(page.getByRole('link', { name: /Retour à l'accueil/i })).toBeVisible();
  });
});
