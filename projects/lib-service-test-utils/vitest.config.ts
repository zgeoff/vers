import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [],
  server: {
    ...(process.env['VITEST'] === 'true' && { ws: false }),
  },
  test: {
    coverage: {
      provider: 'v8',
      reportsDirectory: '../../coverage/apps/lib-service-test-utils',
    },
    environment: 'node',
    exclude: [...configDefaults.exclude, 'src/bun/**'],
    globalSetup: './vitest.global-setup.ts',
    include: ['src/**/*.test.ts'],
    passWithNoTests: true,
    reporters: ['default'],
    setupFiles: ['./vitest.setup.ts'],
    testTimeout: 30 * 1000,
    watch: false,
  },
});
