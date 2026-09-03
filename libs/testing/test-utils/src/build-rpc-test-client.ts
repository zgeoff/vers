import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import type { AnyContractRouter, ContractRouterClient } from '@orpc/contract';

interface RPCTestClientApp {
  readonly handle: (request: Request) => Promise<Response> | Response;
}

interface BuildRPCTestClientOptions {
  readonly headers?: Readonly<Record<string, string>>;

  readonly token?: string;

  readonly url?: string;
}

export function buildRPCTestClient<TContract extends AnyContractRouter>(
  app: RPCTestClientApp,
  options?: BuildRPCTestClientOptions,
): ContractRouterClient<TContract> {
  const headers = {
    ...(options?.token !== undefined && { authorization: `Bearer ${options.token}` }),
    ...options?.headers,
  };

  const link = new RPCLink<Record<never, never>>({
    fetch: (request) => Promise.resolve(app.handle(request)),
    ...(Object.keys(headers).length > 0 && { headers }),
    url: options?.url ?? 'http://test.local/rpc',
  });

  return createORPCClient(link);
}
