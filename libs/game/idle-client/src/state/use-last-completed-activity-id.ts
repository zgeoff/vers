import { useIdleStore } from './use-idle-store';

export function useLastCompletedActivityID() {
  return useIdleStore((state) => state.lastCompletedActivityID);
}
