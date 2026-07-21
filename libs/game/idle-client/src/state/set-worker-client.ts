import type { SimulationTransport } from '../types';
import { useIdleStore } from './use-idle-store';

export function setSimulationTransport(transport: SimulationTransport) {
  useIdleStore.setState(() => ({ transport }));
}
