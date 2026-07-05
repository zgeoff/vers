import type { SimulationAppState } from '@vers/idle-core';
import type { InitialStateMessage } from '../types';
import { WorkerMessageType } from '../types';

export function createInitialStateMessage(state: SimulationAppState): InitialStateMessage {
  return {
    state,
    type: WorkerMessageType.InitialState,
  };
}
