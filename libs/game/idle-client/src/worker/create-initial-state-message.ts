import type { SimulationSnapshot } from '@vers/idle-core';
import type { InitialStateMessage, RewardSlotLedgerSnapshot } from '../types';
import { WorkerMessageType } from '../types';

export function createInitialStateMessage(
  state: SimulationSnapshot,
  rewardSlotLedger: RewardSlotLedgerSnapshot,
): InitialStateMessage {
  return {
    rewardSlotLedger,
    state,
    type: WorkerMessageType.InitialState,
  };
}
