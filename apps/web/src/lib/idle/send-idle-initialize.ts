import type { WorkerClient } from '@vers/idle-client';
import {
  setRewardSlotLedger,
  setSimulationInitialized,
  setSimulationSnapshot,
  setWriterDisplacedActivityID,
} from '@vers/idle-client';

/**
 * Asks the worker for its current state and applies the answer to the shared store — the only
 * caller of `initialize`, so no other path routes this response.
 */
export async function sendIdleInitialize(client: WorkerClient, signal: AbortSignal): Promise<void> {
  const result = await client.initialize({}, { signal });

  // the call can settle in the same tick its writer is replaced; the answer is the dead writer's
  // state, and applying it would mark a fresh writer's connection initialized with stale state
  if (signal.aborted) {
    return;
  }

  setSimulationInitialized(true);
  setSimulationSnapshot(result.state);
  setRewardSlotLedger(result.rewardSlotLedger);
  setWriterDisplacedActivityID(result.writerDisplacedActivityID);
}
