import type { CatchUpContinuation } from '@vers/contract-activity';

/**
 * Splits a planned continuation chain into bounded batches, each capped on total checkpoints
 * across its continuations — never a single continuation split across two batches. Keeps a bulk
 * request's peak payload size and server sync-hash CPU flat regardless of how long the offline
 * gap ran, so the worst case (a full `OFFLINE_PROGRESS_CAP_MS` day) never lands as one request. A
 * continuation whose own checkpoint count exceeds the cap still gets a batch to itself, rather
 * than being dropped or blocked.
 */
export function splitContinuationsIntoBatches(
  continuations: ReadonlyArray<CatchUpContinuation>,
  maxCheckpointsPerBatch: number,
): Array<Array<CatchUpContinuation>> {
  const batches: Array<Array<CatchUpContinuation>> = [];
  let current: Array<CatchUpContinuation> = [];
  let currentCheckpointCount = 0;

  for (const continuation of continuations) {
    if (
      current.length > 0 &&
      currentCheckpointCount + continuation.checkpoints.length > maxCheckpointsPerBatch
    ) {
      batches.push(current);

      current = [];
      currentCheckpointCount = 0;
    }

    current.push(continuation);

    currentCheckpointCount += continuation.checkpoints.length;
  }

  if (current.length > 0) {
    batches.push(current);
  }

  return batches;
}
