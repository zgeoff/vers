import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [],
  server: {
    ...(process.env['VITEST'] === 'true' && { ws: false }),
  },
  test: {
    coverage: {
      provider: 'v8',
      reportsDirectory: '../../coverage/apps/lib-aether-client',
    },
    environment: 'happy-dom',
    include: ['src/**/*.test.{ts,tsx}'],
    passWithNoTests: true,
    reporters: ['default'],
    setupFiles: ['@vitest/web-worker', './vitest.setup.ts'],
    testTimeout: 30 * 1000,
    watch: false,
  },
});
