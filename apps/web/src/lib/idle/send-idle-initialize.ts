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

  setSimulationInitialized(true);
  setSimulationSnapshot(result.state);
  setRewardSlotLedger(result.rewardSlotLedger);
  setWriterDisplacedActivityID(result.writerDisplacedActivityID);
}
