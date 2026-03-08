import { test, expect } from '@playwright/test';

async function register(page, username, password = 'test') {
  await page.goto('/');
  await page.getByRole('button', { name: 'Register' }).click({ force: true });
  const inputs = page.locator('input');
  await inputs.nth(0).fill(username);
  await inputs.nth(1).fill(password);
  await page.getByRole('button', { name: 'Create Account →' }).click({ force: true });
}

test('dashboard renders lesson entry points', async ({ page }) => {
  await register(page, `test_${Date.now()}`);

  await expect(page.getByText('BIENVENIDO', { exact: true })).toBeVisible();
  await expect(page.getByText('NEXT STEP')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start' }).first()).toBeVisible();
});

test('dashboard still renders when AI status is unavailable', async ({ page }) => {
  await page.route('**/api/ai/status**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        anyAvailable: false,
        checkedAt: new Date().toISOString(),
        providers: {
          anthropic: { configured: false, available: false, status: 'missing', reason: 'not configured' },
          openai: { configured: false, available: false, status: 'missing', reason: 'not configured' },
          gemini: { configured: false, available: false, status: 'missing', reason: 'not configured' },
        },
      }),
    });
  });

  await register(page, `test_${Date.now()}`);

  await expect(page.getByText('BIENVENIDO', { exact: true })).toBeVisible();
  await expect(page.getByText('NEXT STEP')).toBeVisible();
});
