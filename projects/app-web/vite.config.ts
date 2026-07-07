import babel from '@rolldown/plugin-babel';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact, { reactCompilerPreset } from '@vitejs/plugin-react';
import rsc from '@vitejs/plugin-rsc';
import type { Plugin } from 'vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    tanstackStart({ rsc: { enabled: true } }),
    rsc(),
    viteReact(),
    babel({ presets: [reactCompilerPreset()] }),
    buildMockBackendPlugin(),
  ],
  resolve: {
    // `lib-design-system`/`lib-styled-system` pin `react` through the workspace catalog, one
    // minor behind this app's own RSC-required pin — dedupe forces every environment onto this
    // single physical copy so a design-system import never drags in a second React instance.
    dedupe: ['react', 'react-dom'],
  },
  server: { port: 3000 },
});

/** The one export `mocks/node.ts` has to expose to this config file's dynamic load. */
interface MockBackendModule {
  readonly server: {
    readonly listen: (options: Readonly<{ onUnhandledRequest: 'bypass' }>) => void;
  };
}

/**
 * Starts the shared MSW server for `vite dev` only (never `vite build`, which this hook doesn't
 * fire for) — real services aren't integrated until a later phase (#165), so dev boot runs
 * entirely against the mock backend. Goes through `ssrLoadModule` rather than a plain top-level
 * import: `vite.config.ts` itself loads outside Vite's own resolver, and this app's workspace
 * packages (`@vers/contract-*`) are extensionless-TS source that only that resolver handles.
 */
function buildMockBackendPlugin(): Plugin {
  return {
    name: 'vers:mock-backend',
    async configureServer(viteServer) {
      const mocks = await viteServer.ssrLoadModule('/mocks/node.ts');

      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- ssrLoadModule's return type is Vite's own `Record<string, any>`; no safer typed accessor exists for a dynamically loaded module
      const { server } = mocks as MockBackendModule;

      server.listen({ onUnhandledRequest: 'bypass' });
    },
  };
}
