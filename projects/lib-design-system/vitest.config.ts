import pandacss from '@pandacss/dev/postcss';
import react from '@vitejs/plugin-react';
import autoprefixer from 'autoprefixer';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  css: {
    postcss: {
      // @ts-expect-error - pandacss types are bogus
      plugins: [pandacss, autoprefixer],
    },
  },
  plugins: [tsconfigPaths(), react()],
  server: {
    ws: process.env.VITEST === 'true' ? false : undefined,
  },
  test: {
    coverage: {
      provider: 'v8',
      reportsDirectory: '../../coverage/apps/lib-design-system',
    },
    environment: 'happy-dom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    passWithNoTests: true,
    reporters: ['default'],
    setupFiles: ['./vitest.setup.ts'],
    testTimeout: 30 * 1000,
    watch: false,
  },
});
