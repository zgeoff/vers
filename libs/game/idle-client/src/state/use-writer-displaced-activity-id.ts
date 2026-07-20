import { useIdleStore } from './use-idle-store';

export function useWriterDisplacedActivityID() {
  return useIdleStore((state) => state.writerDisplacedActivityID);
}
