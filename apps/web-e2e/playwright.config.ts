import { defineConfig, devices } from '@playwright/test';
import { loadE2EEnvironment } from './src/load-e2e-environment';
import type { E2EOptions, MockActivityOptions } from './src/test';

const CROSS_ENGINE_CORPUS_SPEC = /cross-engine-corpus\.spec\.ts/u;

// only the live world map reveals nodes and caches their start inputs, so a spec that starts an
// activity at a node runs against an artifact with the renderer on, built with
// VITE_SIM_ENGINE_HASH set, as CI's e2e step sets it
const RENDERER_SPEC = /offline-navigation\.spec\.ts/u;
const RENDERER_BASE_URL = process.env['RENDERER_BASE_URL'] ?? 'http://localhost:3100';

const environment = loadE2EEnvironment({
  appWebEnv: {
    // the live WebGPU/R3F canvas blocks the main thread long enough under CI's software-GL to
    // drop nav clicks; the placeholder canvas keeps every canvas-lifecycle assertion valid
    FEATURE_GAME_RENDERER: 'false',
  },
  defaultAppWebBaseURL: RENDERER_BASE_URL,
});

export default defineConfig<E2EOptions & MockActivityOptions>({
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
      testIgnore: RENDERER_SPEC,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      // the live canvas's software GL starves whatever spec runs beside it, so this project waits
      // for the placeholder specs to finish
      dependencies: ['chromium'],
      name: 'chromium-renderer',
      testMatch: RENDERER_SPEC,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: RENDERER_BASE_URL,
      },
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

  // CI's default dot reporter prints no per-test durations; list prints each test's time, which
  // the timeout below is set from
  reporter: 'list',

  // retries are unsound here: the mock db persists across attempts, so a
  // retry of any mutating spec replays against already-mutated state (a
  // changed password, a live session) and fails differently
  retries: 0,
  timeout: 30 * 1000,
  use: {
    baseURL: environment.baseURL,
    codeSource: 'mock',

    // serve-mock-services.ts binds the activity listener to this origin
    mockActivityURL: process.env['ACTIVITY_SERVICE_URL'] ?? 'http://localhost:3006',

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
