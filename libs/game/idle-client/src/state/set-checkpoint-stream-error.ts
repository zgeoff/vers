import type { CheckpointStreamError } from '../types';
import { useIdleStore } from './use-idle-store';

/**
 * Records a fatal checkpoint-stream rejection and empties the reward-slot ledger in the same
 * update: once the stream is invalid its pending rewards will never verify.
 */
export function setCheckpointStreamError(checkpointStreamError: CheckpointStreamError) {
  useIdleStore.setState(() => ({ checkpointStreamError, rewardSlotLedger: [] }));
}
