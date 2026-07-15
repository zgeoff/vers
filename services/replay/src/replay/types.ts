import type { CheckpointPayload } from '@vers/contract-activity';
import type { ActivityStatus } from '@vers/db';

/**
 * A stored `activity_checkpoints` row, as read for comparison against a fresh replay.
 */
export interface StoredCheckpoint {
  readonly hash: string;
  readonly payload: CheckpointPayload;
  readonly prevHash: string;
  readonly version: number;
}

/**
 * Checkpoint types whose engine restart resets the next checkpoint's `time` to zero — the append
 * path ends an activity's append-ability on the first one it accepts, so a stored stream never
 * carries more than one.
 */
export const TERMINAL_CHECKPOINT_TYPES: ReadonlySet<string> = new Set(['completed', 'failed']);

/**
 * The frontier activity's replay unit: its own row's stamped versions and chain position, the
 * chain row's anchors, and every stored checkpoint from version 1 through `appendedHead` — the
 * unverified tail to compare is `checkpoints.slice(verifiedHead)`; the whole array is what a
 * cache-miss rebuild replays through. `prevHash` and `seed` are the hash chain and
 * seed-derivation roots the unverified tail's first checkpoint links onto — the activity's
 * `startHash`/`seed` when nothing has verified yet, or the last-verified checkpoint's own
 * `hash`/`nextSeed` otherwise.
 */
export interface ReplaySegment {
  readonly activity: {
    readonly appendedHead: number;
    readonly appendedTimeMs: number;
    readonly avatarID: string;
    readonly buildSnapshot: { readonly level: number; readonly xp: number };
    readonly contentVersion: string;
    readonly id: string;
    readonly keyVersion: number;
    readonly scopeID: string;
    readonly scopeType: string;
    readonly seed: string;
    readonly simVersion: string;
    readonly startChainIndex: number;
    readonly status: ActivityStatus;
  };
  readonly chain: {
    readonly genesisSeed: string;
    readonly verifiedChainIndex: number;
    readonly verifiedNextSeed: string;
  };
  readonly checkpoints: ReadonlyArray<StoredCheckpoint>;
  readonly prevHash: string;
  readonly seed: string;
  readonly verifiedHead: number;
}

/**
 * The minimal shape `compareReplaySegment` needs from a freshly replayed checkpoint — satisfied
 * structurally by both the engine's native `ActivityCheckpoint` union and the wire
 * `ActivityCheckpoint` the cross-version dispatch returns, so compare never converts between them.
 */
export interface ReplayedCheckpoint {
  readonly levelUp?: { readonly from: number; readonly to: number } | undefined;
  readonly nextSeed: string;
  readonly rewards: { readonly xp: number };
  readonly seed?: string;
  readonly time: number;
  readonly type: string;
}

/**
 * A roll-slot fact from the replayed trajectory, reserved for #469's reveal path — no slot has
 * landed yet, so the type has no members and every verdict's `rewardFacts` is empty.
 */
type RewardFact = never;

/**
 * Why a segment's stored checkpoints failed to reproduce on replay.
 */
type DivergenceReason =
  | 'checkpoint-count-mismatch'
  | 'hash-mismatch'
  | 'reward-mismatch'
  | 'seed-mismatch';

/**
 * The outcome of comparing a segment's stored checkpoints against a fresh replay. `match` carries
 * the segment's verified xp delta (the terminal checkpoint's reward, when the segment ends on one)
 * for a future settlement consumer to apply — this worker never writes it.
 */
export type CompareVerdict =
  | {
      readonly kind: 'match';
      readonly rewardFacts: ReadonlyArray<RewardFact>;
      readonly verifiedXPDelta: number;
    }
  | { readonly kind: 'divergence'; readonly reason: DivergenceReason; readonly version: number };

/**
 * The only stamped simulation inputs a replay drive reads — a subset of the frontier segment's
 * activity, so a test can build one inline without a full `ReplaySegment`.
 */
export interface ReplaySimulationActivitySource {
  readonly avatarID: string;
  readonly buildSnapshot: { readonly level: number; readonly xp: number };
  readonly id: string;
  readonly seed: string;
}
