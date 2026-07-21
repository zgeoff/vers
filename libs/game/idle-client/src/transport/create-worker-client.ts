import { createORPCClient } from '@orpc/client';
import type { SupportedMessagePort } from '@orpc/client/message-port';
import { RPCLink } from '@orpc/client/message-port';
import type { WorkerClient } from './types';

/**
 * Builds the tab's typed RPC client onto the worker, over the given port — a started `SharedWorker`
 * port, or a `createBroadcastPort` bridge to the elected web-locks writer.
 */
export function createWorkerClient(port: SupportedMessagePort): WorkerClient {
  const link = new RPCLink({ port });

  return createORPCClient(link);
}
