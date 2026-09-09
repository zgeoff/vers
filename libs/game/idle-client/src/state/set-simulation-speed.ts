import { useIdleStore } from './use-idle-store';

export function setSimulationSpeed(simulationSpeed: number) {
  useIdleStore.setState(() => ({ simulationSpeed }));
}
