import { defineConfig, devices } from '@playwright/test';
import type { JourneyOptions } from './src/support/types';

const baseURL = process.env['STACK_BASE_URL'] ?? 'http://localhost:3200';

/**
 * The full-stack suite: the whole converged spec set against the real service images the deploy
 * pipeline is about to promote, booted by `docker-compose.stack.yml` before playwright runs — no
 * webServer entries, the harness owns the stack lifecycle. Specs create their own unique accounts,
 * so a retry never replays against state a failed attempt mutated.
 */
export default defineConfig<JourneyOptions>({
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
