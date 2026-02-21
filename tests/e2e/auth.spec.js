import { test, expect } from '@playwright/test';

async function register(page, username, password = 'test') {
  await page.goto('/');
  await page.getByRole('button', { name: 'Register' }).click();
  const inputs = page.locator('input');
  await inputs.nth(0).fill(username);
  await inputs.nth(1).fill(password);
  await page.getByRole('button', { name: 'Create Account →' }).click();
}

test('register + logout + login persists account', async ({ page }) => {
  const username = `test_${Date.now()}`;

  await register(page, username, 'test');
  await expect(page.getByText('BIENVENIDO', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Sign Out' }).click();
  await expect(page.getByRole('button', { name: 'Sign In →' })).toBeVisible();

  const inputs = page.locator('input');
  await inputs.nth(0).fill(username);
  await inputs.nth(1).fill('test');
  await page.getByRole('button', { name: 'Sign In →' }).click();

  await expect(page.getByText('BIENVENIDO', { exact: true })).toBeVisible();
});
