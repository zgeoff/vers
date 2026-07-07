// Pulls @zgeoff/bun-test-extended's jest-extended matcher augmentation into this package's tsc
// program. The package ships `.ts` source with no `.d.ts`, so the tsconfig `types` option can't
// resolve it as a type-reference directive — only a real import brings the `bun:test` `expect`
// augmentation into scope. bunfig.toml preloads the same module for the matching runtime matcher
// registration.
import '@zgeoff/bun-test-extended';
import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers';

/**
 * Brings `@testing-library/jest-dom`'s matcher types into `bun:test`'s own `expect` — `test-setup`
 * registers the runtime matchers via `expect.extend`, this only supplies the corresponding types.
 */
declare module 'bun:test' {
  // oxlint-disable-next-line typescript/no-empty-interface -- module augmentation, emptiness is the point
  interface Matchers<T> extends TestingLibraryMatchers<T, void> {}
}
