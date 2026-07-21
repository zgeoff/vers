import type { SimulationTransport, WorkerMessage } from '../types';
import { createDisconnectMessage } from '../worker/create-disconnect-message';

/**
 * The tab's handle onto the page's SharedWorker: posts ride the worker port, and a pagehide
 * listener sends the explicit disconnect that releases this tab's port in the worker. Callers
 * construct at most one per page — the pagehide listener registers for the page's lifetime.
 */
export function createSharedWorkerTransport(): SimulationTransport {
  const worker = new SharedWorker(new URL('../worker/worker.ts', import.meta.url), {
    type: 'module',
  });

  const listeners = new Set<(message: WorkerMessage) => void>();

  // oxlint-disable-next-line unicorn/prefer-add-event-listener -- assigning onmessage starts MessagePort delivery; addEventListener also needs an explicit port.start()
  worker.port.onmessage = (event: MessageEvent<WorkerMessage>) => {
    for (const listener of listeners) {
      listener(event.data);
    }
  };

  window.addEventListener('pagehide', () => {
    worker.port.postMessage(createDisconnectMessage());
  });

  return {
    post: (message) => {
      worker.port.postMessage(message);
    },
    subscribe: (listener) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
  };
}
