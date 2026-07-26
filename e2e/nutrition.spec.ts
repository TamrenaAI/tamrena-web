import { test, expect } from '@playwright/test';

function uniqueUsername(): string {
  return `e2enutrition${Date.now()}`;
}

test('nutrition: submit intake, watch real generation progress, see results', async ({ page }) => {
  test.setTimeout(180 * 1000);

  await page.goto('/');

  await page.locator('#toggle-mode-btn').click();
  const username = uniqueUsername();
  await page.locator('#username-input').fill(username);
  await page.locator('#password-input').fill('supersecret1');
  await page.locator('#confirm-password-input').fill('supersecret1');
  await page.locator('#submit-btn').click();

  await expect(page.getByText('No training protocol yet')).toBeVisible();

  await page.getByRole('link', { name: 'Nutrition', exact: true }).click();
  await expect(page).toHaveURL(/\/nutrition\/intake$/);

  await page.locator('#nutrition-age').fill('28');
  await page.locator('#nutrition-gender').selectOption('male');
  await page.locator('#nutrition-height').fill('178');
  await page.locator('#nutrition-weight').fill('80');
  await page.locator('#nutrition-goal').selectOption('maintenance');
  await page.locator('#nutrition-intake-submit').click();

  await expect(page).toHaveURL(/\/nutrition\/generating$/, { timeout: 10000 });
  await expect(page).toHaveURL(/\/nutrition\/results\//, { timeout: 150000 });

  await expect(page.locator('#nutrition-macro-summary')).toBeVisible();
  await expect(page.locator('#nutrition-meal-plan')).toBeVisible();
});
