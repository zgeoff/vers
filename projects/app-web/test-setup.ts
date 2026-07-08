import '@zgeoff/bun-test-extended';
import { afterEach, expect } from 'bun:test';
import { faker } from '@faker-js/faker';
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import * as jestDOMMatchers from '@testing-library/jest-dom/matchers';
import { registerMSWLifecycle } from '@vers/client-test-utils/test-setup';
import { server } from './src/mocks/node';
import { registerRequestContextMock } from './src/test-utils/register-request-context-mock';

process.env['SESSION_SECRET'] = 'test-session-secret-test-session-secret';

// a fixed seed keeps faker-defaulted mock rows reproducible run-to-run
faker.seed(1);

GlobalRegistrator.register();

expect.extend(jestDOMMatchers);

registerMSWLifecycle(server);

registerRequestContextMock();

// Imported dynamically, after `GlobalRegistrator.register()`: `@testing-library/react` reads
// `document` at import time to decide whether to install its own auto-cleanup, and a static
// import here would resolve before this module's own body (so before happy-dom's global
// `document` exists) and silently skip it. Registered explicitly rather than relying on that
// auto-cleanup regardless, since it only fires for whichever test file happens to import the
// package first — every other file's renders would otherwise accumulate unremoved across its
// own tests, `bun test` running every file's module graph in one process.
const reactTestingLibrary = await import('@testing-library/react');

afterEach(reactTestingLibrary.cleanup);
