import { createWorkerClient } from './create-worker-client';
import type { WorkerClient } from './types';

/**
 * The tab's handle onto the page's `SharedWorker`: a `pagehide` listener sends the explicit
 * disconnect that releases this tab's port in the worker, since `RPCLink` has no close-notify of
 * its own. Callers construct at most one per page — the `pagehide` listener registers for the
 * page's lifetime.
 */
export function createSharedWorkerClient(): WorkerClient {
  const worker = new SharedWorker(new URL('../worker/worker.ts', import.meta.url), {
    type: 'module',
  });

  // oRPC's message-port adapters use addEventListener only and never call start() themselves — a
  // MessagePort driven that way stays paused until start() runs, so every call would hang
  worker.port.start();

  const client = createWorkerClient(worker.port);

  window.addEventListener('pagehide', () => {
    void client.disconnect({});
  });

  return client;
}
