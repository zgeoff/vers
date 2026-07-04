import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import type { ContractRouterClient } from '@orpc/contract';
import { createIsomorphicFn } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';
import type { UserContract } from '@vers/contract-user';

/**
 * Contract-typed oRPC client. During SSR it talks straight to the service (forwarding the
 * caller's session headers); in the browser it goes through this app's /api/rpc proxy route,
 * since the service is not reachable from outside the private network.
 */
export const orpcClient: ContractRouterClient<UserContract> =
  createORPCClient(buildLink());

function buildLink(): RPCLink<Record<never, never>> {
  return createIsomorphicFn()
    .server(
      () =>
        new RPCLink({
          url: `${process.env.SERVICE_URL ?? 'http://localhost:3001'}/rpc`,
          headers: () => pickSessionHeaders(getRequestHeaders()),
        }),
    )
    .client(() => new RPCLink({ url: `${window.location.origin}/api/rpc` }))();
}

const SESSION_HEADER_NAMES = ['authorization', 'cookie'] as const;

function pickSessionHeaders(incoming: Headers): Record<string, string> {
  const picked: Record<string, string> = {};
  for (const name of SESSION_HEADER_NAMES) {
    const value = incoming.get(name);
    if (value !== null) picked[name] = value;
  }
  return picked;
}
