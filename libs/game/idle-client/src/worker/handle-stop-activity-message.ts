import { removePendingStartIntent } from '../submission/remove-pending-start-intent';
import type { StopActivityMessage } from '../types';
import { createSimulationUpdateMessage } from './create-simulation-update-message';
import { resetSimulation } from './reset-simulation';
import { submitStopIntent } from './submit-stop-intent';
import type { WorkerContext } from './types';

/**
 * Ends a run entirely inside the worker: the local halt lands first and needs no network — the
 * simulation stops, the runtime resets to its idle state, and every tab sees a cleared snapshot —
 * then the durable intent is written and its delivery attempted.
 */
export async function handleStopActivityMessage(
  context: WorkerContext,
  message: StopActivityMessage,
): Promise<void> {
  const liveID = context.getActivity()?.id;

  // A newer run owns the runtime: the targeted row is an older one that the newer run's own start
  // flow already closed server-side, so there is nothing left to halt or deliver.
  if (liveID !== undefined && liveID !== message.activityID) {
    return;
  }

  context.advanceStopEpoch();

  await context.getSimulation().stopActivity();

  resetSimulation(context);

  context.resetRewardSlotLedger();

  emitClearedSnapshot(context);

  // unconditional: whatever continuation was outstanding died with the run the player ended
  await removePendingStartIntent();
  await submitStopIntent(context, { avatarID: message.avatarID, id: message.activityID });
}

function emitClearedSnapshot(context: WorkerContext): void {
  const message = createSimulationUpdateMessage({ failureAction: context.getFailureAction() });

  for (const connection of context.connections) {
    connection.postMessage(message);
  }
}
