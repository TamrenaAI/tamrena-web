import { test, expect } from '@playwright/test';

function uniqueUsername(): string {
  return `e2euser${Date.now()}`;
}

test('sign-up creates a real account and reaches the post-sign-in state', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByText('Tamreena')).toBeVisible();
  await expect(page.getByText('Your body. Your data. Your protocol.')).toBeVisible();
  await expect(page.getByAltText('Tamreena')).toBeVisible();

  await page.locator('#toggle-mode-btn').click();
  await expect(page.getByText('Already have an account? Sign in')).toBeVisible();

  const username = uniqueUsername();
  await page.locator('#username-input').fill(username);
  await page.locator('#password-input').fill('supersecret1');
  await page.locator('#confirm-password-input').fill('supersecret1');
  await page.locator('#submit-btn').click();

  await expect(page.getByText('No training protocol yet')).toBeVisible();
});

test('sign-in works for an already-registered account', async ({ page, request }) => {
  const username = uniqueUsername();
  const apiBase = 'http://localhost:8010';

  const signupRes = await request.post(`${apiBase}/auth/signup`, {
    data: { username, password: 'correctpass1', confirm_password: 'correctpass1' },
  });
  expect(signupRes.ok()).toBeTruthy();

  await page.goto('/');
  await expect(page.getByText("Don't have an account? Sign up")).toBeVisible();

  await page.locator('#username-input').fill(username);
  await page.locator('#password-input').fill('correctpass1');
  await page.locator('#submit-btn').click();

  await expect(page.getByText('No training protocol yet')).toBeVisible();
});

test('sign-in shows an error for wrong credentials', async ({ page }) => {
  await page.goto('/');

  await page.locator('#username-input').fill('nonexistent-user-e2e');
  await page.locator('#password-input').fill('whatever123');
  await page.locator('#submit-btn').click();

  await expect(page.getByText('Invalid username or password.')).toBeVisible();
});
