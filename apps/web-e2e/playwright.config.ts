import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

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

export default defineConfig({
  expect: {
    timeout: 10 * 1000,
  },
  fullyParallel: true,
  outputDir: '.test-results',

  // the full-stack suite under ./stack runs on its own config against real services — this
  // config's mock-backed webServers must never pick those specs up
  testDir: './src',
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
      // the stateful mock backends as real HTTP listeners on the service dev ports the artifact's
      // SERVICE_URLS defaults resolve. Never reuse an already-listening server: a service
      // answering on these ports could be the real dev stack, and specs must never mutate it.
      command: 'bun src/serve-mock-services.ts',
      cwd: projectRoot,
      reuseExistingServer: false,
      stderr: 'pipe',
      stdout: 'pipe',
      timeout: 60 * 1000,

      // the same override-then-default resolution the spawned listeners apply per service
      url: `${process.env['USER_SERVICE_URL'] ?? 'http://localhost:3003'}/health`,
    },
    {
      // every spec runs against the deployable artifact, exactly as built — no mock backend
      // in-process, no build-time env overrides. The e2e turbo task depends on the app's build
      // task, so the artifact is already on disk (cached or fresh) — serving it here must not
      // rebuild it. Downstream service calls leave the process over HTTP and land on the mock
      // listeners above. Never reuse an already-listening server: whatever answers on this port
      // (a leftover vite dev, another app) is not the artifact, and reusing it silently voids
      // the production-build guarantee.
      command: 'node ./server.mjs',
      cwd: appWebRoot,
      env: {
        // canvas-persistence.spec.ts clicks through to the Market nav link
        FEATURE_MARKET: 'true',

        LOGGING: 'warn',
        NODE_ENV: 'production',
        PORT: new URL(baseURL).port,

        // Start's session sealing rejects any password under 32 characters
        SESSION_SECRET: 'e2e-session-secret-32-characters',
      },
      reuseExistingServer: false,
      stderr: 'pipe',
      stdout: 'pipe',
      timeout: 240 * 1000,
      url: `${baseURL}/health`,
    },
  ],

  // CI runners have 4 cores shared with both webServers; more workers than this starves the
  // canvas specs' software-GL rendering
  ...(process.env['CI'] !== undefined && { workers: 2 }),
});
