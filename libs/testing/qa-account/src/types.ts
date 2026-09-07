import type { CheckpointPayload } from '@vers/contract-activity';
import type { Activities, ActivityChains, AvatarItems } from '@vers/db';
import type { Insertable } from 'kysely';

export interface QAUser {
  readonly avatarName: string;
  readonly email: string;
  readonly name: string;
  readonly username: string;
}

export interface SeedEntropy {
  readonly genesisSeed: string;
  readonly userSeed: number;
}

export interface DatabaseTarget {
  readonly host: string;
  readonly isLoopback: boolean;
}

export interface KeyRoots {
  readonly rollKeyRoot: Uint8Array;
  readonly scopeSecretRoot: Uint8Array;
}

export interface PlannedCheckpointRow {
  readonly hash: string;
  readonly payload: CheckpointPayload;
  readonly prevHash: string;
  readonly version: number;
}

export type RunOutcome = 'completed' | 'failed';

export interface PlannedRun {
  readonly activity: Insertable<Activities>;
  readonly checkpoints: ReadonlyArray<PlannedCheckpointRow>;
  readonly items: ReadonlyArray<Insertable<AvatarItems>>;
  readonly outcome: RunOutcome;
  readonly xpDelta: number;
}

export interface QARunsPlan {
  readonly chain: Insertable<ActivityChains>;
  readonly clearedNodeIDs: ReadonlyArray<string>;
  readonly finalXP: number;
  readonly runs: ReadonlyArray<PlannedRun>;
}
