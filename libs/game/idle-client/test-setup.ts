import 'fake-indexeddb/auto';
import { afterEach, expect, mock } from 'bun:test';
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import * as jestDOMMatchers from '@testing-library/jest-dom/matchers';
import { registerZustandReset } from '@vers/client-test-utils';
import { registerMockDBReset } from '@vers/mock-services/bun';
import { registerMSWLifecycle } from '@vers/test-utils/bun';
import { server } from './src/mocks/node';
import {
  CHECKPOINT_QUEUE_STORE_NAME,
  CONTENT_DOCUMENT_STORE_NAME,
  NODE_SEEDS_STORE_NAME,
  PENDING_ROOTS_STORE_NAME,
  PREFERENCES_STORE_NAME,
} from './src/submission/constants';
import { resolveCheckpointQueueDB } from './src/submission/resolve-checkpoint-queue-db';

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
const resetZustandStores = registerZustandReset();

registerMSWLifecycle(server);
registerMockDBReset();

// dynamic import: RTL reads `document` at import time, so it must load after registration
const reactTestingLibrary = await import('@testing-library/react');

afterEach(async () => {
  // unmount before the store reset: a reset under a still-mounted tree re-renders it against the
  // fresh stores, and its effects write the outgoing test's state right back; the finally keeps
  // the reset from being skipped when an unmount cleanup throws
  try {
    reactTestingLibrary.cleanup();
  } finally {
    resetZustandStores();
  }

  mock.restore();

  // fake-indexeddb persists for the whole one-process run; sweep both durable stores so no test
  // depends on unique activity ids, or a clean preferences cache, for isolation
  const queueDB = await resolveCheckpointQueueDB();

  await queueDB.clear(CHECKPOINT_QUEUE_STORE_NAME);
  await queueDB.clear(PREFERENCES_STORE_NAME);
  await queueDB.clear(CONTENT_DOCUMENT_STORE_NAME);
  await queueDB.clear(NODE_SEEDS_STORE_NAME);
  await queueDB.clear(PENDING_ROOTS_STORE_NAME);
});
