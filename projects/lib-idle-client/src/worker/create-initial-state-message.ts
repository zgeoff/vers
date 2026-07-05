import type { SimulationAppState } from '@vers/idle-core';
import type { InitialStateMessage } from '../types';
import { WorkerMessageType } from '../types';

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
export function createInitialStateMessage(state: SimulationAppState): InitialStateMessage {
  return {
    state,
    type: WorkerMessageType.InitialState,
  };
}
