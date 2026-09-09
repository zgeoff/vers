import type {
  CheckpointStreamError,
  JournalFailure,
  OfflineCapStatus,
  ResyncStatus,
  RewardSlotLedgerEntry,
  RunOutcome,
  SaveStatus,
  StoragePersistence,
} from '../types';

export interface SyncSlice {
  checkpointStreamError: CheckpointStreamError | null;

  journalFailure: JournalFailure | null;

  lastCompletedActivityID: null | string;

  lastIngestedActivityID: null | string;

  offlineCapStatus: null | OfflineCapStatus;
  resyncStatus: null | ResyncStatus;

  rewardSlotLedger: ReadonlyArray<RewardSlotLedgerEntry>;

  rewardSlotLedgerActivityID: null | string;

  runOutcome: null | RunOutcome;

  saveStatus: null | SaveStatus;

  storagePersistence: StoragePersistence;

  writerContention: boolean;

  writerDisplacedActivityID: null | string;
}

export function createSyncSlice(): SyncSlice {
  return {
    checkpointStreamError: null,
    journalFailure: null,
    lastCompletedActivityID: null,
    lastIngestedActivityID: null,
    offlineCapStatus: null,
    resyncStatus: null,
    rewardSlotLedger: [],
    rewardSlotLedgerActivityID: null,
    runOutcome: null,
    saveStatus: null,
    storagePersistence: 'unknown',
    writerContention: false,
    writerDisplacedActivityID: null,
  };
}
