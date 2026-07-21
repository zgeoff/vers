import type { ActivityData } from '@vers/contract-activity';
import type { ClientMessage } from './worker/client-to-worker-message-schema';
import type { StartStatus, WorkerMessage } from './worker/worker-to-client-message-schema';

export type {
  ResyncStatus,
  RewardSlotLedgerEntry,
  RewardSlotLedgerSnapshot,
  StartStatus,
} from './worker/worker-to-client-message-schema';

/**
 * `SetActivity` is worker-internal — the start flow's install step, never routed from a tab.
 * Tabs never command a catch-up: `ReportOnline` reports connectivity and the session's avatar,
 * and the worker alone decides whether a resync follows — only it holds the live simulation a
 * plan might attach to, and it derives simulation input and submission context from the
 * confirmed row, never trusting a tab's locally reconstructed one.
 */
export enum ClientMessageType {
  Disconnect = 'disconnect',
  Initialize = 'initialize',
  ReportOnline = 'report_online',
  SetActivity = 'set_activity',
  SetFailureAction = 'set_failure_action',
  StartActivity = 'start_activity',
  StopActivity = 'stop_activity',
}

/**
 * Never routed from a tab: constructed by the start flow itself once a row is confirmed, then
 * handled in the same turn that installs the simulation.
 */
export interface SetActivityMessage {
  readonly activity: ActivityData;
  readonly type: ClientMessageType.SetActivity;
}

export enum WorkerMessageType {
  ActivityCompleted = 'activity_completed',
  CheckpointFlushStalled = 'checkpoint_flush_stalled',
  CheckpointStreamInvalid = 'checkpoint_stream_invalid',
  ConnectionStatus = 'connection_status',
  FailureActionStatus = 'failure_action_status',
  InitialState = 'initial_state',
  OfflineCapStatus = 'offline_cap_status',
  ResyncStatus = 'resync_status',
  RewardSlotsRecorded = 'reward_slots_recorded',
  SimulationUpdate = 'simulation_update',
  StartStatus = 'start_status',
  WriterDisplaced = 'writer_displaced',
  WriterReady = 'writer_ready',
}

/**
 * The tab-side handle onto the simulation writer, whichever transport carries it: a SharedWorker
 * port where the browser has one, or a broadcast-channel bridge to an elected dedicated worker.
 * `subscribe` fans every worker message to the listener until the returned detach runs.
 */
export interface SimulationTransport {
  readonly post: (message: ClientMessage) => void;
  readonly subscribe: (listener: (message: WorkerMessage) => void) => () => void;
}

/**
 * The latest start outcome as tabs hold it, keyed by the request it answers.
 */
export interface StartReport {
  readonly requestID: string;
  readonly status: StartStatus;
}

/**
 * The latest flush-stall report as tabs hold it — telemetry for the error backend, with the
 * stream still live and retrying.
 */
export interface CheckpointFlushStall {
  readonly activityID: string;
  readonly reason: string;
  readonly traceID: string;
}

export interface CheckpointStreamError {
  readonly activityID: string;
  readonly reason: string;
  readonly traceID?: string;
}

export interface OfflineCapStatus {
  readonly halted: boolean;
  readonly remainingMs: number;
}
