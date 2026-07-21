import { createBroadcastPort } from './create-broadcast-port';
import { createWorkerClient } from './create-worker-client';
import type { WorkerClient } from './types';

interface CreateWebLocksClientOptions {
  /**
   * Overrides the production election-worker construction — a test's only way to keep this from
   * booting a real dedicated worker.
   */
  readonly createWorker?: () => void;
}

/**
 * The fallback path for browsers without `SharedWorker`: spawns this tab's election worker, then
 * builds an RPC client over a `createBroadcastPort` bridge to whichever tab's worker wins the
 * write lock. A `pagehide` listener sends the explicit disconnect — the demux gives every tab its
 * own virtual port, so the disconnect releases only this tab's port and never severs another
 * tab's. A call issued while no writer holds the lock hangs until the caller aborts it; the
 * writer-ready broadcast is the re-handshake signal callers key their own abort/retry on.
 */
export function createWebLocksClient(
  options: Readonly<CreateWebLocksClientOptions> = {},
): WorkerClient {
  const createWorker = options.createWorker ?? createElectionWorker;

  createWorker();

  const client = createWorkerClient(createBroadcastPort());

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
