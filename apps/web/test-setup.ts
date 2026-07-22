import '@zgeoff/bun-test-extended';
import { afterEach, expect } from 'bun:test';
import { faker } from '@faker-js/faker';
import * as jestDOMMatchers from '@testing-library/jest-dom/matchers';
import { registerZustandReset } from '@vers/client-test-utils';
import { registerMockDBReset } from '@vers/mock-services/bun';
import {
  registerBunTestCleanup,
  registerHappyDOM,
  registerMSWLifecycle,
} from '@vers/test-utils/bun';
import { server } from './src/mocks/node';
import { registerAvatarViewerMock } from './src/test-utils/register-avatar-viewer-mock';
import { registerGameCanvasMock } from './src/test-utils/register-game-canvas-mock';
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

// installs the zustand `create` wrapper before any store module below imports it, so every
// package's stores (worldmap selection, idle sync state) reset between tests
registerZustandReset();
registerMSWLifecycle(server);
registerMockDBReset();
registerRequestContextMock();
registerIdleWorkerHandleMock();
registerGameCanvasMock();
registerAvatarViewerMock();
registerWorldmapSceneMock();
registerRespiteSceneMock();
registerWorldMapNodeCodexSlotMock();

// Imported dynamically, after `GlobalRegistrator.register()`: `@testing-library/react` reads
// `document` at import time to decide whether to install its own auto-cleanup, and a static
// import here would resolve before this module's own body (so before happy-dom's global
// `document` exists) and silently skip it. Registered explicitly rather than relying on that
// auto-cleanup regardless, since it only fires for whichever test file happens to import the
// package first — every other file's renders would otherwise accumulate unremoved across its
// own tests, `bun test` running every file's module graph in one process.
const reactTestingLibrary = await import('@testing-library/react');

afterEach(reactTestingLibrary.cleanup);
registerBunTestCleanup();
