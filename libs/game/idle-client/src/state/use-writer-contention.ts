import { useIdleStore } from './use-idle-store';

export function useWriterContention() {
  return useIdleStore((state) => state.writerContention);
}
