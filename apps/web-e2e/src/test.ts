import { test as base } from '@playwright/test';

/**
 * The converged spec set runs against both backends off one directory; each config sets these in
 * its `use` block. Only the signup journey reads them — to poll the backend it signed up against
 * for the emailed code — so the setup specs' seeded logins ignore them.
 */
export interface E2EOptions {
  readonly codeSource: 'mock' | 'stack';
  readonly mockVerificationURL: string | undefined;
  readonly resendStubURL: string | undefined;
}

/**
 * The shared `test` with the backend options registered, so every spec imports one configured
 * `test`/`expect` pair rather than reaching for the framework's directly.
 */
export const test = base.extend<E2EOptions>({
  codeSource: ['mock', { option: true }],
  mockVerificationURL: [undefined, { option: true }],
  resendStubURL: [undefined, { option: true }],
});

export { expect } from '@playwright/test';
