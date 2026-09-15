import { defineConfig, devices } from '@playwright/test';
import { loadE2EEnvironment } from './src/load-e2e-environment';
import type { E2EOptions } from './src/test';

const CROSS_ENGINE_CORPUS_SPEC = /cross-engine-corpus\.spec\.ts/;

const environment = loadE2EEnvironment({
  appWebEnv: {
    // the live WebGPU/R3F canvas blocks the main thread long enough under CI's software-GL to
    // drop nav clicks; the placeholder canvas keeps every canvas-lifecycle assertion valid
    FEATURE_GAME_RENDERER: 'false',
  },
});

export default defineConfig<E2EOptions>({
  expect: {
    timeout: 10 * 1000,
  },
  fullyParallel: true,
  globalSetup: './src/setup-corpus-artifacts.ts',
  outputDir: '.test-results',
  testDir: './specs',
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      testMatch: CROSS_ENGINE_CORPUS_SPEC,
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      testMatch: CROSS_ENGINE_CORPUS_SPEC,
      use: { ...devices['Desktop Safari'] },
    },
  ],

  // retries are unsound here: the mock db persists across attempts, so a
  // retry of any mutating spec replays against already-mutated state (a
  // changed password, a live session) and fails differently
  retries: 0,
  timeout: 30 * 1000,
  use: {
    baseURL: environment.baseURL,
    codeSource: 'mock',

    // serve-mock-services.ts binds the verification listener to this origin
    mockVerificationURL: process.env['VERIFICATION_SERVICE_URL'] ?? 'http://localhost:3004',

    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: [...environment.webServer],

  // CI runners have 4 cores shared with both webServers; more workers than this starves the
  // canvas specs' software-GL rendering
  ...(process.env['CI'] !== undefined && { workers: 2 }),
});
