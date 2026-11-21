import { afterEach, expect } from 'bun:test';
import { registerHappyDOM } from '@vers/test-utils/bun';
import { sentEmails } from './src/mocks/network';

registerHappyDOM();

// dynamic import: the matchers load `@testing-library/dom`, whose `screen` binds to `document` at
// import time; `_` drops the `default` that the matchers' `export =` types add to the namespace
const { default: _, ...jestDOMMatchers } = await import('@testing-library/jest-dom/matchers');

expect.extend(jestDOMMatchers);

// dynamic import: RTL reads `document` at import time, so it must load after registration
const reactTestingLibrary = await import('@testing-library/react');

afterEach(() => {
  reactTestingLibrary.cleanup();
  sentEmails.clear();
});
