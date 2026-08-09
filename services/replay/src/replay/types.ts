import type { CheckpointPayload } from '@vers/contract-activity';
import type { ActivityStatus } from '@vers/db';

/**
 * A stored `activity_checkpoints` row, as read for comparison against a fresh replay.
 */
export interface StoredCheckpoint {
  /**
   * When this checkpoint landed. Present whenever the checkpoint was read from its stored
   * `activity_checkpoints` row; absent only when the checkpoint was constructed without that row,
   * which never carries a landing time.
   */
  readonly appendedAt?: Date;
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
    readonly encounterNode: { readonly difficulty: number; readonly poolID?: string | undefined };
    readonly id: string;
    readonly keyVersion: number;
    readonly scopeID: string;
    readonly scopeType: string;
    readonly seed: string;

    /**
     * The scope secret ref and root version content sealing derived this activity's node content
     * from.
     */
    readonly secretRef: string;
    readonly secretVersion: number;

    /**
     * The xp this activity has already contributed to its avatar's settled row, so a terminal
     * checkpoint's run total settles only the part no earlier segment paid.
     */
    readonly settledXP: number;
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
  readonly rewardSlots?:
    | ReadonlyArray<{
        readonly context: { readonly nodeTier: number };
        readonly ordinal: number;
      }>
    | undefined;
  readonly seed?: string;
  readonly time: number;
  readonly type: string;
}

/**
 * A verified reward slot's coordinate and rolling context, resolved against the segment's own
 * `startChainIndex` — the mint step's whole input for one slot.
 */
export interface RewardFact {
  readonly chainIndex: number;
  readonly nodeTier: number;
  readonly ordinal: number;
}

/**
 * Why a segment's stored checkpoints failed to reproduce on replay.
 */
type DivergenceReason =
  | 'checkpoint-count-mismatch'
  | 'descriptor-mismatch'
  | 'hash-mismatch'
  | 'reward-mismatch'
  | 'seed-mismatch';

/**
 * The outcome of comparing a segment's stored checkpoints against a fresh replay. A `match`
 * reports the segment's xp two ways, because the engine represents them differently: `xpSum` adds
 * up the per-checkpoint deltas every non-terminal checkpoint carries, while `terminalXPTotal` is
 * present only when the segment ends on a terminal checkpoint and is the run's final total rather
 * than a delta. A caller settling against a running per-activity total uses the second when it is
 * present and the first otherwise — never both, or the deltas the total already contains would
 * pay twice.
 */
export type CompareVerdict =
  | {
      readonly kind: 'match';
      readonly rewardFacts: ReadonlyArray<RewardFact>;
      readonly terminalXPTotal?: number | undefined;
      readonly xpSum: number;
    }
  | { readonly kind: 'divergence'; readonly reason: DivergenceReason; readonly version: number };
