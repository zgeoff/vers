import { useIdleStore } from './use-idle-store';

export function useStoragePersistence() {
  return useIdleStore((state) => state.storagePersistence);
}
