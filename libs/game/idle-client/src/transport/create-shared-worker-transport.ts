import { ClientMessageType } from '../types';
import type { SimulationTransport } from '../types';
import type { ClientMessage } from '../worker/client-to-worker-message-schema';
import type { WorkerMessage } from '../worker/worker-to-client-message-schema';
import { workerToClientMessageSchema } from '../worker/worker-to-client-message-schema';

/**
 * The tab's handle onto the page's SharedWorker: posts ride the worker port, and a pagehide
 * listener sends the explicit disconnect that releases this tab's port in the worker. Callers
 * construct at most one per page — the pagehide listener registers for the page's lifetime.
 * Incoming events parse once against the worker-to-client contract — only a bug on either end of
 * the boundary can produce a malformed message, so a parse failure throws rather than recovering.
 */
export function createSharedWorkerTransport(): SimulationTransport {
  const worker = new SharedWorker(new URL('../worker/worker.ts', import.meta.url), {
    type: 'module',
  });

  const listeners = new Set<(message: WorkerMessage) => void>();

  // oxlint-disable-next-line unicorn/prefer-add-event-listener -- assigning onmessage starts MessagePort delivery; addEventListener also needs an explicit port.start()
  worker.port.onmessage = (event: MessageEvent<unknown>) => {
    const message = workerToClientMessageSchema.parse(event.data);

    for (const listener of listeners) {
      listener(message);
    }
  };

  window.addEventListener('pagehide', () => {
    const message = { type: ClientMessageType.Disconnect } satisfies ClientMessage;

    worker.port.postMessage(message);
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
