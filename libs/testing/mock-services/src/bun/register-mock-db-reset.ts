import { afterEach } from 'bun:test';
import { resetMockDB } from '../db/reset-mock-db';

/**
 * Wires the `@msw/data` store's reset into the current bun-test run: clears every db collection
 * after each test. Call once from a package's preload — `bun test` runs every file in one process,
 * so a row one test writes otherwise stays visible to every later test.
 */
export function registerMockDBReset(): void {
  afterEach(() => {
    resetMockDB();
  });
}
