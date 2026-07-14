import { useIdleStore } from './use-idle-store';

export function useOfflineCapStatus() {
  return useIdleStore((state) => state.offlineCapStatus);
}
