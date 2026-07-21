import { CLIENT_TO_WORKER_CHANNEL, WORKER_TO_CLIENT_CHANNEL } from '../transport/constants';
import type { WorkerConnection } from './types';

/**
 * The elected writer's one connection to every tab: client messages arrive from the
 * client-to-worker channel, posts fan out on the worker-to-client channel. Closing it severs
 * every tab at once, so no disconnect path ever targets it — tabs on this transport never send
 * the disconnect message.
 */
export function createBroadcastConnection(): WorkerConnection {
  const clientToWorker = new BroadcastChannel(CLIENT_TO_WORKER_CHANNEL);
  const workerToClient = new BroadcastChannel(WORKER_TO_CLIENT_CHANNEL);

  return {
    addEventListener: (type, listener) => {
      if (type === 'message') {
        clientToWorker.addEventListener('message', listener);
      }
    },
    close: () => {
      clientToWorker.close();
      workerToClient.close();
    },
    postMessage: (message) => {
      workerToClient.postMessage(message);
    },
  };
}
