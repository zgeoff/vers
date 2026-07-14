import type { CheckpointStreamError } from '../types';
import { useIdleStore } from './use-idle-store';

export function setCheckpointStreamError(checkpointStreamError: CheckpointStreamError) {
  useIdleStore.setState(() => ({ checkpointStreamError }));
}
