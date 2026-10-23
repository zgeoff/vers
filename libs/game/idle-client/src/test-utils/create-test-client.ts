import { once } from 'node:events';
import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/message-port';
import type { WorkerClient } from '../transport/types';

export interface TestClient {
  readonly client: WorkerClient;

  readonly closed: Promise<unknown>;

  readonly port: MessagePort;
}

export function createTestClient(): TestClient {
  const channel = new MessageChannel();

  const closed = once(channel.port1, 'close');

  channel.port1.start();

  const client: WorkerClient = createORPCClient(new RPCLink({ port: channel.port1 }));

  return { client, closed, port: channel.port2 };
}
