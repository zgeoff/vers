import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env['BASE_URL'] ?? 'http://localhost:4000';

const { port } = new URL(baseURL);

// having a million issues trying to use __dirname to establish a reliable path
// so it's easier to do this to handle the case when this file gets parsed for
// building our task graph
const projectRoot = process.cwd().includes('app-web-e2e')
  ? process.cwd()
  : `${process.cwd()}/projects/app-web-e2e`;

const appWebRoot = path.resolve(projectRoot, '..', 'app-web');

const dotEnvFile = path.join(projectRoot, '.env');

process.loadEnvFile(dotEnvFile);

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
    // the suite runs against the production build: the e2e vite mode bakes
    // VITE_ENABLE_MSW in so the mock layer and seed ship in the bundle, and
    // the server process runs as NODE_ENV=production like a real deploy
    command: 'bunx turbo run build:e2e --filter=@vers/web && node ./server.mjs',
    cwd: appWebRoot,
    env: {
      NODE_ENV: 'production',

      // lifts the rate-limit caps for test traffic — the server otherwise
      // 429s parallel workers arriving from one address
      PLAYWRIGHT_TEST_BASE_URL: baseURL,
      PORT: port,
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
