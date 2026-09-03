import { defineConfig, devices } from '@playwright/test';
import type { E2EOptions } from './src/test';

const baseURL = process.env['STACK_BASE_URL'] ?? 'http://localhost:3200';

export default defineConfig<E2EOptions>({
  expect: {
    timeout: 10 * 1000,
  },
  fullyParallel: true,
  outputDir: '.stack-test-results',
  testDir: './specs',
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  retries: process.env['CI'] === undefined ? 0 : 1,
  timeout: 60 * 1000,
  use: {
    baseURL,
    codeSource: 'stack',
    resendStubURL: process.env['RESEND_STUB_URL'] ?? 'http://localhost:3020',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
});
