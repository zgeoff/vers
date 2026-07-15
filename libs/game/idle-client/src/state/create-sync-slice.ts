import type { CheckpointStreamError, OfflineCapStatus, ResyncStatus } from '../types';

export interface SyncSlice {
  checkpointStreamError: CheckpointStreamError | null;

  /**
   * The worker's last-reported connectivity to the activity service: `null` until its first
   * report, so a consumer can distinguish "unknown yet" from a confirmed offline state.
   */
  connectionOnline: boolean | null;

  offlineCapStatus: null | OfflineCapStatus;
  resyncStatus: null | ResyncStatus;
}

export function createSyncSlice(): SyncSlice {
  return {
    checkpointStreamError: null,
    connectionOnline: null,
    offlineCapStatus: null,
    resyncStatus: null,
  };
}
