import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.BASE_URL ?? 'http://localhost:4000';

// having a million issues trying to use __dirname to establish a reliable path
// so it's easier to do this to handle the case when this file gets parsed for
// building our task graph
const projectRoot = process.cwd().includes('app-web-e2e')
  ? process.cwd()
  : `${process.cwd()}/projects/app-web-e2e`;

const workspaceRoot = path.resolve(projectRoot, '..', '..');

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
      name: 'warmup',
      testMatch: /warmup\.setup\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      dependencies: ['warmup'],
      name: 'chromium',
      testIgnore: /warmup\.setup\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // one retry absorbs the full page reload vite forces when a code-split
  // route pulls in a dependency the warmup pass didn't reach
  retries: process.env.CI ? 1 : 0,
  timeout: 30 * 1000,
  use: {
    baseURL,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'bun run dev:app-web',
    cwd: workspaceRoot,
    reuseExistingServer: !process.env.CI,
    stderr: 'pipe',
    stdout: 'pipe',
    timeout: 60 * 1000,
    url: 'http://localhost:4000',
  },
  workers: process.env.CI ? 1 : undefined,
});
