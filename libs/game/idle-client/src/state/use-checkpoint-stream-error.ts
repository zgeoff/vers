import { useIdleStore } from './use-idle-store';

export function useCheckpointStreamError() {
  return useIdleStore((state) => state.checkpointStreamError);
}
