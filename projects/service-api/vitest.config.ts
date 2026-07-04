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
    ws: process.env.VITEST === 'true' ? false : undefined,
  },
  test: {
    coverage: {
      provider: 'v8',
      reportsDirectory: '../../coverage/apps/service-api',
    },
    env: loadEnv('test', __dirname, ''),
    environment: 'node',
    include: ['src/**/*.test.ts'],
    passWithNoTests: true,
    reporters: ['default'],
    setupFiles: ['./vitest.setup.ts'],
    watch: false,
  },
});
