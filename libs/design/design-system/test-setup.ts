import { afterEach, expect, mock } from 'bun:test';
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import * as jestDOMMatchers from '@testing-library/jest-dom/matchers';

GlobalRegistrator.register();

expect.extend(jestDOMMatchers);

// dynamic import: RTL reads `document` at import time, so it must load after registration
const reactTestingLibrary = await import('@testing-library/react');

afterEach(() => {
  reactTestingLibrary.cleanup();
  mock.restore();
});
