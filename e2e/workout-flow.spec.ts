import { test, expect } from '@playwright/test';
import path from 'path';

function uniqueUsername(): string {
  return `e2eworkout${Date.now()}`;
}

test('sign-up through a fully generated plan, then submit feedback', async ({ page }) => {
  test.setTimeout(5 * 60 * 1000); // real plan generation can take several minutes

  await page.goto('/');

  await page.locator('#toggle-mode-btn').click();
  const username = uniqueUsername();
  await page.locator('#username-input').fill(username);
  await page.locator('#password-input').fill('supersecret1');
  await page.locator('#confirm-password-input').fill('supersecret1');
  await page.locator('#submit-btn').click();

  await expect(page.getByText('No training protocol yet')).toBeVisible();
  await page.locator('#generate-first-plan-link').click();

  await expect(page.getByText('Step 1 of 3')).toBeVisible();
  await page.locator('#intake-goal').fill('muscle_gain');
  await page.locator('#intake-days-per-week').fill('4');
  await page.locator('#intake-session-duration').fill('60min');
  await page.locator('#intake-step1-next').click();

  await expect(page.getByText('Step 2 of 3')).toBeVisible();
  await page.locator('#intake-step2-next').click();

  await expect(page.getByText('Step 3 of 3')).toBeVisible();
  await page.locator('#intake-step3-continue').click();

  await expect(page.getByText('InBody Scan Extraction')).toBeVisible();
  const samplePath = path.resolve(__dirname, '../../Tamreena_AI/samples/inbody2.jfif');
  await page.locator('#inbody-pdf-file-input').setInputFiles(samplePath);
  await page.locator('#proceed-extract-btn').click();

  await expect(page.getByText('Processing InBody Scan')).toBeVisible();
  await expect(page.getByText('Training Protocol')).toBeVisible({ timeout: 5 * 60 * 1000 });

  await page.locator('#feedback-day-label').fill('Day 1');
  await page.locator('#feedback-exercise-name').fill('Squat');
  await page.locator('#submit-feedback-btn').click();
  await expect(page.getByText(/Feedback recorded\.|adjusted/)).toBeVisible({ timeout: 30000 });
});

test('sidebar shows all 5 tabs and Progress tab loads for a fresh account', async ({ page, request }) => {
  const username = uniqueUsername();
  const apiBase = 'http://localhost:8010';
  const signupRes = await request.post(`${apiBase}/auth/signup`, {
    data: { username, password: 'correctpass1', confirm_password: 'correctpass1' },
  });
  expect(signupRes.ok()).toBeTruthy();

  await page.goto('/');
  await page.locator('#username-input').fill(username);
  await page.locator('#password-input').fill('correctpass1');
  await page.locator('#submit-btn').click();
  await expect(page.getByText('No training protocol yet')).toBeVisible();

  for (const label of ['Dashboard', 'Workout Plan', 'Progress', 'Exercises', 'Nutrition']) {
    await expect(page.getByRole('link', { name: label, exact: true })).toBeVisible();
  }

  await page.getByRole('link', { name: 'Progress' }).click();
  await expect(page.getByRole('heading', { name: 'Progress' })).toBeVisible();
});
