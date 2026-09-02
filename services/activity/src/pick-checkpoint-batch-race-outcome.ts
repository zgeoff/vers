import type { CheckpointBatchEntry } from '@vers/contract-activity';
import { buildCheckpointHashFromEntry } from '@vers/contract-activity';
import type { ActivityStatus } from '@vers/db';

export interface CheckpointBatchRaceRow {
  readonly appendedHead: number;
  readonly lastHash: string;
  readonly status: ActivityStatus;
  readonly writerSessionId: null | string;
}

export type CheckpointBatchRaceOutcome =
  | { readonly kind: 'not-found' }
  | { readonly kind: 'session-evicted' }
  | { readonly appendedHead: number; readonly kind: 'conflict' }
  | { readonly appendedHead: number; readonly kind: 'resubmit-settled' }
  | { readonly appendedHead: number; readonly kind: 'terminal'; readonly status: ActivityStatus };

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

function isSettledResubmit(
  checkpoints: ReadonlyArray<CheckpointBatchEntry>,
  settled: Readonly<SettledTailRow>,
): boolean {
  const lastCheckpoint = checkpoints.at(-1);

  // The last entry's version must land on `settled.appendedHead`.
  if (lastCheckpoint === undefined || lastCheckpoint.version !== settled.appendedHead) {
    return false;
  }

  let previousHash: string | undefined;

  // Every entry's hash is recomputed from its payload, never trusted from the submitted `hash`
  // field, and must chain onto the previous entry's rebuilt hash.
  for (const checkpoint of checkpoints) {
    if (previousHash !== undefined && checkpoint.prevHash !== previousHash) {
      return false;
    }

    previousHash = buildCheckpointHashFromEntry(checkpoint);
  }

  // The final rebuilt hash must reproduce `settled.lastHash`.
  return previousHash === settled.lastHash;
}
