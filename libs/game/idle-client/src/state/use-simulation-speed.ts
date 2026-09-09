import { useIdleStore } from './use-idle-store';

export function useSimulationSpeed() {
  return useIdleStore((state) => state.simulationSpeed);
}
