import type { CatchUpContinuation } from '@vers/contract-activity';

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
