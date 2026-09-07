export type {
  RewardSlotLedgerEntry,
  RewardSlotLedgerSnapshot,
  StartStatus,
  UndeliveredWork,
} from './worker/worker-contract';

export type { RunOutcome } from './worker/run-outcome-schema';
export type { ResyncStatus } from './worker/worker-to-client-message-schema';

export enum WorkerMessageType {
  ActivityEnded = 'activity_ended',
  ActivityStartIngested = 'activity_start_ingested',
  CheckpointStreamInvalid = 'checkpoint_stream_invalid',
  FailureActionStatus = 'failure_action_status',
  OfflineCapStatus = 'offline_cap_status',
  ResyncStatus = 'resync_status',
  RewardSlotsRecorded = 'reward_slots_recorded',
  SimulationUpdate = 'simulation_update',
  WriterDisplaced = 'writer_displaced',
  WriterReady = 'writer_ready',
}

export interface CheckpointStreamError {
  readonly activityID: string;
}

export interface OfflineCapStatus {
  readonly halted: boolean;
  readonly remainingMs: number;
}
