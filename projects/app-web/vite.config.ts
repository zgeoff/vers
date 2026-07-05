import pandacss from '@pandacss/dev/postcss';
import { reactRouter } from '@react-router/dev/vite';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import autoprefixer from 'autoprefixer';
import { reactRouterHonoServer } from 'react-router-hono-server/dev';
import { defineConfig, loadEnv, searchForWorkspaceRoot } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  build: {
    sourcemap: true,
  },
  css: {
    postcss: {
      // @ts-expect-error - pandacss types are bogus
      plugins: [pandacss, autoprefixer],
    },
  },
  plugins: [
    reactRouterHonoServer({ serverEntryPoint: './server/index.ts' }),
    !process.env['VITEST'] && reactRouter(),
    tsconfigPaths(),
    process.env['SENTRY_AUTH_TOKEN']
      ? sentryVitePlugin({
          authToken: process.env['SENTRY_AUTH_TOKEN'],
          disable: process.env['NODE_ENV'] !== 'production',
          org: 'vers-idle',
          project: 'app-web',
          release: {
            ...(process.env['COMMIT_SHA'] !== undefined && {
              name: process.env['COMMIT_SHA'],
            }),
            setCommits: {
              auto: true,
            },
          },
          sourcemaps: {
            filesToDeleteAfterUpload: ['./build/**/*.map', '.server-build/**/*.map'],
          },
        })
      : null,
  ],
  preview: {
    host: 'localhost',
    port: 4300,
  },
  root: import.meta.dirname,
  server: {
    fs: {
      allow: [
        // vite's default workspace root detection behaviour
        searchForWorkspaceRoot(process.cwd()),
      ],
    },
    host: 'localhost',
    port: 4000,
    ...(process.env['VITEST'] === 'true' && { ws: false }),
  },
  test: {
    coverage: {
      provider: 'v8',
      reportsDirectory: '../../coverage/apps/app-web',
    },
    env: {
      ...loadEnv('test', import.meta.dirname, ''),

      // set secret env vars here so we don't need to load a `.local` env file in tests
      SESSION_SECRET: 'secret',
    },
    environment: 'happy-dom',
    include: ['app/**/*.test.{ts,tsx}'],
    passWithNoTests: true,
    reporters: ['default'],
    setupFiles: ['@vitest/web-worker', 'vitest.setup.ts'],
    watch: false,
  },
  worker: {
    plugins: () => [tsconfigPaths()],
  },
});
