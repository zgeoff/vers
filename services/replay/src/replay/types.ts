import type { CheckpointPayload } from '@vers/contract-activity';
import type { ActivityStatus } from '@vers/db';

export interface StoredCheckpoint {
  readonly appendedAt?: Date;
  readonly hash: string;
  readonly payload: CheckpointPayload;
  readonly prevHash: string;
  readonly version: number;
}

export const TERMINAL_CHECKPOINT_TYPES: ReadonlySet<string> = new Set(['completed', 'failed']);

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

    readonly secretRef: string;
    readonly secretVersion: number;

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

export interface RewardFact {
  readonly chainIndex: number;
  readonly nodeTier: number;
  readonly ordinal: number;
}

type DivergenceReason =
  | 'checkpoint-count-mismatch'
  | 'descriptor-mismatch'
  | 'hash-mismatch'
  | 'reward-mismatch'
  | 'seed-mismatch';

export type CompareVerdict =
  | {
      readonly kind: 'match';
      readonly rewardFacts: ReadonlyArray<RewardFact>;
      readonly terminalXPTotal?: number | undefined;
      readonly xpSum: number;
    }
  | { readonly kind: 'divergence'; readonly reason: DivergenceReason; readonly version: number };
