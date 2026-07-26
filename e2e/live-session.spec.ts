import { test, expect } from '@playwright/test';
import path from 'path';

function uniqueUsername(): string {
  return `e2elivesession${Date.now()}`;
}

test('live session: upload a video, receive a real end event, and see results', async ({ page }) => {
  test.setTimeout(60 * 1000);

  await page.goto('/');

  await page.locator('#toggle-mode-btn').click();
  const username = uniqueUsername();
  await page.locator('#username-input').fill(username);
  await page.locator('#password-input').fill('supersecret1');
  await page.locator('#confirm-password-input').fill('supersecret1');
  await page.locator('#submit-btn').click();

  await expect(page.getByText('No training protocol yet')).toBeVisible();

  await page.getByRole('link', { name: 'Exercises' }).click();
  await page.locator('#exercises-mode-cv').click();

  const firstCard = page.locator('[id^="cv-exercise-card-"]').first();
  await expect(firstCard).toBeVisible();
  await firstCard.click();

  await expect(page.getByText('Live AI Form Tracking')).toBeVisible();
  const startBtn = page.locator('#start-live-session-btn');
  await expect(startBtn).toBeEnabled();
  await startBtn.click();

  await expect(page.getByText(/Live Session —/)).toBeVisible();
  const samplePath = path.resolve(__dirname, 'fixtures/test-clip.mp4');
  await page.locator('#live-session-file-input').setInputFiles(samplePath);
  await page.locator('#live-session-start-btn').click();

  // The synthetic fixture has no human figure, so no "state" events fire —
  // Computer-Vision's real pipeline still streams frames and always
  // publishes a real "end" event once the video finishes, with reps: 0.
  await expect(page.getByText('Session Complete')).toBeVisible({ timeout: 30000 });
  await expect(page.locator('#live-session-final-reps')).toHaveText('Reps: 0');
});
