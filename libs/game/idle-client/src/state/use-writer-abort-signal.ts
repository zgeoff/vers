import { useIdleStore } from './use-idle-store';

export function useWriterAbortSignal() {
  return useIdleStore((state) => state.writerAbortController.signal);
}
