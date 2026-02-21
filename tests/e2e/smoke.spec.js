import { test, expect } from '@playwright/test';

async function register(page, username, password = 'test') {
  await page.goto('/');
  await page.getByRole('button', { name: 'Register' }).click();
  const inputs = page.locator('input');
  await inputs.nth(0).fill(username);
  await inputs.nth(1).fill(password);
  await page.getByRole('button', { name: 'Create Account →' }).click();
}

test('dashboard shows adaptive widgets and can open a lesson', async ({ page }) => {
  await register(page, `test_${Date.now()}`);

  await expect(page.getByText('Adaptive Path', { exact: true })).toBeVisible();
  await expect(page.getByText('Learning Analytics')).toBeVisible();

  await page.getByRole('button', { name: 'Placement Test' }).first().click();
  await expect(page.getByText('Placement Test')).toBeVisible();
  await expect(page.getByRole('button', { name: '← Back' })).toBeVisible();
});

test('AI modules disable when provider status says unavailable', async ({ page }) => {
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

  const chatPartner = page.getByRole('button', { name: 'Chat Partner' });
  const pictureDesc = page.getByRole('button', { name: 'Picture Description' });

  await expect(chatPartner).toBeDisabled();
  await expect(pictureDesc).toBeDisabled();
});
