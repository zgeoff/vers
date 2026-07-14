import { useIdleStore } from './use-idle-store';

export function setSimulationInitialized(initialized: boolean) {
  useIdleStore.setState(() => ({ initialized }));
}
