// side-effect import so the matcher types are in this program: the package ships TS source with no
// `.d.ts`, which the `types` compiler option cannot resolve as a type-reference directive but a
// real import can. bunfig.toml registers the same module as a preload for the runtime effect.
import '@zgeoff/bun-test-extended';
import { registerBunTestCleanup } from '@vers/test-utils/bun';
import { setupBunTestDB } from './setup-bun-test-db';

await setupBunTestDB();

registerBunTestCleanup();
