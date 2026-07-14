import type { ContractRouterClient } from '@orpc/contract';
import type { CheckpointBatchEntry, activityContract } from '@vers/contract-activity';
import type { DBSchema } from 'idb';

/**
 * A `CheckpointBatchEntry` queued for submission, keyed by the activity it belongs to. Stored
 * byte-identical to the mapped entry it was created from, so a resend never re-derives its hash.
 */
export interface QueuedCheckpoint extends CheckpointBatchEntry {
  readonly activityID: string;
}

export interface CheckpointQueueSchema extends DBSchema {
  'pending-checkpoints': {
    key: [string, number];
    value: QueuedCheckpoint;
  };
}

export type ActivityServiceClient = ContractRouterClient<typeof activityContract>;

/**
 * The chain-link state an activity's stream starts submission from: `appendedHead` seeds the
 * first submission's compare-and-swap, `lastHash` seeds the first entry's `prevHash`, and
 * `startChainIndex` anchors every entry's `chainIndex`. A mid-stream resume whose confirmed rows
 * are no longer queued locally also carries `previousNextSeed` — the last appended checkpoint's
 * `nextSeed` — so the next entry's seed continues the chain the server already holds.
 */
export interface ActivitySubmissionContext {
  readonly activityID: string;
  readonly appendedHead: number;
  readonly lastHash: string;
  readonly previousNextSeed?: string;
  readonly startChainIndex: number;
}
