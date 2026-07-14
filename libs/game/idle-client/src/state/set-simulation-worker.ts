import { useIdleStore } from './use-idle-store';

export function setSimulationWorker(worker: SharedWorker) {
  useIdleStore.setState(() => ({ worker }));
}
