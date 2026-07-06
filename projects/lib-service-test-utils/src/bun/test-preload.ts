// side-effect import so the matcher types are in this tsconfig's program —
// the package ships TS source with no `.d.ts`, so the `types` compiler
// option can't resolve it as a type-reference directive; a real import can,
// since normal module resolution accepts `.ts` sources directly. bunfig.toml
// registers the same module as its own preload entry for the runtime effect.
import '@zgeoff/bun-test-extended';
import { setupBunTestDB } from './setup-bun-test-db';

await setupBunTestDB();
