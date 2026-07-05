import type { AnyContractRouter, ContractRouterClient } from '@orpc/contract';
import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';

/** An Elysia app (or anything shaped like one) an RPC test client can call in-process. */
interface RPCTestClientApp {
  handle: (request: Request) => Promise<Response> | Response;
}

interface BuildRPCTestClientOptions {
  headers?: Record<string, string>;
  /** Base URL the client sends requests to; only the path reaches `app.handle`. Default 'http://test.local/rpc'. */
  url?: string;
}

/**
 * Builds a typed oRPC client that exercises an app's real RPC wire protocol in-process, by routing
 * the link's fetch straight through `app.handle` instead of the network.
 */
export function buildRPCTestClient<TContract extends AnyContractRouter>(
  app: RPCTestClientApp,
  options?: BuildRPCTestClientOptions,
): ContractRouterClient<TContract> {
  const link = new RPCLink<Record<never, never>>({
    fetch: (request) => Promise.resolve(app.handle(request)),
    ...(options?.headers !== undefined && { headers: options.headers }),
    url: options?.url ?? 'http://test.local/rpc',
  });

  return createORPCClient(link);
}
