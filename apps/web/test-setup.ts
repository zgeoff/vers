import '@zgeoff/bun-test-extended';
import { afterEach, expect } from 'bun:test';
import { faker } from '@faker-js/faker';
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import * as jestDOMMatchers from '@testing-library/jest-dom/matchers';
import { registerMSWLifecycle } from '@vers/test-utils/bun';
import { server } from './src/mocks/node';
import { registerAetherNodeCodexSlotMock } from './src/test-utils/register-aether-node-codex-slot-mock';
import { registerAetherSceneMock } from './src/test-utils/register-aether-scene-mock';
import { registerAvatarViewerMock } from './src/test-utils/register-avatar-viewer-mock';
import { registerGameCanvasMock } from './src/test-utils/register-game-canvas-mock';
import { registerIdleWorkerHandleMock } from './src/test-utils/register-idle-worker-handle-mock';
import { registerRequestContextMock } from './src/test-utils/register-request-context-mock';
import { registerRespiteSceneMock } from './src/test-utils/register-respite-scene-mock';

process.env['SESSION_SECRET'] = 'test-session-secret-test-session-secret';

// a throwaway dev-only Ed25519 PKCS8 key, so the edge can mint s2s tokens under `bun test`
process.env['SERVICE_AUTH_PRIVATE_KEY'] = `-----BEGIN PRIVATE KEY-----
MC4CAQAwBQYDK2VwBCIEIBMom57erggdVdDCIdRWS+NKMykK+I5BUKpuHziAq+0W
-----END PRIVATE KEY-----`;

// a fixed seed keeps faker-defaulted mock rows reproducible run-to-run
faker.seed(1);

GlobalRegistrator.register();

// happy-dom ships no `SharedWorker`; define a placeholder so the app's support check reports the
// supported path real browsers take. The worker handle is mocked, so nothing constructs it. Tests
// covering the unsupported path remove it locally.
function SharedWorkerPlaceholder(): void {
  throw new Error('SharedWorker placeholder is not constructable under bun test');
}

Reflect.set(globalThis, 'SharedWorker', SharedWorkerPlaceholder);

expect.extend(jestDOMMatchers);

registerMSWLifecycle(server);

registerRequestContextMock();

registerIdleWorkerHandleMock();

registerGameCanvasMock();

registerAvatarViewerMock();

registerAetherSceneMock();

registerRespiteSceneMock();

registerAetherNodeCodexSlotMock();

// Imported dynamically, after `GlobalRegistrator.register()`: `@testing-library/react` reads
// `document` at import time to decide whether to install its own auto-cleanup, and a static
// import here would resolve before this module's own body (so before happy-dom's global
// `document` exists) and silently skip it. Registered explicitly rather than relying on that
// auto-cleanup regardless, since it only fires for whichever test file happens to import the
// package first — every other file's renders would otherwise accumulate unremoved across its
// own tests, `bun test` running every file's module graph in one process.
const reactTestingLibrary = await import('@testing-library/react');

afterEach(reactTestingLibrary.cleanup);
