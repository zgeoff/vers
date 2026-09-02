import babel from '@rolldown/plugin-babel';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact, { reactCompilerPreset } from '@vitejs/plugin-react';
import rsc from '@vitejs/plugin-rsc';
import type { Plugin } from 'vite';
import { defineConfig } from 'vite';

const sentryAuthToken = findNonEmptyEnv('SENTRY_AUTH_TOKEN');
const sentryDSN = findNonEmptyEnv('VITE_SENTRY_DSN');

export default defineConfig({
  build: { sourcemap: sentryAuthToken === undefined ? false : 'hidden' },
  plugins: [
    tanstackStart({ rsc: { enabled: true } }),
    rsc(),
    viteReact(),
    babel({ presets: [reactCompilerPreset()] }),
    buildMockBackendPlugin(),

    // source maps upload to the error tracker's Debug-ID artifact-bundle endpoints — it never
    // fetches scripts from public URLs — then get deleted so the runtime image never serves them.
    // Releases are Sentry-specific endpoints the tracker doesn't implement, so both legs are off.
    ...(sentryAuthToken !== undefined && sentryDSN !== undefined
      ? [
          sentryVitePlugin({
            authToken: sentryAuthToken,
            org: 'bugsink',
            project: 'web',
            release: { create: false, inject: false },
            sourcemaps: { filesToDeleteAfterUpload: ['dist/**/*.map'] },
            telemetry: false,
            url: new URL(sentryDSN).origin,

            // the plugin's default handler logs upload failures and lets the build pass,
            // shipping an image whose stack traces can never be symbolicated — a build
            // that can't deliver its sourcemaps must not ship
            errorHandler(error) {
              throw error;
            },
          }),
        ]
      : []),
  ],
  environments: {
    // tanstack start names its server environment `ssr` (kept for compatibility with vite plugins
    // predating the environment API), not `server`.
    ssr: {
      build: {
        rolldownOptions: {
          // pino's transport mechanism spawns a real worker_thread from a file on disk; bundling
          // strips that file out from under it (breaking on `__dirname`), so pino and the
          // transports it loads by module name at runtime stay external.
          external: ['pino', 'pino-pretty', 'thread-stream'],
        },
      },
    },
  },

  // the dev server's dependency scan never reaches the `new SharedWorker(new URL(...))` target, so
  // the worker's deps go undiscovered until a browser spins it up and the optimizer re-bundles
  // mid-session with a full reload. An extra scan entry resolves them from the worker's own root.
  optimizeDeps: {
    entries: ['../../libs/game/idle-client/src/worker/worker.ts'],
  },
  resolve: {
    // `lib-design-system`/`lib-styled-system` pin `react` through the workspace catalog, one
    // minor behind this app's own RSC-required pin — dedupe forces every environment onto this
    // single physical copy so a design-system import never drags in a second React instance.
    dedupe: ['react', 'react-dom'],
  },
  server: { port: 3000 },
});

// an empty value counts as absent: Docker passes a declared-but-unset build arg through as an empty
// string, and an argless image build would otherwise enable the sourcemap plugin with blank
// credentials
function findNonEmptyEnv(name: string): string | undefined {
  const value = process.env[name];

  return value === undefined || value === '' ? undefined : value;
}

function buildMockBackendPlugin(): Plugin {
  return {
    name: 'vers:mock-backend',
    async configureServer(viteServer) {
      // Goes through `ssrLoadModule` rather than a plain top-level import: this config file loads
      // outside Vite's own resolver, and this app's workspace packages (`@vers/contract-*`) are
      // extensionless-TS source that only that resolver handles.
      const mocks: Record<string, unknown> = await viteServer.ssrLoadModule('/src/mocks/node.ts');

      if (!isMockBackendServer(mocks['server'])) {
        throw new Error('/src/mocks/node.ts must export an MSW server as `server`');
      }

      mocks['server'].listen({ onUnhandledRequest: 'bypass' });
    },
  };
}

interface MockBackendServer {
  readonly listen: (options: Readonly<{ onUnhandledRequest: 'bypass' }>) => void;
}

// a structural check rather than `instanceof`: the bundled config and the ssr-loaded mock module
// each get their own copy of msw, so class identity fails across that boundary even for a genuine
// server
function isMockBackendServer(value: unknown): value is MockBackendServer {
  return (
    typeof value === 'object' &&
    value !== null &&
    'listen' in value &&
    typeof value.listen === 'function'
  );
}
