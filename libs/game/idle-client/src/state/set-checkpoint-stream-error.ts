import type { CheckpointStreamError } from '../types';
import { useCheckpointStreamErrorStore } from './use-checkpoint-stream-error-store';

export function setCheckpointStreamError(checkpointStreamError: CheckpointStreamError) {
  useCheckpointStreamErrorStore.setState(() => ({ checkpointStreamError }));
}
