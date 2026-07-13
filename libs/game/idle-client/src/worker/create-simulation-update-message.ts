import type { SimulationSnapshot } from '@vers/idle-core';
import type { SimulationUpdateMessage } from '../types';
import { WorkerMessageType } from '../types';

export function createSimulationUpdateMessage(state: SimulationSnapshot): SimulationUpdateMessage {
  return {
    state,
    type: WorkerMessageType.SimulationUpdate,
  };
}
