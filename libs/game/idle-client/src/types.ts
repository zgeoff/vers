import type { ActivityData } from '@vers/contract-activity';
import type { ActivityFailureAction, SimulationSnapshot } from '@vers/idle-core';

/**
 * `SetActivity` is for a fresh stream the tab just started through the `startActivity` mutation —
 * it carries the row that mutation returned. Resuming any other activity, live or offline, always
 * goes through `RequestResync`; the worker alone derives its simulation input and submission
 * context from the confirmed row, never trusting a tab's locally reconstructed one.
 */
export enum ClientMessageType {
  Disconnect = 'disconnect',
  Initialize = 'initialize',
  RequestResync = 'request_resync',
  SetActivity = 'set_activity',
  SetFailureAction = 'set_failure_action',
}

interface IClientMessage {
  readonly type: ClientMessageType;
}

export interface SetActivityMessage extends IClientMessage {
  readonly activity: ActivityData;
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

/**
 * Asks the worker to resync the avatar's confirmed activity state — the tab's own trigger for a
 * catch-up the worker alone plans and runs, since only the worker holds the live simulation a plan
 * might attach to.
 */
export interface RequestResyncMessage extends IClientMessage {
  readonly avatarID: string;
  readonly type: ClientMessageType.RequestResync;
}

export type ClientMessage =
  | DisconnectMessage
  | InitializeMessage
  | RequestResyncMessage
  | SetActivityMessage
  | SetFailureActionMessage;

export enum WorkerMessageType {
  CheckpointStreamInvalid = 'checkpoint_stream_invalid',
  ConnectionStatus = 'connection_status',
  InitialState = 'initial_state',
  OfflineCapStatus = 'offline_cap_status',
  ResyncStatus = 'resync_status',
  SimulationUpdate = 'simulation_update',
}

interface IWorkerMessage {
  readonly type: WorkerMessageType;
}

export interface InitialStateMessage extends IWorkerMessage {
  readonly state: SimulationSnapshot;
  readonly type: WorkerMessageType.InitialState;
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
 * Reports that the activity service rejected an activity's stream with `CHECKPOINT_INVALID`: the
 * worker has stopped submitting checkpoints for it, keeping the queued rows for debugging.
 */
export interface CheckpointStreamInvalidMessage extends IWorkerMessage {
  readonly activityID: string;
  readonly reason: string;
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

export type WorkerMessage =
  | CheckpointStreamInvalidMessage
  | ConnectionStatusMessage
  | InitialStateMessage
  | OfflineCapStatusMessage
  | ResyncStatusMessage
  | SimulationUpdateMessage;

export interface CheckpointStreamError {
  readonly activityID: string;
  readonly reason: string;
}

export interface OfflineCapStatus {
  readonly halted: boolean;
  readonly remainingMs: number;
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
