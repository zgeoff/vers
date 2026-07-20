import { createSimulation } from '@vers/idle-core';
import { removePendingStartIntent } from '../submission/remove-pending-start-intent';
import type { StopActivityMessage } from '../types';
import { createSimulationUpdateMessage } from './create-simulation-update-message';
import { registerSimulationListeners } from './register-simulation-listeners';
import { submitStopIntent } from './submit-stop-intent';
import type { WorkerContext } from './types';

/**
 * Ends a run entirely inside the worker: the local halt lands first and needs no network — the
 * simulation stops, a fresh empty one takes its place, and every tab sees a cleared snapshot —
 * then the durable intent is written and its delivery attempted. The stopped instance is replaced
 * rather than kept because stopping only detaches its activity; its avatar and combat state would
 * otherwise linger in every later snapshot a connecting tab receives. The runtime keeps a non-null
 * simulation throughout, so a later fresh-start message still finds one to install into.
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

  const simulation = context.getSimulation();

  if (simulation !== null) {
    await simulation.stopActivity();
  }

  const replacement = createSimulation();

  registerSimulationListeners(context, replacement);

  context.setSimulation(replacement);
  context.setActivity(null);
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
