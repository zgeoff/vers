import { useIdleStore } from './use-idle-store';

export function useWriterGeneration() {
  return useIdleStore((state) => state.writerGeneration);
}
