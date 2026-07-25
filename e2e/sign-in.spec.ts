import { test, expect } from '@playwright/test';

test('dev-login signs the user in and reaches the post-sign-in state', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('#google-signin-btn')).toBeVisible();
  await expect(page.getByText('Tamreena')).toBeVisible();
  await expect(page.getByText('Your body. Your data. Your protocol.')).toBeVisible();

  await page.locator('#dev-login-btn').click();

  await expect(page.getByText('Signed in — Home page comes in a later stage.')).toBeVisible();
});

test('sign-in card renders the correct visual elements from the approved mockup', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByText('Sign in with Google')).toBeVisible();
  await expect(page.getByText('By continuing, you agree to our Terms of Service and Privacy Policy.')).toBeVisible();
});
