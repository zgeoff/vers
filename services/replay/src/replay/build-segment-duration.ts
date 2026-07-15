import { TERMINAL_CHECKPOINT_TYPES } from './compare-replay-segment';
import type { StoredCheckpoint } from './types';

/**
 * Generous slack past a run's own summed local-attempt durations, covering the silent ticks
 * between its last recorded checkpoint and the true batch boundary — a checkpoint only fires on a
 * wave clear or terminal event, so a batch can legitimately end mid-wave with nothing emitted
 * since. Bounds the driver's safety-net duration far below `OFFLINE_PROGRESS_CAP_MS` while still
 * giving `stopAtState` room to find a checkpoint that hasn't fired yet.
 */
const DURATION_GRACE_MS = 60_000;

/**
 * Sums a run of stored checkpoints into a duration safety net for `advanceToDuration`: a
 * checkpoint's own `time` resets on every engine restart within a farmed stream, so this walks
 * each local attempt's own boundary — a `completed`/`failed` checkpoint — and adds its own `time`
 * to the running total, then a grace margin for the run's final, possibly still-open attempt. The
 * real stop condition is the caller's `stopAtState`; this only bounds how far a driver ever ticks
 * chasing a target it may never reach (a tampered final checkpoint's fabricated seed).
 */
export function buildSegmentDuration(checkpoints: ReadonlyArray<StoredCheckpoint>): number {
  let total = 0;
  let index = 0;

  while (index < checkpoints.length) {
    let end = index;

    while (end < checkpoints.length && !isTerminalCheckpoint(checkpoints[end])) {
      end += 1;
    }

    const boundary = checkpoints[Math.min(end, checkpoints.length - 1)];

    total += boundary?.payload.time ?? 0;
    index = end + 1;
  }

  return total + DURATION_GRACE_MS;
}

function isTerminalCheckpoint(checkpoint: Readonly<StoredCheckpoint> | undefined): boolean {
  return checkpoint !== undefined && TERMINAL_CHECKPOINT_TYPES.has(checkpoint.payload.type);
}
