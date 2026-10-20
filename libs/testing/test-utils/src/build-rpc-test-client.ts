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

  const sendRequest = (request: Request): Promise<Response> => Promise.resolve(app.handle(request));

  const link = new RPCLink<Record<string, never>>({
    fetch: sendRequest,
    ...(Object.keys(headers).length > 0 && { headers }),
    url: options?.url ?? 'http://test.local/rpc',
  });

  return createORPCClient(link);
}
