import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/message-port';
import type { WorkerClient } from '../transport/types';

export interface TestClient {
  readonly client: WorkerClient;

  readonly port: MessagePort;
}

export function createTestClient(): TestClient {
  const channel = new MessageChannel();

  channel.port1.start();

  const client: WorkerClient = createORPCClient(new RPCLink({ port: channel.port1 }));

  return { client, port: channel.port2 };
}
