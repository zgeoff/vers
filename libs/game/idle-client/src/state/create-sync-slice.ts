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
   * The activity `rewardSlotLedger`'s entries belong to, kept in sync whenever the ledger resets
   * or gains an entry — internal bookkeeping with no selector of its own.
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
