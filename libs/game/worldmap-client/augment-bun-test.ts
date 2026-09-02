import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers';

declare module 'bun:test' {
  // oxlint-disable-next-line typescript/no-empty-interface -- module augmentation, emptiness is the point
  interface Matchers<T> extends TestingLibraryMatchers<T, void> {}
}
