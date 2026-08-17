import { registerZustandReset } from '@vers/client-test-utils';

// its own preload entry, ahead of `test-setup.ts`: that file's local `register-*-mock` imports
// (`registerWorldmapSceneMock` among them) transitively import zustand-backed stores, and
// `registerZustandReset` must wrap zustand's `create` before any of those imports run or the
// stores they create are never tracked for reset — a same-file call after those imports is too
// late, since ES module imports are hoisted and evaluate before the importing module's own body.
// Only the wrapper installs this early: the reset itself runs from the teardown hook that also
// unmounts rendered trees, after the unmount, so no still-mounted tree writes the outgoing test's
// state back into the freshly reset stores.
export const resetZustandStores = registerZustandReset();
