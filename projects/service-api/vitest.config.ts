import { loadEnv } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tsconfigPaths()],
  server: {
    ...(process.env['VITEST'] === 'true' && { ws: false }),
  },
  test: {
    coverage: {
      provider: 'v8',
      reportsDirectory: '../../coverage/apps/service-api',
    },
    env: loadEnv('test', import.meta.dirname, ''),
    environment: 'node',
    include: ['src/**/*.test.ts'],
    passWithNoTests: true,
    reporters: ['default'],
    setupFiles: ['./vitest.setup.ts'],
    watch: false,
  },
});
