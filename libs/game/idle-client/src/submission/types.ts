import type { ContractRouterClient } from '@orpc/contract';
import type {
  CheckpointBatchEntry,
  ContentDocument,
  activityContract,
} from '@vers/contract-activity';
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

/**
 * A stop the player raised that the server hasn't confirmed yet. Held durably so a stop raised
 * offline, or lost to a crash, is delivered on the next reconnect before any resync plans — the
 * server row must read closed by then, or the resync would revive the stopped run and award
 * offline progress for time after the player quit.
 */
export interface PendingStopIntent {
  readonly activityID: string;
  readonly avatarID: string;
}

/**
 * A continuation the worker wanted to start but couldn't complete, held durably so it survives a
 * worker reload; a resync's entry drain retries it with the idempotent start key
 * `continue_<activityID>`. `activityID` names the source row, so the drain can tell that row
 * still being open (keep waiting) from a different claim on the avatar (stale). The row it
 * eventually starts takes the failure action current at drain time, not raise time.
 */
export interface PendingStartIntent {
  readonly activityID: string;
  readonly avatarID: string;
  readonly scopeID: string;
  readonly scopeType: string;
}

/**
 * A world-map node's genesis seed as the worker's durable cache holds it, keyed by the
 * `[avatarID, nodeID]` pair. A node's genesis seed is per avatar — two avatars sharing a coordinate
 * root distinct chains against distinct seeds — so the cache scopes every row to its avatar rather
 * than letting one avatar's reveal overwrite another's. Revealing an already-cached node writes the
 * same seed back in place: the server mint it comes from is idempotent per avatar and node, so the
 * cache write is too.
 */
export interface NodeSeed {
  readonly avatarID: string;
  readonly genesisSeed: string;
  readonly nodeID: string;
}

/**
 * A revealed node's genesis seed as it arrives over the worker message and off the reveal round
 * trip, before the avatar it belongs to is threaded onto it. The relayed batch carries one
 * avatarID for every seed in it, so a seed on the wire holds only its node id and seed.
 */
export interface RevealedNodeSeed {
  readonly genesisSeed: string;
  readonly nodeID: string;
}

export interface CheckpointQueueSchema extends DBSchema {
  'content-documents': {
    key: string;
    value: ContentDocument;
  };
  'node-seeds': {
    key: [string, string];
    value: NodeSeed;
  };
  'pending-checkpoints': {
    key: [string, number];
    value: QueuedCheckpoint;
  };
  preferences: {
    key: string;
    value: FailureActionPreference | PendingStartIntent | PendingStopIntent;
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
