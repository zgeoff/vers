import { useSimulationStore } from './use-simulation-store';

export function useSimulationInitialized() {
  return useSimulationStore((state) => state.initialized);
}
