import type { WorkerClient } from '../transport/types';
import { useIdleStore } from './use-idle-store';

export function setWorkerClient(client: WorkerClient) {
  useIdleStore.setState(() => ({ client }));
}
