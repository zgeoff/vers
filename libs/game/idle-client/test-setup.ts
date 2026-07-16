import 'fake-indexeddb/auto';
import { afterEach, expect, mock } from 'bun:test';
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import * as jestDOMMatchers from '@testing-library/jest-dom/matchers';
import { registerZustandReset } from '@vers/client-test-utils';
import { registerMSWLifecycle } from '@vers/test-utils/bun';
import { server } from './src/mocks/node';

// a throwaway dev-only Ed25519 PKCS8 key, so tests can mint the access tokens the stateful
// activity mock's session resolution decodes
process.env['SERVICE_AUTH_PRIVATE_KEY'] = `-----BEGIN PRIVATE KEY-----
MC4CAQAwBQYDK2VwBCIEIBMom57erggdVdDCIdRWS+NKMykK+I5BUKpuHziAq+0W
-----END PRIVATE KEY-----`;

GlobalRegistrator.register();
expect.extend(jestDOMMatchers);

// installs the zustand `create` wrapper before any store module below imports it; bun runs every
// test file in one process with no isolation, so the idle store would otherwise leak state across
// files
registerZustandReset();
registerMSWLifecycle(server);

// dynamic import: RTL reads `document` at import time, so it must load after registration
const reactTestingLibrary = await import('@testing-library/react');

afterEach(() => {
  reactTestingLibrary.cleanup();
  mock.restore();
});
