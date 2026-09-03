import { afterEach } from 'bun:test';
import { resetMockDB } from '../db/reset-mock-db';

export function registerMockDBReset(): void {
  afterEach(() => {
    resetMockDB();
  });
}
