import type { OfflineCapStatus } from '../types';
import { useOfflineCapStatusStore } from './use-offline-cap-status-store';

export function setOfflineCapStatus(offlineCapStatus: OfflineCapStatus) {
  useOfflineCapStatusStore.setState(() => ({ offlineCapStatus }));
}
