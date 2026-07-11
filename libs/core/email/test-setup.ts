import { afterEach, expect } from 'bun:test';
import * as jestDOMMatchers from '@testing-library/jest-dom/matchers';
import { registerHappyDOM, registerMSWLifecycle } from '@vers/test-utils/bun';
import { server } from './src/mocks/node';

registerHappyDOM();

expect.extend(jestDOMMatchers);

registerMSWLifecycle(server);

// dynamic import: RTL reads `document` at import time, so it must load after registration
const reactTestingLibrary = await import('@testing-library/react');

afterEach(() => {
  reactTestingLibrary.cleanup();
});
