import { afterEach } from 'bun:test';
import { resolveIdleCheckpointDB } from './resolve-idle-checkpoint-db';

export function registerIdleCheckpointDBReset(): void {
  afterEach(async () => {
    const idleCheckpointDB = await resolveIdleCheckpointDB();

    await idleCheckpointDB.clear('preferences');
  });
}
