import type { CheckpointFlushStall } from '../types';
import { useIdleStore } from './use-idle-store';

/**
 * Records the latest flush-stall report, or clears it (`null`) once a consumer has forwarded it —
 * the stall is a one-shot telemetry signal, not persistent state, so a cleared report is never
 * re-delivered on a later mount. The stream keeps retrying with its queue intact either way, so
 * nothing else in the store changes.
 */
export function setCheckpointFlushStall(checkpointFlushStall: CheckpointFlushStall | null) {
  useIdleStore.setState(() => ({ checkpointFlushStall }));
}
