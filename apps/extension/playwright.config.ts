import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 45_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  reporter: 'list',
  globalSetup: './tests/setup/global-setup.ts',
  use: {
    headless: false, // Extensions require a headed browser
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
});
