import type { SimulationAppState } from '@vers/idle-core';
import type { SimulationUpdateMessage } from '../types';
import { WorkerMessageType } from '../types';

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
export function createSimulationUpdateMessage(state: SimulationAppState): SimulationUpdateMessage {
  return {
    state,
    type: WorkerMessageType.SimulationUpdate,
  };
}
