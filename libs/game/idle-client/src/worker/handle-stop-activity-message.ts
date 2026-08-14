import { removePendingStartIntent } from '../submission/remove-pending-start-intent';
import { WorkerMessageType } from '../types';
import { resetSimulation } from './reset-simulation';
import { submitStopIntent } from './submit-stop-intent';
import type { WorkerContext } from './types';
import type { WorkerMessage } from './worker-to-client-message-schema';

interface StopActivityInput {
  readonly activityID: string;
  readonly avatarID: string;
}

/**
 * Ends a run entirely inside the worker.
 */
export async function handleStopActivityMessage(
  context: WorkerContext,
  input: Readonly<StopActivityInput>,
): Promise<void> {
  const liveID = context.getActivity()?.id;

  // A newer run owns the runtime: the targeted row is an older one that the newer run's own start
  // flow already closed server-side, so there is nothing left to halt or deliver.
  if (liveID !== undefined && liveID !== input.activityID) {
    return;
  }

  // The local halt lands first and needs no network — the simulation stops, the runtime resets to
  // its idle state, and every tab sees a cleared snapshot.
  context.advanceStopScope();
  context.getSimulation().stopActivity();

  resetSimulation(context);

  context.resetRewardSlotLedger();

  const message = {
    state: { failureAction: context.getFailureAction() },
    type: WorkerMessageType.SimulationUpdate,
  } satisfies WorkerMessage;

  context.broadcast(message);

  // The durable intent is written and its delivery attempted only after the local halt completes.
  // unconditional: whatever continuation was outstanding died with the run the player ended
  await removePendingStartIntent();
  await submitStopIntent(context, { avatarID: input.avatarID, id: input.activityID });
}
