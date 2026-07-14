import { useShallow } from 'zustand/react/shallow';
import { useResyncStatusStore } from './use-resync-status-store';

export function useResyncStatus() {
  const resyncStatus = useResyncStatusStore(useShallow((state) => state.resyncStatus));

  return resyncStatus;
}
