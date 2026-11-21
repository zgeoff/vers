import { readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import babel from '@rolldown/plugin-babel';
import SentryCLI from '@sentry/cli';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact, { reactCompilerPreset } from '@vitejs/plugin-react';
import rsc from '@vitejs/plugin-rsc';
import type { Plugin } from 'vite';
import { defineConfig } from 'vite';

const sentryAuthToken = readNonEmptyEnv('SENTRY_AUTH_TOKEN');
const sentryDSN = readNonEmptyEnv('VITE_SENTRY_DSN');

export default defineConfig({
  build: {
    // the CSP's `font-src 'self'` rejects a `data:` font, so a font file never inlines however
    // small it is; every other asset keeps vite's size-based default
    assetsInlineLimit: (filePath) => (isFontFile(filePath) ? false : undefined),
    sourcemap: sentryAuthToken === undefined ? false : 'hidden',
  },
  plugins: [
    tanstackStart({ rsc: { enabled: true } }),
    rsc(),
    viteReact(),
    babel({ presets: [reactCompilerPreset()] }),
    buildMockBackendPlugin(),

    // source maps upload to the error tracker's Debug-ID artifact-bundle endpoints — it never
    // fetches scripts from public URLs — then get deleted so the runtime image never serves them
    ...(sentryAuthToken !== undefined && sentryDSN !== undefined
      ? [buildSourcemapUploadPlugin({ authToken: sentryAuthToken, url: new URL(sentryDSN).origin })]
      : []),
  ],

  environments: {
    client: {
      build: {
        rolldownOptions: {
          output: {
            // the bundler hoists a shared chunk above the entry's body, so a schema built in one
            // would probe eval before the entry's jitless call ran; keeping zod and the jitless
            // module in one chunk every schema chunk imports keeps the call ahead of every schema
            codeSplitting: {
              groups: [{ name: 'zod', test: /node_modules\/zod\/|\/disable-zod-jit\.ts$/u }],
            },
          },
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

function isFontFile(filePath: string): boolean {
  return /\.woff2?$/u.test(filePath);
}

// an empty value counts as absent: Docker passes a declared-but-unset build arg through as an empty
// string, and an argless image build would otherwise enable the sourcemap plugin with blank
// credentials
function readNonEmptyEnv(name: string): string | undefined {
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
      const mocks: Record<string, unknown> = await viteServer.ssrLoadModule(
        '/src/mocks/dev-network.ts',
      );

      if (!isMockBackendNetwork(mocks['network'])) {
        throw new Error('/src/mocks/dev-network.ts must export an MSW network as `network`');
      }

      mocks['network'].enable();
    },
  };
}

interface MockBackendNetwork {
  readonly enable: () => void;
}

// a structural check rather than `instanceof`: the bundled config and the ssr-loaded mock module
// each get their own copy of msw, so class identity fails across that boundary even for a genuine
// server
function isMockBackendNetwork(value: unknown): value is MockBackendNetwork {
  return (
    typeof value === 'object' &&
    value !== null &&
    'enable' in value &&
    typeof value.enable === 'function'
  );
}

interface SourcemapUploadOptions {
  readonly authToken: string;
  readonly url: string;
}

// a failed step throws and fails the build, so an image that can't be symbolicated never ships
function buildSourcemapUploadPlugin(options: SourcemapUploadOptions): Plugin {
  return {
    name: 'vers:sourcemap-upload',
    apply: 'build',
    buildApp: {
      order: 'post',
      async handler(builder) {
        const distDir = path.resolve(builder.config.root, 'dist');

        const cli = new SentryCLI(null, {
          authToken: options.authToken,
          org: 'bugsink',
          project: 'web',
          url: options.url,
        });

        // vite rewrites some chunks and their maps after a bundler plugin's last hook, worker
        // bundles among them, so Debug IDs go in once every environment has built
        await cli.execute(['sourcemaps', 'inject', distDir], 'rejectOnError');

        // Bugsink assembles each upload under a global write lock for about a minute, and a second
        // upload that waits on it hits gunicorn's 30s timeout as a 500, so one upload sends it all
        await cli.execute(['sourcemaps', 'upload', distDir], 'rejectOnError');

        await removeSourcemaps(distDir);
      },
    },
  };
}

async function removeSourcemaps(directory: string): Promise<void> {
  const entries = await readdir(directory, { recursive: true });

  await Promise.all(collectSourcemapPaths(entries).map((entry) => rm(path.join(directory, entry))));
}

function collectSourcemapPaths(entries: ReadonlyArray<string>): Array<string> {
  return entries.filter((entry) => entry.endsWith('.map'));
}
