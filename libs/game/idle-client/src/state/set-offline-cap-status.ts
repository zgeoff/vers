import type { OfflineCapStatus } from '../types';
import { useOfflineCapStatusStore } from './use-offline-cap-status-store';

export function setOfflineCapStatus(offlineCapStatus: null | OfflineCapStatus) {
  useOfflineCapStatusStore.setState(() => ({ offlineCapStatus }));
}
