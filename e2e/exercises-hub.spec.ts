import { test, expect } from '@playwright/test';

function uniqueUsername(): string {
  return `e2eexercises${Date.now()}`;
}

test('exercises hub: browse CV trackable exercises and view detail with enabled live session CTA', async ({ page }) => {
  await page.goto('/');

  await page.locator('#toggle-mode-btn').click();
  const username = uniqueUsername();
  await page.locator('#username-input').fill(username);
  await page.locator('#password-input').fill('supersecret1');
  await page.locator('#confirm-password-input').fill('supersecret1');
  await page.locator('#submit-btn').click();

  await expect(page.getByText('No training protocol yet')).toBeVisible();

  await page.getByRole('link', { name: 'Exercises' }).click();
  await expect(page.getByRole('heading', { name: 'Exercise Library & AI Tracking' })).toBeVisible();

  await page.locator('#exercises-mode-cv').click();

  const firstCard = page.locator('[id^="cv-exercise-card-"]').first();
  await expect(firstCard).toBeVisible();
  await firstCard.click();

  await expect(page.getByText('Live AI Form Tracking')).toBeVisible();
  const startBtn = page.locator('#start-live-session-btn');
  await expect(startBtn).toBeVisible();
  await expect(startBtn).toBeEnabled();
});
