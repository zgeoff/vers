import { useSimulationStore } from './use-simulation-store';

export function setSimulationWorker(worker: SharedWorker) {
  useSimulationStore.setState(() => ({ worker }));
}
