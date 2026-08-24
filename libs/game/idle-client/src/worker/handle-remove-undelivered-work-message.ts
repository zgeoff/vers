import { removeOfflineWork } from '../submission/remove-offline-work';
import { resetSimulation } from './reset-simulation';
import type { WorkerContext } from './types';

/**
 * Discards this device's undelivered offline work: the caller is about to end the session, and
 * the player has confirmed the loss. The simulation stops first — a live one keeps queueing
 * checkpoints, so clearing under it would leave fresh rows behind for a run the player already
 * gave up. No broadcast: the tab that asked for this navigates away into the logout redirect, and
 * every other tab in the profile loses the same cookie and signs itself out on its next call.
 */
export async function handleRemoveUndeliveredWorkMessage(context: WorkerContext): Promise<void> {
  resetSimulation(context);

  await removeOfflineWork();
}
