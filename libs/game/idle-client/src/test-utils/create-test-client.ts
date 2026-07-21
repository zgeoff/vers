import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/message-port';
import type { WorkerClient } from '../transport/types';

export interface TestClient {
  /**
   * A real oRPC client wired over `port`, ready to call the moment the far port is upgraded.
   */
  readonly client: WorkerClient;

  /**
   * The far end of the channel — hand this to `WorkerRuntime.handleConnect` (wrapped in a
   * `MessageEvent`) or `WorkerRuntime.upgrade` directly.
   */
  readonly port: MessagePort;
}

/**
 * Builds a real `MessageChannel` pair and a typed client over one end, so a router/runtime test
 * exercises the actual `port.start()` and `handler.upgrade()` wiring rather than calling handler
 * functions directly.
 */
export function createTestClient(): TestClient {
  const channel = new MessageChannel();

  channel.port1.start();

  const client: WorkerClient = createORPCClient(new RPCLink({ port: channel.port1 }));

  return { client, port: channel.port2 };
}
