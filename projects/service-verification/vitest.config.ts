import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [tsconfigPaths()],
  server: {
    ...(process.env['VITEST'] === 'true' && { ws: false }),
  },
  test: {
    coverage: {
      provider: 'v8',
      reportsDirectory: '../../coverage/apps/service-verification',
    },
    env: loadEnv('test', __dirname, ''),
    environment: 'node',
    globalSetup: ['./vitest.global-setup.ts'],
    include: ['src/**/*.test.ts'],
    passWithNoTests: true,
    reporters: ['default'],
    setupFiles: ['./vitest.setup.ts'],
    testTimeout: 30 * 1000,
    watch: false,
  },
});
