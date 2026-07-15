import type {
  CheckpointStreamError,
  OfflineCapStatus,
  ResyncStatus,
  RewardSlotLedgerEntry,
} from '../types';

export interface SyncSlice {
  checkpointStreamError: CheckpointStreamError | null;
  offlineCapStatus: null | OfflineCapStatus;
  resyncStatus: null | ResyncStatus;
  rewardSlotLedger: ReadonlyArray<RewardSlotLedgerEntry>;

  /**
   * The activity `rewardSlotLedger`'s entries belong to, tracked independently of the simulation
   * snapshot's own activity field so a ledger reset never races that field's update — internal
   * bookkeeping for `updateRewardSlotLedger`, with no selector of its own.
   */
  rewardSlotLedgerActivityID: null | string;
}

export function createSyncSlice(): SyncSlice {
  return {
    checkpointStreamError: null,
    offlineCapStatus: null,
    resyncStatus: null,
    rewardSlotLedger: [],
    rewardSlotLedgerActivityID: null,
  };
}
