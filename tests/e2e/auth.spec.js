import { test, expect } from '@playwright/test';

async function register(page, username, password = 'test') {
  await page.goto('/');
  await page.getByRole('button', { name: 'Register' }).click({ force: true });
  const inputs = page.locator('input');
  await inputs.nth(0).fill(username);
  await inputs.nth(1).fill(password);
  await page.getByRole('button', { name: 'Create Account →' }).click({ force: true });
}

test('register reaches authenticated dashboard', async ({ page }) => {
  const username = `test_${Date.now()}`;

  await register(page, username, 'test');
  await expect(page.getByText('BIENVENIDO', { exact: true })).toBeVisible();
  await expect(page.getByText('NEXT STEP')).toBeVisible();
});
