import { useIdleStore } from './use-idle-store';

export function useSimulationInitialized() {
  return useIdleStore((state) => state.initialized);
}
