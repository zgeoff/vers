import type { ActivityData, AvatarData, SimulationAppState } from '@vers/idle-core';

export enum ClientMessageType {
  Initialize = 'initialize',
  SetActivity = 'set-activity',
}

interface IClientMessage {
  type: ClientMessageType;
}

export interface SetActivityMessage extends IClientMessage {
  activity: ActivityData;
  avatar: AvatarData;
  type: ClientMessageType.SetActivity;
}

export interface InitializeMessage extends IClientMessage {
  type: ClientMessageType.Initialize;
}

export type ClientMessage = InitializeMessage | SetActivityMessage;

export enum WorkerMessageType {
  InitialState = 'initial-state',
  SimulationUpdate = 'simulation-update',
}

interface IWorkerMessage {
  type: WorkerMessageType;
}

export interface InitialStateMessage extends IWorkerMessage {
  state: SimulationAppState;
  type: WorkerMessageType.InitialState;
}

export interface SimulationUpdateMessage extends IWorkerMessage {
  state: SimulationAppState;
  type: WorkerMessageType.SimulationUpdate;
}

export type WorkerMessage = InitialStateMessage | SimulationUpdateMessage;
