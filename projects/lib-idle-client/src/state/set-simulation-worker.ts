import { useSimulationStore } from './use-simulation-store';

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
export function setSimulationWorker(worker: SharedWorker) {
  useSimulationStore.setState(() => ({ worker }));
}
