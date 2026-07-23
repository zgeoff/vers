import { afterEach } from 'bun:test';
import { resolveIdleCheckpointDB } from './resolve-idle-checkpoint-db';

/**
 * Sweeps the idle worker's IndexedDB preferences store after each test, called once from the test
 * preload: `fake-indexeddb` persists for the whole one-process run, so a record one test seeds
 * would otherwise leak into every later test.
 */
export function registerIdleCheckpointDBReset(): void {
  afterEach(async () => {
    const idleCheckpointDB = await resolveIdleCheckpointDB();

    await idleCheckpointDB.clear('preferences');
  });
}
