import { afterEach, expect, mock } from 'bun:test';
import { GlobalRegistrator } from '@happy-dom/global-registrator';

GlobalRegistrator.register();

// dynamic import: the matchers load `@testing-library/dom`, whose `screen` binds to `document` at
// import time; `_` drops the `default` that the matchers' `export =` types add to the namespace
const { default: _, ...jestDOMMatchers } = await import('@testing-library/jest-dom/matchers');

expect.extend(jestDOMMatchers);

// dynamic import: RTL reads `document` at import time, so it must load after registration
const reactTestingLibrary = await import('@testing-library/react');

afterEach(() => {
  reactTestingLibrary.cleanup();
  mock.restore();
});
