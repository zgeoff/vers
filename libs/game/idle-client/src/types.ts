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

export type WorkerMessage =
  | CheckpointStreamInvalidMessage
  | InitialStateMessage
  | SimulationUpdateMessage;

/**
 * A stopped checkpoint stream, read off a `CheckpointStreamInvalidMessage` into app state.
 */
export interface CheckpointStreamError {
  readonly activityID: string;
  readonly reason: string;
}
