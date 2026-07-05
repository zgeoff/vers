import type { AnyContractRouter } from '@orpc/contract';
import type { Router } from '@orpc/server';
import { RPCHandler } from '@orpc/server/fetch';
import type { HttpHandler } from 'msw';
import { http } from 'msw';
import { RPC_PREFIX } from './rpc-prefix';

export interface BuildMockServiceOptions<
  TContract extends AnyContractRouter,
  TContext extends Record<string, unknown>,
> {
  /** The service's origin, e.g. `http://user.test`; the RPC mount is always `${baseUrl}/rpc`. */
  baseUrl: string;

  /** The contract the router must implement; anchors `router`'s type to the real service shape. */
  contract: TContract;

  /** Builds per-call context (e.g. `actingUserId`) from a request's forwarded headers. */
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Request is a DOM built-in, not declared readonly
  resolveContext: (request: Request) => TContext | Promise<TContext>;

  /** A full `implement(contract)` router; every leaf handled, backend storage is the caller's choice. */
  router: Router<TContract, TContext>;
}

/**
 * Builds MSW handlers that back an entire contract with a caller-supplied router, by wrapping a
 * real `RPCHandler` so requests round-trip oRPC's actual wire protocol instead of a hand-rolled
 * mock. Matches every RPC call under `${baseUrl}/rpc`; a call the router doesn't implement 404s.
 */
export function buildMockService<
  TContract extends AnyContractRouter,
  TContext extends Record<string, unknown>,
>(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- @orpc/server's Router type isn't declared readonly
  options: BuildMockServiceOptions<TContract, TContext>,
): Array<HttpHandler> {
  const rpcHandler = new RPCHandler<TContext>(options.router);

  return [
    http.all(`${options.baseUrl}${RPC_PREFIX}/*`, async (info) => {
      const context = await options.resolveContext(info.request);

      const { matched, response } = await rpcHandler.handle(info.request, {
        context,
        prefix: RPC_PREFIX,
      });

      return matched ? response : new Response(null, { status: 404 });
    }),
  ];
}
