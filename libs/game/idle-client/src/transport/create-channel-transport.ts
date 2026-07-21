import type { SimulationTransport, WorkerMessage } from '../types';
import { CLIENT_TO_WORKER_CHANNEL, WORKER_TO_CLIENT_CHANNEL } from './constants';

interface CreateChannelTransportOptions {
  /**
   * Overrides the production election-worker construction — a test's only way to keep the
   * transport from booting a real dedicated worker.
   */
  readonly createWorker?: () => void;
}

/**
 * The fallback transport for browsers without SharedWorker: spawns this tab's election worker,
 * posts client messages on the client-to-worker channel, and relays writer broadcasts from the
 * worker-to-client channel. It never sends the disconnect message: the writer's one connection is
 * the broadcast bridge shared by every tab, and a disconnect would sever them all. A post while no
 * writer holds the lock is lost — the writer-ready re-handshake is the recovery.
 */
export function createChannelTransport(
  options: CreateChannelTransportOptions = {},
): SimulationTransport {
  const createWorker = options.createWorker ?? createElectionWorker;

  createWorker();

  const clientToWorker = new BroadcastChannel(CLIENT_TO_WORKER_CHANNEL);
  const workerToClient = new BroadcastChannel(WORKER_TO_CLIENT_CHANNEL);
  const listeners = new Set<(message: WorkerMessage) => void>();

  workerToClient.addEventListener('message', (event: MessageEvent<WorkerMessage>) => {
    for (const listener of listeners) {
      listener(event.data);
    }
  });

  return {
    post: (message) => {
      clientToWorker.postMessage(message);
    },
    subscribe: (listener) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
  };
}

function createElectionWorker(): Worker {
  // the browser holds the worker for the page's lifetime once constructed; callers discard the
  // handle — the worker's only channel to the page is the broadcast pair, never this reference
  return new Worker(new URL('../worker/worker-election.ts', import.meta.url), { type: 'module' });
}
