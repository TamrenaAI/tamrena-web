import { test, expect } from '@playwright/test';

function uniqueUsername(): string {
  return `e2eprogress${Date.now()}`;
}

test('progress tab shows empty states for a fresh account with no scans', async ({ page }) => {
  await page.goto('/');

  await page.locator('#toggle-mode-btn').click();
  const username = uniqueUsername();
  await page.locator('#username-input').fill(username);
  await page.locator('#password-input').fill('supersecret1');
  await page.locator('#confirm-password-input').fill('supersecret1');
  await page.locator('#submit-btn').click();

  await expect(page.getByText('No training protocol yet')).toBeVisible();

  await page.getByRole('link', { name: 'Progress' }).click();
  await expect(page.getByRole('heading', { name: 'Progress' })).toBeVisible();
  await expect(page.getByText('Scan again on your next plan to see your progress here.')).toBeVisible();
  await expect(page.locator('#monthly-review-submit-btn')).toHaveCount(0);
});
