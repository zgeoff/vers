import type { CheckpointBatchEntry } from '@vers/contract-activity';
import { buildCheckpointHash } from '@vers/contract-activity';
import type { ActivityStatus } from '@vers/db';

/**
 * A checkpoint batch's append target, as read fresh after its guarded update lost the race — the
 * shape both `trackActivityProgress` and `advanceActivity` resolve a lost compare-and-swap from.
 */
export interface CheckpointBatchRaceRow {
  readonly appendedHead: number;
  readonly lastHash: string;
  readonly status: ActivityStatus;
  readonly writerSessionId: null | string;
}

/**
 * What a lost checkpoint-batch compare-and-swap resolves to: the row is gone (`not-found`), a
 * resubmit that recomputes onto the recorded tail settles as already-applied (`resubmit-settled`),
 * any other batch against a non-active row is fatal for the stream (`terminal`), a different
 * session now owns the writer (`session-evicted`), or the head is simply stale and retryable
 * (`conflict`).
 */
export type CheckpointBatchRaceOutcome =
  | { readonly kind: 'not-found' }
  | { readonly kind: 'session-evicted' }
  | { readonly appendedHead: number; readonly kind: 'conflict' }
  | { readonly appendedHead: number; readonly kind: 'resubmit-settled' }
  | { readonly appendedHead: number; readonly kind: 'terminal'; readonly status: ActivityStatus };

/**
 * Resolves a lost head-row race from a fresh read of the activity row: gone (`not-found`),
 * terminal (a matching resubmit settles as `resubmit-settled`, otherwise `terminal`), writer taken
 * over (`session-evicted`), or a retryable stale head (`conflict`). Pure and error-shape-free, so
 * each caller maps the outcome onto its own contract's error payloads.
 */
export function pickCheckpointBatchRaceOutcome(
  actingSessionID: null | string,
  current: Readonly<CheckpointBatchRaceRow> | undefined,
  checkpoints: ReadonlyArray<CheckpointBatchEntry>,
): CheckpointBatchRaceOutcome {
  if (current === undefined) {
    return { kind: 'not-found' };
  }

  if (current.status !== 'active') {
    if (isSettledResubmit(checkpoints, current)) {
      return { appendedHead: current.appendedHead, kind: 'resubmit-settled' };
    }

    return { appendedHead: current.appendedHead, kind: 'terminal', status: current.status };
  }

  if (current.writerSessionId !== null && current.writerSessionId !== actingSessionID) {
    return { kind: 'session-evicted' };
  }

  return { appendedHead: current.appendedHead, kind: 'conflict' };
}

interface SettledTailRow {
  readonly appendedHead: number;
  readonly lastHash: string;
}

/**
 * Reports whether a checkpoint batch, replayed from scratch, recomputes onto a settled activity's
 * recorded tail: the last entry's version lands on `settled.appendedHead`, and every entry's hash —
 * recomputed from each payload, never trusted from the submitted `hash` field — chains onto
 * the previous entry's rebuilt hash and the final one reproduces `settled.lastHash`. A match proves
 * the recorded tail is this exact batch: the original submit landed and only the ack was lost.
 */
function isSettledResubmit(
  checkpoints: ReadonlyArray<CheckpointBatchEntry>,
  settled: Readonly<SettledTailRow>,
): boolean {
  const lastCheckpoint = checkpoints.at(-1);

  if (lastCheckpoint === undefined || lastCheckpoint.version !== settled.appendedHead) {
    return false;
  }

  let previousHash: string | undefined;

  for (const checkpoint of checkpoints) {
    if (previousHash !== undefined && checkpoint.prevHash !== previousHash) {
      return false;
    }

    previousHash = buildCheckpointHash({
      chainIndex: checkpoint.payload.chainIndex,
      entropySource: checkpoint.payload.entropySource,
      nextSeed: checkpoint.payload.nextSeed,
      prevHash: checkpoint.prevHash,
      seed: checkpoint.payload.seed,
      time: checkpoint.payload.time,
      type: checkpoint.payload.type,
      version: checkpoint.version,
    });
  }

  return previousHash === settled.lastHash;
}
