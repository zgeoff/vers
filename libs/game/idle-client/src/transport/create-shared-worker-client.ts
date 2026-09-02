import { createWorkerClient } from './create-worker-client';
import type { WorkerClient } from './types';

export function createSharedWorkerClient(): WorkerClient {
  const worker = new SharedWorker(new URL('../worker/worker.ts', import.meta.url), {
    type: 'module',
  });

  // oRPC's message-port adapters use addEventListener only and never call start() themselves — a
  // MessagePort driven that way stays paused until start() runs, so every call would hang
  worker.port.start();

  const client = createWorkerClient(worker.port);

  // oRPC's `RPCLink` has no close-notify of its own, so `pagehide` is the one teardown signal
  // every environment delivers
  window.addEventListener('pagehide', () => {
    void client.disconnect({});
  });

  return client;
}
