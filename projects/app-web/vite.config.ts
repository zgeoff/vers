import babel from '@rolldown/plugin-babel';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact, { reactCompilerPreset } from '@vitejs/plugin-react';
import rsc from '@vitejs/plugin-rsc';
import type { Plugin } from 'vite';
import { defineConfig } from 'vite';

const sentryAuthToken = process.env['SENTRY_AUTH_TOKEN'];
const sentryDSN = process.env['VITE_SENTRY_DSN'];

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
          // pino's transport/worker mechanism spawns a real worker_thread from a file on disk;
          // bundling it strips that file out from under it (breaking on `__dirname`, among other
          // things), so it — and the transports it loads by module name at runtime — stay external
          // and get resolved from node_modules instead.
          external: ['pino', 'pino-pretty', 'pino-sentry-transport', 'thread-stream'],
        },
      },
    },
  },
  resolve: {
    // `lib-design-system`/`lib-styled-system` pin `react` through the workspace catalog, one
    // minor behind this app's own RSC-required pin — dedupe forces every environment onto this
    // single physical copy so a design-system import never drags in a second React instance.
    dedupe: ['react', 'react-dom'],
  },
  server: { port: 3000 },
});

/**
 * Starts the shared MSW server for `vite dev` only — `configureServer` never fires for
 * `vite build` — so dev boot runs entirely against the mock backend. Goes through `ssrLoadModule`
 * rather than a plain top-level import: this config file loads outside Vite's own resolver, and
 * this app's workspace packages (`@vers/contract-*`) are extensionless-TS source that only that
 * resolver handles.
 */
function buildMockBackendPlugin(): Plugin {
  return {
    name: 'vers:mock-backend',
    async configureServer(viteServer) {
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

/**
 * Structural check rather than `instanceof msw/node`'s server class: the bundled config and the
 * ssr-loaded mock module each get their own copy of msw, so class identity fails across that
 * boundary even for a genuine server.
 */
function isMockBackendServer(value: unknown): value is MockBackendServer {
  return (
    typeof value === 'object' &&
    value !== null &&
    'listen' in value &&
    typeof value.listen === 'function'
  );
}
