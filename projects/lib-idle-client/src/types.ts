import type { ActivityData, AvatarData, SimulationAppState } from '@vers/idle-core';

export enum ClientMessageType {
  Initialize = 'initialize',
  SetActivity = 'set-activity',
}

interface IClientMessage {
  readonly type: ClientMessageType;
}

export interface SetActivityMessage extends IClientMessage {
  readonly activity: ActivityData;
  readonly avatar: AvatarData;
  readonly type: ClientMessageType.SetActivity;
}

export interface InitializeMessage extends IClientMessage {
  readonly type: ClientMessageType.Initialize;
}

export type ClientMessage = InitializeMessage | SetActivityMessage;

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
