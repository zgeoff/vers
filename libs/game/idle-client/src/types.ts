import type {
  ActivityFailureAction,
  ActivityInput,
  AvatarData,
  SimulationSnapshot,
} from '@vers/idle-core';

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

export type WorkerMessage = InitialStateMessage | SimulationUpdateMessage;
