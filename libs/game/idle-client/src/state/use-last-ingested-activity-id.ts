import { useIdleStore } from './use-idle-store';

export function useLastIngestedActivityID() {
  return useIdleStore((state) => state.lastIngestedActivityID);
}
