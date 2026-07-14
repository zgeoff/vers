import type { OfflineCapStatus } from '../types';
import { useIdleStore } from './use-idle-store';

export function setOfflineCapStatus(offlineCapStatus: null | OfflineCapStatus) {
  useIdleStore.setState(() => ({ offlineCapStatus }));
}
