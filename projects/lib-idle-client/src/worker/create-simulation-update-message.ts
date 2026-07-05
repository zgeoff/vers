import type { SimulationAppState } from '@vers/idle-core';
import type { SimulationUpdateMessage } from '../types';
import { WorkerMessageType } from '../types';

export function createSimulationUpdateMessage(state: SimulationAppState): SimulationUpdateMessage {
  return {
    state,
    type: WorkerMessageType.SimulationUpdate,
  };
}
