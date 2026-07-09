import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers';

/**
 * Brings `@testing-library/jest-dom`'s matcher types into `bun:test`'s own `expect`; only the
 * types — the runtime matchers are registered separately via `expect.extend` in the preload.
 * The jest-extended matcher types come from `@zgeoff/bun-test-extended` via tsconfig `types`.
 */
declare module 'bun:test' {
  // oxlint-disable-next-line typescript/no-empty-interface -- module augmentation, emptiness is the point
  interface Matchers<T> extends TestingLibraryMatchers<T, void> {}
}
