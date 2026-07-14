import { useIdleStore } from './use-idle-store';

export function useResyncStatus() {
  return useIdleStore((state) => state.resyncStatus);
}
