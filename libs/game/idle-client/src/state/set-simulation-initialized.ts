import { useSimulationStore } from './use-simulation-store';

export function setSimulationInitialized(initialized: boolean) {
  useSimulationStore.setState(() => ({ initialized }));
}
