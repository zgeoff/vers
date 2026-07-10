// Registers the process-wide cleanup contract once for the whole `bun test` run, so its own
// register-bun-test-cleanup tests observe the effect across tests rather than within a single one.
import { registerBunTestCleanup } from './src/bun/register-bun-test-cleanup';

registerBunTestCleanup();
