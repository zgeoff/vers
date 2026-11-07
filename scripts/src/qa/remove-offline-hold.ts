import { rm } from 'node:fs/promises';
import { removeProcessGroup } from '../qa-chrome/remove-process-group';
import { STOP_GRACE_MS } from '../qa-chrome/stop-grace-ms';
import { readOfflineHold } from './read-offline-hold';
import type { OfflineHoldPaths } from './types';

export async function removeOfflineHold(paths: OfflineHoldPaths): Promise<void> {
  const hold = await readOfflineHold(paths);

  if (hold !== undefined) {
    await removeProcessGroup(hold.pid, STOP_GRACE_MS);
  }

  await rm(paths.stateFile, { force: true });
  await rm(paths.logFile, { force: true });
}
