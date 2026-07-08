import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env['BASE_URL'] ?? 'http://localhost:3000';

// having a million issues trying to use __dirname to establish a reliable path
// so it's easier to do this to handle the case when this file gets parsed for
// building our task graph
const projectRoot = process.cwd().includes('app-web-e2e')
  ? process.cwd()
  : `${process.cwd()}/projects/app-web-e2e`;

const appWebRoot = path.resolve(projectRoot, '..', 'app-web');

const dotEnvFile = path.join(projectRoot, '.env');

try {
  process.loadEnvFile(dotEnvFile);
} catch {
  // no .env locally (CI writes one from a secret) — the phase 1 smoke spec needs no secrets
}

export default defineConfig({
  expect: {
    timeout: 10 * 1000,
  },
  fullyParallel: true,
  outputDir: '.test-results',
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // retries are unsound here: the mock db persists across attempts, so a
  // retry of any mutating spec replays against already-mutated state (a
  // changed password, a live session) and fails differently
  retries: 0,
  timeout: 30 * 1000,
  use: {
    baseURL,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    // boots the dev server: its own vite plugin starts the mock backend (see
    // app-web/vite.config.ts), giving specs a real request/response cycle without a production
    // build
    command: 'bun run dev',
    cwd: appWebRoot,
    env: {
      PLAYWRIGHT_TEST_BASE_URL: baseURL,
      SESSION_SECRET: 'e2e-session-secret',
    },
    // oxlint-disable-next-line typescript/strict-boolean-expressions -- baseline(#236)
    reuseExistingServer: !process.env['CI'],
    stderr: 'pipe',
    stdout: 'pipe',
    timeout: 240 * 1000,
    url: baseURL,
  },
  // oxlint-disable-next-line typescript/strict-boolean-expressions -- baseline(#236)
  ...(process.env['CI'] && { workers: 1 }),
});
