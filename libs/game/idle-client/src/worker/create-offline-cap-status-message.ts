import type { OfflineCapStatusMessage } from '../types';
import { WorkerMessageType } from '../types';

export function createOfflineCapStatusMessage(
  remainingMs: number,
  halted: boolean,
): OfflineCapStatusMessage {
  return {
    halted,
    remainingMs,
    type: WorkerMessageType.OfflineCapStatus,
  };
}
