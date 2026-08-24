import { removeOfflineWork } from '../submission/remove-offline-work';
import { resetSimulation } from './reset-simulation';
import type { WorkerContext } from './types';

/**
 * Discards this device's undelivered offline work: the caller is about to end the session, and the
 * player has confirmed the loss.
 *
 * The durable stores clear before the simulation stops, so a clear that fails leaves the run
 * ticking and the outbox intact — the caller reports the failure and the player decides again,
 * rather than losing a run to a discard that never landed. A live simulation can queue one more
 * checkpoint while the clear runs; that row names an activity whose start row the clear took with
 * it, so no later flush can deliver it.
 *
 * Nothing is broadcast: the tab that asked for this navigates away into the logout redirect, and
 * every other tab in the profile loses the same cookie and signs itself out on its next call.
 */
export async function handleRemoveUndeliveredWorkMessage(context: WorkerContext): Promise<void> {
  await removeOfflineWork();

  resetSimulation(context);
}
