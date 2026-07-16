import { useIdleStore } from './use-idle-store';

export function useCheckpointFlushStall() {
  return useIdleStore((state) => state.checkpointFlushStall);
}
