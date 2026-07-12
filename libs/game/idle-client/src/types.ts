import type {
  ActivityData,
  ActivityFailureAction,
  AvatarData,
  SimulationAppState,
} from '@vers/idle-core';

export enum ClientMessageType {
  Disconnect = 'disconnect',
  Initialize = 'initialize',
  SetActivity = 'set-activity',
  SetFailureAction = 'set-failure-action',
}

interface IClientMessage {
  readonly type: ClientMessageType;
}

export interface SetActivityMessage extends IClientMessage {
  readonly activity: ActivityData;
  readonly avatar: AvatarData;
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
  InitialState = 'initial-state',
  SimulationUpdate = 'simulation-update',
}

interface IWorkerMessage {
  readonly type: WorkerMessageType;
}

export interface InitialStateMessage extends IWorkerMessage {
  readonly state: SimulationAppState;
  readonly type: WorkerMessageType.InitialState;
}

export interface SimulationUpdateMessage extends IWorkerMessage {
  readonly state: SimulationAppState;
  readonly type: WorkerMessageType.SimulationUpdate;
}

export type WorkerMessage = InitialStateMessage | SimulationUpdateMessage;
