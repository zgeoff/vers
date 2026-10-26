import type { ContractRouterClient } from '@orpc/contract';
import type {
  BuildSnapshot,
  CheckpointBatchEntry,
  EncounterNode,
  OfflineActivityStartSubmission,
  activityContract,
} from '@vers/contract-activity';
import type { DB } from '@vers/db';
import type { EncounterContent } from '@vers/game-utils';
import type { ActivityFailureAction } from '@vers/idle-core';
import type { CryptoKey } from 'jose';
import type { Kysely } from 'kysely';

export interface LoadStack {
  readonly appURL: string;
  readonly containerPrefix: string;
  readonly db: Kysely<DB>;
  readonly privateKey: CryptoKey;
  readonly readExits: (startedAt: Date) => Promise<Array<ContainerExit>>;
  readonly readLogs: (service: string, since: Date) => Promise<string>;
  readonly remove: () => Promise<void>;
  readonly sessionSecret: string;
  readonly sessionServiceURL: string;
  readonly startService: (service: string) => Promise<void>;
  readonly stopService: (service: string) => Promise<void>;
  readonly versions: LoadEngineVersions;
}

export type PlayerClient = ContractRouterClient<typeof activityContract>;

export interface LoadPlayerAccount {
  readonly avatarID: string;
  readonly profile: PlayerProfile;
  readonly userID: string;
}

export interface ConnectedPlayer {
  readonly account: LoadPlayerAccount;
  readonly buildSnapshot: BuildSnapshot;
  readonly chain: PlayerChain;
  readonly client: PlayerClient;
  readonly content: EncounterContent;
}

export interface CookieJar {
  header: string;
  readonly name: string;
}

export interface CallRecord {
  readonly durationMs: number;
  readonly failure?: string;
  readonly procedure: string;
  readonly status: number;
}

interface ChainAnchor {
  readonly chainIndex: number;
  readonly nextSeed: string;
}

export interface PlayerChain {
  readonly anchor: ChainAnchor;
  readonly contentVersion: string;
  readonly encounterNode: EncounterNode;
  readonly keyVersion: number;
  readonly scopeID: string;
  readonly scopeType: string;
}

export interface PlayerProfile {
  readonly failureAction: ActivityFailureAction;
  readonly index: number;
  readonly level: number;
  readonly simVersion: string;
}

export interface ActivityRun {
  readonly entries: ReadonlyArray<CheckpointBatchEntry>;
  readonly id: string;
  readonly nextAnchor: ChainAnchor;
  readonly nextBuildSnapshot: BuildSnapshot;
  readonly outcome: 'completed' | 'failed';
  readonly start: OfflineActivityStartSubmission;
  readonly xpTotal: number;
}

export interface LoadEngineVersions {
  readonly current: string;
  readonly retained: string;
}

export interface DeliveredRun {
  readonly activityID: string;
  readonly terminal: boolean;
  readonly xpTotal: number;
}

export interface ContainerSample {
  readonly container: string;
  readonly cpuPercent: number;
  readonly elapsedMs: number;
  readonly memoryBytes: number;
}

export interface ContainerExit {
  readonly container: string;
  readonly elapsedMs: number;
  readonly exitCode: number;
  readonly oomKilled: boolean;
}

export interface PipelineSample {
  readonly appended: number;
  readonly backedOff: number;
  readonly elapsedMs: number;
  readonly held: number;
  readonly lockWaiters: number;
  readonly longestTransactionMs: number;
  readonly verified: number;
}

interface SettlementAge {
  readonly ageMs: number;
  readonly elapsedMs: number;
}

export interface SamplerRecording {
  readonly containers: Array<ContainerSample>;
  readonly pipeline: Array<PipelineSample>;
  readonly settlementAges: Array<SettlementAge>;
}

export interface LockWaits {
  readonly acquiredAfterMs: ReadonlyArray<number>;
  readonly byLock: Readonly<Record<string, number>>;
  readonly waits: number;
}

interface Refusal {
  readonly code: string;
  readonly procedure: string;
}

export interface CallLog {
  readonly calls: Array<CallRecord>;
  readonly refusals: Array<Refusal>;
}

export interface Reconciliation {
  readonly activities: number;
  readonly avatarXPMismatches: number;
  readonly checkpoints: number;
  readonly held: number;
  readonly outcomes: Readonly<Record<string, number>>;
  readonly runXPMismatches: number;
  readonly simulatedMs: number;
  readonly unverified: number;
}

export interface ScenarioEvent {
  readonly elapsedMs: number;
  readonly label: string;
}

export interface ScenarioRecording {
  readonly calls: ReadonlyArray<CallRecord>;
  readonly events: ReadonlyArray<ScenarioEvent>;
  readonly exits: ReadonlyArray<ContainerExit>;
  readonly lockWaits: LockWaits;
  readonly name: string;
  readonly outage?: OutageWindow | undefined;
  readonly players: number;
  readonly playMs: number;
  readonly reconciliation: Reconciliation;
  readonly recording: SamplerRecording;
  readonly refusals: ReadonlyArray<Refusal>;
  readonly settleMs: number | undefined;
}

export interface OutageWindow {
  readonly endedMs: number;
  readonly service: string;
  readonly startedMs: number;
}

export interface ProcedureSummary {
  readonly calls: number;
  readonly failures: number;
  readonly p50Ms: number;
  readonly p95Ms: number;
  readonly procedure: string;
}

export interface ResourceSummary {
  readonly container: string;
  readonly cpuMeanPercent: number;
  readonly cpuP95Percent: number;
  readonly memoryPeakBytes: number;
}

export interface ScenarioSummary {
  readonly delivery: {
    readonly calls: number;
    readonly failedByStatus: Readonly<Record<string, number>>;
    readonly peakBackedOff: number;
    readonly procedures: ReadonlyArray<ProcedureSummary>;
    readonly refusals: Readonly<Record<string, number>>;
  };
  readonly events: ReadonlyArray<ScenarioEvent>;
  readonly exits: ReadonlyArray<ContainerExit>;
  readonly name: string;
  readonly players: number;
  readonly playMs: number;
  readonly reconciliation: Reconciliation;
  readonly recoveryMs: number | undefined;
  readonly resources: ReadonlyArray<ResourceSummary>;
  readonly settleMs: number | undefined;
  readonly settlementAgeMs: {
    readonly count: number;
    readonly max: number;
    readonly p50: number;
    readonly p95: number;
    readonly p99: number;
  };
  readonly transactions: {
    readonly byLock: Readonly<Record<string, number>>;
    readonly lockWaitMaxMs: number;
    readonly lockWaitP95Ms: number;
    readonly lockWaits: number;
    readonly longestTransactionMs: number;
    readonly peakLockWaiters: number;
  };
  readonly workload: {
    readonly activities: number;
    readonly checkpoints: number;
    readonly outcomes: Readonly<Record<string, number>>;
    readonly peakVerifiedPerMinute: number;
    readonly simulatedHours: number;
  };
}

export interface LoadReportContext {
  readonly commit: string;
  readonly postgresCPUs: number;
  readonly serviceCPUs: number;
  readonly settlementTargetMs: number;
  readonly versions: LoadEngineVersions;
}
