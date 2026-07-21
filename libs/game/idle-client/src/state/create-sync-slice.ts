import type {
  CheckpointStreamError,
  OfflineCapStatus,
  ResyncStatus,
  RewardSlotLedgerEntry,
} from '../types';

export interface SyncSlice {
  checkpointStreamError: CheckpointStreamError | null;

  /**
   * The activity the worker most recently reported completed; completion is terminal per activity
   * id, so every change is a fresh completion.
   */
  lastCompletedActivityID: null | string;

  offlineCapStatus: null | OfflineCapStatus;
  resyncStatus: null | ResyncStatus;

  rewardSlotLedger: ReadonlyArray<RewardSlotLedgerEntry>;

  /**
   * The activity `rewardSlotLedger`'s entries belong to, kept in sync whenever the ledger resets
   * or gains an entry — internal bookkeeping with no selector of its own.
   */
  rewardSlotLedgerActivityID: null | string;

  /**
   * The activity another session displaced this device from — its writer was taken over and
   * nothing this device submits for it persists — `null` when none.
   */
  writerDisplacedActivityID: null | string;
}

export function createSyncSlice(): SyncSlice {
  return {
    checkpointStreamError: null,
    lastCompletedActivityID: null,
    offlineCapStatus: null,
    resyncStatus: null,
    rewardSlotLedger: [],
    rewardSlotLedgerActivityID: null,
    writerDisplacedActivityID: null,
  };
}
