import type { CheckpointBatchEntry } from '@vers/contract-activity';

export type SettlementDevice = 'device-a' | 'device-b';

type SettlementScopeID = '0_0' | '1_0';

export type SettlementCommand =
  | {
      readonly durationMs: number;
      readonly genesis: number;
      readonly kind: 'start';
      readonly scopeID: SettlementScopeID;
    }
  | {
      readonly count: number;
      readonly device: SettlementDevice;
      readonly kind: 'deliver' | 'forge';
    }
  | {
      readonly count: number;
      readonly device: SettlementDevice;
      readonly kind: 'redeliver';
      readonly skip: number;
    }
  | { readonly device: SettlementDevice; readonly kind: 'stop' }
  | { readonly device: SettlementDevice; readonly kind: 'takeover' }
  | { readonly kind: 'settle-all' }
  | { readonly kind: 'settle-one' };

export interface SettlementCase {
  readonly avatarSeed: number;
  readonly commands: ReadonlyArray<SettlementCommand>;
}

export interface ModelCheckpoint {
  readonly entry: CheckpointBatchEntry;
  readonly forgedEntry: CheckpointBatchEntry;
  readonly rewardOrdinals: ReadonlyArray<number>;
  readonly type: string;
  readonly xp: number;
}

type ModelActivityStatus = 'active' | 'rejected' | 'stopped';

export interface ModelActivity {
  readonly appendedHead: number;
  readonly buildXP: number;
  readonly checkpoints: ReadonlyArray<ModelCheckpoint>;
  readonly id: string;
  readonly predecessorID: null | string;
  readonly scopeID: string;
  readonly settledXP: number;
  readonly startChainIndex: number;
  readonly status: ModelActivityStatus;
  readonly tamperedVersion: null | number;
  readonly verifiedHead: number;
  readonly writer: null | SettlementDevice;
}

export interface ModelChain {
  readonly appendedChainIndex: number;
  readonly scopeID: string;
  readonly verifiedChainIndex: number;
}

export interface SettlementModel {
  readonly activities: ReadonlyArray<ModelActivity>;
  readonly avatarXP: number;
  readonly chains: ReadonlyArray<ModelChain>;
  readonly grants: ReadonlyArray<string>;
  readonly items: ReadonlyArray<string>;
}

export type ModelCall =
  | {
      readonly device: SettlementDevice;
      readonly expectedHead: number;
      readonly forged: boolean;
      readonly kind: 'deliver';
      readonly lastVersion: number;
    }
  | { readonly device: SettlementDevice; readonly kind: 'stop' }
  | { readonly device: SettlementDevice; readonly kind: 'takeover' };

export type CallOutcome =
  | { readonly kind: 'accepted' }
  | {
      readonly code: 'ACTIVITY_TERMINAL' | 'CONFLICT' | 'NOT_FOUND' | 'SESSION_EVICTED';
      readonly kind: 'refused';
    };

export type IterationOutcome = 'claimed' | 'idle';

export interface SnapshotActivity {
  readonly appendedHead: number;
  readonly id: string;
  readonly settledXP: number;
  readonly status: string;
  readonly verifiedHead: number;
  readonly writer: null | string;
}

export interface SettlementSnapshot {
  readonly activities: ReadonlyArray<SnapshotActivity>;
  readonly avatarXP: number;
  readonly chains: ReadonlyArray<ModelChain>;
  readonly grants: ReadonlyArray<string>;
  readonly items: ReadonlyArray<string>;
}

export interface SettlementFailure {
  readonly actual?: unknown;
  readonly expected?: unknown;
  readonly step: number;
  readonly command: SettlementCommand;
  readonly violations: ReadonlyArray<string>;
}
