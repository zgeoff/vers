import { defineConfig, devices } from '@playwright/test';
import { loadE2EEnvironment } from './src/load-e2e-environment';
import type { E2EOptions } from './src/test';

// no FEATURE_GAME_RENDERER override here: unlike the default config, a benchmark's whole point is
// measuring the real WebGPU/R3F canvas, not the placeholder
const environment = loadE2EEnvironment({});

/**
 * On-demand perf benchmarks: run manually against a real GPU, never picked up by `bun run e2e`'s
 * default config. Its own `testDir` keeps every benchmark spec out of `playwright.config.ts`'s
 * discovery entirely, so nothing here can ever land on the CI critical path.
 */
export default defineConfig<E2EOptions>({
  expect: {
    timeout: 10 * 1000,
  },
  fullyParallel: false,
  outputDir: '.bench-test-results',
  testDir: './benchmarks',
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],

        // best-effort GPU acceleration under headless Chromium; run with `--headed` for numbers
        // that reflect a real compositor instead of software rendering
        launchOptions: {
          args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist'],
        },
      },
    },
  ],
  retries: 0,
  timeout: 120 * 1000,
  use: {
    baseURL: environment.baseURL,
    codeSource: 'mock',
    mockVerificationURL: process.env['VERIFICATION_SERVICE_URL'] ?? 'http://localhost:3004',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: [...environment.webServer],
});
