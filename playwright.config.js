import { defineConfig, devices } from '@playwright/test';

const PORT = process.env.E2E_PORT || 4173;
const LOCAL_BASE_URL = `http://127.0.0.1:${PORT}`;
const BASE_URL = process.env.E2E_BASE_URL || LOCAL_BASE_URL;
const USE_LOCAL_SERVER = !process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  webServer: USE_LOCAL_SERVER
    ? {
        command: `npm run dev -- --host 127.0.0.1 --port ${PORT}`,
        url: LOCAL_BASE_URL,
        reuseExistingServer: true,
        timeout: 120_000,
      }
    : undefined,
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
