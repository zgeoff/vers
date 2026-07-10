// Registers the shared MSW server's lifecycle once for the whole `bun test` run. Wired into
// bunfig.toml's preload array; test files import the same `server` and add per-test handlers with
// `server.use(...)`, carrying no lifecycle hooks of their own.
import { registerMSWLifecycle } from '@vers/test-utils/bun';
import { server } from './src/orpc/mocks/server';

registerMSWLifecycle(server);
