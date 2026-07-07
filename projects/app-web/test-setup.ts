import '@zgeoff/bun-test-extended';
import { expect } from 'bun:test';
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import * as jestDOMMatchers from '@testing-library/jest-dom/matchers';
import { registerMSWLifecycle } from '@vers/client-test-utils/test-setup';
import { server } from './mocks/node';
import { registerRequestContextMock } from './test-utils/register-request-context-mock';

process.env['SESSION_SECRET'] = 'test-session-secret-test-session-secret';

GlobalRegistrator.register();

expect.extend(jestDOMMatchers);

registerMSWLifecycle(server);

registerRequestContextMock();
