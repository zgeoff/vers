import type { CheckpointStreamError, OfflineCapStatus, ResyncStatus } from '../types';

export interface SyncSlice {
  checkpointStreamError: CheckpointStreamError | null;
  offlineCapStatus: null | OfflineCapStatus;
  resyncStatus: null | ResyncStatus;
}

export function createSyncSlice(): SyncSlice {
  return {
    checkpointStreamError: null,
    offlineCapStatus: null,
    resyncStatus: null,
  };
}
