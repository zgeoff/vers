import type { ContractRouterClient } from '@orpc/contract';
import type { CheckpointBatchEntry, activityContract } from '@vers/contract-activity';
import type { ActivityFailureAction } from '@vers/idle-core';
import type { DBSchema } from 'idb';

/**
 * A `CheckpointBatchEntry` queued for submission, keyed by the activity it belongs to. Stored
 * byte-identical to the mapped entry it was created from, so a resend never re-derives its hash.
 */
export interface QueuedCheckpoint extends CheckpointBatchEntry {
  readonly activityID: string;
}

/**
 * The failure-action preference as the device-local cache holds it: `dirty` marks a locally set
 * value the server hasn't acknowledged yet, so a resync knows to push it rather than adopt the
 * server's. `avatarID` scopes that value to the avatar it was set for, so a resync flushes a dirty
 * value only when it belongs to the avatar being resynced.
 */
export interface FailureActionPreference {
  readonly avatarID: string;
  readonly dirty: boolean;
  readonly failureAction: ActivityFailureAction;
}

export interface CheckpointQueueSchema extends DBSchema {
  'pending-checkpoints': {
    key: [string, number];
    value: QueuedCheckpoint;
  };
  preferences: {
    key: string;
    value: FailureActionPreference;
  };
}

/**
 * Per-call client context the worker's `RPCLink` reads: a minted `traceparent` sent as the
 * request's trace header, so the service continues the worker's trace instead of starting a
 * fresh one.
 */
export interface ActivityCallContext {
  readonly traceparent?: string;
}

export type ActivityServiceClient = ContractRouterClient<
  typeof activityContract,
  ActivityCallContext
>;

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
