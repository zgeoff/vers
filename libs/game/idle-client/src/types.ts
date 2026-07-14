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
  CheckpointStreamInvalid = 'checkpoint_stream_invalid',
  InitialState = 'initial_state',
  OfflineCapStatus = 'offline_cap_status',
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
  | InitialStateMessage
  | OfflineCapStatusMessage
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
