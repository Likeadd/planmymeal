import { expect, test } from '@playwright/test';

// ============================================================================
// E2E — Validation du formulaire signup (côté client, sans backend)
// Vérifie la politique de mot de passe renforcée (8 car. + lettre + chiffre).
// Aucun compte réel n'est créé : on s'arrête aux erreurs de validation.
// ============================================================================

test.describe('Signup — validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/signup');
  });

  test('refuse un mot de passe sans chiffre', async ({ page }) => {
    await page.getByLabel('Votre prénom').fill('Test');
    await page.getByLabel('Adresse email').fill('e2e-validation@example.com');
    await page.getByLabel('Mot de passe').fill('lettres seulement');
    await page.getByRole('button', { name: /Créer mon compte gratuit/i }).click();

    await expect(
      page.getByText(/au moins 8 caractères, dont une lettre et un chiffre/i)
    ).toBeVisible();
    // Reste sur le formulaire (pas de redirection)
    await expect(page).toHaveURL(/\/signup/);
  });

  test('refuse un mot de passe trop court', async ({ page }) => {
    await page.getByLabel('Votre prénom').fill('Test');
    await page.getByLabel('Adresse email').fill('e2e-validation@example.com');
    await page.getByLabel('Mot de passe').fill('a1b2');
    await page.getByRole('button', { name: /Créer mon compte gratuit/i }).click();

    await expect(
      page.getByText(/au moins 8 caractères, dont une lettre et un chiffre/i)
    ).toBeVisible();
    await expect(page).toHaveURL(/\/signup/);
  });

  test('refuse les champs vides', async ({ page }) => {
    await page.getByRole('button', { name: /Créer mon compte gratuit/i }).click();
    await expect(page.getByText('Tous les champs sont requis.')).toBeVisible();
  });
});
