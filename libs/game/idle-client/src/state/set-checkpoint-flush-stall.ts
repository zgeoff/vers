import type { CheckpointFlushStall } from '../types';
import { useIdleStore } from './use-idle-store';

/**
 * Records the latest flush-stall report. Telemetry only — the stream keeps retrying with its
 * queue intact, so nothing else in the store changes.
 */
export function setCheckpointFlushStall(checkpointFlushStall: CheckpointFlushStall) {
  useIdleStore.setState(() => ({ checkpointFlushStall }));
}
