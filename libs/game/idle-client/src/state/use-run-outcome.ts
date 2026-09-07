import { useIdleStore } from './use-idle-store';

export function useRunOutcome() {
  return useIdleStore((state) => state.runOutcome);
}
