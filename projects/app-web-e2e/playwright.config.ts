import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env['BASE_URL'] ?? 'http://localhost:3000';
const productionBaseURL = process.env['PRODUCTION_BASE_URL'] ?? 'http://localhost:3010';

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
  // no .env locally (CI writes one from a secret) — the smoke spec that runs without a .env
  // needs no secrets
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
  webServer: [
    {
      // the dev server's own vite plugin starts the mock backend, giving journey specs the mock
      // services a signed-in flow needs. Only `vite dev` fires that plugin's `configureServer`
      // hook, so the production build below can't host it.
      command: 'bun run dev',
      cwd: appWebRoot,
      env: {
        PLAYWRIGHT_TEST_BASE_URL: baseURL,

        // Start's session sealing rejects any password under 32 characters
        SESSION_SECRET: 'e2e-session-secret-32-characters',
      },
      reuseExistingServer: process.env['CI'] === undefined,
      stderr: 'pipe',
      stdout: 'pipe',
      timeout: 240 * 1000,
      url: baseURL,
    },
    {
      // the real production artifact (`vite build` + `server.mjs`) on its own port, so a smoke
      // spec can prove the deployable build serves traffic. It hosts no mock backend, so only
      // routes that call no downstream service (the health check, the anonymous home page) work.
      command: 'bun run build && node ./server.mjs',
      cwd: appWebRoot,
      env: {
        LOGGING: 'warn',
        NODE_ENV: 'production',
        PORT: new URL(productionBaseURL).port,

        // Start's session sealing rejects any password under 32 characters
        SESSION_SECRET: 'e2e-session-secret-32-characters',
      },
      reuseExistingServer: process.env['CI'] === undefined,
      stderr: 'pipe',
      stdout: 'pipe',
      timeout: 240 * 1000,
      url: `${productionBaseURL}/health`,
    },
  ],
  ...(process.env['CI'] !== undefined && { workers: 1 }),
});
