import 'fake-indexeddb/auto';
import '@zgeoff/bun-test-extended';
import { afterEach, expect } from 'bun:test';
import { faker } from '@faker-js/faker';
import * as jestDOMMatchers from '@testing-library/jest-dom/matchers';
import { registerMockDBReset } from '@vers/mock-services/bun';
import {
  registerBunTestCleanup,
  registerHappyDOM,
  registerMSWLifecycle,
} from '@vers/test-utils/bun';
import { resetZustandStores } from './reset-zustand-stores';
import { server } from './src/mocks/node';
import { registerAvatarViewerMock } from './src/test-utils/register-avatar-viewer-mock';
import { registerGameCanvasMock } from './src/test-utils/register-game-canvas-mock';
import { registerIdleCheckpointDBReset } from './src/test-utils/register-idle-checkpoint-db-reset';
import { registerIdleWorkerHandleMock } from './src/test-utils/register-idle-worker-handle-mock';
import { registerRequestContextMock } from './src/test-utils/register-request-context-mock';
import { registerRespiteSceneMock } from './src/test-utils/register-respite-scene-mock';
import { registerWorldMapNodeCodexSlotMock } from './src/test-utils/register-world-map-node-codex-slot-mock';
import { registerWorldmapSceneMock } from './src/test-utils/register-worldmap-scene-mock';

process.env['SESSION_SECRET'] = 'test-session-secret-test-session-secret';

// a resolvable Tinybird config so ingest suites observe the delivery path over MSW
process.env['TINYBIRD_URL'] = 'https://tinybird.test';
process.env['TINYBIRD_INGEST_TOKEN'] = 'test-tinybird-ingest-token';

// a throwaway dev-only Ed25519 PKCS8 key, so the edge can mint s2s tokens under `bun test`
process.env['SERVICE_AUTH_PRIVATE_KEY'] = `-----BEGIN PRIVATE KEY-----
MC4CAQAwBQYDK2VwBCIEIBMom57erggdVdDCIdRWS+NKMykK+I5BUKpuHziAq+0W
-----END PRIVATE KEY-----`;

// a fixed seed keeps faker-defaulted mock rows reproducible run-to-run
faker.seed(1);

registerHappyDOM();

expect.extend(jestDOMMatchers);

// the zustand reset wrapper (worldmap selection, idle sync state) is installed by the
// `reset-zustand-stores.ts` preload, ahead of this file's own imports below
registerMSWLifecycle(server);
registerMockDBReset();
registerRequestContextMock();
registerIdleWorkerHandleMock();
registerIdleCheckpointDBReset();
registerGameCanvasMock();
registerAvatarViewerMock();
registerWorldmapSceneMock();
registerRespiteSceneMock();
registerWorldMapNodeCodexSlotMock();

// imported dynamically, after `GlobalRegistrator.register()`: `@testing-library/react` reads
// `document` at import time to decide whether to install auto-cleanup, and a static import would
// resolve before happy-dom exists. Auto-cleanup fires only for the first importer, hence explicit.
const reactTestingLibrary = await import('@testing-library/react');

afterEach(() => {
  // unmount before the store reset: a reset under a still-mounted tree re-renders it against the
  // fresh stores, and its effects write the outgoing test's state right back
  reactTestingLibrary.cleanup();

  resetZustandStores();
});

registerBunTestCleanup();
