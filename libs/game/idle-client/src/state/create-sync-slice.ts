import type {
  CheckpointStreamError,
  OfflineCapStatus,
  ResyncStatus,
  RewardSlotLedgerEntry,
  RunOutcome,
} from '../types';

export interface SyncSlice {
  checkpointStreamError: CheckpointStreamError | null;

  lastCompletedActivityID: null | string;

  lastIngestedActivityID: null | string;

  offlineCapStatus: null | OfflineCapStatus;
  resyncStatus: null | ResyncStatus;

  rewardSlotLedger: ReadonlyArray<RewardSlotLedgerEntry>;

  rewardSlotLedgerActivityID: null | string;

  runOutcome: null | RunOutcome;

  writerDisplacedActivityID: null | string;
}

export function createSyncSlice(): SyncSlice {
  return {
    checkpointStreamError: null,
    lastCompletedActivityID: null,
    lastIngestedActivityID: null,
    offlineCapStatus: null,
    resyncStatus: null,
    rewardSlotLedger: [],
    rewardSlotLedgerActivityID: null,
    runOutcome: null,
    writerDisplacedActivityID: null,
  };
}
