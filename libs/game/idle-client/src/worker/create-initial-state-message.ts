import type { SimulationSnapshot } from '@vers/idle-core';
import type { InitialStateMessage } from '../types';
import { WorkerMessageType } from '../types';

export function createInitialStateMessage(state: SimulationSnapshot): InitialStateMessage {
  return {
    state,
    type: WorkerMessageType.InitialState,
  };
}
