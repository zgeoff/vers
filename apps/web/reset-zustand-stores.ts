import { registerZustandReset } from '@vers/client-test-utils';

// its own preload entry, ahead of the main test setup: the wrapper must replace zustand's `create`
// before any import that creates a store runs, and ES module imports are hoisted ahead of the
// importing module's own body, so a same-file call after those imports is too late.
export const resetZustandStores = registerZustandReset();
