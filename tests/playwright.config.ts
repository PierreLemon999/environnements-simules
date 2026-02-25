import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  outputDir: './results',
  timeout: 30000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:5173',
    screenshot: 'only-on-failure',
    trace: 'off',
  },
  projects: [
    {
      name: 'screenshots',
      testMatch: /screenshots\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'functional',
      testMatch: /functional\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
