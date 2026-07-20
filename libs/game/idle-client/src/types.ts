import type { ActivityData } from '@vers/contract-activity';
import type { ActivityFailureAction, SimulationSnapshot } from '@vers/idle-core';

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

interface IClientMessage {
  readonly type: ClientMessageType;
}

export interface SetActivityMessage extends IClientMessage {
  readonly activity: ActivityData;
  readonly type: ClientMessageType.SetActivity;
}

export interface SetFailureActionMessage extends IClientMessage {
  readonly avatarID: string;
  readonly failureAction: ActivityFailureAction;
  readonly type: ClientMessageType.SetFailureAction;
}

export interface InitializeMessage extends IClientMessage {
  readonly type: ClientMessageType.Initialize;
}

export interface DisconnectMessage extends IClientMessage {
  readonly type: ClientMessageType.Disconnect;
}

/**
 * A tab's connectivity signal: the network looks reachable again (or the tab just loaded) and the
 * session's active avatar is `avatarID`. Chromium never fires online events inside a SharedWorker,
 * so tabs relay theirs; the worker alone decides whether a catch-up follows. The avatar rides
 * along as context because only the session can name it — the worker's own memory doesn't survive
 * its restart, and a fresh device has none. `claim` marks a deliberate presence — a fresh page
 * load, an explicit continue or retry — and lets a resync the worker schedules take over as an
 * active activity's writer; an automatic trigger (a reconnect relay) never claims, so two open
 * devices can't trade the writer back and forth.
 */
export interface ReportOnlineMessage extends IClientMessage {
  readonly avatarID: string;
  readonly claim: boolean;
  readonly type: ClientMessageType.ReportOnline;
}

/**
 * Begins a run. The worker owns the server call, the conflict recovery, and the simulation
 * install, answering with a start status carrying the same `requestID` — the tab only correlates.
 * A fresh selection sends a new request; a superseded one is abandoned, never installed.
 */
export interface StartActivityMessage extends IClientMessage {
  readonly avatarID: string;
  readonly requestID: string;
  readonly scopeID: string;
  readonly scopeType: string;
  readonly type: ClientMessageType.StartActivity;
}

/**
 * Ends a run: the worker halts the local simulation immediately and owns the rest — flushing the
 * activity's earned checkpoints, delivering the targeted server stop, and retrying that delivery
 * from a durable intent on later reconnects — so the tab never awaits the server and the stop
 * works offline. `activityID` names the run the player ended; a stop raised against a row that a
 * newer run has since replaced leaves the newer run untouched.
 */
export interface StopActivityMessage extends IClientMessage {
  readonly activityID: string;
  readonly avatarID: string;
  readonly type: ClientMessageType.StopActivity;
}

export type ClientMessage =
  | DisconnectMessage
  | InitializeMessage
  | ReportOnlineMessage
  | SetFailureActionMessage
  | StartActivityMessage
  | StopActivityMessage;

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
}

interface IWorkerMessage {
  readonly type: WorkerMessageType;
}

/**
 * Reports that an activity's terminal completed checkpoint left the simulation — the one signal
 * that an activity finished, as opposed to being stopped or replaced by a newer selection.
 */
export interface ActivityCompletedMessage extends IWorkerMessage {
  readonly activityID: string;
  readonly type: WorkerMessageType.ActivityCompleted;
}

export interface InitialStateMessage extends IWorkerMessage {
  /**
   * The current activity's reward-slot ledger as the worker holds it, so a tab connecting mid-run
   * catches up on pending rewards instead of starting empty.
   */
  readonly rewardSlotLedger: RewardSlotLedgerSnapshot;
  readonly state: SimulationSnapshot;
  readonly type: WorkerMessageType.InitialState;

  /**
   * The activity another session displaced this device from, `null` when none — included so a tab
   * connecting after the displacement broadcast still learns of it.
   */
  readonly writerDisplacedActivityID: null | string;
}

export interface SimulationUpdateMessage extends IWorkerMessage {
  readonly state: SimulationSnapshot;
  readonly type: WorkerMessageType.SimulationUpdate;
}

/**
 * Reports a resync's lifecycle as it runs in the worker, so every connected tab can render the
 * same catch-up state.
 */
export interface ResyncStatusMessage extends IWorkerMessage {
  readonly status: ResyncStatus;
  readonly type: WorkerMessageType.ResyncStatus;
}

/**
 * Reports the worker's connectivity to the activity service, from the shared worker's own
 * `online`/`offline` events — the signal a tab uses to explain a stalled catch-up.
 */
export interface ConnectionStatusMessage extends IWorkerMessage {
  readonly online: boolean;
  readonly type: WorkerMessageType.ConnectionStatus;
}

/**
 * Reports the avatar's effective failure-action preference — the worker's in-session source of
 * truth, sent on every change (a tab's own set, a resync reconcile's adoption of the server's
 * value) and in a connecting tab's initial state, so every tab reflects it even with no
 * simulation running.
 */
export interface FailureActionStatusMessage extends IWorkerMessage {
  readonly failureAction: ActivityFailureAction;
  readonly type: WorkerMessageType.FailureActionStatus;
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

/**
 * One start request's outcome: `started` carries the minted, installed row; `attached` names the
 * already-active same-scope row the worker resynced onto; `failed` covers everything a tab retry
 * can address. Broadcast to every connection — tabs match `requestID`, ignore the rest.
 */
export type StartStatus =
  | { readonly activity: ActivityData; readonly kind: 'started' }
  | { readonly activityID: string; readonly kind: 'attached' }
  | { readonly kind: 'failed' };

export interface StartStatusMessage extends IWorkerMessage {
  readonly requestID: string;
  readonly status: StartStatus;
  readonly type: WorkerMessageType.StartStatus;
}

/**
 * Reports that another session took over as an activity's writer, displacing this device: its
 * local simulation is cleared and nothing it submits for that activity persists. `activityID` is
 * `null` once the displacement resolves — this session re-attached (taking the writer back) or
 * installed a different run. Broadcast only on transition, so a dismissed notice isn't re-raised
 * by every reconnect.
 */
export interface WriterDisplacedMessage extends IWorkerMessage {
  readonly activityID: null | string;
  readonly type: WorkerMessageType.WriterDisplaced;
}

export type WorkerMessage =
  | ActivityCompletedMessage
  | CheckpointFlushStalledMessage
  | CheckpointStreamInvalidMessage
  | ConnectionStatusMessage
  | FailureActionStatusMessage
  | InitialStateMessage
  | OfflineCapStatusMessage
  | ResyncStatusMessage
  | RewardSlotsRecordedMessage
  | SimulationUpdateMessage
  | StartStatusMessage
  | WriterDisplacedMessage;

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
 * The catch-up flow's lifecycle as tabs observe it: fast-forwarding with running attempt and
 * level-up counts, done with the final tallies, capped when the server stopped the stream at the
 * offline-progress bound, active-elsewhere when another session took the stream's writer mid
 * catch-up — the tallies past the confirmed head never persisted — failed when the catch-up
 * couldn't complete, or session-expired when the server no longer recognizes the caller's session
 * — a state no retry can leave, only a fresh sign-in. A resync with no real away period
 * broadcasts nothing.
 */
export type ResyncStatus =
  | { readonly attempts: number; readonly kind: 'done'; readonly levelUps: number }
  | { readonly attempts: number; readonly kind: 'fast-forwarding'; readonly levelUps: number }
  | { readonly activityID: string; readonly kind: 'active-elsewhere' }
  | { readonly avatarID: string; readonly kind: 'failed' }
  | { readonly avatarID: string; readonly kind: 'session-expired' }
  | { readonly kind: 'capped' };
