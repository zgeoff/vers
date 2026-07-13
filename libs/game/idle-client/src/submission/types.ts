import type { CheckpointBatchEntry } from '@vers/contract-activity';
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
