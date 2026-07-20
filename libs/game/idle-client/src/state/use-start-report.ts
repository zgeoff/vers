import { useIdleStore } from './use-idle-store';

export function useStartReport() {
  return useIdleStore((state) => state.startReport);
}
