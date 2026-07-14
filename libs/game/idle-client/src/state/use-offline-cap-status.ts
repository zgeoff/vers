import { useShallow } from 'zustand/react/shallow';
import { useOfflineCapStatusStore } from './use-offline-cap-status-store';

export function useOfflineCapStatus() {
  const offlineCapStatus = useOfflineCapStatusStore(useShallow((state) => state.offlineCapStatus));

  return offlineCapStatus;
}
