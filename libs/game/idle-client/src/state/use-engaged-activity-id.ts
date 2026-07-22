import { useIdleStore } from './use-idle-store';

export function useEngagedActivityID() {
  return useIdleStore((state) => state.engagedActivityID);
}
