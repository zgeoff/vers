export type {
  RewardSlotLedgerEntry,
  RewardSlotLedgerSnapshot,
  StartStatus,
  UndeliveredWork,
} from './worker/worker-contract';

export type { WorkerDebugSnapshot } from './worker/debug-snapshot-schema';
export type { RunOutcome } from './worker/run-outcome-schema';
export type { LiveRun } from './worker/live-run-schema';
export type { ResyncStatus } from './worker/worker-to-client-message-schema';

export enum WorkerMessageType {
  ActivityEnded = 'activity_ended',
  ActivityStartIngested = 'activity_start_ingested',
  CheckpointStreamInvalid = 'checkpoint_stream_invalid',
  FailureActionStatus = 'failure_action_status',
  JournalFailure = 'journal_failure',
  OfflineCapStatus = 'offline_cap_status',
  ResyncStatus = 'resync_status',
  RewardSlotsRecorded = 'reward_slots_recorded',
  SaveStatus = 'save_status',
  SimulationUpdate = 'simulation_update',
  WriterDisplaced = 'writer_displaced',
  WriterPending = 'writer_pending',
  WriterReady = 'writer_ready',
}

export interface CheckpointStreamError {
  readonly activityID: string;
}

export interface OfflineCapStatus {
  readonly halted: boolean;
  readonly remainingMs: number;
}

export type JournalFailureKind = 'quota' | 'unreadable' | 'write';

export interface JournalFailure {
  readonly activityID: string;
  readonly kind: JournalFailureKind;
  readonly receivedVersion: number | null;
}

export interface SaveStatus {
  readonly activityID: string;
  readonly receivedVersion: number | null;
  readonly savedVersion: number | null;
}

export type StoragePersistence = 'denied' | 'granted' | 'unavailable' | 'unknown';
