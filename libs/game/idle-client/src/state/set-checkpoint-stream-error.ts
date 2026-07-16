import type { CheckpointStreamError } from '../types';
import { useIdleStore } from './use-idle-store';

/**
 * Records a fatal checkpoint-stream rejection and empties the reward-slot ledger in the same
 * update: once the stream is invalid its pending rewards will never verify, so the same event that
 * reports the failure also drops the counts that were catching up.
 */
export function setCheckpointStreamError(checkpointStreamError: CheckpointStreamError) {
  useIdleStore.setState(() => ({ checkpointStreamError, rewardSlotLedger: [] }));
}
