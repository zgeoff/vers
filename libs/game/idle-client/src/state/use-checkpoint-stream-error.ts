import { useShallow } from 'zustand/react/shallow';
import { useCheckpointStreamErrorStore } from './use-checkpoint-stream-error-store';

export function useCheckpointStreamError() {
  const checkpointStreamError = useCheckpointStreamErrorStore(
    useShallow((state) => state.checkpointStreamError),
  );

  return checkpointStreamError;
}
