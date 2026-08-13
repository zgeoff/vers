import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import type { E2EOptions } from './src/test';

const baseURL = process.env['BASE_URL'] ?? 'http://localhost:3000';

/**
 * Resolves the project root without relying on `__dirname`, which is unreliable when this file is
 * parsed for the task graph rather than run from its own directory.
 */
const projectRoot = process.cwd().includes('web-e2e')
  ? process.cwd()
  : `${process.cwd()}/apps/web-e2e`;

const appWebRoot = path.resolve(projectRoot, '..', 'web');
const dotEnvFile = path.join(projectRoot, '.env');

try {
  process.loadEnvFile(dotEnvFile);
} catch {
  // no .env locally (CI writes one from a secret) — the smoke spec that runs without a .env
  // needs no secrets
}

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
    baseURL,
    codeSource: 'mock',
    mockVerificationURL: process.env['VERIFICATION_SERVICE_URL'] ?? 'http://localhost:3004',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      // the same stateful mock backends the default config boots; a benchmark run still needs a
      // login and an avatar for the seeded account, not just the app server
      command: 'bun src/serve-mock-services.ts',
      cwd: projectRoot,
      reuseExistingServer: false,
      stderr: 'pipe',
      stdout: 'pipe',
      timeout: 60 * 1000,
      url: `${process.env['USER_SERVICE_URL'] ?? 'http://localhost:3003'}/health`,
    },
    {
      // no FEATURE_GAME_RENDERER override here: unlike the default config, this benchmark's whole
      // point is measuring the real WebGPU/R3F canvas, not the placeholder
      command: 'node ./server.mjs',
      cwd: appWebRoot,
      env: {
        FEATURE_MARKET: 'true',
        LOGGING: 'warn',
        NODE_ENV: 'production',
        PORT: new URL(baseURL).port,
        SESSION_SECRET: 'e2e-session-secret-32-characters',
      },
      reuseExistingServer: false,
      stderr: 'pipe',
      stdout: 'pipe',
      timeout: 240 * 1000,
      url: `${baseURL}/health`,
    },
  ],
});
