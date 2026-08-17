import { afterEach, expect, mock } from 'bun:test';
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import * as jestDOMMatchers from '@testing-library/jest-dom/matchers';
import { registerZustandReset } from '@vers/client-test-utils';

GlobalRegistrator.register();

expect.extend(jestDOMMatchers);

// installs the zustand `create` wrapper before any store module below imports it; bun runs every
// test file in one process with no isolation, so the worldmap store would otherwise
// leak state across files
const resetZustandStores = registerZustandReset();

// dynamic import: RTL reads `document` at import time, so it must load after registration
const reactTestingLibrary = await import('@testing-library/react');

afterEach(() => {
  // unmount before the store reset: a reset under a still-mounted tree re-renders it against the
  // fresh stores, and its effects write the outgoing test's state right back; the finally keeps
  // the reset from being skipped when an unmount cleanup throws
  try {
    reactTestingLibrary.cleanup();
  } finally {
    resetZustandStores();
  }

  mock.restore();
});
