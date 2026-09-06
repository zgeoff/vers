import { useIdleStore } from './use-idle-store';

export function useLiveRun() {
  return useIdleStore((state) => state.liveRun);
}
