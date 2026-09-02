import { createORPCClient } from '@orpc/client';
import type { SupportedMessagePort } from '@orpc/client/message-port';
import { RPCLink } from '@orpc/client/message-port';
import type { WorkerClient } from './types';

export function createWorkerClient(port: SupportedMessagePort): WorkerClient {
  const link = new RPCLink({ port });

  return createORPCClient(link);
}
