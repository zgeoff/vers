import { afterEach, expect, mock } from 'bun:test';
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import * as jestDOMMatchers from '@testing-library/jest-dom/matchers';
import { registerZustandReset } from '@vers/client-test-utils';

GlobalRegistrator.register();
expect.extend(jestDOMMatchers);

// installs the zustand `create` wrapper before any store module below imports it; bun runs every
// test file in one process with no isolation, so the five aether-client stores would otherwise
// leak state across files
registerZustandReset();

// dynamic import: RTL reads `document` at import time, so it must load after registration
const reactTestingLibrary = await import('@testing-library/react');

afterEach(() => {
  reactTestingLibrary.cleanup();
  mock.restore();
});
