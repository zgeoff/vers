import { useIdleStore } from './use-idle-store';

export function useEngagedRun() {
  return useIdleStore((state) => state.engagedRun);
}
