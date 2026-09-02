import { createBroadcastPort } from './create-broadcast-port';
import { createWorkerClient } from './create-worker-client';
import type { WorkerClient } from './types';

interface CreateWebLocksClientOptions {
  readonly createWorker?: () => void;
}

export function createWebLocksClient(
  options: Readonly<CreateWebLocksClientOptions> = {},
): WorkerClient {
  const createWorker = options.createWorker ?? createElectionWorker;

  createWorker();

  const client = createWorkerClient(createBroadcastPort());

  // oRPC's `RPCLink` has no close-notify of its own, so `pagehide` is the one teardown signal
  // every environment delivers
  window.addEventListener('pagehide', () => {
    void client.disconnect({});
  });

  return client;
}

function createElectionWorker(): Worker {
  // the browser holds the worker for the page's lifetime once constructed; callers discard the
  // handle — the worker's only channel to the page is the broadcast pair, never this reference
  return new Worker(new URL('../worker/worker-election.ts', import.meta.url), { type: 'module' });
}
