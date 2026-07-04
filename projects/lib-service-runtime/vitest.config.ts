import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tsconfigPaths()],
  server: {
    ws: process.env.VITEST === 'true' ? false : undefined,
  },
  test: {
    coverage: {
      provider: 'v8',
      reportsDirectory: '../../coverage/apps/lib-service-runtime',
    },
    environment: 'node',
    include: ['src/**/*.test.ts'],
    passWithNoTests: true,
    reporters: ['default'],
    server: {
      deps: {
        inline: ['elysia'],
      },
    },
    setupFiles: ['./vitest.setup.ts'],
    testTimeout: 30 * 1000,
    watch: false,
  },
});
