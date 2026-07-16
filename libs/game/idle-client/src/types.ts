import type {
  ActivityFailureAction,
  ActivityInput,
  AvatarData,
  SimulationSnapshot,
} from '@vers/idle-core';
import type { ActivitySubmissionContext } from './submission/types';

export enum ClientMessageType {
  Disconnect = 'disconnect',
  Initialize = 'initialize',
  SetActivity = 'set_activity',
  SetFailureAction = 'set_failure_action',
}

interface IClientMessage {
  readonly type: ClientMessageType;
}

export interface SetActivityMessage extends IClientMessage {
  readonly activity: ActivityInput;
  readonly avatar: AvatarData;

  /**
   * The stream's chain-link starting point, present only when the caller has the server-authored
   * `ActivityData` to submit checkpoints against — absent, no checkpoint for this activity is
   * submitted.
   */
  readonly submission?: ActivitySubmissionContext;
  readonly type: ClientMessageType.SetActivity;
}

export interface SetFailureActionMessage extends IClientMessage {
  readonly failureAction: ActivityFailureAction;
  readonly type: ClientMessageType.SetFailureAction;
}

export interface InitializeMessage extends IClientMessage {
  readonly type: ClientMessageType.Initialize;
}

export interface DisconnectMessage extends IClientMessage {
  readonly type: ClientMessageType.Disconnect;
}

export type ClientMessage =
  | DisconnectMessage
  | InitializeMessage
  | SetActivityMessage
  | SetFailureActionMessage;

export enum WorkerMessageType {
  CheckpointFlushStalled = 'checkpoint_flush_stalled',
  CheckpointStreamInvalid = 'checkpoint_stream_invalid',
  InitialState = 'initial_state',
  OfflineCapStatus = 'offline_cap_status',
  RewardSlotsRecorded = 'reward_slots_recorded',
  SimulationUpdate = 'simulation_update',
}

interface IWorkerMessage {
  readonly type: WorkerMessageType;
}

export interface InitialStateMessage extends IWorkerMessage {
  /**
   * The current activity's reward-slot ledger as the worker holds it, so a tab connecting mid-run
   * catches up on pending rewards instead of starting empty.
   */
  readonly rewardSlotLedger: RewardSlotLedgerSnapshot;
  readonly state: SimulationSnapshot;
  readonly type: WorkerMessageType.InitialState;
}

export interface SimulationUpdateMessage extends IWorkerMessage {
  readonly state: SimulationSnapshot;
  readonly type: WorkerMessageType.SimulationUpdate;
}

/**
 * Reports that an activity's checkpoint flushes have repeatedly failed without a defined
 * contract outcome — transport failures or undeclared server errors. Telemetry only, not a stop
 * signal: the stream stays live, its queue intact, and later flushes keep retrying. `traceID`
 * names the last failed attempt's trace for log correlation.
 */
export interface CheckpointFlushStalledMessage extends IWorkerMessage {
  readonly activityID: string;
  readonly reason: string;
  readonly traceID: string;
  readonly type: WorkerMessageType.CheckpointFlushStalled;
}

/**
 * Reports that the activity service rejected an activity's stream with `CHECKPOINT_INVALID`: the
 * worker has stopped submitting checkpoints for it, keeping the queued rows for debugging.
 * `traceID` names the rejecting request's trace; a stream stopped by a local failure carries none.
 */
export interface CheckpointStreamInvalidMessage extends IWorkerMessage {
  readonly activityID: string;
  readonly reason: string;
  readonly traceID?: string;
  readonly type: WorkerMessageType.CheckpointStreamInvalid;
}

/**
 * Reports the avatar's offline-progress budget as it approaches or hits the cap: `remainingMs` is
 * the worker's conservative view of the budget left, and `halted` means the simulation stopped at
 * an encounter boundary and idles until a resync replaces it.
 */
export interface OfflineCapStatusMessage extends IWorkerMessage {
  readonly halted: boolean;
  readonly remainingMs: number;
  readonly type: WorkerMessageType.OfflineCapStatus;
}

/**
 * Reports a checkpoint's reward-slot count as it leaves the generator and enters the submission
 * path, keyed by the activity-relative `version` the checkpoint chain assigns it — the same
 * numbering the server's `verifiedHead` advances against. Only carries checkpoints the submitter
 * actually queued and that earned at least one slot; a dropped or zero-slot checkpoint never
 * broadcasts one of these.
 */
export interface RewardSlotsRecordedMessage extends IWorkerMessage {
  readonly activityID: string;
  readonly rewardSlotCount: number;
  readonly type: WorkerMessageType.RewardSlotsRecorded;
  readonly version: number;
}

export type WorkerMessage =
  | CheckpointFlushStalledMessage
  | CheckpointStreamInvalidMessage
  | InitialStateMessage
  | OfflineCapStatusMessage
  | RewardSlotsRecordedMessage
  | SimulationUpdateMessage;

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

/**
 * One checkpoint's recorded reward-slot count, keyed by the activity-relative version the
 * checkpoint chain assigns it — the same numbering the server's `verifiedHead` advances against.
 */
export interface RewardSlotLedgerEntry {
  readonly count: number;
  readonly version: number;
}

/**
 * A reward-slot ledger paired with the activity its entries belong to, so a consumer can tell
 * whether the entries describe the activity it's rendering before trusting their counts.
 */
export interface RewardSlotLedgerSnapshot {
  readonly activityID: null | string;
  readonly entries: ReadonlyArray<RewardSlotLedgerEntry>;
}

/**
 * The catch-up flow's lifecycle as tabs observe it: checking the confirmed state, fast-forwarding
 * with running attempt and level-up counts, done with the final tallies, or capped when the
 * server stopped the stream at the offline-progress bound.
 */
export type ResyncStatus =
  | { readonly attempts: number; readonly kind: 'done'; readonly levelUps: number }
  | { readonly attempts: number; readonly kind: 'fast-forwarding'; readonly levelUps: number }
  | { readonly kind: 'capped' }
  | { readonly kind: 'checking' };
