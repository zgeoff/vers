import type {
  CheckpointFlushStall,
  CheckpointStreamError,
  OfflineCapStatus,
  ResyncStatus,
  RewardSlotLedgerEntry,
  StartReport,
} from '../types';

export interface SyncSlice {
  checkpointFlushStall: CheckpointFlushStall | null;
  checkpointStreamError: CheckpointStreamError | null;

  /**
   * The worker's last-reported connectivity to the activity service: `null` until its first
   * report, so a consumer can distinguish "unknown yet" from a confirmed offline state.
   */
  connectionOnline: boolean | null;

  /**
   * The activity the worker most recently reported completed; completion is terminal per activity
   * id, so every change is a fresh completion.
   */
  lastCompletedActivityID: null | string;

  offlineCapStatus: null | OfflineCapStatus;
  resyncStatus: null | ResyncStatus;

  /**
   * The worker's latest start outcome; tabs match its request id against their own attempt.
   */
  startReport: null | StartReport;

  rewardSlotLedger: ReadonlyArray<RewardSlotLedgerEntry>;

  /**
   * The activity `rewardSlotLedger`'s entries belong to, kept in sync whenever the ledger resets
   * or gains an entry — internal bookkeeping with no selector of its own.
   */
  rewardSlotLedgerActivityID: null | string;
}

export function createSyncSlice(): SyncSlice {
  return {
    checkpointFlushStall: null,
    checkpointStreamError: null,
    connectionOnline: null,
    lastCompletedActivityID: null,
    offlineCapStatus: null,
    resyncStatus: null,
    startReport: null,
    rewardSlotLedger: [],
    rewardSlotLedgerActivityID: null,
  };
}
